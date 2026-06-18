"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  Minus,
  Plus,
  Repeat2,
  Search,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  addExerciseToWorkout,
  completeWorkout,
  removeExercise,
  swapExercise,
} from "@/server/actions/workouts";
import { deleteSetLog, logSet } from "@/server/actions/sets";
import { caloriesBurned } from "@/core/application/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Workout } from "@/core/domain/entities";

export interface ExerciseStats {
  last: number | null;
  max: number | null;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Beep + vibración al terminar el descanso. */
function notifyRestEnd() {
  try {
    navigator.vibrate?.([200, 120, 200]);
  } catch {
    /* no soportado */
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch {
    /* sin audio */
  }
}

type SwapResult = {
  name: string;
  gif_url: string;
  target: string;
  equipment: string;
};

/** Comprime una foto en el dispositivo a JPEG (evita subir imágenes enormes). */
async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("No se pudo leer la imagen"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Imagen inválida"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function TrainClient({
  workout,
  weightKg,
  stats,
}: {
  workout: Workout;
  weightKg: number | null;
  stats: Record<string, ExerciseStats>;
}) {
  const router = useRouter();
  const storageKey = `nutriai-train-${workout.id}`;

  const exercises = useMemo(
    () =>
      workout.plan.flatMap((b, bi) =>
        b.exercises.map((ex, ei) => ({
          ...ex,
          bi,
          ei,
          key: `${bi}-${ei}`,
          nameKey: ex.name.trim().toLowerCase(),
        })),
      ),
    [workout.plan],
  );

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  // Peso/reps POR SERIE (clave `${exKey}:${serie}`) — cada serie guarda lo suyo
  const [setW, setSetW] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    for (const e of exercises) {
      const last = stats[e.nameKey]?.last;
      for (let i = 0; i < e.sets; i++)
        w[`${e.key}:${i}`] = last != null ? String(last) : "";
    }
    return w;
  });
  const [setR, setSetR] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const e of exercises) {
      const m = /\d+/.exec(e.reps);
      for (let i = 0; i < e.sets; i++) r[`${e.key}:${i}`] = m ? m[0] : "";
    }
    return r;
  });
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [logIds, setLogIds] = useState<Record<string, string>>({});
  const [bestMax, setBestMax] = useState<Record<string, number>>(() => {
    const b: Record<string, number> = {};
    for (const e of exercises) {
      const mx = stats[e.nameKey]?.max;
      if (mx != null && mx > 0) b[e.nameKey] = mx;
    }
    return b;
  });
  const [rest, setRest] = useState<{
    left: number;
    total: number;
    name: string;
  } | null>(null);
  const [finished, setFinished] = useState<{
    time: number;
    kcal: number;
    sets: number;
  } | null>(null);
  const [saving, startSave] = useTransition();

  // Selector de ejercicio: reemplazar uno (swap) o añadir uno nuevo (add).
  const [picker, setPicker] = useState<
    { mode: "swap"; bi: number; ei: number; name: string } | { mode: "add" } | null
  >(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapResults, setSwapResults] = useState<SwapResult[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapping, startSwap] = useTransition();
  const [identifying, setIdentifying] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);

  // Cargar/iniciar sesión persistida (sobrevive a recargas)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw) as {
          v?: number;
          startedAt?: number;
          doneMap?: Record<string, boolean>;
          setW?: Record<string, string>;
          setR?: Record<string, string>;
          extra?: Record<string, number>;
          logIds?: Record<string, string>;
        };
        if (p.v === 2) {
          setStartedAt(p.startedAt ?? Date.now());
          setDoneMap(p.doneMap ?? {});
          if (p.setW) setSetW((w) => ({ ...w, ...p.setW }));
          if (p.setR) setSetR((r) => ({ ...r, ...p.setR }));
          if (p.extra) setExtra(p.extra);
          if (p.logIds) setLogIds(p.logIds);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setStartedAt(Date.now());
  }, [storageKey]);

  function persistAll(over: {
    doneMap?: Record<string, boolean>;
    setW?: Record<string, string>;
    setR?: Record<string, string>;
    extra?: Record<string, number>;
    logIds?: Record<string, string>;
  }) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          v: 2,
          startedAt,
          doneMap: over.doneMap ?? doneMap,
          setW: over.setW ?? setW,
          setR: over.setR ?? setR,
          extra: over.extra ?? extra,
          logIds: over.logIds ?? logIds,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  // Cronómetro de sesión
  useEffect(() => {
    if (!startedAt || finished) return;
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt, finished]);

  // Cuenta regresiva de descanso
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      notifyRestEnd();
      toast.success("¡Descanso terminado! Siguiente serie 💪");
      setRest(null);
      return;
    }
    const t = setTimeout(
      () => setRest((r) => (r ? { ...r, left: r.left - 1 } : r)),
      1000,
    );
    return () => clearTimeout(t);
  }, [rest]);

  // Mantener la pantalla encendida durante el entrenamiento
  useEffect(() => {
    let lock: { release?: () => Promise<void> } | undefined;
    (async () => {
      try {
        lock = await (
          navigator as unknown as {
            wakeLock?: { request: (t: string) => Promise<typeof lock> };
          }
        ).wakeLock?.request("screen");
      } catch {
        /* no soportado */
      }
    })();
    return () => {
      try {
        lock?.release?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const setsOf = (e: (typeof exercises)[number]) =>
    Math.max(1, e.sets + (extra[e.key] ?? 0));
  const totalSets = exercises.reduce((s, e) => s + setsOf(e), 0);
  const doneTotal = exercises.reduce((s, e) => {
    let c = 0;
    for (let i = 0; i < setsOf(e); i++) if (doneMap[`${e.key}:${i}`]) c++;
    return s + c;
  }, 0);
  const pct = totalSets > 0 ? Math.round((doneTotal / totalSets) * 100) : 0;
  const kcal = caloriesBurned(
    workout.workout_type,
    Math.max(1, Math.round(elapsed / 60)),
    weightKg,
  );
  const allDone = totalSets > 0 && doneTotal >= totalSets;

  function toggleSet(e: (typeof exercises)[number], i: number) {
    const k = `${e.key}:${i}`;
    if (doneMap[k]) {
      // Deshacer: quitar marca y borrar el registro de esa serie
      const nd = { ...doneMap, [k]: false };
      setDoneMap(nd);
      const id = logIds[k];
      const nl = { ...logIds };
      if (id) {
        void deleteSetLog(id);
        delete nl[k];
        setLogIds(nl);
      }
      persistAll({ doneMap: nd, logIds: nl });
      return;
    }

    // Completar la serie con SU peso/reps
    const nd = { ...doneMap, [k]: true };
    setDoneMap(nd);
    persistAll({ doneMap: nd });

    const w = parseFloat((setW[k] ?? "").replace(",", ".")) || 0;
    const r = parseInt(setR[k] ?? "", 10) || 0;
    void logSet({
      workoutId: workout.id,
      exerciseName: e.name,
      setNumber: i + 1,
      weightKg: w,
      reps: r,
    }).then((res) => {
      if (!res.ok || !res.id) return;
      setLogIds((prev) => {
        const n = { ...prev, [k]: res.id! };
        persistAll({ logIds: n });
        return n;
      });
      if (res.isPR) {
        toast.success(`🏆 ¡Nuevo récord! ${e.name}: ${w} kg`, {
          duration: 4000,
        });
        try {
          navigator.vibrate?.([100, 60, 100, 60, 200]);
        } catch {
          /* ignore */
        }
        setBestMax((b) => ({ ...b, [e.nameKey]: w }));
      }
    });

    // Descanso si aún quedan series por hacer
    const willBeDone = doneTotal + 1;
    if (e.rest_sec > 0 && willBeDone < totalSets) {
      setRest({ left: e.rest_sec, total: e.rest_sec, name: e.name });
    }
  }

  function addSet(e: (typeof exercises)[number]) {
    const count = setsOf(e);
    const ne = { ...extra, [e.key]: (extra[e.key] ?? 0) + 1 };
    // La serie nueva hereda el peso/reps de la última
    const prevK = `${e.key}:${count - 1}`;
    const newK = `${e.key}:${count}`;
    const nw = { ...setW, [newK]: setW[prevK] ?? "" };
    const nr = { ...setR, [newK]: setR[prevK] ?? "" };
    setExtra(ne);
    setSetW(nw);
    setSetR(nr);
    persistAll({ extra: ne, setW: nw, setR: nr });
  }

  function removeSet(e: (typeof exercises)[number]) {
    const count = setsOf(e);
    if (count <= 1) return;
    const lastK = `${e.key}:${count - 1}`;
    if (doneMap[lastK]) {
      toast.error("Esa serie ya está hecha; desmárcala primero.");
      return;
    }
    const ne = { ...extra, [e.key]: (extra[e.key] ?? 0) - 1 };
    setExtra(ne);
    persistAll({ extra: ne });
  }

  async function runSwapSearch() {
    if (!swapQuery.trim()) return;
    setSwapLoading(true);
    try {
      const res = await fetch(
        `/api/exercises/search?q=${encodeURIComponent(swapQuery)}`,
      );
      const data = await res.json();
      setSwapResults(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al buscar");
    } finally {
      setSwapLoading(false);
    }
  }

  async function identifyFromPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setIdentifying(true);
    try {
      const imageDataUrl = await compressImage(f);
      const res = await fetch("/api/exercises/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const text = await res.text();
      let data: {
        name?: string;
        target?: string;
        equipment?: string;
        gif_url?: string;
        error?: string;
      };
      try {
        data = JSON.parse(text);
      } catch {
        toast.error(
          res.status === 413
            ? "La foto es muy grande. Intenta con otra."
            : "No se pudo identificar. Intenta de nuevo.",
        );
        return;
      }
      if (!res.ok || !data.name) {
        toast.error(data.error ?? "No se pudo identificar el ejercicio.");
        return;
      }
      // Mostrar lo identificado arriba (el usuario confirma o ajusta)
      setSwapResults([
        {
          name: data.name,
          gif_url: data.gif_url ?? "",
          target: data.target ?? "",
          equipment: data.equipment ?? "",
        },
      ]);
      setSwapQuery(data.name);
      toast.success(`Identificado: ${data.name}`);
    } catch {
      toast.error("Error al procesar la foto.");
    } finally {
      setIdentifying(false);
    }
  }

  function closePicker() {
    setPicker(null);
    setSwapQuery("");
    setSwapResults([]);
  }

  function applyPick(repl: { name: string; gif_url?: string; target?: string }) {
    if (!picker) return;
    startSwap(async () => {
      if (picker.mode === "swap") {
        const res = await swapExercise(workout.id, picker.bi, picker.ei, repl);
        if (!res.ok) {
          toast.error(res.error ?? "Error");
          return;
        }
        toast.success(`Ejercicio cambiado a ${repl.name}`);
      } else {
        const res = await addExerciseToWorkout(workout.id, repl);
        if (!res.ok) {
          toast.error(res.error ?? "Error");
          return;
        }
        toast.success(`Añadido: ${repl.name}`);
      }
      closePicker();
      router.refresh();
    });
  }

  /**
   * Quita un ejercicio durante la sesión y RE-INDEXA el estado local (peso/reps/
   * marcas) de los ejercicios que estaban después en el mismo bloque, para que
   * no se desalineen al correrse los índices.
   */
  function removeExerciseLocal(e: (typeof exercises)[number]) {
    const { bi, ei } = e;
    // Borra de la BD las series ya registradas de este ejercicio.
    for (let i = 0; i < setsOf(e); i++) {
      const id = logIds[`${e.key}:${i}`];
      if (id) void deleteSetLog(id);
    }

    const shift = <T,>(map: Record<string, T>): Record<string, T> => {
      const out: Record<string, T> = {};
      for (const [key, val] of Object.entries(map)) {
        const m = /^(\d+)-(\d+)(:.*)?$/.exec(key);
        if (!m) {
          out[key] = val;
          continue;
        }
        const kbi = Number(m[1]);
        const kei = Number(m[2]);
        const rest = m[3] ?? "";
        if (kbi !== bi) {
          out[key] = val;
          continue;
        }
        if (kei === ei) continue; // descarta el eliminado
        out[`${bi}-${kei > ei ? kei - 1 : kei}${rest}`] = val;
      }
      return out;
    };

    const nW = shift(setW);
    const nR = shift(setR);
    const nDone = shift(doneMap);
    const nExtra = shift(extra);
    const nLog = shift(logIds);
    setSetW(nW);
    setSetR(nR);
    setDoneMap(nDone);
    setExtra(nExtra);
    setLogIds(nLog);
    persistAll({
      doneMap: nDone,
      setW: nW,
      setR: nR,
      extra: nExtra,
      logIds: nLog,
    });

    startSwap(async () => {
      const res = await removeExercise(workout.id, bi, ei);
      if (!res.ok) {
        toast.error(res.error ?? "Error al eliminar");
        return;
      }
      toast.success(`Eliminado: ${e.name}`);
      router.refresh();
    });
  }

  function finish() {
    startSave(async () => {
      await completeWorkout(workout.id);
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`nutriai-wk-${workout.id}`);
      } catch {
        /* ignore */
      }
      setRest(null);
      setFinished({ time: elapsed, kcal, sets: doneTotal });
      router.refresh();
    });
  }

  // ------- Pantalla de resumen final -------
  if (finished) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 py-6 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary glow-primary">
          <Trophy className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-extrabold">¡Entrenamiento completado!</h1>
        <p className="text-sm text-muted-foreground">{workout.title}</p>

        <div className="grid w-full max-w-xs grid-cols-3 gap-3">
          <Stat label="Tiempo" value={fmt(finished.time)} />
          <Stat label="Kcal" value={`~${finished.kcal}`} accent />
          <Stat label="Series" value={`${finished.sets}/${totalSets}`} />
        </div>

        <Button asChild className="mt-2 w-full max-w-xs">
          <Link href="/plan">Volver a Entreno</Link>
        </Button>
      </div>
    );
  }

  // ------- Modo entrenamiento -------
  return (
    <div className="space-y-4 py-2 pb-44">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{workout.title}</h1>
          <p className="text-xs text-muted-foreground">Modo entrenamiento</p>
        </div>
        <Link
          href="/plan"
          aria-label="Salir"
          className="shrink-0 rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      {/* Stats en vivo */}
      <Card className="border-primary/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-2xl font-extrabold tabular-nums">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {fmt(elapsed)}
              </p>
              <p className="text-[11px] text-muted-foreground">Tiempo</p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 text-2xl font-extrabold text-primary">
                <Flame className="h-4 w-4" />~{kcal}
              </p>
              <p className="text-[11px] text-muted-foreground">Kcal</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums">
                {doneTotal}/{totalSets}
              </p>
              <p className="text-[11px] text-muted-foreground">Series</p>
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
        </CardContent>
      </Card>

      {/* Ejercicios */}
      {workout.plan.map((block, bi) =>
        block.exercises.length === 0 ? null : (
        <div key={bi}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            {block.block}
          </p>
          <div className="space-y-2">
            {block.exercises.map((ex, ei) => {
              const e = exercises.find((x) => x.bi === bi && x.ei === ei)!;
              const count = setsOf(e);
              let doneCount = 0;
              for (let i = 0; i < count; i++)
                if (doneMap[`${e.key}:${i}`]) doneCount++;
              const complete = doneCount >= count;
              const best = bestMax[e.nameKey];

              return (
                <Card
                  key={ei}
                  className={cn(complete && "border-primary/40 bg-primary/5")}
                >
                  <CardContent className="space-y-2.5 p-3">
                    <div className="flex items-center gap-3">
                      {ex.gif_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/exercise-gif?u=${encodeURIComponent(ex.gif_url)}`}
                          alt={ex.name}
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-lg bg-white object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                          <Dumbbell className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-semibold capitalize",
                            complete && "text-primary",
                          )}
                        >
                          {ex.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count} × {ex.reps}
                          {ex.rest_sec ? ` · descanso ${ex.rest_sec}s` : ""}
                          {best != null && best > 0 ? ` · 🏆 ${best} kg` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <button
                          onClick={() => {
                            setPicker({ mode: "swap", bi, ei, name: ex.name });
                            setSwapQuery("");
                            setSwapResults([]);
                          }}
                          aria-label="Cambiar ejercicio"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Repeat2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeExerciseLocal(e)}
                          disabled={swapping}
                          aria-label="Eliminar ejercicio"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Filas por serie: cada una con SU peso y reps */}
                    <div className="space-y-1.5">
                      {Array.from({ length: count }, (_, i) => {
                        const k = `${e.key}:${i}`;
                        const isDone = Boolean(doneMap[k]);
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-2 py-1.5",
                              isDone ? "bg-primary/15" : "bg-secondary/40",
                            )}
                          >
                            <span
                              className={cn(
                                "w-6 shrink-0 text-center text-xs font-bold",
                                isDone ? "text-primary" : "text-muted-foreground",
                              )}
                            >
                              {i + 1}
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={setW[k] ?? ""}
                              disabled={isDone}
                              onChange={(ev) => {
                                const n = { ...setW, [k]: ev.target.value };
                                setSetW(n);
                                persistAll({ setW: n });
                              }}
                              placeholder="kg"
                              className="h-9 w-16 rounded-lg border border-input bg-background px-1 text-center text-base font-semibold disabled:opacity-70"
                            />
                            <span className="text-[11px] text-muted-foreground">
                              kg
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={setR[k] ?? ""}
                              disabled={isDone}
                              onChange={(ev) => {
                                const n = { ...setR, [k]: ev.target.value };
                                setSetR(n);
                                persistAll({ setR: n });
                              }}
                              placeholder="reps"
                              className="h-9 w-14 rounded-lg border border-input bg-background px-1 text-center text-base font-semibold disabled:opacity-70"
                            />
                            <span className="text-[11px] text-muted-foreground">
                              reps
                            </span>
                            <button
                              onClick={() => toggleSet(e, i)}
                              aria-label={isDone ? "Desmarcar serie" : "Completar serie"}
                              className={cn(
                                "ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all",
                                isDone
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/60",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Añadir / quitar series */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => addSet(e)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" /> serie
                      </button>
                      {count > 1 && (
                        <button
                          onClick={() => removeSet(e)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive"
                        >
                          <Minus className="h-3.5 w-3.5" /> serie
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Añadir un ejercicio nuevo durante la sesión */}
      <button
        onClick={() => {
          setPicker({ mode: "add" });
          setSwapQuery("");
          setSwapResults([]);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Añadir ejercicio
      </button>

      {/* Finalizar */}
      <Button
        className="w-full"
        variant={allDone ? "default" : "secondary"}
        onClick={finish}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trophy className="h-4 w-4" />
        )}
        {allDone ? "Finalizar entrenamiento 🎉" : "Terminar antes de tiempo"}
      </Button>

      {/* Temporizador de descanso (flotante) */}
      {rest && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-4 animate-fade-in">
          <div className="rounded-2xl border border-primary/40 bg-card p-4 shadow-lg glow-primary">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Descanso</p>
                <p className="text-3xl font-extrabold tabular-nums text-primary">
                  {fmt(rest.left)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setRest((r) =>
                      r ? { ...r, left: r.left + 15, total: r.total + 15 } : r,
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  15s
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRest(null)}>
                  <SkipForward className="h-4 w-4" /> Saltar
                </Button>
              </div>
            </div>
            <Progress
              value={rest.total > 0 ? (rest.left / rest.total) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </div>
        </div>
      )}

      {/* Cambiar / añadir ejercicio en caliente */}
      <Dialog
        open={picker !== null}
        onOpenChange={(o) => {
          if (!o) closePicker();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {picker?.mode === "add" ? "Añadir ejercicio" : "Cambiar ejercicio"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {picker?.mode === "add" ? (
              "Búscalo, tómale foto a la máquina o escribe su nombre. Se añade al final."
            ) : (
              <>
                Reemplaza{" "}
                <b className="capitalize">
                  {picker?.mode === "swap" ? picker.name : ""}
                </b>{" "}
                por otro (se actualiza la rutina).
              </>
            )}
          </p>

          {/* Identificar con foto de la máquina */}
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={identifyFromPhoto}
          />
          <Button
            variant="default"
            className="w-full"
            onClick={() => camRef.current?.click()}
            disabled={identifying}
          >
            {identifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Identificando…
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" /> Tomar foto de la máquina
                <Sparkles className="h-3.5 w-3.5 opacity-80" />
              </>
            )}
          </Button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o busca por nombre
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              value={swapQuery}
              onChange={(ev) => setSwapQuery(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && runSwapSearch()}
              placeholder="Ej: press inclinado mancuerna…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-secondary/40 px-3 text-base"
            />
            <Button
              variant="secondary"
              onClick={runSwapSearch}
              disabled={swapLoading}
            >
              {swapLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {swapResults.map((r, i) => (
              <button
                key={i}
                onClick={() =>
                  applyPick({ name: r.name, gif_url: r.gif_url, target: r.target })
                }
                disabled={swapping}
                className="flex w-full items-center gap-3 rounded-xl bg-secondary/40 p-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/exercise-gif?u=${encodeURIComponent(r.gif_url)}`}
                  alt={r.name}
                  loading="lazy"
                  className="h-11 w-11 shrink-0 rounded-lg bg-white object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {r.name}
                  </p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {r.target} · {r.equipment}
                  </p>
                </div>
              </button>
            ))}
            {swapQuery.trim() && (
              <button
                onClick={() => applyPick({ name: swapQuery.trim() })}
                disabled={swapping}
                className="w-full rounded-xl border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Usar «{swapQuery.trim()}» como nombre (sin imagen)
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p
        className={cn(
          "text-lg font-extrabold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
