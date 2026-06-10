import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { TrainClient } from "@/components/workouts/train-client";

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

  return (
    <TrainClient
      workout={workout}
      weightKg={prof?.current_weight_kg ?? null}
    />
  );
}
