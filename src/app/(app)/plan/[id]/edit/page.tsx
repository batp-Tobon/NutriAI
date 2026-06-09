import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { RoutineBuilder } from "@/components/workouts/routine-builder";

export const metadata = { title: "Editar rutina" };

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: workout } = await supabase
    .from("workouts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!workout) notFound();

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Editar rutina</h1>
      <RoutineBuilder initial={workout} />
    </div>
  );
}
