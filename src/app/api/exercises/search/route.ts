import { NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { searchExercises } from "@/infrastructure/exercisedb/client";
import { searchFreeExercises } from "@/infrastructure/freedb/client";
import { searchWger } from "@/infrastructure/wger/client";

export const runtime = "nodejs";

/**
 * Busca ejercicios combinando 3 catálogos (todos gratis):
 *  - ExerciseDB (GIFs animados) — primero, por la animación.
 *  - wger (español nativo + imágenes, open source) — gran cobertura en español.
 *  - Free Exercise DB (fotos) — relleno extra.
 * Se traduce la consulta de español a inglés y se deduplica por nombre.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const [edb, wger, free] = await Promise.all([
    searchExercises(q, 18).catch(() => []),
    searchWger(q, 18).catch(() => []),
    searchFreeExercises(q, 18).catch(() => []),
  ]);

  // Mezcla en orden de preferencia; sin duplicados por nombre.
  const seen = new Set<string>();
  const merged: {
    name: string;
    gif_url: string;
    target: string;
    equipment: string;
  }[] = [];
  for (const r of [...edb, ...wger, ...free]) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name: r.name,
      gif_url: r.gifUrl,
      target: r.target,
      equipment: r.equipment,
    });
  }

  return NextResponse.json(merged.slice(0, 24));
}
