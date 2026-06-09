import "server-only";
import { createOpenAI } from "./client";
import { env } from "@/lib/env";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Eres "NutriAI Coach", un entrenador y nutricionista virtual.
Especialidades: nutrición, déficit calórico, ganancia muscular y hábitos saludables.
Responde en español, claro y motivador, con consejos accionables y seguros.
No des diagnósticos médicos; ante problemas de salud, recomienda acudir a un profesional.
Sé breve salvo que pidan detalle.`;

/**
 * Genera la respuesta del Coach a partir del historial y un resumen del
 * contexto del usuario (objetivos, macros, actividad reciente).
 */
export async function coachReply(
  history: CoachMessage[],
  userContext: string,
): Promise<string> {
  const openai = createOpenAI();

  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.6,
    max_tokens: 600,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Contexto del usuario:\n${userContext}` },
      ...history,
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ??
    "Lo siento, no pude generar una respuesta. Inténtalo de nuevo."
  );
}
