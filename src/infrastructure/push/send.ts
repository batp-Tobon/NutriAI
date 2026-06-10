import "server-only";
import webpush from "web-push";
import type { createAdminClient } from "@/infrastructure/supabase/admin";
import { env, isPushConfigured } from "@/lib/env";

let configured = false;
function ensure(): boolean {
  if (!isPushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      env.vapidSubject,
      env.vapidPublicKey,
      env.vapidPrivateKey,
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Envía una notificación push a todas las suscripciones de un usuario. */
export async function sendPushToUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensure()) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        // Suscripción caducada/inválida → la borramos
        if (code === 404 || code === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return sent;
}
