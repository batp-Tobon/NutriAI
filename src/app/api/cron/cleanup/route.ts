import { NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/supabase/admin";
import { env, isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Limpieza de retención (datos > 90 días). La ejecuta Vercel Cron a diario.
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
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
