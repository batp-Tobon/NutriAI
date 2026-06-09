/**
 * Contratos de repositorio (puertos). La capa de infraestructura los implementa
 * con Supabase. La aplicación/UI depende SÓLO de estas interfaces (DIP/SOLID).
 */
import type { Database } from "@/types/database";
import type {
  Conversation,
  Food,
  Meal,
  MealItem,
  MealWithItems,
  Measurement,
  Message,
  Notification,
  Profile,
  Progress,
  Workout,
} from "@/core/domain/entities";

type Ins<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export interface ProfileRepository {
  getById(id: string): Promise<Profile | null>;
  update(id: string, patch: Partial<Profile>): Promise<Profile>;
}

export interface FoodRepository {
  search(query: string, limit?: number): Promise<Food[]>;
  create(food: Ins<"foods">): Promise<Food>;
}

export interface MealRepository {
  listByDate(userId: string, dateISO: string): Promise<MealWithItems[]>;
  listBetween(userId: string, fromISO: string, toISO: string): Promise<Meal[]>;
  create(meal: Ins<"meals">, items: Omit<Ins<"meal_items">, "meal_id">[]): Promise<MealWithItems>;
  remove(id: string, userId: string): Promise<void>;
}

export interface ProgressRepository {
  list(userId: string, limit?: number): Promise<Progress[]>;
  upsert(entry: Ins<"progress">): Promise<Progress>;
}

export interface MeasurementRepository {
  latest(userId: string): Promise<Measurement | null>;
  list(userId: string, limit?: number): Promise<Measurement[]>;
  upsert(entry: Ins<"measurements">): Promise<Measurement>;
}

export interface WorkoutRepository {
  list(userId: string, limit?: number): Promise<Workout[]>;
  create(workout: Ins<"workouts">): Promise<Workout>;
  markCompleted(id: string, userId: string): Promise<void>;
  remove(id: string, userId: string): Promise<void>;
  /** Fechas (YYYY-MM-DD) de sesiones completadas desde `sinceISO`. */
  completedDates(userId: string, sinceISO: string): Promise<string[]>;
}

export interface NotificationRepository {
  list(userId: string, limit?: number): Promise<Notification[]>;
  markRead(id: string, userId: string): Promise<void>;
}

export interface ConversationRepository {
  getOrCreateDefault(userId: string): Promise<Conversation>;
  listMessages(conversationId: string, userId: string): Promise<Message[]>;
  addMessage(msg: Ins<"ai_messages">): Promise<Message>;
}
