"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createWorkoutRepository } from "@/infrastructure/supabase/repositories";
import {
  generateWorkout,
  generateWorkoutFromPool,
} from "@/infrastructure/openai/workout-generator";
import { fetchExercisePool } from "@/infrastructure/exercisedb/client";
import { isOpenAIConfigured } from "@/lib/env";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import type { WorkoutType } from "@/types/database";

const schema = z.object({
  workoutType: z.enum(["home", "gym", "cardio", "hypertrophy", "mobility"]),
  goal: z.enum(["lose_fat", "maintain", "gain_muscle"]),
  durationMin: z.coerce.number().int().min(10).max(180),
  level: z.enum(["principiante", "intermedio", "avanzado"]),
  focus: z
    .enum([
      "full",
      "chest",
      "back",
      "legs",
      "shoulders",
      "arms",
      "biceps",
      "triceps",
      "glutes",
      "core",
    ])
    .default("full"),
  notes: z.string().max(300).optional(),
});

export async function createWorkout(
  input: z.input<typeof schema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!isOpenAIConfigured()) {
    return { ok: false, error: "OpenAI no configurado (OPENAI_API_KEY)." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const v = parsed.data;

  try {
    // Con ExerciseDB → ejercicios reales con GIF; sin él → rutina en texto.
    const pool = await fetchExercisePool(v.workoutType, v.focus).catch(() => []);
    const gen =
      pool.length > 0
        ? await generateWorkoutFromPool(v, pool)
        : await generateWorkout(v);

    const supabase = await createClient();
    await createWorkoutRepository(supabase).create({
      user_id: user.id,
      title: gen.title,
      workout_type: v.workoutType,
      goal: v.goal,
      duration_min: gen.duration_min,
      difficulty: gen.difficulty,
      plan: gen.plan,
      ai_generated: true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al generar" };
  }

  revalidatePath("/plan");
  return { ok: true };
}

export async function completeWorkout(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  await createWorkoutRepository(supabase).markCompleted(id, user.id);
  revalidatePath("/plan");
  return { ok: true };
}

export async function deleteWorkout(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  await createWorkoutRepository(supabase).remove(id, user.id);
  revalidatePath("/plan");
  return { ok: true };
}

/** Registra una sesión de entrenamiento de hoy (sin rutina generada). */
export async function logQuickSession(
  type: WorkoutType,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  try {
    await createWorkoutRepository(supabase).create({
      user_id: user.id,
      title: `Sesión de ${WORKOUT_TYPE_LABELS[type]}`,
      workout_type: type,
      plan: [],
      ai_generated: false,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/plan");
  return { ok: true };
}
