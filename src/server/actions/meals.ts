"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createFoodRepository,
  createMealRepository,
} from "@/infrastructure/supabase/repositories";
import type { Food } from "@/core/domain/entities";

const itemSchema = z.object({
  name: z.string().min(1),
  grams: z.coerce.number().nonnegative(),
  kcal: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
});

const mealSchema = z.object({
  name: z.string().min(1),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  source: z.enum(["photo", "text", "manual"]),
  image_url: z.string().nullable().optional(),
  ai_confidence: z.number().min(0).max(1).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export type SaveMealInput = z.input<typeof mealSchema>;

export async function saveMeal(
  input: SaveMealInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const meals = createMealRepository(supabase);

  try {
    await meals.create(
      {
        user_id: user.id,
        name: v.name,
        meal_type: v.meal_type,
        source: v.source,
        image_url: v.image_url ?? null,
        ai_confidence: v.ai_confidence ?? null,
        consumed_at: new Date().toISOString(),
        total_kcal: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
      },
      v.items.map((i) => ({
        food_id: null,
        name: i.name,
        grams: i.grams,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      })),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

/** Busca alimentos del catálogo (para el registro manual, sin IA). */
export async function searchFoods(query: string): Promise<Food[]> {
  const user = await getCurrentUser();
  if (!user || !query.trim()) return [];
  const supabase = await createClient();
  return createFoodRepository(supabase).search(query, 12);
}

export async function deleteMeal(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  await createMealRepository(supabase).remove(id, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}
