"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Dumbbell,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  completeWorkout,
  deleteWorkout,
  scheduleWorkout,
} from "@/server/actions/workouts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Workout } from "@/core/domain/entities";

export function WorkoutCard({ workout }: { workout: Workout }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState(workout.scheduled_for ?? "");
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [scheduling, startSchedule] = useTransition();
  const [done, setDone] = useState<Set<string>>(new Set());

  const completed = Boolean(workout.completed_at);
  const storageKey = `nutriai-wk-${workout.id}`;
  const total = workout.plan.reduce((n, b) => n + b.exercises.length, 0);
  const doneCount = done.size;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Cargar progreso guardado
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function persist(next: Set<string>) {
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function toggle(key: string) {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    persist(next);

    if (next.size === total && total > 0 && !completed) {
      start(async () => {
        await completeWorkout(workout.id);
        toast.success("¡Rutina completada al 100%! 🎉");
        router.refresh();
      });
    }
  }

  function confirmDelete() {
    startDelete(async () => {
      await deleteWorkout(workout.id);
      toast.success("Rutina eliminada");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  function saveSchedule(clear = false) {
    startSchedule(async () => {
      const res = await scheduleWorkout(
        workout.id,
        clear ? null : schedDate || null,
      );
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success(clear ? "Fecha quitada" : "Rutina programada 📅");
      setScheduleOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className={cn(completed && "border-primary/40")}>
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
                {completed && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                )}
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
                {workout.scheduled_for && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(
                      `${workout.scheduled_for}T00:00:00`,
                    ).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                    })}
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
            onClick={() => setScheduleOpen(true)}
            aria-label="Programar rutina"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <Link
            href={`/plan/${workout.id}/edit`}
            aria-label="Editar rutina"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label="Eliminar rutina"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de progreso (siempre visible) */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-semibold">
                {doneCount}/{total} ejercicios
              </span>
            </div>
            <Progress value={pct} className="mt-1 h-2" />
          </div>
        )}

        {open && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {workout.plan.map((block, i) => (
              <div key={i}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {block.block}
                </p>
                <div className="space-y-2">
                  {block.exercises.map((ex, j) => {
                    const key = `${i}-${j}`;
                    const isDone = done.has(key);
                    return (
                      <button
                        key={j}
                        onClick={() => toggle(key)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                          isDone
                            ? "bg-primary/15 ring-1 ring-primary/40"
                            : "bg-secondary/40",
                        )}
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
                          <p
                            className={cn(
                              "truncate text-sm font-semibold capitalize",
                              isDone && "text-primary",
                            )}
                          >
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
                        {isDone ? (
                          <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {pct === 100 ? (
              <p className="rounded-xl bg-primary/15 py-2 text-center text-sm font-semibold text-primary">
                {pending ? "Guardando…" : "¡Completada al 100%! 🎉"}
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Toca cada ejercicio al terminarlo para llegar al 100%.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmación de borrado (con los colores de la app) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Eliminar rutina</DialogTitle>
            <DialogDescription className="text-center">
              ¿Seguro que quieres eliminar <b>{workout.title}</b>? Esta acción no
              se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Programar rutina en una fecha */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Programar rutina</DialogTitle>
            <DialogDescription className="text-center">
              Elige el día para hacer <b>{workout.title}</b>.
            </DialogDescription>
          </DialogHeader>
          <input
            type="date"
            value={schedDate}
            onChange={(e) => setSchedDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-secondary/40 px-3 text-sm"
          />
          <div className="flex gap-2">
            {workout.scheduled_for && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => saveSchedule(true)}
                disabled={scheduling}
              >
                Quitar
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => saveSchedule(false)}
              disabled={scheduling || !schedDate}
            >
              {scheduling && <Loader2 className="h-4 w-4 animate-spin" />}
              Programar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
