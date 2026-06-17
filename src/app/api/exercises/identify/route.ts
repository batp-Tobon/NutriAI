import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import { identifyExercise } from "@/infrastructure/openai/exercise-vision";
import { searchExercises } from "@/infrastructure/exercisedb/client";
import { searchFreeExercises } from "@/infrastructure/freedb/client";
import { env, isOpenAIConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Identifica el ejercicio a partir de la foto de una máquina/movimiento (IA de
 * visión) y lo enriquece con un GIF/imagen del catálogo si lo encuentra.
 */
export async function POST(request: Request) {
  const { userId, access } = await getUserAccess();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!access.aiEnabled) {
    return NextResponse.json(
      { error: "Identificar por foto es del plan IA. Cambia de plan para usarlo." },
      { status: 403 },
    );
  }
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI no está configurado." },
      { status: 400 },
    );
  }
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

  let body: { imageDataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.imageDataUrl) {
    return NextResponse.json({ error: "Envía una imagen." }, { status: 400 });
  }

  try {
    const id = await identifyExercise({ imageDataUrl: body.imageDataUrl });

    // Buscar un GIF/imagen del catálogo con el término en inglés
    const [edb, free] = await Promise.all([
      searchExercises(id.searchTerm || id.name, 1).catch(() => []),
      searchFreeExercises(id.searchTerm || id.name).catch(() => []),
    ]);
    const match = edb[0] ?? free[0];

    return NextResponse.json({
      name: id.name,
      target: id.target || match?.target || "",
      equipment: id.equipment || match?.equipment || "",
      gif_url: match?.gifUrl ?? "",
      confidence: id.confidence,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al identificar" },
      { status: 500 },
    );
  }
}
