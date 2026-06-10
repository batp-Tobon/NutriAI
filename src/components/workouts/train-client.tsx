"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  SkipForward,
  Trophy,
  X,
} from "lucide-react";
import { completeWorkout } from "@/server/actions/workouts";
import { caloriesBurned } from "@/core/application/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Workout } from "@/core/domain/entities";

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

export function TrainClient({
  workout,
  weightKg,
}: {
  workout: Workout;
  weightKg: number | null;
}) {
  const router = useRouter();
  const storageKey = `nutriai-train-${workout.id}`;

  const exercises = useMemo(
    () =>
      workout.plan.flatMap((b, bi) =>
        b.exercises.map((ex, ei) => ({
          ...ex,
          key: `${bi}-${ei}`,
          blockName: b.block,
        })),
      ),
    [workout.plan],
  );
  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
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

  // Cargar/iniciar sesión persistida (sobrevive a recargas)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw) as {
          startedAt?: number;
          done?: Record<string, number>;
        };
        setStartedAt(p.startedAt ?? Date.now());
        setDone(p.done ?? {});
        return;
      }
    } catch {
      /* ignore */
    }
    const now = Date.now();
    setStartedAt(now);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ startedAt: now, done: {} }),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey]);

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

  const doneTotal = exercises.reduce(
    (s, e) => s + Math.min(done[e.key] ?? 0, e.sets),
    0,
  );
  const pct = totalSets > 0 ? Math.round((doneTotal / totalSets) * 100) : 0;
  const kcal = caloriesBurned(
    workout.workout_type,
    Math.max(1, Math.round(elapsed / 60)),
    weightKg,
  );
  const allDone = totalSets > 0 && doneTotal >= totalSets;

  function persist(next: Record<string, number>) {
    setDone(next);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ startedAt, done: next }),
      );
    } catch {
      /* ignore */
    }
  }

  function tapSet(
    exKey: string,
    idx: number,
    ex: { sets: number; rest_sec: number; name: string },
  ) {
    const cur = done[exKey] ?? 0;
    const next = idx < cur ? idx : idx + 1;
    persist({ ...done, [exKey]: next });
    // Solo inicia descanso al COMPLETAR una serie (no al deshacer)
    if (next > cur && ex.rest_sec > 0 && !(next >= ex.sets && allDoneAfter(exKey, next))) {
      setRest({ left: ex.rest_sec, total: ex.rest_sec, name: ex.name });
    }
  }

  function allDoneAfter(exKey: string, value: number): boolean {
    return (
      exercises.reduce(
        (s, e) => s + Math.min(e.key === exKey ? value : (done[e.key] ?? 0), e.sets),
        0,
      ) >= totalSets
    );
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
      {workout.plan.map((block, bi) => (
        <div key={bi}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            {block.block}
          </p>
          <div className="space-y-2">
            {block.exercises.map((ex, ei) => {
              const key = `${bi}-${ei}`;
              const cur = done[key] ?? 0;
              const complete = cur >= ex.sets;
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
                          {ex.sets} × {ex.reps}
                          {ex.rest_sec ? ` · descanso ${ex.rest_sec}s` : ""}
                        </p>
                      </div>
                      {complete && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      )}
                    </div>

                    {/* Burbujas de series */}
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: ex.sets }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => tapSet(key, i, ex)}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all",
                            i < cur
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

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
