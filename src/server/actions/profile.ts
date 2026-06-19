"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createProfileRepository } from "@/infrastructure/supabase/repositories";
import { calcDailyTargets } from "@/core/application/nutrition";

const schema = z.object({
  full_name: z.string().min(1, "Indica tu nombre"),
  age: z.coerce.number().int().min(10).max(120),
  sex: z.enum(["male", "female", "other"]),
  height_cm: z.coerce.number().min(80).max(260),
  current_weight_kg: z.coerce.number().min(25).max(400),
  target_weight_kg: z.coerce.number().min(25).max(400),
  activity_level: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ]),
  goal: z.enum(["lose_fat", "maintain", "gain_muscle"]),
});

export type SaveProfileInput = z.input<typeof schema>;

export async function saveProfile(
  input: SaveProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const v = parsed.data;

  const targets = calcDailyTargets({
    sex: v.sex,
    age: v.age,
    heightCm: v.height_cm,
    weightKg: v.current_weight_kg,
    activityLevel: v.activity_level,
    goal: v.goal,
  });

  const supabase = await createClient();
  const profiles = createProfileRepository(supabase);

  try {
    await profiles.update(user.id, {
      full_name: v.full_name,
      age: v.age,
      sex: v.sex,
      height_cm: v.height_cm,
      current_weight_kg: v.current_weight_kg,
      target_weight_kg: v.target_weight_kg,
      activity_level: v.activity_level,
      goal: v.goal,
      daily_calorie_target: targets.kcal,
      daily_protein_target: targets.protein,
      daily_carbs_target: targets.carbs,
      daily_fat_target: targets.fat,
      onboarding_completed: true,
    });

    // Registrar el peso actual también en el histórico de progreso
    await supabase.from("progress").upsert(
      {
        user_id: user.id,
        weight_kg: v.current_weight_kg,
        recorded_at: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "user_id,recorded_at" },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}

/** Cambia el objetivo y recalcula los objetivos diarios de calorías y macros. */
export async function setGoal(
  goal: "lose_fat" | "maintain" | "gain_muscle",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!["lose_fat", "maintain", "gain_muscle"].includes(goal)) {
    return { ok: false, error: "Objetivo inválido" };
  }

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("sex, age, height_cm, current_weight_kg, activity_level")
    .eq("id", user.id)
    .maybeSingle();

  const patch: {
    goal: "lose_fat" | "maintain" | "gain_muscle";
    daily_calorie_target?: number;
    daily_protein_target?: number;
    daily_carbs_target?: number;
    daily_fat_target?: number;
  } = { goal };

  // Si hay datos suficientes, recalcula los objetivos diarios.
  if (
    p?.sex &&
    p.age != null &&
    p.height_cm != null &&
    p.current_weight_kg != null &&
    p.activity_level
  ) {
    const t = calcDailyTargets({
      sex: p.sex,
      age: p.age,
      heightCm: p.height_cm,
      weightKg: p.current_weight_kg,
      activityLevel: p.activity_level,
      goal,
    });
    patch.daily_calorie_target = t.kcal;
    patch.daily_protein_target = t.protein;
    patch.daily_carbs_target = t.carbs;
    patch.daily_fat_target = t.fat;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deficit");
  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/profile");
  return { ok: true };
}

/** Configura (o quita) el día del mes en que pagas tu gym. */
export async function setGymPaymentDay(
  day: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
    return { ok: false, error: "Día inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ gym_payment_day: day, gym_last_reminded_at: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
