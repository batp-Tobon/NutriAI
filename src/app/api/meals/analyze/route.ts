import { NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { analyzeMeal } from "@/infrastructure/openai/meal-vision";
import { isOpenAIConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI no está configurado. Añade OPENAI_API_KEY en .env.local." },
      { status: 400 },
    );
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
