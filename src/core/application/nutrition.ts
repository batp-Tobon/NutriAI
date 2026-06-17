/**
 * Lógica de negocio nutricional (pura, sin dependencias de infraestructura).
 * Mifflin-St Jeor → TDEE → objetivo calórico → reparto de macros.
 */
import { ACTIVITY_FACTOR } from "@/lib/constants";
import type { ActivityLevel, Goal, Sex, WorkoutType } from "@/types/database";
import type { Macros } from "@/core/domain/entities";
import { round } from "@/lib/utils";

/** MET aproximado por tipo de entrenamiento (para estimar calorías gastadas). */
const WORKOUT_MET: Record<WorkoutType, number> = {
  gym: 5,
  hypertrophy: 5,
  home: 5,
  cardio: 8,
  mobility: 3,
};

/** Calorías gastadas ≈ MET × peso(kg) × duración(horas). */
export function caloriesBurned(
  type: WorkoutType,
  durationMin: number | null,
  weightKg: number | null,
): number {
  if (!durationMin || durationMin <= 0) return 0;
  const met = WORKOUT_MET[type] ?? 5;
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  return Math.round(met * w * (durationMin / 60));
}

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

/** Energía aproximada de 1 kg de grasa corporal (kcal). Estándar usado por apps. */
export const KCAL_PER_KG_FAT = 7700;

export interface DeficitInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** kcal consumidas hoy (suma de comidas). */
  consumedKcal: number;
  /** kcal gastadas hoy en ejercicio registrado (extra sobre la actividad diaria). */
  exerciseKcal: number;
  /** Objetivo calórico del perfil (si existe); si no, se calcula por la meta. */
  targetKcal?: number | null;
}

export interface DeficitReport {
  bmr: number;
  /** Mantenimiento = gasto del día sin ejercicio extra. */
  tdee: number;
  exercise: number;
  /** Gasto total estimado del día = TDEE + ejercicio. */
  expenditure: number;
  consumed: number;
  /** consumido − gasto. Negativo = déficit (estás gastando más de lo que comes). */
  balance: number;
  /** Magnitud del déficit (positivo cuando hay déficit; 0 si hay superávit). */
  deficit: number;
  inDeficit: boolean;
  /** % del mantenimiento que representa lo consumido. */
  pctOfMaintenance: number;
  /** Ingesta recomendada según la meta (déficit/superávit saludable). */
  targetKcal: number;
  /** Déficit objetivo por día según la meta (TDEE − ingesta recomendada). */
  targetDeficit: number;
  /** Ingesta recomendada para RECOMPOSICIÓN: déficit suave ~15% del TDEE. */
  recompKcal: number;
  /** Déficit objetivo para recomposición (~15% del TDEE). */
  recompDeficit: number;
  /** Proyección de cambio de peso si se mantiene el balance de hoy. */
  weeklyKg: number;
  monthlyKg: number;
}

/**
 * Reporte de déficit calórico del día con todas las cifras intermedias visibles
 * (BMR → TDEE → gasto total → balance → proyección). Método tipo MyFitnessPal:
 * el ejercicio registrado se suma como gasto extra sobre la actividad diaria.
 */
export function calcDeficit(input: DeficitInput): DeficitReport {
  const bmr = round(calcBMR(input));
  const tdee = round(calcTDEE(input));
  const exercise = Math.max(0, round(input.exerciseKcal));
  const expenditure = tdee + exercise;
  const consumed = Math.max(0, round(input.consumedKcal));

  const balance = consumed - expenditure; // < 0 = déficit
  const deficit = balance < 0 ? -balance : 0;

  const targetKcal =
    input.targetKcal && input.targetKcal > 0
      ? round(input.targetKcal)
      : calcDailyTargets(input).kcal;
  const targetDeficit = Math.max(0, tdee - targetKcal);

  // Recomposición: déficit suave del 15% conserva músculo mientras baja grasa.
  const recompKcal = round(tdee * 0.85);
  const recompDeficit = tdee - recompKcal;

  const weeklyKg = round((balance * 7) / KCAL_PER_KG_FAT, 2);
  const monthlyKg = round((balance * 30) / KCAL_PER_KG_FAT, 2);

  return {
    bmr,
    tdee,
    exercise,
    expenditure,
    consumed,
    balance,
    deficit,
    inDeficit: balance < 0,
    pctOfMaintenance: tdee > 0 ? Math.round((consumed / tdee) * 100) : 0,
    targetKcal,
    targetDeficit,
    recompKcal,
    recompDeficit,
    weeklyKg,
    monthlyKg,
  };
}

export type StatusLevel = "good" | "warn" | "bad";

/**
 * Evalúa el balance de hoy pensando en RECOMPOSICIÓN (perder grasa + ganar
 * músculo): lo ideal es un déficit MODERADO, no agresivo, para no perder músculo.
 * Devuelve nivel + mensaje corto en español.
 */
export function energyStatus(rep: DeficitReport): {
  level: StatusLevel;
  message: string;
} {
  const moderate = Math.round(rep.tdee * 0.25); // ~déficit máximo recomendado
  if (rep.balance > 150)
    return {
      level: "warn",
      message: "Vas en superávit: hoy es difícil perder grasa.",
    };
  if (rep.deficit > moderate)
    return {
      level: "bad",
      message: "Déficit muy agresivo: arriesgas perder músculo.",
    };
  if (rep.deficit < 100)
    return {
      level: "warn",
      message: "Cerca de mantenimiento: la grasa baja lento.",
    };
  return { level: "good", message: "Déficit moderado ideal para recomponer." };
}

/** Estado de proteína del día (clave para conservar/ganar músculo). */
export function proteinStatus(
  proteinG: number,
  weightKg: number,
): { level: StatusLevel; perKg: number; message: string } {
  const perKg = weightKg > 0 ? round(proteinG / weightKg, 1) : 0;
  if (perKg >= 1.6)
    return { level: "good", perKg, message: "Proteína suficiente para músculo." };
  if (perKg >= 1.2)
    return { level: "warn", perKg, message: "Sube un poco la proteína." };
  return { level: "bad", perKg, message: "Proteína baja: prioriza más." };
}

/** Estado del sueño (recuperación). 7–9 h ideal. */
export function sleepStatus(hours: number): {
  level: StatusLevel;
  message: string;
} {
  if (hours >= 7 && hours <= 9)
    return { level: "good", message: "Buen descanso para recuperar." };
  if (hours >= 6 && hours < 7)
    return { level: "warn", message: "Algo corto; apunta a 7–9 h." };
  if (hours > 9)
    return { level: "warn", message: "Demasiado; revisa tu calidad de sueño." };
  return { level: "bad", message: "Dormir poco frena grasa y músculo." };
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
