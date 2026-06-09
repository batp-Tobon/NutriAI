import "server-only";
import { z } from "zod";
import { createOpenAI } from "./client";
import { env } from "@/lib/env";

const itemSchema = z.object({
  name: z.string(),
  grams: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

const analysisSchema = z.object({
  name: z.string(),
  items: z.array(itemSchema).min(1),
  confidence: z.number().min(0).max(1),
});

export type MealAnalysis = z.infer<typeof analysisSchema>;

const SYSTEM_PROMPT = `Eres un nutricionista experto que analiza comidas.
Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "name": "nombre corto del plato",
  "items": [
    { "name": "alimento", "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number }
  ],
  "confidence": number  // 0..1, tu confianza en la estimación
}
Estima porciones y gramos de forma realista. Los macros son los totales para los gramos indicados (no por 100 g). No incluyas texto fuera del JSON.`;

/**
 * Analiza una comida a partir de una imagen (data URL) y/o una descripción de
 * texto. Devuelve los alimentos detectados con porciones y macros estimados.
 */
export async function analyzeMeal(input: {
  imageDataUrl?: string;
  description?: string;
}): Promise<MealAnalysis> {
  const openai = createOpenAI();
  const hasImage = Boolean(input.imageDataUrl);

  const userText = input.description
    ? `Analiza esta comida. Descripción del usuario: "${input.description}".`
    : "Analiza la comida de la imagen.";

  const userContent: OpenAIUserContent = hasImage
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: input.imageDataUrl! } },
      ]
    : userText;

  const completion = await openai.chat.completions.create({
    model: hasImage ? env.openaiVisionModel : env.openaiModel,
    response_format: { type: "json_object" },
    max_tokens: 900,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = analysisSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }
  return parsed.data;
}

type OpenAIUserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
