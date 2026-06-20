import type {
  ActivityLevel,
  Goal,
  MealType,
  WorkoutType,
} from "@/types/database";

export const APP_NAME = "NutriAI";

/** Precio mensual por plan (COP). Base para registrar ingresos y MRR. */
export const PLAN_PRICE_COP: Record<"general" | "ai", number> = {
  general: 10000,
  ai: 20000,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentario",
  light: "Ligero (1-3 días/sem)",
  moderate: "Moderado (3-5 días/sem)",
  active: "Activo (6-7 días/sem)",
  very_active: "Muy activo (físico/2x día)",
};

/** Multiplicadores TDEE por nivel de actividad. */
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: "Perder grasa",
  maintain: "Mantener",
  gain_muscle: "Ganar músculo",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
};

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  home: "Casa",
  gym: "Gimnasio",
  cardio: "Cardio",
  hypertrophy: "Hipertrofia",
  mobility: "Movilidad",
};

/** Enfoque muscular para generar la rutina. */
export type MuscleFocus =
  | "full"
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "biceps"
  | "triceps"
  | "glutes"
  | "core";

export const MUSCLE_FOCUS_LABELS: Record<MuscleFocus, string> = {
  full: "Cuerpo completo",
  chest: "Pecho",
  back: "Espalda",
  legs: "Pierna",
  shoulders: "Hombros",
  arms: "Brazos",
  biceps: "Bíceps",
  triceps: "Tríceps",
  glutes: "Glúteos",
  core: "Abdomen",
};
