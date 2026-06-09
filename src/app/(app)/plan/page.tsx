import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createWorkoutRepository } from "@/infrastructure/supabase/repositories";
import { WorkoutGenerator } from "@/components/workouts/workout-generator";
import { WorkoutCard } from "@/components/workouts/workout-card";
import { ActivityTracker } from "@/components/workouts/activity-tracker";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Entrenamiento" };

export default async function PlanPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const repo = createWorkoutRepository(supabase);

  const workouts = await repo.list(user!.id, 30);
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const dates = await repo.completedDates(user!.id, since);

  // Sólo rutinas reales (con ejercicios); las sesiones rápidas van al calendario.
  const routines = workouts.filter((w) => (w.plan?.length ?? 0) > 0);

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-xl font-bold">Entrenamiento</h1>

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
        <WorkoutGenerator />
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link href="/plan/new">
            <Pencil className="h-4 w-4" /> Crear rutina manual
          </Link>
        </Button>
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
    </div>
  );
}
