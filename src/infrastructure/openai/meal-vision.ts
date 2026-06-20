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

const SYSTEM_PROMPT = `Eres un nutricionista experto en cocina latinoamericana y colombiana que
analiza comidas a partir de fotos o texto. Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "name": "nombre corto del plato",
  "items": [
    { "name": "ingrediente", "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number }
  ],
  "confidence": number  // 0..1, qué tan seguro estás de la estimación
}

REGLAS OBLIGATORIAS:
- DESCOMPÓN el plato en sus INGREDIENTES principales: cada ingrediente es un item con SUS gramos.
  Un plato preparado NO es un solo item. (Ej.: changua = huevos + leche + pan/calados + agua/cebolla/cilantro).
- RESPETA las cantidades que indique el usuario. "5 huevos" = 5 huevos (~50 g c/u = 250 g de huevo).
  "una taza de arroz" ≈ 150-200 g · "un vaso de leche" ≈ 200-250 g · "una arepa" ≈ 90-120 g ·
  "una cucharada de aceite" ≈ 14 g · "una porción/plato" = ración real servida.
- ESTIMA la porción REAL servida. NUNCA uses 100 g por defecto. Un plato o tazón completo suele
  pesar 350-700 g en total (sumando ingredientes). Sé generoso y realista, no minimices.
- Los macros y kcal son los TOTALES para los gramos de ESE item (NO por 100 g).
- TODO alimento real tiene energía: las kcal SIEMPRE son > 0. Nunca 0 para pan, arroz, huevo, etc.
- Densidades de referencia (kcal/100 g): huevo ~155, leche entera ~62, pan ~265, arroz cocido ~130,
  pasta cocida ~155, pollo ~165, carne ~250, queso ~350, aguacate ~160, arepa ~220, frijoles ~130,
  aceite ~884, azúcar ~400, chocolate ~545, banano ~89, papa cocida ~85, papas fritas ~312.
- Coherencia: kcal ≈ 4·proteína + 4·carbohidratos + 9·grasa (±10%). Ajusta hasta que cuadre.
- Si dudas del tamaño, da tu MEJOR estimación y baja "confidence"; nunca pongas 0.

EJEMPLO. Entrada: "changua tradicional con 5 huevos y pan". Salida:
{
  "name": "Changua con huevos",
  "items": [
    { "name": "Huevos (5)", "grams": 250, "kcal": 360, "protein": 32, "carbs": 2, "fat": 25 },
    { "name": "Leche entera", "grams": 200, "kcal": 124, "protein": 6.4, "carbs": 9.6, "fat": 6.6 },
    { "name": "Pan / calados", "grams": 50, "kcal": 150, "protein": 5, "carbs": 27, "fat": 2 }
  ],
  "confidence": 0.6
}

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
    ? `Analiza esta comida y descomponla en ingredientes. Descripción del usuario: "${input.description}". Respeta las cantidades que menciona.`
    : "Analiza la comida de la imagen y descomponla en sus ingredientes con porciones realistas.";

  const userContent: OpenAIUserContent = hasImage
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: input.imageDataUrl! } },
      ]
    : userText;

  // Usamos el modelo fuerte (visión) también para texto: el análisis nutricional
  // requiere más precisión que el modelo "mini".
  const completion = await openai.chat.completions.create({
    model: env.openaiVisionModel,
    response_format: { type: "json_object" },
    max_tokens: 1200,
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
