/**
 * Lógica de acceso por suscripción (pura).
 * Prueba gratis de 5 días → luego requiere mensualidad activa.
 * Los administradores siempre tienen acceso.
 */
import type { Profile } from "@/core/domain/entities";

export type AccessState = "admin" | "trial" | "subscribed" | "expired";

export interface AccessInfo {
  hasAccess: boolean;
  state: AccessState;
  daysLeft: number;
}

type ProfileLike = Pick<
  Profile,
  "role" | "trial_ends_at" | "subscribed_until"
> | null;

export function getAccess(profile: ProfileLike): AccessInfo {
  if (!profile) return { hasAccess: false, state: "expired", daysLeft: 0 };

  if (profile.role === "admin") {
    return { hasAccess: true, state: "admin", daysLeft: 9999 };
  }

  const now = Date.now();
  const days = (iso: string | null) =>
    iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : 0;

  const sub = profile.subscribed_until
    ? new Date(profile.subscribed_until).getTime()
    : 0;
  if (sub > now) {
    return { hasAccess: true, state: "subscribed", daysLeft: days(profile.subscribed_until) };
  }

  const trial = profile.trial_ends_at
    ? new Date(profile.trial_ends_at).getTime()
    : 0;
  if (trial > now) {
    return { hasAccess: true, state: "trial", daysLeft: days(profile.trial_ends_at) };
  }

  return { hasAccess: false, state: "expired", daysLeft: 0 };
}
