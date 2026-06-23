import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  createClient,
  getCurrentProfile,
  getCurrentUser,
} from "@/infrastructure/supabase/server";
import { createWorkoutRepository } from "@/infrastructure/supabase/repositories";
import { getUserAccess } from "@/server/access";
import { WorkoutGenerator } from "@/components/workouts/workout-generator";
import { WorkoutCard } from "@/components/workouts/workout-card";
import { ActivityTracker } from "@/components/workouts/activity-tracker";
import { LoadBaseWeekButton } from "@/components/workouts/load-base-week";
import { WorkoutDaySummary } from "@/components/workouts/day-summary";
import { LogPastSession } from "@/components/workouts/log-past-session";
import { DayNav } from "@/components/log/day-nav";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "Entrenamiento" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: qd } = await searchParams;
  const today = todayISO();
  const date =
    qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd <= today ? qd : today;
  const isToday = date === today;

  const user = await getCurrentUser();
  const supabase = await createClient();
  const repo = createWorkoutRepository(supabase);

  // Perfil + entrenos del día + rutinas del usuario, en paralelo.
  const [completedDay, scheduledDay, prof, allWorkouts] = await Promise.all([
    repo.completedOn(user!.id, date),
    repo.scheduledOn(user!.id, date),
    getCurrentProfile(),
    repo.list(user!.id, 30),
  ]);
  const routines = allWorkouts.filter((w) => (w.plan?.length ?? 0) > 0);
  // Plantillas de rutina (sin completar) para "traer" a un día pasado.
  const routineTemplates = routines
    .filter((w) => !w.completed_at)
    .map((w) => ({ id: w.id, title: w.title, plan: w.plan }));

  // Secciones de "hoy" (generador, actividad) solo en el día actual
  let dates: string[] = [];
  let aiEnabled = false;
  if (isToday) {
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const [{ access }, completedDates] = await Promise.all([
      getUserAccess(),
      repo.completedDates(user!.id, since),
    ]);
    aiEnabled = access.aiEnabled;
    dates = completedDates;
  }

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-xl font-bold">Entrenamiento</h1>

      <DayNav date={date} today={today} basePath="/plan" />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {isToday ? "Entrenamiento de hoy" : "Lo que entrenaste este día"}
        </h2>
        <WorkoutDaySummary
          completed={completedDay}
          scheduled={scheduledDay}
          weightKg={prof?.current_weight_kg ?? null}
          isToday={isToday}
        />
      </div>

      {isToday ? (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Tu actividad
            </h2>
            <ActivityTracker dates={dates} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Generar rutina
            </h2>
            <WorkoutGenerator aiEnabled={aiEnabled} />
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href="/plan/new">
                <Pencil className="h-4 w-4" /> Crear rutina manual
              </Link>
            </Button>
            {routines.length === 0 && <LoadBaseWeekButton />}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Tus rutinas ({routines.length})
            </h2>
            {routines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Genera tu primera rutina personalizada con IA.
              </p>
            ) : (
              <div className="space-y-3">
                {routines.map((w) => (
                  <WorkoutCard key={w.id} workout={w} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <LogPastSession date={date} routines={routineTemplates} />
      )}
    </div>
  );
}
