import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { caloriesBurned } from "@/core/application/nutrition";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import type { Workout } from "@/core/domain/entities";

/** Resumen del entrenamiento de un día: qué se hizo, ejercicios y calorías. */
export function WorkoutDaySummary({
  completed,
  scheduled,
  weightKg,
  isToday,
}: {
  completed: Workout[];
  scheduled: Workout[];
  weightKg: number | null;
  isToday: boolean;
}) {
  const completedIds = new Set(completed.map((w) => w.id));
  const pending = scheduled.filter((w) => !completedIds.has(w.id));
  const totalBurned = completed.reduce(
    (s, w) => s + caloriesBurned(w.workout_type, w.duration_min, weightKg),
    0,
  );

  if (completed.length === 0 && pending.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        {isToday
          ? "Aún no has entrenado hoy. ¡Dale! 💪"
          : "No entrenaste este día."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Encabezado con total quemado */}
      {completed.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold">
            {completed.length}{" "}
            {completed.length === 1 ? "sesión completada" : "sesiones completadas"}{" "}
            ✅
          </p>
          {totalBurned > 0 && (
            <span className="flex items-center gap-1 text-sm font-bold text-primary">
              <Flame className="h-4 w-4" /> ~{totalBurned} kcal
            </span>
          )}
        </div>
      )}

      {/* Sesiones completadas con su detalle */}
      {completed.map((w) => {
        const burned = caloriesBurned(w.workout_type, w.duration_min, weightKg);
        const hasPlan = (w.plan?.length ?? 0) > 0;
        return (
          <Card key={w.id} className="border-primary/30">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <h3 className="truncate font-semibold">{w.title}</h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {WORKOUT_TYPE_LABELS[w.workout_type]}
                    </Badge>
                    {w.duration_min && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {w.duration_min} min
                      </span>
                    )}
                    {burned > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Flame className="h-3 w-3" /> ~{burned} kcal
                      </span>
                    )}
                  </div>
                </div>
                {w.completed_at && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(w.completed_at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>

              {hasPlan ? (
                <div className="space-y-3">
                  {w.plan.map((block, i) => (
                    <div key={i}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {block.block}
                      </p>
                      <div className="space-y-1.5">
                        {block.exercises.map((ex, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-2.5 rounded-xl bg-secondary/40 p-2"
                          >
                            {ex.gif_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/exercise-gif?u=${encodeURIComponent(ex.gif_url)}`}
                                alt={ex.name}
                                loading="lazy"
                                className="h-11 w-11 shrink-0 rounded-lg bg-white object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                                <Dumbbell className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium capitalize">
                                {ex.name}
                              </p>
                              {ex.target && (
                                <p className="truncate text-xs capitalize text-muted-foreground">
                                  🎯 {ex.target}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {ex.sets}×{ex.reps}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sesión rápida registrada (sin detalle de ejercicios).
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Programadas para ese día y no completadas */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Programadas para este día
          </h3>
          {pending.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.title}</p>
                <p className="text-xs text-muted-foreground">
                  {WORKOUT_TYPE_LABELS[w.workout_type]}
                  {w.duration_min ? ` · ${w.duration_min} min` : ""}
                </p>
              </div>
              <Badge variant={isToday ? "default" : "destructive"}>
                {isToday ? "Pendiente" : "No realizada"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
