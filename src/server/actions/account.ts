"use server";

import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";

/** Marca que el usuario ya vio la tarjeta de bienvenida de su suscripción. */
export async function dismissWelcome(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  // Si la columna aún no existe (migración 0016 sin correr), no rompe nada.
  await supabase
    .from("profiles")
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  return { ok: true };
}
