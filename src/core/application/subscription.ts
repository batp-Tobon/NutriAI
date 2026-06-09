/**
 * Lógica de acceso por suscripción y plan (pura).
 * Prueba 5 días (con IA) → luego plan General (sin IA) o IA.
 * Los administradores siempre tienen acceso total.
 */
import type { Profile } from "@/core/domain/entities";

export type AccessState = "admin" | "trial" | "subscribed" | "expired";
export type Plan = "general" | "ai";

export interface AccessInfo {
  hasAccess: boolean;
  state: AccessState;
  plan: Plan;
  aiEnabled: boolean;
  daysLeft: number;
}

type ProfileLike = Pick<
  Profile,
  "role" | "plan" | "trial_ends_at" | "subscribed_until"
> | null;

export function getAccess(profile: ProfileLike, isAdmin = false): AccessInfo {
  // Admin (por rol o por email): acceso total con IA.
  if (isAdmin || profile?.role === "admin") {
    return { hasAccess: true, state: "admin", plan: "ai", aiEnabled: true, daysLeft: 9999 };
  }
  if (!profile) {
    return { hasAccess: false, state: "expired", plan: "general", aiEnabled: false, daysLeft: 0 };
  }

  const now = Date.now();
  const days = (iso: string | null) =>
    iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : 0;

  // Suscripción pagada vigente → respeta el plan contratado.
  const sub = profile.subscribed_until
    ? new Date(profile.subscribed_until).getTime()
    : 0;
  if (sub > now) {
    const plan: Plan = profile.plan === "ai" ? "ai" : "general";
    return {
      hasAccess: true,
      state: "subscribed",
      plan,
      aiEnabled: plan === "ai",
      daysLeft: days(profile.subscribed_until),
    };
  }

  // Prueba gratuita → experiencia completa con IA.
  const trial = profile.trial_ends_at
    ? new Date(profile.trial_ends_at).getTime()
    : 0;
  if (trial > now) {
    return {
      hasAccess: true,
      state: "trial",
      plan: "ai",
      aiEnabled: true,
      daysLeft: days(profile.trial_ends_at),
    };
  }

  return { hasAccess: false, state: "expired", plan: "general", aiEnabled: false, daysLeft: 0 };
}
