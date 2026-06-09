import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import { analyzeMeal } from "@/infrastructure/openai/meal-vision";
import { env, isOpenAIConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId, access } = await getUserAccess();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!access.aiEnabled) {
    return NextResponse.json(
      { error: "El análisis con IA es del plan IA. Cambia de plan para usarlo." },
      { status: 403 },
    );
  }
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI no está configurado. Añade OPENAI_API_KEY en .env.local." },
      { status: 400 },
    );
  }
  // Cuota mensual de IA (los admins están exentos)
  if (access.state !== "admin") {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("consume_ai_credit", {
      p_limit: env.aiMonthlyLimit,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste tu límite mensual de usos de IA." },
        { status: 429 },
      );
    }
  }

  let body: { imageDataUrl?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.imageDataUrl && !body.description) {
    return NextResponse.json(
      { error: "Envía una imagen o una descripción." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeMeal(body);
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al analizar la comida" },
      { status: 500 },
    );
  }
}
