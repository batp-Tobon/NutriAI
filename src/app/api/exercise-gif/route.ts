import { NextResponse } from "next/server";
import { env, isExerciseDBConfigured } from "@/lib/env";

export const runtime = "nodejs";

// Sólo proxeamos imágenes desde estos hosts (evita open-proxy / SSRF).
const ALLOWED_SUFFIXES = ["exercisedb.io", "rapidapi.com"];

/**
 * Proxy de GIFs de ExerciseDB: descarga la imagen en el servidor (añadiendo la
 * RapidAPI key si hace falta) y la sirve, para que el <img> cargue siempre.
 *   /api/exercise-gif?u=<url-codificada>
 */
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u");
  if (!u) return new NextResponse("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }

  const ok =
    target.protocol === "https:" &&
    ALLOWED_SUFFIXES.some(
      (h) => target.hostname === h || target.hostname.endsWith("." + h),
    );
  if (!ok) return new NextResponse("forbidden host", { status: 403 });

  try {
    const upstream = await fetch(target.toString(), {
      headers: isExerciseDBConfigured()
        ? {
            "X-RapidAPI-Key": env.rapidApiKey,
            "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
          }
        : {},
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) return new NextResponse("not found", { status: 404 });

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/gif",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch error", { status: 502 });
  }
}
