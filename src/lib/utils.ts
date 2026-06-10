import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Redondea a `decimals` decimales (por defecto entero). */
export function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Formatea un número con separador de miles (es). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

/** Inicial(es) para avatares. */
export function initials(name?: string | null): string {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Fechas con zona horaria de la app.
// El servidor (Vercel) corre en UTC; sin esto, el "día" cambiaría a las 7 pm
// hora Colombia. Con estos helpers la jornada inicia a medianoche local.
// ---------------------------------------------------------------------------
const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ ?? "America/Bogota";
const APP_TZ_OFFSET = process.env.NEXT_PUBLIC_APP_TZ_OFFSET ?? "-05:00";

/** Fecha ISO (YYYY-MM-DD) de hoy en la zona horaria de la app. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(
    new Date(),
  );
}

/** Convierte un timestamp ISO a la fecha (YYYY-MM-DD) local de la app. */
export function toAppDateISO(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/** Límites UTC de un día local (para consultas a la BD). */
export function dayBoundsUTC(dateISO: string): { from: string; to: string } {
  return {
    from: `${dateISO}T00:00:00${APP_TZ_OFFSET}`,
    to: `${dateISO}T23:59:59${APP_TZ_OFFSET}`,
  };
}

/** Suma o resta días a una fecha ISO (YYYY-MM-DD). */
export function shiftDateISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
