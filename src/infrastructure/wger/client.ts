import "server-only";
import { parseExerciseQuery } from "@/infrastructure/exercisedb/client";

/**
 * wger (https://wger.de) — gestor de entrenamiento open source con una API REST
 * pública y SIN llave. Su catálogo (~850 ejercicios) trae traducciones en varios
 * idiomas, incluido ESPAÑOL nativo, además de imágenes, categoría y músculos.
 *
 * La API ya no expone /exercise/search, así que descargamos todo el catálogo
 * (/exerciseinfo) una vez, lo cacheamos en memoria y filtramos localmente. Al
 * tener nombres en español, podemos hacer match directo con la consulta del
 * usuario (sin traducir) y, además, contra el nombre en inglés ya traducido.
 */

const DATASET_URL = "https://wger.de/api/v2/exerciseinfo/?format=json&limit=900";

// IDs de idioma en wger: 2 = inglés, 4 = español.
const LANG_EN = 2;
const LANG_ES = 4;

/** Quita tildes/diacríticos (combina con normalize("NFD")). */
const DIACRITICS = /[̀-ͯ]/g;

interface WgerInfo {
  category?: { name?: string };
  muscles?: { name_en?: string }[];
  equipment?: { name?: string }[];
  images?: { image?: string; is_main?: boolean }[];
  translations?: { name?: string; language?: number }[];
}

export interface WgerItem {
  name: string;
  gifUrl: string; // imagen (png); se sirve por el mismo proxy
  target: string;
  equipment: string;
}

/** Ejercicio ya normalizado y listo para buscar/mostrar. */
interface NormalizedExercise {
  display: string; // nombre a mostrar (prefiere español)
  haystack: string; // texto donde buscar (todos los nombres + músculo + equipo)
  gifUrl: string;
  target: string;
  equipment: string;
}

let cache: NormalizedExercise[] | null = null;

const STOP = new Set([
  "de", "con", "el", "la", "los", "las", "en", "y", "a", "del", "al",
  "por", "para", "un", "una", "the", "of", "with",
]);

/** Parte la consulta en español en palabras útiles (sin acentos/stopwords). */
function spanishWords(q: string): string[] {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

async function getDataset(): Promise<NormalizedExercise[]> {
  if (cache) return cache;
  try {
    const res = await fetch(DATASET_URL, {
      headers: { "User-Agent": "NutriAI/1.0 (nutrition app)" },
      next: { revalidate: 604800 }, // 1 semana: el catálogo es estático
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: WgerInfo[] };

    cache = (data.results ?? [])
      .map((r): NormalizedExercise | null => {
        const tr = r.translations ?? [];
        const es = tr.find((t) => t.language === LANG_ES)?.name?.trim();
        const en = tr.find((t) => t.language === LANG_EN)?.name?.trim();
        const display = es || en || tr[0]?.name?.trim() || "";
        if (!display) return null;

        const img =
          r.images?.find((i) => i.is_main)?.image ?? r.images?.[0]?.image ?? "";
        const muscle = r.muscles?.[0]?.name_en ?? r.category?.name ?? "";
        const equipment = r.equipment?.[0]?.name ?? "";

        const names = tr.map((t) => t.name ?? "").join(" ");
        const haystack = `${names} ${muscle} ${equipment} ${r.category?.name ?? ""}`
          .toLowerCase()
          .normalize("NFD")
          .replace(DIACRITICS, "");

        return { display, haystack, gifUrl: img, target: muscle, equipment };
      })
      .filter((x): x is NormalizedExercise => x !== null);

    return cache;
  } catch {
    return [];
  }
}

/**
 * Busca en wger. Combina las palabras de la consulta tal cual (español) con su
 * traducción al inglés, y puntúa por cuántas aparecen en el ejercicio.
 */
export async function searchWger(
  query: string,
  limit = 12,
): Promise<WgerItem[]> {
  if (!query.trim()) return [];
  const ds = await getDataset();
  if (ds.length === 0) return [];

  const { words: enWords, movement } = parseExerciseQuery(query);
  const terms = [...new Set([...spanishWords(query), ...enWords])].filter(
    (t) => t.length > 2,
  );
  if (terms.length === 0) return [];

  const scored = ds
    .map((e) => {
      let score = terms.reduce((s, w) => s + (e.haystack.includes(w) ? 1 : 0), 0);
      if (movement && e.display.toLowerCase().includes(movement)) score += 1;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ e }) => ({
    name: e.display,
    gifUrl: e.gifUrl,
    target: e.target,
    equipment: e.equipment,
  }));
}
