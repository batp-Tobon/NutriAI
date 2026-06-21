import "server-only";
import { getCurrentProfile, getCurrentUser } from "@/infrastructure/supabase/server";
import { getAccess, type AccessInfo } from "@/core/application/subscription";
import { env } from "@/lib/env";

/**
 * Acceso del usuario actual (plan, IA, días restantes) calculado en el servidor.
 * Úsalo en rutas/acciones para bloquear funciones de IA según el plan.
 * Reusa el perfil cacheado por request (sin consulta extra).
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
  const profile = await getCurrentProfile();
  const isAdmin = env.adminEmails.includes((user.email ?? "").toLowerCase());
  return { userId: user.id, email: user.email ?? null, access: getAccess(profile, isAdmin) };
}
