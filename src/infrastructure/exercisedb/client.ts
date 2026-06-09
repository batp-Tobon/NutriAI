import "server-only";
import { env, isExerciseDBConfigured } from "@/lib/env";
import type { WorkoutType } from "@/types/database";
import type { MuscleFocus } from "@/lib/constants";

const BASE = "https://exercisedb.p.rapidapi.com";
const HOST = "exercisedb.p.rapidapi.com";

export interface ExercisePoolItem {
  name: string;
  gifUrl: string;
  target: string;
  bodyPart: string;
  equipment: string;
}

interface RawExercise {
  id: string;
  name: string;
  target: string;
  bodyPart: string;
  equipment: string;
}

/** URL del GIF (endpoint /image de ExerciseDB; requiere la key → se sirve vía proxy). */
function gifUrlFor(id: string): string {
  return `${BASE}/image?resolution=180&exerciseId=${id}`;
}

async function fetchList(path: string, limit = 30): Promise<ExercisePoolItem[]> {
  const url = `${BASE}${path}?limit=${limit}&offset=0`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": env.rapidApiKey,
      "X-RapidAPI-Host": HOST,
    },
    // ExerciseDB es estático: cachea 24h para no gastar la cuota.
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`ExerciseDB ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as RawExercise[];
  return data
    .filter((e) => e.id && e.name)
    .map((e) => ({
      name: e.name,
      gifUrl: gifUrlFor(e.id),
      target: e.target,
      bodyPart: e.bodyPart,
      equipment: e.equipment,
    }));
}

/** Endpoints a consultar según el tipo de entrenamiento. */
function sourcesFor(type: WorkoutType): string[] {
  switch (type) {
    case "home":
      return ["/exercises/equipment/body%20weight"];
    case "cardio":
      return ["/exercises/bodyPart/cardio"];
    case "mobility":
      return ["/exercises/bodyPart/waist", "/exercises/equipment/body%20weight"];
    case "hypertrophy":
      return ["/exercises/equipment/dumbbell", "/exercises/equipment/barbell"];
    case "gym":
    default:
      return ["/exercises/equipment/barbell", "/exercises/equipment/cable"];
  }
}

/** Endpoints según el enfoque muscular elegido (tiene prioridad sobre el tipo). */
function focusSources(focus: MuscleFocus, type: WorkoutType): string[] {
  switch (focus) {
    case "chest":
      return ["/exercises/bodyPart/chest"];
    case "back":
      return ["/exercises/bodyPart/back"];
    case "legs":
      return ["/exercises/bodyPart/upper%20legs", "/exercises/bodyPart/lower%20legs"];
    case "shoulders":
      return ["/exercises/bodyPart/shoulders"];
    case "arms":
      return ["/exercises/bodyPart/upper%20arms", "/exercises/bodyPart/lower%20arms"];
    case "biceps":
      return ["/exercises/target/biceps"];
    case "triceps":
      return ["/exercises/target/triceps"];
    case "glutes":
      return ["/exercises/target/glutes"];
    case "core":
      return ["/exercises/bodyPart/waist"];
    case "full":
    default:
      return sourcesFor(type);
  }
}

/** Equipo disponible en casa (para filtrar cuando el lugar es "home"). */
const HOME_EQUIP = new Set([
  "body weight",
  "band",
  "dumbbell",
  "kettlebell",
  "resistance band",
]);

/** Mezcla y recorta a `max` elementos (variedad entre generaciones). */
function sampleUnique(items: ExercisePoolItem[], max: number): ExercisePoolItem[] {
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const k = i.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, max);
}

/**
 * Devuelve un pool de ejercicios reales (con GIF) adecuado al tipo de
 * entrenamiento. Vacío si ExerciseDB no está configurado.
 */
/** Busca ejercicios del catálogo por nombre (para el constructor manual). */
export async function searchExercises(
  query: string,
  limit = 8,
): Promise<ExercisePoolItem[]> {
  if (!isExerciseDBConfigured() || !query.trim()) return [];
  const q = encodeURIComponent(query.trim().toLowerCase());
  try {
    return await fetchList(`/exercises/name/${q}`, limit);
  } catch {
    return [];
  }
}

export async function fetchExercisePool(
  type: WorkoutType,
  focus: MuscleFocus = "full",
  max = 40,
): Promise<ExercisePoolItem[]> {
  if (!isExerciseDBConfigured()) return [];
  // allSettled: si un endpoint falla (rate limit, etc.), seguimos con el resto.
  const results = await Promise.allSettled(
    focusSources(focus, type).map((p) => fetchList(p)),
  );
  let items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // En casa, prioriza ejercicios sin máquinas (si quedan suficientes).
  if (type === "home") {
    const homeOnly = items.filter((i) => HOME_EQUIP.has(i.equipment));
    if (homeOnly.length >= 6) items = homeOnly;
  }

  return sampleUnique(items, max);
}
