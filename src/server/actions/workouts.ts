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

const manualSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Ponle un nombre").max(120),
  workoutType: z.enum(["home", "gym", "cardio", "hypertrophy", "mobility"]),
  goal: z.enum(["lose_fat", "maintain", "gain_muscle"]),
  durationMin: z.coerce.number().int().min(5).max(240),
  difficulty: z.enum(["principiante", "intermedio", "avanzado"]),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1),
        sets: z.coerce.number().int().min(1).max(30),
        reps: z.string().min(1),
        rest_sec: z.coerce.number().int().min(0).max(900),
        gif_url: z.string().optional().nullable(),
        target: z.string().optional().nullable(),
      }),
    )
    .min(1, "Agrega al menos un ejercicio"),
});

export type ManualWorkoutInput = z.input<typeof manualSchema>;

/** Crea o edita una rutina manual del usuario. */
export async function saveManualWorkout(
  input: ManualWorkoutInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const v = parsed.data;

  const plan = [
    {
      block: "Principal",
      exercises: v.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        rest_sec: e.rest_sec,
        ...(e.gif_url ? { gif_url: e.gif_url } : {}),
        ...(e.target ? { target: e.target } : {}),
      })),
    },
  ];

  const row = {
    title: v.title,
    workout_type: v.workoutType,
    goal: v.goal,
    duration_min: v.durationMin,
    difficulty: v.difficulty,
    plan,
    ai_generated: false,
  };

  const supabase = await createClient();
  try {
    if (v.id) {
      const { error } = await supabase
        .from("workouts")
        .update(row)
        .eq("id", v.id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("workouts")
        .insert({ ...row, user_id: user.id });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar" };
  }

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
