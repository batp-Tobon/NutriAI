# Login social (Google · Outlook · Facebook)

Los botones ya están en la app (pantalla de login/registro). Para que **funcionen**
hay que **activar cada proveedor en Supabase** y crear su "app" OAuth en cada
plataforma. El código no requiere cambios.

## Notas

- **Outlook/Microsoft/Hotmail/Live**: en Supabase el proveedor se llama **Azure**.
  Un solo botón ("Outlook") cubre todas las cuentas Microsoft.
- **Instagram** no es un proveedor de login independiente: se autentica con
  **Facebook Login** (ambas son de Meta). Por eso usamos **Facebook**.
- **Apple** se quitó (requiere cuenta de pago de USD $99/año).

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

## Outlook / Microsoft (gratis) — proveedor "Azure"

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** →
   **App registrations → New registration**.
2. Nombre: NutriAI. En "Supported account types" elige **"Accounts in any
   organizational directory and personal Microsoft accounts"** (para Outlook/Hotmail/Live).
3. **Redirect URI** → tipo **Web** → pega el callback de Supabase (arriba).
4. Crea la app y copia el **Application (client) ID**.
5. **Certificates & secrets → New client secret** → copia el **Value** del secreto.
6. Supabase → **Authentication → Providers → Azure** → pega Client ID y Secret.
   En "Azure Tenant URL" deja `https://login.microsoftonline.com/common` (cuentas
   personales). **Activa**.

## Probar

Tras activar un proveedor, en la pantalla de login aparece su botón funcional. Al
entrar por primera vez, Supabase crea el usuario y el trigger del perfil lo lleva
al onboarding, igual que con email.
