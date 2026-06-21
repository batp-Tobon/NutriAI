import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions). En Next 15 `cookies()` es asíncrono.
 *
 * Envuelto en `cache()`: dentro de un mismo request se reutiliza el mismo
 * cliente (no se vuelven a leer las cookies en cada llamada).
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: el middleware refresca la sesión.
        }
      },
    },
  });
});

/**
 * Usuario autenticado (o null). `cache()` lo deduplica: aunque lo llamen el
 * layout y la página en el mismo request, sólo se valida el token UNA vez.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Perfil del usuario actual (o null), deduplicado por request. Evita que el
 * layout y la página consulten `profiles` por separado en cada navegación.
 */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});
