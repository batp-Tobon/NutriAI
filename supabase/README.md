# Base de datos NutriAI (Supabase)

Migraciones en orden (`supabase/migrations/`):

| Archivo | Contenido |
|---|---|
| `…01_init_schema.sql` | Extensiones, enums, tablas, índices, funciones y triggers |
| `…02_rls_policies.sql` | Row Level Security (aislamiento por usuario + lectura admin) |
| `…03_storage.sql` | Buckets de fotos (`meal-images`, `progress-photos`, `avatars`) y sus policies |
| `…04_seed_foods.sql` | Catálogo inicial de alimentos |

## Opción A — Editor SQL (la más simple)

1. Entra a tu proyecto en https://supabase.com → **SQL Editor**.
2. Abre cada archivo de `migrations/` **en orden** y pulsa **Run**.
3. Listo. Las tablas, RLS y buckets quedan creados.

## Opción B — CLI de Supabase

```bash
# 1. Inicia sesión (abre el navegador)
supabase login

# 2. Enlaza tu proyecto (project ref está en Settings → General)
supabase link --project-ref TU_PROJECT_REF

# 3. Aplica todas las migraciones
supabase db push
```

## Hacerte administrador

Tras registrarte una vez en la app, ejecuta en el SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
```

## Modelo de datos

```
auth.users (gestionado por Supabase)
  └─ profiles (1:1)
foods ──< meal_items >── meals ──< (user)
progress, measurements, workouts, notifications  (todas ──< user)
ai_conversations ──< ai_messages
```

Todas las tablas de usuario llevan `user_id` con RLS `user_id = auth.uid()`.
`meal_items` hereda la propiedad de su `meal` padre.
