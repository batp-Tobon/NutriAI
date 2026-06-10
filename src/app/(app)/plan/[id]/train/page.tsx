import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { TrainClient, type ExerciseStats } from "@/components/workouts/train-client";

export const metadata = { title: "Modo entrenamiento" };

export default async function TrainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: workout }, { data: prof }] = await Promise.all([
    supabase
      .from("workouts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("current_weight_kg")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  if (!workout || (workout.plan?.length ?? 0) === 0) notFound();

  // Último peso usado y récord (máximo) por ejercicio de esta rutina
  const names = [
    ...new Set(
      workout.plan.flatMap((b) =>
        b.exercises.map((e) => e.name.trim().toLowerCase()),
      ),
    ),
  ];
  const stats: Record<string, ExerciseStats> = {};
  if (names.length > 0) {
    const { data: logs } = await supabase
      .from("workout_set_logs")
      .select("exercise_name, weight_kg, performed_at")
      .eq("user_id", user!.id)
      .in("exercise_name", names)
      .order("performed_at", { ascending: false })
      .limit(300);
    for (const l of logs ?? []) {
      const w = Number(l.weight_kg);
      const s = stats[l.exercise_name] ?? { last: null, max: null };
      if (s.last === null && w > 0) s.last = w; // primero = más reciente
      if (w > (s.max ?? 0)) s.max = w;
      stats[l.exercise_name] = s;
    }
  }

  return (
    <TrainClient
      workout={workout}
      weightKg={prof?.current_weight_kg ?? null}
      stats={stats}
    />
  );
}
