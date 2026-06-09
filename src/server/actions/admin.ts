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
