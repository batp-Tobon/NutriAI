import "server-only";
import { z } from "zod";
import { createOpenAI } from "./client";
import { env } from "@/lib/env";
import type { Goal, WorkoutBlock, WorkoutType } from "@/types/database";
import type { ExercisePoolItem } from "@/infrastructure/exercisedb/client";
import { MUSCLE_FOCUS_LABELS, type MuscleFocus } from "@/lib/constants";

const planSchema = z.object({
  title: z.string(),
  difficulty: z.string(),
  duration_min: z.number().int().positive(),
  plan: z
    .array(
      z.object({
        block: z.string(),
        exercises: z
          .array(
            z.object({
              name: z.string(),
              sets: z.number().int().positive(),
              reps: z.string(),
              rest_sec: z.number().int().nonnegative(),
              notes: z.string().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type GeneratedWorkout = z.infer<typeof planSchema>;

export interface WorkoutRequest {
  workoutType: WorkoutType;
  goal: Goal;
  durationMin: number;
  level: "principiante" | "intermedio" | "avanzado";
  focus: MuscleFocus;
  notes?: string;
}

const SYSTEM_PROMPT = `Eres un entrenador personal. Generas rutinas seguras y efectivas.
Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "title": "string",
  "difficulty": "principiante|intermedio|avanzado",
  "duration_min": number,
  "plan": [
    { "block": "Calentamiento|Principal|Cardio|Enfriamiento",
      "exercises": [ { "name": "string", "sets": number, "reps": "string", "rest_sec": number, "notes": "string opcional" } ] }
  ]
}
Adapta los ejercicios al lugar (casa/gimnasio) y objetivo. No incluyas texto fuera del JSON.`;

/** Genera una rutina de entrenamiento personalizada con IA. */
export async function generateWorkout(
  req: WorkoutRequest,
): Promise<GeneratedWorkout> {
  const openai = createOpenAI();

  const userPrompt = `Genera una rutina:
- Lugar/tipo: ${req.workoutType}
- Objetivo: ${req.goal}
- Enfoque muscular: ${MUSCLE_FOCUS_LABELS[req.focus]}
- Duración: ${req.durationMin} minutos
- Nivel: ${req.level}
${req.notes ? `- Notas: ${req.notes}` : ""}`;

  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = planSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }
  return parsed.data;
}

// ----------------------------------------------------------------------------
// Rutina basada en ejercicios REALES (con GIF) de ExerciseDB.
// La IA elige de un pool por `id`, así que cada ejercicio tiene su GIF asegurado.
// ----------------------------------------------------------------------------

const poolPlanSchema = z.object({
  title: z.string(),
  difficulty: z.string(),
  duration_min: z.number().int().positive(),
  blocks: z
    .array(
      z.object({
        block: z.string(),
        items: z
          .array(
            z.object({
              id: z.number().int().nonnegative(),
              name_es: z.string(),
              sets: z.number().int().positive(),
              reps: z.string(),
              rest_sec: z.number().int().nonnegative(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export interface GeneratedWorkoutWithGifs {
  title: string;
  difficulty: string;
  duration_min: number;
  plan: WorkoutBlock[];
}

const POOL_SYSTEM = `Eres un entrenador personal. Construyes una rutina usando SOLO los ejercicios de la lista que te paso (cada uno tiene un id).
Devuelve SIEMPRE JSON válido con esta forma exacta:
{
  "title": "string",
  "difficulty": "principiante|intermedio|avanzado",
  "duration_min": number,
  "blocks": [
    { "block": "Calentamiento|Principal|Cardio|Enfriamiento",
      "items": [ { "id": number, "name_es": "nombre del ejercicio traducido al español", "sets": number, "reps": "string", "rest_sec": number } ] }
  ]
}
Reglas: usa entre 5 y 8 ejercicios en total; el id DEBE existir en la lista; "name_es" es la traducción al español del nombre del ejercicio de ese id; ajusta series/reps al objetivo y nivel. No incluyas texto fuera del JSON.`;

/** Genera una rutina seleccionando ejercicios reales del pool (con GIF). */
export async function generateWorkoutFromPool(
  req: WorkoutRequest,
  pool: ExercisePoolItem[],
): Promise<GeneratedWorkoutWithGifs> {
  const openai = createOpenAI();

  const list = pool
    .map((e, i) => `${i}: ${e.name} (músculo: ${e.target}, equipo: ${e.equipment})`)
    .join("\n");

  const userPrompt = `Objetivo: ${req.goal}. Duración: ${req.durationMin} min. Nivel: ${req.level}.${
    req.notes ? ` Notas: ${req.notes}.` : ""
  }
Ejercicios disponibles (usa SOLO estos id):
${list}`;

  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 1100,
    messages: [
      { role: "system", content: POOL_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = poolPlanSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }

  const plan: WorkoutBlock[] = parsed.data.blocks
    .map((b) => ({
      block: b.block,
      exercises: b.items
        .filter((it) => pool[it.id])
        .map((it) => {
          const ex = pool[it.id];
          return {
            name: it.name_es?.trim() || ex.name,
            sets: it.sets,
            reps: it.reps,
            rest_sec: it.rest_sec,
            gif_url: ex.gifUrl,
            target: ex.target,
            equipment: ex.equipment,
          };
        }),
    }))
    .filter((b) => b.exercises.length > 0);

  if (plan.length === 0) {
    throw new Error("No se pudo construir la rutina. Inténtalo de nuevo.");
  }

  return {
    title: parsed.data.title,
    difficulty: parsed.data.difficulty,
    duration_min: parsed.data.duration_min,
    plan,
  };
}

