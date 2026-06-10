import { NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { sendPushToUser } from "@/infrastructure/push/send";
import { env, isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Avisa a 5 días del vencimiento: notifica al usuario (para que pague) y a los
 * administradores (para que lleven el control). Sólo 1 vez por periodo.
 */
async function notifyExpiring(admin: Admin): Promise<number> {
  const now = new Date();
  const in5 = new Date(now.getTime() + 5 * 86_400_000);

  const { data: expiring } = await admin
    .from("profiles")
    .select(
      "id, email, subscribed_until, subscription_started_at, renewal_notified_at",
    )
    .not("subscribed_until", "is", null)
    .gte("subscribed_until", now.toISOString())
    .lte("subscribed_until", in5.toISOString());

  if (!expiring || expiring.length === 0) return 0;

  const { data: allProfiles } = await admin
    .from("profiles")
    .select("id, email, role");
  const adminIds = (allProfiles ?? [])
    .filter(
      (p) =>
        p.role === "admin" ||
        env.adminEmails.includes((p.email ?? "").toLowerCase()),
    )
    .map((p) => p.id);

  let notified = 0;
  for (const u of expiring) {
    // ¿ya se avisó en este periodo de suscripción?
    if (
      u.renewal_notified_at &&
      (!u.subscription_started_at ||
        new Date(u.renewal_notified_at) >= new Date(u.subscription_started_at))
    ) {
      continue;
    }

    const days = Math.max(
      1,
      Math.ceil(
        (new Date(u.subscribed_until as string).getTime() - now.getTime()) /
          86_400_000,
      ),
    );

    const userBody = `Te quedan ${days} día(s). Renueva con Bre-B ${
      env.paymentKey || ""
    } para no perder el acceso.`;
    await admin.from("notifications").insert({
      user_id: u.id,
      type: "system",
      title: "Tu plan vence pronto",
      body: userBody,
    });
    // Push al celular (si tiene notificaciones activadas)
    await sendPushToUser(admin, u.id, {
      title: "Tu plan vence pronto",
      body: userBody,
      url: "/subscribe",
    }).catch(() => 0);

    for (const aid of adminIds) {
      await admin.from("notifications").insert({
        user_id: aid,
        type: "system",
        title: "Suscripción por vencer",
        body: `${u.email ?? "Un usuario"} vence en ${days} día(s).`,
      });
    }

    await admin
      .from("profiles")
      .update({ renewal_notified_at: now.toISOString() })
      .eq("id", u.id);
    notified++;
  }
  return notified;
}

/**
 * Mantenimiento diario (Vercel Cron):
 *  - Borra datos > 90 días (retención).
 *  - Avisa a 5 días del vencimiento de la suscripción.
 * Vercel envía `Authorization: Bearer <CRON_SECRET>` si CRON_SECRET está set.
 */
export async function GET(request: Request) {
  if (env.cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase no configurado" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("delete_old_data");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;
  try {
    notified = await notifyExpiring(admin);
  } catch {
    /* no bloquear la limpieza por un fallo en los avisos */
  }

  return NextResponse.json({
    ok: true,
    notified,
    ranAt: new Date().toISOString(),
  });
}
