"use server";

import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";

/**
 * Registra una serie con su peso/reps y detecta si es un nuevo récord
 * personal (mayor peso histórico en ese ejercicio).
 */
export async function logSet(input: {
  workoutId?: string | null;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
}): Promise<{ ok: boolean; id?: string; isPR?: boolean; prevMax?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const name = input.exerciseName.trim().toLowerCase();
  if (!name) return { ok: false };
  const weight = Number.isFinite(input.weightKg)
    ? Math.max(0, Math.round(input.weightKg * 100) / 100)
    : 0;
  const reps = Number.isFinite(input.reps)
    ? Math.max(0, Math.round(input.reps))
    : 0;

  const supabase = await createClient();

  // Mejor marca previa (para detectar récord)
  const { data: prev } = await supabase
    .from("workout_set_logs")
    .select("weight_kg")
    .eq("user_id", user.id)
    .eq("exercise_name", name)
    .order("weight_kg", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevMax = prev?.weight_kg != null ? Number(prev.weight_kg) : 0;

  const { data, error } = await supabase
    .from("workout_set_logs")
    .insert({
      user_id: user.id,
      workout_id: input.workoutId ?? null,
      exercise_name: name,
      set_number: Math.max(1, Math.round(input.setNumber)),
      weight_kg: weight,
      reps,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false };
  return { ok: true, id: data.id, isPR: weight > 0 && weight > prevMax, prevMax };
}

/** Elimina un registro de serie (al deshacer en el modo entrenamiento). */
export async function deleteSetLog(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const supabase = await createClient();
  await supabase
    .from("workout_set_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  return { ok: true };
}
