import { NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { searchExercises } from "@/infrastructure/exercisedb/client";
import { searchFreeExercises } from "@/infrastructure/freedb/client";

export const runtime = "nodejs";

/**
 * Busca ejercicios combinando 2 catálogos:
 *  - ExerciseDB (GIFs animados) — primero.
 *  - Free Exercise DB (fotos, más cobertura) — después.
 * Traduce la consulta de español a inglés en ambos.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const [edb, free] = await Promise.all([
    searchExercises(q, 18).catch(() => []),
    searchFreeExercises(q, 18).catch(() => []),
  ]);

  // Mezcla: primero los GIF de ExerciseDB, luego las fotos; sin duplicados.
  const seen = new Set<string>();
  const merged: {
    name: string;
    gif_url: string;
    target: string;
    equipment: string;
  }[] = [];
  for (const r of [...edb, ...free]) {
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

  return NextResponse.json(merged.slice(0, 16));
}
