"use server";

import { z } from "zod";
import { createClient } from "@/infrastructure/supabase/server";
import { getUserAccess } from "@/server/access";
import {
  generateMealPlan,
  type MealPlan,
} from "@/infrastructure/openai/meal-planner";
import { env, isOpenAIConfigured } from "@/lib/env";

const schema = z.object({
  targetKcal: z.coerce.number().min(800).max(6000),
  proteinTarget: z.coerce.number().min(20).max(400),
  mealsCount: z.coerce.number().int().min(2).max(6),
  diet: z.enum(["omnivoro", "vegetariano", "vegano"]),
  avoid: z.string().max(200).optional(),
  budget: z.enum(["economico", "medio", "alto"]),
});

export type MealPlanInput = z.input<typeof schema>;

/** Genera un plan de comidas con IA (plan IA + cuota mensual, como otras funciones). */
export async function generateMealPlanAction(
  input: MealPlanInput,
): Promise<{ ok: boolean; plan?: MealPlan; error?: string }> {
  const { userId, access } = await getUserAccess();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!access.aiEnabled) {
    return {
      ok: false,
      error: "El plan de comidas con IA es del plan IA. Cambia de plan para usarlo.",
    };
  }
  if (!isOpenAIConfigured()) {
    return { ok: false, error: "OpenAI no está configurado." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  // Cuota mensual de IA (los admins están exentos)
  if (access.state !== "admin") {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("consume_ai_credit", {
      p_limit: env.aiMonthlyLimit,
    });
    if (!allowed) {
      return { ok: false, error: "Alcanzaste tu límite mensual de usos de IA." };
    }
  }

  try {
    const plan = await generateMealPlan(parsed.data);
    return { ok: true, plan };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al generar el plan",
    };
  }
}
