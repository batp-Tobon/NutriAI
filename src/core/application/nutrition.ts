/**
 * Lógica de negocio nutricional (pura, sin dependencias de infraestructura).
 * Mifflin-St Jeor → TDEE → objetivo calórico → reparto de macros.
 */
import { ACTIVITY_FACTOR } from "@/lib/constants";
import type { ActivityLevel, Goal, Sex } from "@/types/database";
import type { Macros } from "@/core/domain/entities";
import { round } from "@/lib/utils";

export interface NutritionInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

/** Tasa metabólica basal (Mifflin-St Jeor). */
export function calcBMR(input: Pick<NutritionInput, "sex" | "age" | "heightCm" | "weightKg">): number {
  const { sex, age, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78; // 'other' → promedio
}

/** Gasto energético total diario. */
export function calcTDEE(input: NutritionInput): number {
  return calcBMR(input) * ACTIVITY_FACTOR[input.activityLevel];
}

const GOAL_CALORIE_FACTOR: Record<Goal, number> = {
  lose_fat: 0.8, // déficit 20%
  maintain: 1.0,
  gain_muscle: 1.1, // superávit 10%
};

/**
 * Objetivos diarios de calorías y macros.
 * Proteína fija en 2 g/kg, grasa al 25% de las kcal, resto carbohidratos.
 */
export function calcDailyTargets(input: NutritionInput): Macros {
  const tdee = calcTDEE(input);
  const kcal = Math.max(1200, round(tdee * GOAL_CALORIE_FACTOR[input.goal]));

  const protein = round(input.weightKg * 2);
  const fat = round((kcal * 0.25) / 9);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbs = Math.max(0, round((kcal - proteinKcal - fatKcal) / 4));

  return { kcal, protein, carbs, fat };
}

/** Suma de macros (p. ej. todas las comidas del día). */
export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Restante = objetivo − consumido (nunca por debajo de 0 en kcal mostradas). */
export function remainingMacros(target: Macros, consumed: Macros): Macros {
  return {
    kcal: round(target.kcal - consumed.kcal),
    protein: round(target.protein - consumed.protein),
    carbs: round(target.carbs - consumed.carbs),
    fat: round(target.fat - consumed.fat),
  };
}

/** Macros de un alimento (por 100 g) escalados a `grams`. */
export function macrosForGrams(
  per100g: { kcal_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number },
  grams: number,
): Macros {
  const k = grams / 100;
  return {
    kcal: round(per100g.kcal_per_100g * k),
    protein: round(per100g.protein_per_100g * k, 1),
    carbs: round(per100g.carbs_per_100g * k, 1),
    fat: round(per100g.fat_per_100g * k, 1),
  };
}
