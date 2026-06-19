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

const SYSTEM_PROMPT = `Eres un nutricionista experto que analiza comidas a partir de fotos o texto.
Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "name": "nombre corto del plato",
  "items": [
    { "name": "alimento", "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number }
  ],
  "confidence": number  // 0..1, qué tan seguro estás de la estimación
}

REGLAS OBLIGATORIAS:
- Identifica CADA alimento visible y estima sus gramos de forma realista.
- Los macros y kcal son los TOTALES para los gramos indicados (NO por 100 g).
- TODO alimento real tiene energía: las kcal de un alimento comestible SIEMPRE son > 0.
  Nunca devuelvas 0 kcal para chocolate, pan, arroz, carne, fruta, bebidas azucaradas, etc.
- Usa densidades energéticas estándar como referencia (kcal por 100 g):
  chocolate ~545, chocolate con leche ~535, galletas ~480, pan ~265, arroz cocido ~130,
  pasta cocida ~155, pollo ~165, carne de res ~250, huevo ~155, queso ~350, aguacate ~160,
  manzana ~52, banano ~89, papas fritas ~312, pizza ~266, gaseosa ~42, arroz frito ~190.
- Coherencia: kcal ≈ 4·proteína + 4·carbohidratos + 9·grasa (±10%). Ajusta para que cuadre.
- Si dudas del tamaño de la porción, da tu MEJOR estimación y baja "confidence"; nunca pongas 0.
No incluyas texto fuera del JSON.`;

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
  return normalizeAnalysis(parsed.data);
}

/**
 * Corrige incoherencias típicas de la IA: si un alimento llega con 0 kcal pero
 * tiene macros, calcula las kcal (4/4/9); y si no tiene nada pero sí gramos,
 * estima un mínimo razonable para que nunca quede en 0.
 */
function normalizeAnalysis(a: MealAnalysis): MealAnalysis {
  const items = a.items.map((it) => {
    const fromMacros = Math.round(it.protein * 4 + it.carbs * 4 + it.fat * 9);
    let kcal = it.kcal;
    if (kcal <= 0 && fromMacros > 0) kcal = fromMacros;
    // Última red de seguridad: alimento con gramos pero sin datos → ~2 kcal/g.
    if (kcal <= 0 && it.grams > 0) kcal = Math.round(it.grams * 2);
    return { ...it, kcal };
  });
  return { ...a, items };
}

type OpenAIUserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
