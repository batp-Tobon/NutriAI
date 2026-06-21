import { NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import {
  parseReference,
  parseTransaction,
  verifyEventChecksum,
} from "@/infrastructure/wompi/client";
import { PLAN_PRICE_COP } from "@/lib/constants";
import { isWompiConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Webhook de eventos de Wompi. Al APROBARSE una transacción, crea el pago
 * (confirmado) a partir de la referencia (usuario + plan) y activa/extiende el
 * mes. Verifica la firma del evento y el monto; es idempotente por referencia.
 */
export async function POST(request: Request) {
  if (!isWompiConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyEventChecksum(payload as never)) {
    return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 });
  }

  const tx = parseTransaction(payload as never);
  if (!tx || tx.status !== "APPROVED") {
    return NextResponse.json({ ok: true }); // solo nos interesan los aprobados
  }

  const ref = parseReference(tx.reference);
  if (!ref) return NextResponse.json({ ok: true });

  // El monto aprobado debe coincidir con el precio del plan (anti-manipulación).
  if (tx.amountInCents !== PLAN_PRICE_COP[ref.plan] * 100) {
    return NextResponse.json({ ok: true });
  }

  const db = createAdminClient();

  // Idempotencia: si ya procesamos esta referencia, no repetimos.
  const { data: existing } = await db
    .from("payments")
    .select("id")
    .eq("reference", tx.reference)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  // Extiende la suscripción (suma sobre la fecha vigente si aún tiene tiempo).
  const startDate = new Date();
  const { data: prof } = await db
    .from("profiles")
    .select("email, subscribed_until")
    .eq("id", ref.userId)
    .maybeSingle();
  const current =
    prof?.subscribed_until && new Date(prof.subscribed_until) > startDate
      ? new Date(prof.subscribed_until)
      : new Date();
  current.setDate(current.getDate() + 30);

  await db
    .from("profiles")
    .update({
      subscribed_until: current.toISOString(),
      subscription_started_at: startDate.toISOString(),
      renewal_notified_at: null,
      plan: ref.plan,
    })
    .eq("id", ref.userId);

  // Registra el ingreso (confirmado) con la referencia para idempotencia.
  await db.from("payments").insert({
    user_id: ref.userId,
    user_email: prof?.email ?? null,
    amount: PLAN_PRICE_COP[ref.plan],
    currency: "COP",
    plan: ref.plan,
    method: "wompi",
    status: "confirmed",
    reference: tx.reference,
    period_start: startDate.toISOString().slice(0, 10),
    period_end: current.toISOString().slice(0, 10),
  });

  return NextResponse.json({ ok: true });
}
