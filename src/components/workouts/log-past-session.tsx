"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { logPastWorkout } from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkoutType, WorkoutBlock } from "@/types/database";

const TYPES: WorkoutType[] = ["gym", "hypertrophy", "home", "cardio", "mobility"];

interface ExRow {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  gif_url?: string | null;
  target?: string | null;
}
interface RoutineLite {
  id: string;
  title: string;
  plan: WorkoutBlock[];
}
type SearchResult = {
  name: string;
  gif_url: string;
  target: string;
  equipment: string;
};

/** Registrar lo que se entrenó un día anterior: trae una rutina o búscala. */
export function LogPastSession({
  date,
  routines,
}: {
  date: string;
  routines: RoutineLite[];
}) {
  const router = useRouter();
  const [type, setType] = useState<WorkoutType>("gym");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(45);
  const [exercises, setExercises] = useState<ExRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, start] = useTransition();

  function loadRoutine(r: RoutineLite) {
    const rows: ExRow[] = r.plan.flatMap((b) =>
      b.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: parseInt(/\d+/.exec(e.reps)?.[0] ?? "10", 10) || 10,
        weight: 0,
        gif_url: e.gif_url ?? null,
        target: e.target ?? null,
      })),
    );
    setExercises(rows);
    setTitle(r.title);
    toast.success(`Rutina "${r.title}" cargada`);
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/exercises/search?q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al buscar");
    } finally {
      setSearching(false);
    }
  }

  function addFromSearch(r: SearchResult) {
    setExercises((x) => [
      ...x,
      { name: r.name, sets: 3, reps: 10, weight: 0, gif_url: r.gif_url, target: r.target },
    ]);
    setResults([]);
    setQuery("");
  }
  function addBlank() {
    setExercises((x) => [...x, { name: "", sets: 3, reps: 10, weight: 0 }]);
  }
  function patch(idx: number, p: Partial<ExRow>) {
    setExercises((x) => x.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  }
  function remove(idx: number) {
    setExercises((x) => x.filter((_, i) => i !== idx));
  }

  function log() {
    if (exercises.some((e) => !e.name.trim())) {
      toast.error("Hay ejercicios sin nombre. Complétalos o quítalos.");
      return;
    }
    start(async () => {
      const res = await logPastWorkout({
        type,
        dateISO: date,
        durationMin: duration,
        title: title.trim() || undefined,
        exercises: exercises.filter((e) => e.name.trim()),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("¡Entreno registrado! 💪");
      router.refresh();
    });
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Registrar lo que entrenaste</h2>
        </div>

        {/* Traer una rutina guardada */}
        {routines.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Traer una rutina guardada
            </p>
            <div className="flex flex-wrap gap-1.5">
              {routines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRoutine(r)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-primary/60 hover:text-primary"
                >
                  {r.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tipo + nombre + duración */}
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs",
                type === t
                  ? "border-primary bg-primary/10 font-semibold"
                  : "border-border text-muted-foreground",
              )}
            >
              {WORKOUT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre (ej: Pierna, Pecho…)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base"
          />
          <span className="text-xs text-muted-foreground">Duración</span>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-center text-base"
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>

        {/* Ejercicios */}
        {exercises.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase text-muted-foreground">
              <span className="flex-1">Ejercicio</span>
              <span className="w-12 text-center">Series</span>
              <span className="w-12 text-center">Reps</span>
              <span className="w-14 text-center">Kg</span>
              <span className="w-5" />
            </div>
            {exercises.map((e, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  value={e.name}
                  onChange={(ev) => patch(idx, { name: ev.target.value })}
                  placeholder="Ej: Sentadilla"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-base"
                />
                <input
                  type="number"
                  value={e.sets}
                  onChange={(ev) => patch(idx, { sets: Number(ev.target.value) })}
                  className="h-9 w-12 rounded-lg border border-input bg-background px-1 text-center text-base"
                />
                <input
                  type="number"
                  value={e.reps}
                  onChange={(ev) => patch(idx, { reps: Number(ev.target.value) })}
                  className="h-9 w-12 rounded-lg border border-input bg-background px-1 text-center text-base"
                />
                <input
                  type="number"
                  value={e.weight}
                  onChange={(ev) => patch(idx, { weight: Number(ev.target.value) })}
                  className="h-9 w-14 rounded-lg border border-input bg-background px-1 text-center text-base"
                />
                <button
                  onClick={() => remove(idx)}
                  aria-label="Quitar"
                  className="w-5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Buscar ejercicio en el catálogo */}
        <div className="space-y-2 rounded-xl border border-dashed border-border p-2.5">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Buscar ejercicio (sentadilla, press…)"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base"
            />
            <Button size="sm" variant="secondary" className="h-9" onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={addBlank}>
              <Plus className="h-4 w-4" /> Manual
            </Button>
          </div>
          {results.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => addFromSearch(r)}
                  className="flex w-full items-center gap-2 rounded-lg bg-secondary/40 p-1.5 text-left hover:bg-secondary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/exercise-gif?u=${encodeURIComponent(r.gif_url)}`}
                    alt={r.name}
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium capitalize">{r.name}</p>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">
                      {r.target} · {r.equipment}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full" onClick={log} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Dumbbell className="h-4 w-4" />
          )}
          Registrar entreno
        </Button>
      </CardContent>
    </Card>
  );
}
