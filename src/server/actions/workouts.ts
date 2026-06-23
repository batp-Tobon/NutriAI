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
import { appNoonISO, todayISO } from "@/lib/utils";
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
        kind: z.enum(["reps", "time"]).optional(),
        duration_min: z.coerce.number().int().min(1).max(300).optional(),
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
    if (e.kind === "time") {
      exercise.kind = "time";
      exercise.duration_min = e.duration_min ?? 20;
    }
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

/** Reemplaza un ejercicio de la rutina (también usable en pleno entrenamiento). */
export async function swapExercise(
  workoutId: string,
  blockIndex: number,
  exIndex: number,
  repl: { name: string; gif_url?: string | null; target?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!repl.name?.trim()) return { ok: false, error: "Nombre vacío" };

  const supabase = await createClient();
  const { data: w } = await supabase
    .from("workouts")
    .select("plan")
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!w) return { ok: false, error: "Rutina no encontrada" };

  const plan = (w.plan ?? []) as WorkoutBlock[];
  const ex = plan[blockIndex]?.exercises?.[exIndex];
  if (!ex) return { ok: false, error: "Ejercicio no encontrado" };

  const next: WorkoutExercise = {
    ...ex,
    name: repl.name.trim(),
  };
  if (repl.gif_url) next.gif_url = repl.gif_url;
  else delete next.gif_url;
  if (repl.target) next.target = repl.target;
  else delete next.target;
  plan[blockIndex].exercises[exIndex] = next;

  const { error } = await supabase
    .from("workouts")
    .update({ plan })
    .eq("id", workoutId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plan");
  return { ok: true };
}

/** Elimina un ejercicio de la rutina (también en pleno entrenamiento). */
export async function removeExercise(
  workoutId: string,
  blockIndex: number,
  exIndex: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  const { data: w } = await supabase
    .from("workouts")
    .select("plan")
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!w) return { ok: false, error: "Rutina no encontrada" };

  const plan = (w.plan ?? []) as WorkoutBlock[];
  if (!plan[blockIndex]?.exercises?.[exIndex]) {
    return { ok: false, error: "Ejercicio no encontrado" };
  }
  // Quita el ejercicio. Conservamos el bloque (aunque quede vacío) para no
  // desplazar los índices del resto durante la sesión.
  plan[blockIndex].exercises.splice(exIndex, 1);

  const { error } = await supabase
    .from("workouts")
    .update({ plan })
    .eq("id", workoutId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plan");
  return { ok: true };
}

/** Añade un ejercicio nuevo a la rutina (al final), incluso en pleno entrenamiento. */
export async function addExerciseToWorkout(
  workoutId: string,
  ex: {
    name: string;
    gif_url?: string | null;
    target?: string | null;
    sets?: number;
    reps?: string;
    rest_sec?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!ex.name?.trim()) return { ok: false, error: "Nombre vacío" };

  const supabase = await createClient();
  const { data: w } = await supabase
    .from("workouts")
    .select("plan")
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!w) return { ok: false, error: "Rutina no encontrada" };

  const plan = (w.plan ?? []) as WorkoutBlock[];
  if (plan.length === 0) plan.push({ block: "Principal", exercises: [] });

  const exercise: WorkoutExercise = {
    name: ex.name.trim(),
    sets: ex.sets ?? 3,
    reps: ex.reps ?? "10-12",
    rest_sec: ex.rest_sec ?? 60,
  };
  if (ex.gif_url) exercise.gif_url = ex.gif_url;
  if (ex.target) exercise.target = ex.target;
  // Lo añadimos al último bloque para que aparezca al final.
  plan[plan.length - 1].exercises.push(exercise);

  const { error } = await supabase
    .from("workouts")
    .update({ plan })
    .eq("id", workoutId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

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

/** Registra una sesión de entrenamiento en la fecha indicada (por defecto hoy). */
export async function logQuickSession(
  type: WorkoutType,
  dateISO?: string,
  durationMin?: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Fecha al mediodía local del día indicado (no permite futuro); si no, ahora.
  const today = todayISO();
  const completedAt =
    dateISO && dateISO <= today ? appNoonISO(dateISO) : new Date().toISOString();
  const duration =
    durationMin && durationMin > 0 ? Math.min(360, Math.round(durationMin)) : 45;

  const supabase = await createClient();
  try {
    await createWorkoutRepository(supabase).create({
      user_id: user.id,
      title: `Sesión de ${WORKOUT_TYPE_LABELS[type]}`,
      workout_type: type,
      duration_min: duration,
      plan: [],
      ai_generated: false,
      completed_at: completedAt,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/plan");
  return { ok: true };
}

const pastWorkoutSchema = z.object({
  type: z.enum(["home", "gym", "cardio", "hypertrophy", "mobility"]),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z.coerce.number().int().min(0).max(360).optional(),
  title: z.string().max(120).optional(),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1),
        sets: z.coerce.number().int().min(1).max(30),
        reps: z.coerce.number().int().min(0).max(100),
        weight: z.coerce.number().min(0).max(1000),
        gif_url: z.string().optional().nullable(),
        target: z.string().optional().nullable(),
      }),
    )
    .max(40)
    .default([]),
});

export type PastWorkoutInput = z.input<typeof pastWorkoutSchema>;

/**
 * Registra un entrenamiento de un día PASADO con sus ejercicios (para llevar el
 * control). Crea la sesión completada con su plan y guarda las series en
 * `workout_set_logs` para que cuente en pesos/récords. Nunca fecha en el futuro.
 */
export async function logPastWorkout(
  input: PastWorkoutInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = pastWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const v = parsed.data;
  if (v.dateISO > todayISO()) {
    return { ok: false, error: "No puedes registrar en el futuro" };
  }

  const completedAt = appNoonISO(v.dateISO);
  const duration =
    v.durationMin && v.durationMin > 0 ? Math.min(360, v.durationMin) : 45;

  const plan: WorkoutBlock[] =
    v.exercises.length > 0
      ? [
          {
            block: "Sesión",
            exercises: v.exercises.map((e): WorkoutExercise => {
              const ex: WorkoutExercise = {
                name: e.name,
                sets: e.sets,
                reps: String(e.reps),
                rest_sec: 60,
              };
              if (e.gif_url) ex.gif_url = e.gif_url;
              if (e.target) ex.target = e.target;
              return ex;
            }),
          },
        ]
      : [];

  const supabase = await createClient();
  try {
    const created = await createWorkoutRepository(supabase).create({
      user_id: user.id,
      title: v.title?.trim() || `Sesión de ${WORKOUT_TYPE_LABELS[v.type]}`,
      workout_type: v.type,
      duration_min: duration,
      plan,
      ai_generated: false,
      completed_at: completedAt,
    });

    // Guarda las series para pesos/récords (defensivo si no se corrió 0012).
    const rows = v.exercises.flatMap((e) =>
      Array.from({ length: e.sets }, (_, i) => ({
        user_id: user.id,
        workout_id: created.id,
        exercise_name: e.name,
        set_number: i + 1,
        weight_kg: e.weight,
        reps: e.reps,
        performed_at: completedAt,
      })),
    );
    if (rows.length > 0) {
      await supabase.from("workout_set_logs").insert(rows);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/plan");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Programa (o desprograma) una rutina para una fecha. */
export async function scheduleWorkout(
  id: string,
  dateISO: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workouts")
    .update({ scheduled_for: dateISO })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plan");
  return { ok: true };
}
