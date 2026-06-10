"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { env } from "@/lib/env";

/** Verifica que el usuario actual sea administrador. */
async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    data?.role === "admin" ||
    env.adminEmails.includes((user.email ?? "").toLowerCase());
  return isAdmin ? user : null;
}

/** Activa (o extiende) 1 mes del plan elegido. Pago manual por Bre-B. */
export async function activateMonth(
  userId: string,
  plan: "general" | "ai",
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();
  const { data: prof } = await db
    .from("profiles")
    .select("subscribed_until")
    .eq("id", userId)
    .maybeSingle();

  // Si aún tiene tiempo, se suma sobre la fecha vigente; si no, desde hoy.
  const current =
    prof?.subscribed_until && new Date(prof.subscribed_until) > new Date()
      ? new Date(prof.subscribed_until)
      : new Date();
  current.setDate(current.getDate() + 30);

  const { error } = await db
    .from("profiles")
    .update({
      subscribed_until: current.toISOString(),
      subscription_started_at: new Date().toISOString(),
      renewal_notified_at: null, // reinicia el aviso para el nuevo periodo
      plan,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Edita (desde admin) el nombre y las fechas de suscripción de un usuario. */
export async function updateUserByAdmin(
  userId: string,
  input: { fullName?: string; startsAt?: string | null; endsAt?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "No autorizado" };

  const patch: {
    full_name?: string | null;
    subscription_started_at?: string | null;
    subscribed_until?: string | null;
  } = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName.trim() || null;
  if (input.startsAt !== undefined)
    patch.subscription_started_at = input.startsAt ? `${input.startsAt}T12:00:00` : null;
  if (input.endsAt !== undefined)
    patch.subscribed_until = input.endsAt ? `${input.endsAt}T23:59:59` : null;

  const db = createAdminClient();
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Reinicia los datos de un usuario (borra comidas, rutinas, progreso…) para empezar de 0. */
export async function resetUserData(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();
  try {
    await db.from("meals").delete().eq("user_id", userId); // meal_items en cascada
    await db.from("progress").delete().eq("user_id", userId);
    await db.from("measurements").delete().eq("user_id", userId);
    await db.from("workouts").delete().eq("user_id", userId);
    await db.from("notifications").delete().eq("user_id", userId);
    await db.from("ai_conversations").delete().eq("user_id", userId); // ai_messages en cascada
    await db
      .from("profiles")
      .update({
        onboarding_completed: false,
        daily_calorie_target: null,
        daily_protein_target: null,
        daily_carbs_target: null,
        daily_fat_target: null,
      })
      .eq("id", userId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** Elimina por completo a un usuario (cuenta + todos sus datos en cascada). */
export async function deleteUser(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await assertAdmin();
  if (!me) return { ok: false, error: "No autorizado" };
  if (me.id === userId) {
    return { ok: false, error: "No puedes eliminar tu propia cuenta de admin." };
  }

  const db = createAdminClient();
  const { data: target } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (target?.role === "admin") {
    return { ok: false, error: "No puedes eliminar a otro administrador." };
  }

  // Borra de auth.users; el resto de tablas caen por ON DELETE CASCADE.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

/** Revoca el acceso de pago (deja al usuario sin suscripción activa). */
export async function revokeSubscription(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ subscribed_until: null })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
