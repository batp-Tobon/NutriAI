/**
 * Entidades de dominio.
 * Reutilizan las filas de la BD como modelo, exponiéndolas con nombres de
 * dominio para que la capa de aplicación/UI no dependa de Supabase.
 */
import type { Database } from "@/types/database";

type T = Database["public"]["Tables"];

export type Profile = T["profiles"]["Row"];
export type Food = T["foods"]["Row"];
export type Meal = T["meals"]["Row"];
export type MealItem = T["meal_items"]["Row"];
export type Progress = T["progress"]["Row"];
export type Measurement = T["measurements"]["Row"];
export type Workout = T["workouts"]["Row"];
export type Notification = T["notifications"]["Row"];
export type Conversation = T["ai_conversations"]["Row"];
export type Message = T["ai_messages"]["Row"];

/** Comida con sus alimentos. */
export interface MealWithItems extends Meal {
  items: MealItem[];
}

/** Macronutrientes + calorías. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Resumen nutricional del día para el dashboard. */
export interface DailySummary {
  date: string;
  consumed: Macros;
  target: Macros;
  remaining: Macros;
  meals: number;
}
