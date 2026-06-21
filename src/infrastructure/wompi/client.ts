import "server-only";
import { createHash } from "crypto";
import { env } from "@/lib/env";

/**
 * Integración con Wompi (Bancolombia) — Web Checkout + webhook de eventos.
 * Inerte hasta configurar NEXT_PUBLIC_WOMPI_PUBLIC_KEY + WOMPI_INTEGRITY_SECRET
 * (+ WOMPI_EVENTS_SECRET para validar el webhook). Montos en CENTAVOS de COP.
 * Docs: https://docs.wompi.co
 */

const CHECKOUT_URL = "https://checkout.wompi.co/p/";
const CURRENCY = "COP";
const REF_PREFIX = "nutriai";

/**
 * La referencia codifica el usuario y el plan para que el webhook sepa a quién
 * activar (Wompi no crea filas en `payments`; se crea al aprobarse). Formato:
 *   nutriai__<userId>__<plan>__<timestamp>
 * El separador "__" no aparece en los UUID ni en los planes.
 */
export function buildReference(userId: string, plan: "general" | "ai"): string {
  return `${REF_PREFIX}__${userId}__${plan}__${Date.now()}`;
}

export function parseReference(
  ref: string,
): { userId: string; plan: "general" | "ai" } | null {
  const parts = ref.split("__");
  if (parts.length < 4 || parts[0] !== REF_PREFIX) return null;
  const userId = parts[1];
  const plan = parts[2];
  if (!userId || (plan !== "general" && plan !== "ai")) return null;
  return { userId, plan };
}

/** Firma de integridad del Web Checkout: SHA256(ref + monto + moneda + secreto). */
export function integritySignature(
  reference: string,
  amountInCents: number,
): string {
  const data = `${reference}${amountInCents}${CURRENCY}${env.wompiIntegritySecret}`;
  return createHash("sha256").update(data).digest("hex");
}

/** Construye la URL del Web Checkout de Wompi para una transacción. */
export function buildCheckoutUrl(params: {
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  customerEmail?: string;
}): string {
  const q = new URLSearchParams({
    "public-key": env.wompiPublicKey,
    currency: CURRENCY,
    "amount-in-cents": String(params.amountInCents),
    reference: params.reference,
    "signature:integrity": integritySignature(
      params.reference,
      params.amountInCents,
    ),
    "redirect-url": params.redirectUrl,
  });
  if (params.customerEmail) q.set("customer-data:email", params.customerEmail);
  return `${CHECKOUT_URL}?${q.toString()}`;
}

type WompiEvent = {
  event?: string;
  data?: { transaction?: Record<string, unknown> };
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

function valueAtPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur && typeof cur === "object" && key in (cur as object)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }
  return cur == null ? "" : String(cur);
}

/**
 * Verifica la firma del evento de Wompi:
 *   SHA256( valores_de_properties + timestamp + WOMPI_EVENTS_SECRET ).
 */
export function verifyEventChecksum(payload: WompiEvent): boolean {
  if (!env.wompiEventsSecret) return false;
  const props = payload.signature?.properties ?? [];
  const checksum = payload.signature?.checksum ?? "";
  if (props.length === 0 || !checksum) return false;

  const concatenated =
    props.map((p) => valueAtPath(payload.data, p)).join("") +
    String(payload.timestamp ?? "") +
    env.wompiEventsSecret;
  const computed = createHash("sha256")
    .update(concatenated)
    .digest("hex")
    .toUpperCase();
  return computed === checksum.toUpperCase();
}

/** Extrae los datos relevantes de la transacción del evento. */
export function parseTransaction(payload: WompiEvent): {
  reference: string;
  status: string;
  amountInCents: number;
} | null {
  const t = payload.data?.transaction;
  if (!t) return null;
  return {
    reference: String(t.reference ?? ""),
    status: String(t.status ?? ""),
    amountInCents: Number(t.amount_in_cents ?? 0),
  };
}
