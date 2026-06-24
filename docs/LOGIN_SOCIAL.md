# Login social (Google · Apple · Facebook)

Los botones ya están en la app (pantalla de login/registro). Para que **funcionen**
hay que **activar cada proveedor en Supabase** y crear su "app" OAuth en cada
plataforma. El código no requiere cambios.

## Importante: ¿Instagram?

Instagram **no** es un proveedor de login independiente. Las cuentas de Instagram
se autentican con **Facebook Login** (ambas son de Meta). Por eso agregamos
**Facebook**, que cubre a los usuarios de Meta. No existe un botón "Instagram".

## Paso 0 — URLs en Supabase

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://nutri-ai-chi-three.vercel.app`
- **Redirect URLs**: añade `https://nutri-ai-chi-three.vercel.app/auth/callback`
  (y `http://localhost:3000/auth/callback` para desarrollo).

El **callback de Supabase** que pedirá cada plataforma es:
`https://zmzkutaelwheafdsmlzx.supabase.co/auth/v1/callback`

## Google (gratis)

1. Google Cloud Console → crea un proyecto → **APIs & Services → OAuth consent screen**
   (tipo "External", pon nombre, correo y dominio).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. En "Authorized redirect URIs" pega el callback de Supabase (arriba).
4. Copia **Client ID** y **Client secret**.
5. Supabase → **Authentication → Providers → Google** → pégalos y **activa**.

## Facebook (gratis) — cubre Instagram/Meta

1. [Meta for Developers](https://developers.facebook.com) → **My Apps → Create App**
   → tipo "Consumer" → añade el producto **Facebook Login**.
2. Facebook Login → **Settings** → en "Valid OAuth Redirect URIs" pega el callback
   de Supabase.
3. **Settings → Basic**: copia **App ID** y **App Secret**; agrega la **Política de
   privacidad** (URL) — Meta la exige para publicar.
4. Supabase → **Authentication → Providers → Facebook** → pégalos y **activa**.
5. Pon la app de Meta en modo **Live** (mientras esté en "Development" solo entran
   los testers que agregues).

## Apple (requiere Apple Developer, USD $99/año)

1. Apple Developer → **Certificates, Identifiers & Profiles**:
   - Crea un **App ID** y un **Services ID** (este es el "client id").
   - Habilita "Sign in with Apple" y registra el dominio + el callback de Supabase.
   - Crea una **Key** para "Sign in with Apple" y descarga el `.p8`.
2. Supabase → **Authentication → Providers → Apple** → completa Services ID, Team ID,
   Key ID y la clave `.p8`. **Activa**.

> Apple es el más laborioso y tiene costo anual. Si aún no tienes cuenta de Apple
> Developer, puedes empezar solo con **Google + Facebook** (ambos gratis) y dejar
> Apple para cuando publiques en la App Store.

## Probar

Tras activar un proveedor, en la pantalla de login aparece su botón funcional. Al
entrar por primera vez, Supabase crea el usuario y el trigger del perfil lo lleva
al onboarding, igual que con email.
