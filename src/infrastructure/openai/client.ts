import "server-only";
import OpenAI from "openai";
import { env, isOpenAIConfigured } from "@/lib/env";

/** Cliente de OpenAI (sólo servidor). */
export function createOpenAI(): OpenAI {
  if (!isOpenAIConfigured()) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Añádela en .env.local.",
    );
  }
  return new OpenAI({ apiKey: env.openaiKey });
}
