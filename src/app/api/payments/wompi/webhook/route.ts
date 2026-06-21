import { NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import {
  parseTransaction,
  verifyEventChecksum,
} from "@/infrastructure/wompi/client";
import { isWompiConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Webhook de eventos de Wompi. Al aprobarse una transacción, confirma el pago
 * (cuya `reference` es el id del registro en `payments`) y activa/extiende el
 * mes del plan. Idempotente y con verificación de firma.
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
  if (!tx || !tx.reference) {
    return NextResponse.json({ ok: true }); // nada que hacer
  }

  const db = createAdminClient();
  const { data: pay } = await db
    .from("payments")
    .select("id, user_id, plan, status")
    .eq("id", tx.reference)
    .maybeSingle();
  if (!pay) return NextResponse.json({ ok: true });

  // Estados terminales fallidos → marca el pago como rechazado.
  if (["DECLINED", "ERROR", "VOIDED"].includes(tx.status)) {
    if (pay.status === "pending") {
      await db.from("payments").update({ status: "rejected" }).eq("id", pay.id);
    }
    return NextResponse.json({ ok: true });
  }

  // Sólo activamos en APROBADO y si aún no estaba confirmado (idempotente).
  if (tx.status !== "APPROVED" || pay.status === "confirmed" || !pay.user_id) {
    return NextResponse.json({ ok: true });
  }

  const plan: "general" | "ai" = pay.plan === "ai" ? "ai" : "general";
  const startDate = new Date();
  const { data: prof } = await db
    .from("profiles")
    .select("subscribed_until")
    .eq("id", pay.user_id)
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
      plan,
    })
    .eq("id", pay.user_id);

  await db
    .from("payments")
    .update({
      status: "confirmed",
      period_start: startDate.toISOString().slice(0, 10),
      period_end: current.toISOString().slice(0, 10),
    })
    .eq("id", pay.id);

  return NextResponse.json({ ok: true });
}
