import "server-only";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { getAccess, type AccessInfo } from "@/core/application/subscription";
import { env } from "@/lib/env";

/**
 * Acceso del usuario actual (plan, IA, días restantes) calculado en el servidor.
 * Úsalo en rutas/acciones para bloquear funciones de IA según el plan.
 */
export async function getUserAccess(): Promise<{
  userId: string | null;
  email: string | null;
  access: AccessInfo;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { userId: null, email: null, access: getAccess(null) };
  }
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan, trial_ends_at, subscribed_until")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = env.adminEmails.includes((user.email ?? "").toLowerCase());
  return { userId: user.id, email: user.email ?? null, access: getAccess(profile, isAdmin) };
}
