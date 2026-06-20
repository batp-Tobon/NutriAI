"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { PLAN_PRICE_COP } from "@/lib/constants";

/**
 * El usuario declara su pago y (opcionalmente) adjunta el comprobante. Crea un
 * registro de pago en estado 'pending' para que el admin lo confirme.
 * Usa la service_role en el servidor (con el user_id ya validado) para no
 * requerir una política de INSERT abierta en la tabla `payments`.
 */
export async function submitPaymentProof(input: {
  plan: "general" | "ai";
  reference?: string;
  proofPath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (input.plan !== "general" && input.plan !== "ai") {
    return { ok: false, error: "Plan inválido" };
  }

  const db = createAdminClient();

  // Evita duplicados: si ya hay un pago pendiente, no creamos otro.
  const { data: existing } = await db
    .from("payments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: "Ya tienes un pago pendiente de confirmación. Te avisaremos pronto.",
    };
  }

  try {
    const { error } = await db.from("payments").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      amount: PLAN_PRICE_COP[input.plan],
      currency: "COP",
      plan: input.plan,
      method: "bre-b",
      status: "pending",
      reference: input.reference?.trim() || null,
      proof_url: input.proofPath?.trim() || null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `${e.message} (¿corriste las migraciones 0014 y 0015?)`
          : "Error",
    };
  }

  revalidatePath("/subscribe");
  revalidatePath("/admin");
  return { ok: true };
}
