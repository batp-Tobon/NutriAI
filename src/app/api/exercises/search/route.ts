import { NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { searchExercises } from "@/infrastructure/exercisedb/client";

export const runtime = "nodejs";

/** Busca ejercicios del catálogo por nombre (para añadirlos con GIF). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  try {
    const results = await searchExercises(q);
    return NextResponse.json(
      results.map((r) => ({
        name: r.name,
        gif_url: r.gifUrl,
        target: r.target,
        equipment: r.equipment,
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
