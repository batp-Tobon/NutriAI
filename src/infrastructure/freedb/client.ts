import "server-only";
import { parseExerciseQuery } from "@/infrastructure/exercisedb/client";

// Free Exercise DB (open data, sin llave): ~870 ejercicios con fotos.
const DATASET_URL =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

interface FreeExercise {
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  category?: string;
  images: string[];
}

export interface FreeExerciseItem {
  name: string;
  gifUrl: string; // foto (jpg); se sirve igual por el proxy
  target: string;
  equipment: string;
}

let cache: FreeExercise[] | null = null;

async function getDataset(): Promise<FreeExercise[]> {
  if (cache) return cache;
  try {
    const res = await fetch(DATASET_URL, { next: { revalidate: 604800 } });
    if (!res.ok) return [];
    cache = (await res.json()) as FreeExercise[];
    return cache;
  } catch {
    return [];
  }
}

/** Busca en el dataset local (en memoria) por palabras clave traducidas. */
export async function searchFreeExercises(
  query: string,
  limit = 10,
): Promise<FreeExerciseItem[]> {
  if (!query.trim()) return [];
  const { words, movement } = parseExerciseQuery(query);
  if (words.length === 0) return [];

  const ds = await getDataset();
  if (ds.length === 0) return [];

  const scored = ds
    .map((e) => {
      const name = e.name.toLowerCase();
      const score = words.reduce((s, w) => s + (name.includes(w) ? 1 : 0), 0);
      return { e, score };
    })
    .filter(
      (x) =>
        x.score > 0 &&
        (!movement || x.e.name.toLowerCase().includes(movement)),
    )
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, limit)
    .map(({ e }) => ({
      name: e.name,
      gifUrl: e.images?.[0] ? IMG_BASE + e.images[0] : "",
      target: e.primaryMuscles?.[0] ?? "",
      equipment: e.equipment ?? "",
    }))
    .filter((x) => x.gifUrl);
}
