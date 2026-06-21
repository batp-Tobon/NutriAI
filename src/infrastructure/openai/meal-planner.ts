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

const mealSchema = z.object({
  meal: z.string(),
  meal_type: z
    .enum(["breakfast", "lunch", "dinner", "snack"])
    .default("snack"),
  items: z.array(itemSchema).min(1),
});

const planSchema = z.object({
  title: z.string(),
  meals: z.array(mealSchema).min(1),
  shopping_list: z
    .array(z.object({ name: z.string(), amount: z.string() }))
    .default([]),
});

export type MealPlan = z.infer<typeof planSchema>;

export interface MealPlanInput {
  targetKcal: number;
  proteinTarget: number;
  mealsCount: number;
  diet: "omnivoro" | "vegetariano" | "vegano";
  avoid?: string;
  budget: "economico" | "medio" | "alto";
}

const DIET_LABEL = {
  omnivoro: "omnívora (incluye carnes)",
  vegetariano: "vegetariana (sin carne ni pescado)",
  vegano: "vegana (sin productos animales)",
};
const BUDGET_LABEL = {
  economico: "económico (ingredientes básicos y baratos)",
  medio: "medio",
  alto: "sin restricción de presupuesto",
};

/**
 * Genera un plan de comidas de UN día que cuadre con las calorías y la proteína
 * objetivo, con cocina latina/colombiana asequible y una lista de mercado.
 */
export async function generateMealPlan(input: MealPlanInput): Promise<MealPlan> {
  const openai = createOpenAI();

  const system = `Eres un nutricionista experto en cocina latinoamericana y colombiana.
Diseñas planes de alimentación realistas, económicos y fáciles de preparar.
Devuelve SIEMPRE un JSON válido con esta forma EXACTA:
{
  "title": "nombre corto del plan",
  "meals": [
    {
      "meal": "Desayuno",
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
      "items": [ { "name": "alimento", "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number } ]
    }
  ],
  "shopping_list": [ { "name": "ingrediente", "amount": "cantidad (ej: 500 g, 6 unidades)" } ]
}

REGLAS:
- El TOTAL del día debe acercarse a las calorías objetivo (±5%) y a la proteína objetivo.
- Reparte en el número de comidas pedido. Usa meal_type correcto por comida.
- Macros y kcal son TOTALES para los gramos de cada item (NO por 100 g). kcal ≈ 4·prot + 4·carbs + 9·grasa.
- Comida real y asequible de Colombia (huevo, arroz, frijol, pollo, arepa, plátano, atún, lentejas, avena, fruta…).
- La shopping_list agrega TODOS los ingredientes del día con cantidades aproximadas.
- No incluyas texto fuera del JSON.`;

  const user = `Crea un plan de 1 día.
Objetivo: ${Math.round(input.targetKcal)} kcal y ~${Math.round(input.proteinTarget)} g de proteína.
Comidas: ${input.mealsCount}. Dieta: ${DIET_LABEL[input.diet]}. Presupuesto: ${BUDGET_LABEL[input.budget]}.
${input.avoid?.trim() ? `Evitar: ${input.avoid.trim()}.` : ""}`;

  const completion = await openai.chat.completions.create({
    model: env.openaiVisionModel,
    response_format: { type: "json_object" },
    max_tokens: 1800,
    temperature: 0.5,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = planSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }

  // Normaliza kcal: si llega 0 pero hay macros, calcula 4/4/9.
  const plan = parsed.data;
  for (const m of plan.meals) {
    for (const it of m.items) {
      if (it.kcal <= 0) {
        it.kcal = Math.round(it.protein * 4 + it.carbs * 4 + it.fat * 9);
      }
    }
  }
  return plan;
}
