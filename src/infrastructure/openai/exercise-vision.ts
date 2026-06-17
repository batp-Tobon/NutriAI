import "server-only";
import { z } from "zod";
import { createOpenAI } from "./client";
import { env } from "@/lib/env";

const schema = z.object({
  name: z.string(),
  searchTerm: z.string(),
  target: z.string().optional().default(""),
  equipment: z.string().optional().default(""),
  confidence: z.number().min(0).max(1),
});

export type ExerciseVision = z.infer<typeof schema>;

const SYSTEM_PROMPT = `Eres un entrenador de gimnasio experto. A partir de una foto de
una MÁQUINA, mancuerna, barra o de una persona ejecutando un ejercicio, identifica
el ejercicio más probable. Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "name": "nombre del ejercicio en español (ej: Press de pecho en máquina)",
  "searchTerm": "nombre corto en INGLÉS para buscar en un catálogo (ej: chest press)",
  "target": "músculo principal en español (ej: Pecho)",
  "equipment": "equipo en español (ej: Máquina)",
  "confidence": number  // 0..1, tu confianza
}
Si la máquina tiene una etiqueta o lámina con el nombre, úsala. No incluyas texto fuera del JSON.`;

/** Identifica el ejercicio a partir de la foto de una máquina o movimiento. */
export async function identifyExercise(input: {
  imageDataUrl: string;
}): Promise<ExerciseVision> {
  const openai = createOpenAI();

  const completion = await openai.chat.completions.create({
    model: env.openaiVisionModel,
    response_format: { type: "json_object" },
    max_tokens: 300,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "¿Qué ejercicio es esta máquina/movimiento?" },
          { type: "image_url", image_url: { url: input.imageDataUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("La IA no pudo identificar el ejercicio. Inténtalo de nuevo.");
  }
  return parsed.data;
}
