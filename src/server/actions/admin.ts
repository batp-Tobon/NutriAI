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

/** Activa (o extiende) 1 mes de suscripción a un usuario. Pago manual por Nequi. */
export async function activateMonth(
  userId: string,
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
    .update({ subscribed_until: current.toISOString() })
    .eq("id", userId);

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
