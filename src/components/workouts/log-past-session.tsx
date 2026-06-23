"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import { logPastWorkout } from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkoutType } from "@/types/database";

const TYPES: WorkoutType[] = ["gym", "hypertrophy", "home", "cardio", "mobility"];

interface ExRow {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

/** Registrar lo que se entrenó en un día anterior, con sus ejercicios. */
export function LogPastSession({ date }: { date: string }) {
  const router = useRouter();
  const [type, setType] = useState<WorkoutType>("gym");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(45);
  const [exercises, setExercises] = useState<ExRow[]>([]);
  const [pending, start] = useTransition();

  function addRow() {
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
        <p className="text-xs text-muted-foreground">
          Anota el tipo, y si quieres, los ejercicios que hiciste (cuenta para
          tus pesos y récords).
        </p>

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

        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir ejercicio
        </button>

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
