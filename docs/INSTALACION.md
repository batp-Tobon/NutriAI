# Manual de instalación — NutriAI

Guía paso a paso para dejar NutriAI funcionando en local.

## 1. Requisitos

- **Node.js 20+** (probado en 24) y **npm 10+**
- Cuenta en **Supabase** (gratis) → https://supabase.com
- Cuenta en **OpenAI** con saldo/API key → https://platform.openai.com
- (Opcional) CLI: `npm i -g supabase vercel`

## 2. Instalar dependencias

```bash
cd NutriAI
npm install
```

## 3. Crear el proyecto Supabase

1. Entra a https://supabase.com → **New project**.
2. Nombre: `nutriai`. Elige región cercana y una contraseña de BD.
3. Cuando esté listo, ve a **Project Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (¡secreta!)

### 3.1 Aplicar el esquema (tablas, RLS, storage)

Opción simple (SQL Editor):
1. Abre **SQL Editor** en Supabase.
2. Ejecuta, **en orden**, el contenido de cada archivo de
   `supabase/migrations/` (01 → 02 → 03 → 04).

Opción CLI:
```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Detalles en [`supabase/README.md`](../supabase/README.md).

## 4. Configurar autenticación (Supabase Auth)

En **Authentication → Providers**:

- **Email**: activado por defecto. Para desarrollo puedes desactivar
  "Confirm email" para entrar sin verificar.
- **Google**:
  1. Crea credenciales OAuth en Google Cloud Console (tipo *Web*).
  2. Authorized redirect URI:
     `https://TU-PROYECTO.supabase.co/auth/v1/callback`
  3. Pega Client ID y Secret en Supabase → Google.
- **Apple** (requiere Apple Developer, 99 USD/año):
  1. Crea un *Services ID* y una *Key* en developer.apple.com.
  2. Configura el redirect a `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
  3. Pega los datos en Supabase → Apple.

En **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (y tu dominio en producción).
- **Redirect URLs**: añade `http://localhost:3000/auth/callback` y el de producción.

## 5. Configurar OpenAI

1. Crea una API key en https://platform.openai.com/api-keys
2. Ponla en `.env.local` como `OPENAI_API_KEY`.

## 6. Variables de entorno

```bash
cp .env.example .env.local
```
Rellena `.env.local` con los valores de los pasos 3 y 5. Define también
`ADMIN_EMAILS` con tu email para acceder al panel `/admin`.

## 7. Iconos PWA (opcional)

```bash
npm run icons   # genera public/icons/*.png desde icon.svg
```

## 8. Arrancar

```bash
npm run dev
```
Abre http://localhost:3000, regístrate, completa el onboarding y listo.

### Hacerte administrador

Tras registrarte, en el SQL Editor de Supabase:
```sql
update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
```

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| "Supabase no está configurado" | Faltan `NEXT_PUBLIC_SUPABASE_*` en `.env.local`. |
| Login con Google falla | Revisa redirect URIs y Site URL en Supabase Auth. |
| La IA no responde | Falta `OPENAI_API_KEY` o no hay saldo en OpenAI. |
| `/admin` redirige al dashboard | Tu usuario no es admin (paso anterior o `ADMIN_EMAILS`). |
| El service worker no aparece en dev | Es normal: la PWA se desactiva en desarrollo, sólo en `build`. |
