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
// ---------------------------------------------------------------------------
// Búsqueda de ejercicios: el catálogo está en inglés, así que traducimos la
// consulta (español) al inglés y la ordenamos como nombra ExerciseDB
// ("[equipo] [modificador] [zona] [movimiento]") para que el match sea bueno.
// ---------------------------------------------------------------------------

const ES_EN: Record<string, string> = {
  press: "press", banca: "bench", banco: "bench",
  inclinado: "incline", inclinada: "incline",
  declinado: "decline", declinada: "decline",
  plano: "flat", plana: "flat",
  mancuerna: "dumbbell", mancuernas: "dumbbell",
  barra: "barbell", polea: "cable", cable: "cable",
  maquina: "machine", "máquina": "machine", multipower: "smith", smith: "smith",
  kettlebell: "kettlebell", rusa: "kettlebell",
  banda: "band", liga: "band",
  sentadilla: "squat", sentadillas: "squat",
  zancada: "lunge", zancadas: "lunge", desplante: "lunge",
  remo: "row", remos: "row",
  dominada: "pull-up", dominadas: "pull-up",
  jalon: "pulldown", "jalón": "pulldown",
  curl: "curl", biceps: "biceps", "bíceps": "biceps",
  triceps: "triceps", "tríceps": "triceps",
  fondos: "dips", fondo: "dip",
  frances: "skull", "francés": "skull",
  extension: "extension", "extensión": "extension", extensiones: "extension",
  patada: "kickback", patadas: "kickback",
  elevacion: "raise", "elevación": "raise", elevaciones: "raise",
  lateral: "lateral", laterales: "lateral",
  frontal: "front", posterior: "rear",
  apertura: "fly", aperturas: "fly", cristo: "fly",
  encogimiento: "shrug", encogimientos: "shrug", trapecio: "shrug",
  flexion: "push-up", "flexión": "push-up", flexiones: "push-up",
  plancha: "plank",
  abdominal: "crunch", abdominales: "crunch", abdomen: "crunch", crunch: "crunch",
  gemelo: "calf", gemelos: "calf", pantorrilla: "calf",
  hombro: "shoulder", hombros: "shoulder", militar: "military",
  pecho: "chest", pectoral: "chest", pectorales: "chest",
  espalda: "back", pierna: "leg", piernas: "leg",
  puente: "bridge", empuje: "thrust", cadera: "hip",
  sentado: "seated", sentada: "seated",
  parado: "standing", parada: "standing",
  acostado: "lying", tumbado: "lying",
  martillo: "hammer", concentrado: "concentration",
  predicador: "preacher", scott: "preacher", arnold: "arnold",
  rumano: "romanian", rumana: "romanian", sumo: "sumo",
  cerrado: "close", abierto: "wide", ancho: "wide",
  invertido: "reverse", invertida: "reverse",
  alterno: "alternate", alternado: "alternate", pullover: "pullover",
};

const MULTI: [RegExp, string][] = [
  [/peso\s+muerto/gi, " deadlift "],
  [/press\s+militar/gi, " shoulder press "],
  [/elevaci[oó]n(?:es)?\s+lateral(?:es)?/gi, " lateral raise "],
  [/curl\s+martillo/gi, " hammer curl "],
  [/hip\s+thrust/gi, " hip thrust "],
];

const STOP = new Set(["de","con","el","la","los","las","en","y","a","del","al","por","para","un","una","the","of","with","sobre"]);
const EQUIP = new Set(["dumbbell","barbell","cable","machine","kettlebell","band","smith"]);
const MOVES = new Set(["press","row","curl","raise","fly","extension","squat","deadlift","lunge","pulldown","push-up","dip","dips","plank","crunch","shrug","pullover","thrust","bridge","kickback","pushdown","pull-up","skull"]);
const MODIFIERS = new Set(["incline","decline","flat","reverse","close","wide","front","rear","seated","standing","lying","prone","single","alternate","hammer","preacher","concentration","military","romanian","sumo","arnold"]);
const AREA = new Set(["bench","shoulder","chest","leg","hip","glute","biceps","triceps","back","calf"]);

function translateToWords(q: string): string[] {
  let s = ` ${q.toLowerCase()} `;
  for (const [re, en] of MULTI) s = s.replace(re, en);
  const out: string[] = [];
  for (const raw of s.split(/[\s,]+/)) {
    const w = raw.trim();
    if (!w || STOP.has(w)) continue;
    for (const part of (ES_EN[w] ?? w).split(" ")) if (part) out.push(part);
  }
  return [...new Set(out)];
}

function buildPhrase(words: string[]): { phrase: string; movement: string } {
  const mods = words.filter((w) => MODIFIERS.has(w));
  const areas = words.filter((w) => AREA.has(w));
  const moves = words.filter((w) => MOVES.has(w));
  const others = words.filter(
    (w) => !MODIFIERS.has(w) && !AREA.has(w) && !MOVES.has(w) && !EQUIP.has(w),
  );
  return {
    phrase: [...mods, ...areas, ...others, ...moves].join(" ").trim(),
    movement: moves[0] ?? "",
  };
}

/** Busca ejercicios del catálogo; traduce el español al inglés del catálogo. */
export async function searchExercises(
  query: string,
  limit = 10,
): Promise<ExercisePoolItem[]> {
  if (!isExerciseDBConfigured() || !query.trim()) return [];
  const words = translateToWords(query);
  const { phrase, movement } = buildPhrase(words);

  // Intenta: frase ordenada → palabra de movimiento → consulta cruda.
  const tries = [phrase, movement, query.toLowerCase().trim()].filter(
    (t, i, a) => t && a.indexOf(t) === i,
  );
  for (const t of tries) {
    const list = await fetchList(
      `/exercises/name/${encodeURIComponent(t)}`,
      15,
    ).catch(() => [] as ExercisePoolItem[]);
    if (list.length > 0) return list.slice(0, limit);
  }
  return [];
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
