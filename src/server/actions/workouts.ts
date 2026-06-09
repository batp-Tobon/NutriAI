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
import { getUserAccess } from "@/server/access";
import { env, isOpenAIConfigured } from "@/lib/env";
import { WORKOUT_TYPE_LABELS } from "@/lib/constants";
import { BASE_WEEK } from "@/lib/base-week";
import type {
  WorkoutBlock,
  WorkoutExercise,
  WorkoutType,
} from "@/types/database";

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
  const { userId, access } = await getUserAccess();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!access.aiEnabled) {
    return {
      ok: false,
      error: "Generar rutinas con IA es del plan IA. Crea una rutina manual o cambia de plan.",
    };
  }
  if (!isOpenAIConfigured()) {
    return { ok: false, error: "OpenAI no configurado (OPENAI_API_KEY)." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const v = parsed.data;

  try {
    const supabase = await createClient();

    // Cuota mensual de IA (admins exentos)
    if (access.state !== "admin") {
      const { data: allowed } = await supabase.rpc("consume_ai_credit", {
        p_limit: env.aiMonthlyLimit,
      });
      if (!allowed) {
        return { ok: false, error: "Alcanzaste tu límite mensual de usos de IA." };
      }
    }

    // Con ExerciseDB → ejercicios reales con GIF; sin él → rutina en texto.
    const pool = await fetchExercisePool(v.workoutType, v.focus).catch(() => []);
    const gen =
      pool.length > 0
        ? await generateWorkoutFromPool(v, pool)
        : await generateWorkout(v);

    await createWorkoutRepository(supabase).create({
      user_id: userId,
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
        block: z.string().optional().nullable(),
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

  // Agrupa por bloque conservando el orden (preserva calentamiento/principal/…)
  const plan: WorkoutBlock[] = [];
  for (const e of v.exercises) {
    const blockName = e.block?.trim() || "Principal";
    let blk = plan.find((b) => b.block === blockName);
    if (!blk) {
      blk = { block: blockName, exercises: [] };
      plan.push(blk);
    }
    const exercise: WorkoutExercise = {
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      rest_sec: e.rest_sec,
    };
    if (e.gif_url) exercise.gif_url = e.gif_url;
    if (e.target) exercise.target = e.target;
    blk.exercises.push(exercise);
  }

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

/** Carga la semana base recomendada (6 rutinas listas) para el usuario. */
export async function loadBaseWeek(): Promise<{
  ok: boolean;
  error?: string;
  count?: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  const rows = BASE_WEEK.map((r) => ({
    user_id: user.id,
    title: r.title,
    workout_type: r.workout_type,
    goal: r.goal,
    duration_min: r.duration_min,
    difficulty: r.difficulty,
    plan: r.plan,
    ai_generated: false,
  }));

  const { error } = await supabase.from("workouts").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plan");
  return { ok: true, count: rows.length };
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
