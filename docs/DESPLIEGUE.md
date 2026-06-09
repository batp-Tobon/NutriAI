# Manual de despliegue — NutriAI (Vercel)

## 1. Preparar el repositorio

```bash
git init
git add .
git commit -m "NutriAI inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/nutriai.git
git push -u origin main
```

> `.env.local` está en `.gitignore`: **nunca** subas secretos al repo.

## 2. Importar en Vercel

1. https://vercel.com → **Add New → Project** → importa el repo.
2. Framework: **Next.js** (autodetectado). Build: `next build` (por defecto).
3. No despliegues aún: primero añade las variables de entorno.

## 3. Variables de entorno en Vercel

En **Project → Settings → Environment Variables**, añade (Production + Preview):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (marca como *Sensitive*) |
| `OPENAI_API_KEY` | tu clave OpenAI |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `OPENAI_VISION_MODEL` | `gpt-4o` |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.vercel.app` |
| `ADMIN_EMAILS` | tu email admin |

## 4. Desplegar

Pulsa **Deploy**. Vercel construye y publica. Cada `git push` a `main`
genera un nuevo despliegue de producción; las ramas generan *previews*.

## 5. Ajustes posteriores al primer deploy

1. Copia la URL final (p. ej. `https://nutriai.vercel.app`).
2. Actualiza `NEXT_PUBLIC_APP_URL` con esa URL y **redeploy**.
3. En **Supabase → Authentication → URL Configuration**:
   - **Site URL**: tu dominio de producción.
   - **Redirect URLs**: añade `https://tu-dominio/auth/callback`.
4. En **Google/Apple OAuth**: añade el redirect de Supabase si cambió.

## 6. Dominio propio (opcional)

Vercel → **Settings → Domains** → añade tu dominio y sigue las instrucciones DNS.
Recuerda actualizar `NEXT_PUBLIC_APP_URL` y las Redirect URLs de Supabase.

## 7. Verificación de la PWA

- Abre la web en Chrome → DevTools → **Application → Manifest / Service Workers**.
- Debe aparecer el manifest y el SW registrado (sólo en producción/build).
- En móvil: menú del navegador → "Añadir a pantalla de inicio".

## 8. Despliegue por CLI (alternativa)

```bash
vercel        # preview
vercel --prod # producción
```

## Checklist de producción

- [ ] Migraciones aplicadas en el Supabase de producción.
- [ ] Variables de entorno cargadas en Vercel.
- [ ] Site URL y Redirect URLs correctas en Supabase.
- [ ] `OPENAI_API_KEY` con saldo y límites configurados.
- [ ] Confirmación de email activada en Auth (producción).
- [ ] Al menos un usuario admin (`role = 'admin'`).
