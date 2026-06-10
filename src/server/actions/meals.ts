"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import {
  createFoodRepository,
  createMealRepository,
} from "@/infrastructure/supabase/repositories";
import { searchOpenFoodFacts } from "@/infrastructure/openfoodfacts/client";
import type { FoodSearchItem } from "@/core/domain/entities";

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

/** Busca alimentos (sin IA): base local + Open Food Facts, en español. */
export async function searchFoods(query: string): Promise<FoodSearchItem[]> {
  const user = await getCurrentUser();
  if (!user || !query.trim()) return [];

  const supabase = await createClient();
  const [local, off] = await Promise.all([
    createFoodRepository(supabase)
      .search(query, 8)
      .catch(() => []),
    searchOpenFoodFacts(query, 12).catch(() => []),
  ]);

  const localItems: FoodSearchItem[] = local.map((f) => ({
    id: f.id,
    name: f.name,
    kcal_per_100g: f.kcal_per_100g,
    protein_per_100g: f.protein_per_100g,
    carbs_per_100g: f.carbs_per_100g,
    fat_per_100g: f.fat_per_100g,
  }));

  // Local primero (curado), luego Open Food Facts; sin duplicar por nombre.
  const seen = new Set<string>();
  const merged: FoodSearchItem[] = [];
  for (const it of [...localItems, ...off]) {
    const key = it.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }
  return merged.slice(0, 16);
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
