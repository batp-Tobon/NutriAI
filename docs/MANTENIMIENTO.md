# Manual de mantenimiento — NutriAI

## Cambios en la base de datos (migraciones)

1. Crea un nuevo archivo en `supabase/migrations/` con timestamp creciente,
   p. ej. `20260701000001_nueva_columna.sql`.
2. Escribe SQL **idempotente** (`if not exists`, `do $$ ... $$`).
3. Aplícalo: `supabase db push` (o pégalo en el SQL Editor).
4. Si cambian tablas, regenera los tipos:
   ```bash
   supabase gen types typescript --project-id TU_REF > src/types/database.ts
   ```

## Dependencias

```bash
npm outdated          # ver versiones
npm update            # actualizaciones menores
npm run type-check    # verificar tipos tras actualizar
npm run build         # verificar que compila
```
Revisa con cuidado los *majors* de `next`, `react`, `@supabase/*` y `openai`.

## Seguridad

- **RLS**: toda tabla de usuario está protegida (`user_id = auth.uid()`).
  Si añades una tabla nueva, **activa RLS y crea políticas** (mira
  `supabase/migrations/...rls_policies.sql`).
- **service_role key**: sólo en el servidor (`src/infrastructure/supabase/admin.ts`,
  marcado con `server-only`). Nunca con prefijo `NEXT_PUBLIC_`.
- Rota las claves (OpenAI/Supabase) periódicamente desde sus paneles y
  actualízalas en Vercel.

## Costes de IA (OpenAI)

- El análisis de comida usa **Vision** (`gpt-4o`), más caro que el chat.
- El coach y las rutinas usan `gpt-4o-mini` (barato).
- Controla el gasto en https://platform.openai.com/usage y pon **límites de uso**.
- Para abaratar: baja `max_tokens`, cachea resultados frecuentes o cambia de modelo
  en `.env` (`OPENAI_MODEL`, `OPENAI_VISION_MODEL`).

## Backups

- Supabase (plan Pro) hace backups automáticos. En Free, exporta manualmente:
  **Database → Backups** o `supabase db dump > backup.sql`.
- Programa un volcado periódico antes de cambios grandes.

## Observabilidad

- **Vercel**: pestaña *Logs* y *Analytics* del proyecto.
- **Supabase**: *Logs* (API, Auth, Postgres) y *Reports*.
- **OpenAI**: *Usage* y *Limits*.

## Tareas recurrentes sugeridas

| Frecuencia | Tarea |
|---|---|
| Semanal | Revisar uso/errores en Vercel y OpenAI. |
| Mensual | `npm outdated`, aplicar parches de seguridad, revisar backups. |
| Trimestral | Rotar claves, revisar políticas RLS, limpiar datos huérfanos. |

## Notificaciones / recordatorios (extensión)

La tabla `notifications` y la UI ya existen. Para enviar recordatorios
automáticos (comidas, entrenamientos, hidratación), añade un cron
(p. ej. **Vercel Cron** o **Supabase Scheduled Functions**) que inserte filas en
`notifications`. Para push reales, integra Web Push (VAPID) sobre el service worker.

## Estructura de carpetas (recordatorio)

- `core/` lógica de dominio (no tocar para cambios de infraestructura).
- `infrastructure/` adaptadores Supabase/OpenAI.
- `server/actions/` casos de uso de escritura (Server Actions).
- `app/` rutas y API. `components/` UI.

## Solución de problemas en producción

| Síntoma | Diagnóstico |
|---|---|
| 500 en `/api/coach` o `/api/meals/analyze` | Revisa `OPENAI_API_KEY` y los logs de Vercel. |
| Usuarios no pueden ver sus datos | Política RLS mal configurada en una tabla nueva. |
| Login OAuth roto tras cambiar dominio | Actualiza Site URL y Redirect URLs en Supabase. |
| El SW sirve contenido viejo | Workbox cachea; haz un nuevo deploy (cambia el SW) o limpia caché. |
