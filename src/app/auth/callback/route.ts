import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";

/**
 * Callback de Supabase Auth: intercambia el `code` (OAuth / email) por sesión.
 * Usado por Google, Apple, confirmación de email y recuperación de contraseña.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
