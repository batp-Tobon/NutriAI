import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import {
  createConversationRepository,
  createMealRepository,
} from "@/infrastructure/supabase/repositories";
import { coachReply, type CoachMessage } from "@/infrastructure/openai/coach";
import { sumMacros } from "@/core/application/nutrition";
import { GOAL_LABELS } from "@/lib/constants";
import { env, isOpenAIConfigured } from "@/lib/env";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId, access } = await getUserAccess();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!access.aiEnabled) {
    return NextResponse.json(
      { error: "El Coach IA es del plan IA. Cambia de plan para usarlo." },
      { status: 403 },
    );
  }
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI no está configurado (OPENAI_API_KEY)." },
      { status: 400 },
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const supabase = await createClient();

  // Cuota mensual de IA (admins exentos)
  if (access.state !== "admin") {
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

  const conversations = createConversationRepository(supabase);

  try {
    const conversation = await conversations.getOrCreateDefault(userId);

    await conversations.addMessage({
      conversation_id: conversation.id,
      user_id: userId,
      role: "user",
      content: message,
    });

    const allMessages = await conversations.listMessages(
      conversation.id,
      userId,
    );
    const history: CoachMessage[] = allMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Contexto del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    const meals = await createMealRepository(supabase).listByDate(
      userId,
      todayISO(),
    );
    const consumed = sumMacros(
      meals.map((m) => ({
        kcal: m.total_kcal,
        protein: m.total_protein,
        carbs: m.total_carbs,
        fat: m.total_fat,
      })),
    );
    const context = [
      profile?.goal ? `Objetivo: ${GOAL_LABELS[profile.goal]}` : "",
      profile?.daily_calorie_target
        ? `Objetivo diario: ${profile.daily_calorie_target} kcal, ${profile.daily_protein_target}g proteína`
        : "",
      `Hoy lleva consumidas: ${Math.round(consumed.kcal)} kcal (P${Math.round(
        consumed.protein,
      )} C${Math.round(consumed.carbs)} G${Math.round(consumed.fat)}).`,
    ]
      .filter(Boolean)
      .join("\n");

    const reply = await coachReply(history, context);

    await conversations.addMessage({
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error del coach" },
      { status: 500 },
    );
  }
}
