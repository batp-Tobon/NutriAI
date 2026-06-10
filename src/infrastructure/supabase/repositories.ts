/**
 * Implementaciones Supabase de los contratos de repositorio.
 * Cada factory recibe un SupabaseClient (servidor o navegador) → testeable y
 * sin acoplar la app a Supabase (Repository Pattern + DIP).
 */
import type { createClient as createServerSupabase } from "@/infrastructure/supabase/server";
import type {
  ConversationRepository,
  FoodRepository,
  MealRepository,
  MeasurementRepository,
  NotificationRepository,
  ProfileRepository,
  ProgressRepository,
  WorkoutRepository,
} from "@/core/domain/repositories";
import type { MealItem } from "@/core/domain/entities";
import { sumMacros } from "@/core/application/nutrition";
import { dayBoundsUTC, toAppDateISO } from "@/lib/utils";

/** Tipo exacto del cliente Supabase del servidor (tipado con Database). */
type DB = Awaited<ReturnType<typeof createServerSupabase>>;

function unwrap<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

export function createProfileRepository(db: DB): ProfileRepository {
  return {
    async getById(id) {
      const { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async update(id, patch) {
      return unwrap(
        await db.from("profiles").update(patch).eq("id", id).select("*").single(),
      );
    },
  };
}

export function createFoodRepository(db: DB): FoodRepository {
  return {
    async search(query, limit = 12) {
      const { data, error } = await db
        .from("foods")
        .select("*")
        .ilike("name", `%${query}%`)
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async create(food) {
      return unwrap(await db.from("foods").insert(food).select("*").single());
    },
  };
}

export function createMealRepository(db: DB): MealRepository {
  return {
    async listByDate(userId, dateISO) {
      const { from, to } = dayBoundsUTC(dateISO);
      const { data, error } = await db
        .from("meals")
        .select("*, items:meal_items(*)")
        .eq("user_id", userId)
        .gte("consumed_at", from)
        .lte("consumed_at", to)
        .order("consumed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as never;
    },
    async listBetween(userId, fromISO, toISO) {
      const { data, error } = await db
        .from("meals")
        .select("*")
        .eq("user_id", userId)
        .gte("consumed_at", fromISO)
        .lte("consumed_at", toISO)
        .order("consumed_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async create(meal, items) {
      const totals = sumMacros(
        items.map((i) => ({
          kcal: i.kcal ?? 0,
          protein: i.protein ?? 0,
          carbs: i.carbs ?? 0,
          fat: i.fat ?? 0,
        })),
      );
      const { data: inserted, error: insertErr } = await db
        .from("meals")
        .insert({
          ...meal,
          total_kcal: totals.kcal,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fat: totals.fat,
        })
        .select("*")
        .single();
      if (insertErr || !inserted) {
        throw new Error(insertErr?.message ?? "No se pudo crear la comida");
      }

      let itemRows: MealItem[] = [];
      if (items.length > 0) {
        const { data: rows, error: itemsErr } = await db
          .from("meal_items")
          .insert(items.map((i) => ({ ...i, meal_id: inserted.id })))
          .select("*");
        if (itemsErr) throw new Error(itemsErr.message);
        itemRows = rows ?? [];
      }
      return { ...inserted, items: itemRows };
    },
    async remove(id, userId) {
      const { error } = await db.from("meals").delete().eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}

export function createProgressRepository(db: DB): ProgressRepository {
  return {
    async list(userId, limit = 60) {
      const { data, error } = await db
        .from("progress")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async upsert(entry) {
      return unwrap(
        await db
          .from("progress")
          .upsert(entry, { onConflict: "user_id,recorded_at" })
          .select("*")
          .single(),
      );
    },
  };
}

export function createMeasurementRepository(db: DB): MeasurementRepository {
  return {
    async latest(userId) {
      const { data, error } = await db
        .from("measurements")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async list(userId, limit = 30) {
      const { data, error } = await db
        .from("measurements")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async upsert(entry) {
      return unwrap(
        await db
          .from("measurements")
          .upsert(entry, { onConflict: "user_id,recorded_at" })
          .select("*")
          .single(),
      );
    },
  };
}

export function createWorkoutRepository(db: DB): WorkoutRepository {
  return {
    async list(userId, limit = 20) {
      const { data, error } = await db
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async create(workout) {
      return unwrap(await db.from("workouts").insert(workout).select("*").single());
    },
    async markCompleted(id, userId) {
      const { error } = await db
        .from("workouts")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async remove(id, userId) {
      const { error } = await db
        .from("workouts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async completedOn(userId, dateISO) {
      const { from, to } = dayBoundsUTC(dateISO);
      const { data, error } = await db
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", from)
        .lte("completed_at", to)
        .order("completed_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async scheduledOn(userId, dateISO) {
      const { data, error } = await db
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .eq("scheduled_for", dateISO)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async completedDates(userId, sinceISO) {
      const { data, error } = await db
        .from("workouts")
        .select("completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", sinceISO);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((r) => r.completed_at)
        .filter((d): d is string => Boolean(d))
        .map((d) => toAppDateISO(d));
    },
  };
}

export function createNotificationRepository(db: DB): NotificationRepository {
  return {
    async list(userId, limit = 30) {
      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async markRead(id, userId) {
      const { error } = await db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}

export function createConversationRepository(db: DB): ConversationRepository {
  return {
    async getOrCreateDefault(userId) {
      const existing = await db
        .from("ai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) return existing.data;
      return unwrap(
        await db
          .from("ai_conversations")
          .insert({ user_id: userId, title: "Coach NutriAI" })
          .select("*")
          .single(),
      );
    },
    async listMessages(conversationId, userId) {
      const { data, error } = await db
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async addMessage(msg) {
      return unwrap(await db.from("ai_messages").insert(msg).select("*").single());
    },
  };
}
