/**
 * Tipos de la base de datos (formato Supabase).
 * Reflejan el esquema de `supabase/migrations`. Permiten consultas tipadas:
 *   createServerClient<Database>(...).from('meals')...
 *
 * Para regenerarlos desde el proyecto real:
 *   supabase gen types typescript --project-id TU_REF > src/types/database.ts
 */

export type UserRole = "user" | "admin";
export type Sex = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose_fat" | "maintain" | "gain_muscle";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSource = "photo" | "text" | "manual";
export type WorkoutType = "home" | "gym" | "cardio" | "hypertrophy" | "mobility";
export type NotificationType = "meal" | "workout" | "hydration" | "system";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          age: number | null;
          sex: Sex | null;
          height_cm: number | null;
          current_weight_kg: number | null;
          target_weight_kg: number | null;
          activity_level: ActivityLevel | null;
          goal: Goal | null;
          daily_calorie_target: number | null;
          daily_protein_target: number | null;
          daily_carbs_target: number | null;
          daily_fat_target: number | null;
          onboarding_completed: boolean;
          trial_ends_at: string | null;
          subscribed_until: string | null;
          plan: "general" | "ai";
          ai_uses: number;
          ai_period_start: string | null;
          subscription_started_at: string | null;
          renewal_notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      foods: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          kcal_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["foods"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["foods"]["Row"]>;
        Relationships: [];
      };
      meals: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          meal_type: MealType;
          source: MealSource;
          image_url: string | null;
          notes: string | null;
          ai_confidence: number | null;
          total_kcal: number;
          total_protein: number;
          total_carbs: number;
          total_fat: number;
          consumed_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meals"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["meals"]["Row"]>;
        Relationships: [];
      };
      meal_items: {
        Row: {
          id: string;
          meal_id: string;
          food_id: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meal_items"]["Row"]> & {
          meal_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["meal_items"]["Row"]>;
        Relationships: [];
      };
      progress: {
        Row: {
          id: string;
          user_id: string;
          weight_kg: number | null;
          body_fat_pct: number | null;
          muscle_mass_kg: number | null;
          sleep_hours: number | null;
          photo_url: string | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["progress"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["progress"]["Row"]>;
        Relationships: [];
      };
      measurements: {
        Row: {
          id: string;
          user_id: string;
          waist_cm: number | null;
          chest_cm: number | null;
          arm_cm: number | null;
          leg_cm: number | null;
          hip_cm: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["measurements"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["measurements"]["Row"]>;
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          workout_type: WorkoutType;
          goal: Goal | null;
          duration_min: number | null;
          difficulty: string | null;
          plan: WorkoutBlock[];
          ai_generated: boolean;
          scheduled_for: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workouts"]["Row"]> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["workouts"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          scheduled_for: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["ai_conversations"]["Row"]
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["ai_conversations"]["Row"]>;
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_messages"]["Row"]> & {
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant" | "system";
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_messages"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      recalc_meal_totals: { Args: { p_meal_id: string }; Returns: undefined };
      delete_old_data: { Args: Record<string, never>; Returns: undefined };
      consume_ai_credit: { Args: { p_limit: number }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      sex: Sex;
      activity_level: ActivityLevel;
      goal: Goal;
      meal_type: MealType;
      meal_source: MealSource;
      workout_type: WorkoutType;
      notification_type: NotificationType;
    };
  };
}

/** Estructura del plan de entrenamiento (columna jsonb `workouts.plan`). */
export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_sec: number;
  notes?: string;
  /** GIF demostrativo (ExerciseDB) y músculo objetivo, si están disponibles. */
  gif_url?: string;
  target?: string;
  equipment?: string;
}
export interface WorkoutBlock {
  block: string;
  exercises: WorkoutExercise[];
}
