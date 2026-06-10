/**
 * Recomendaciones del día (reglas, sin IA → sirve para todos los planes).
 * Analiza calorías/déficit, ejercicio, proteína, sueño e hidratación.
 */
import type { Goal } from "@/types/database";

export type Tone = "good" | "warn" | "info";
export interface Tip {
  tone: Tone;
  text: string;
}

export interface InsightInput {
  goal: Goal | null;
  consumedKcal: number;
  targetKcal: number;
  burned: number;
  proteinConsumed: number;
  proteinTarget: number;
  sleepHours: number | null;
  waterMl: number;
  waterGoalMl: number;
  hour: number;
  mealsCount: number;
}

/** Meta de agua ≈ 35 ml por kg (entre 1500 y 4000 ml). */
export function waterGoalMl(weightKg: number | null): number {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  return Math.min(4000, Math.max(1500, Math.round((w * 35) / 100) * 100));
}

export function dailyInsights(i: InsightInput): Tip[] {
  const tips: Tip[] = [];
  const allowance = i.targetKcal + i.burned; // lo que puede comer hoy
  const remaining = Math.round(allowance - i.consumedKcal);

  // --- Calorías / déficit ---
  if (i.mealsCount === 0) {
    tips.push({
      tone: "info",
      text: "Aún no registras comidas hoy. Empieza por tu próxima comida.",
    });
  } else if (i.consumedKcal > allowance + 120) {
    const over = Math.round(i.consumedKcal - allowance);
    tips.push({
      tone: "warn",
      text:
        i.goal === "lose_fat"
          ? `Vas ${over} kcal por encima de tu déficit. Modera el resto del día o suma cardio.`
          : `Vas ${over} kcal por encima de tu objetivo de hoy.`,
    });
  } else if (remaining > 0) {
    tips.push({
      tone: "good",
      text:
        i.goal === "lose_fat"
          ? `Buen déficit: te quedan ~${remaining} kcal disponibles hoy.`
          : i.goal === "gain_muscle"
            ? `Te faltan ~${remaining} kcal para tu superávit. Suma una comida.`
            : `Vas bien: te quedan ~${remaining} kcal para tu objetivo.`,
    });
  }

  // --- Ejercicio ---
  if (i.burned > 0) {
    tips.push({
      tone: "info",
      text: `Quemaste ~${i.burned} kcal entrenando; tu margen de hoy subió.`,
    });
  }

  // --- Proteína ---
  if (
    i.proteinTarget > 0 &&
    i.hour >= 15 &&
    i.proteinConsumed < i.proteinTarget * 0.6
  ) {
    tips.push({
      tone: "warn",
      text: `Vas bajo en proteína (${Math.round(i.proteinConsumed)}/${Math.round(
        i.proteinTarget,
      )} g). Prioriza proteína en tus próximas comidas.`,
    });
  }

  // --- Sueño ---
  if (i.sleepHours != null) {
    if (i.sleepHours < 6) {
      tips.push({
        tone: "warn",
        text: `Dormiste ${i.sleepHours} h. Prioriza el descanso: ayuda a recuperar y a controlar antojos.`,
      });
    } else if (i.sleepHours >= 7) {
      tips.push({
        tone: "good",
        text: `Buen descanso (${i.sleepHours} h) 👌 Tu recuperación lo agradece.`,
      });
    }
  }

  // --- Agua ---
  if (i.waterMl < i.waterGoalMl) {
    const left = i.waterGoalMl - i.waterMl;
    tips.push({ tone: "info", text: `Hidrátate 💧 Te faltan ${left} ml para tu meta de hoy.` });
  } else {
    tips.push({ tone: "good", text: "¡Hidratación al día! 💧" });
  }

  return tips.slice(0, 4);
}
