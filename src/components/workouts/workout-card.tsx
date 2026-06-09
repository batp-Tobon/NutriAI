"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Clock, Dumbbell, Trash2 } from "lucide-react";
import { completeWorkout, deleteWorkout } from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Workout } from "@/core/domain/entities";

export function WorkoutCard({ workout }: { workout: Workout }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const completed = Boolean(workout.completed_at);

  function complete() {
    start(async () => {
      await completeWorkout(workout.id);
      toast.success("¡Entrenamiento completado!");
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm("¿Eliminar esta rutina?")) return;
    startDelete(async () => {
      await deleteWorkout(workout.id);
      toast.success("Rutina eliminada");
      router.refresh();
    });
  }

  return (
    <Card className={cn(completed && "opacity-70")}>
      <CardContent className="pt-5">
        <div className="flex items-start gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <h3 className="truncate font-semibold">{workout.title}</h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {WORKOUT_TYPE_LABELS[workout.workout_type]}
              </Badge>
              {workout.duration_min && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {workout.duration_min} min
                </span>
              )}
              {workout.difficulty && (
                <span className="text-xs text-muted-foreground">
                  {workout.difficulty}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            aria-label="Eliminar rutina"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {workout.plan.map((block, i) => (
              <div key={i}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {block.block}
                </p>
                <div className="space-y-2">
                  {block.exercises.map((ex, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 rounded-xl bg-secondary/40 p-2"
                    >
                      {ex.gif_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/exercise-gif?u=${encodeURIComponent(ex.gif_url)}`}
                          alt={ex.name}
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-lg bg-white object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                          <Dumbbell className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold capitalize">
                          {ex.name}
                        </p>
                        {ex.target && (
                          <p className="truncate text-xs capitalize text-muted-foreground">
                            🎯 {ex.target}
                          </p>
                        )}
                        <p className="text-xs font-medium text-primary">
                          {ex.sets} series × {ex.reps}
                          {ex.rest_sec ? ` · ${ex.rest_sec}s desc.` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!completed && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={complete}
                disabled={pending}
              >
                <Check className="h-4 w-4" /> Marcar como completada
              </Button>
            )}
            {completed && (
              <p className="text-center text-xs text-primary">
                ✓ Completada
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
