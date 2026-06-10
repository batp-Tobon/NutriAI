-- NutriAI - Esquema completo (pega todo en el SQL Editor y RUN).

-- >>> 20260608000001_init_schema.sql >>>
-- ============================================================================
-- NutriAI Â· 0001 Â· Esquema inicial
-- Tablas, enums, relaciones, Ã­ndices, funciones y triggers.
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";                         -- gen_random_uuid()
create extension if not exists "pg_trgm";                          -- bÃºsqueda de alimentos
create extension if not exists "moddatetime" schema extensions;    -- updated_at automÃ¡tico

-- ---------- Enums ----------
do $$ begin create type public.user_role      as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sex            as enum ('male','female','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.activity_level as enum ('sedentary','light','moderate','active','very_active'); exception when duplicate_object then null; end $$;
do $$ begin create type public.goal           as enum ('lose_fat','maintain','gain_muscle'); exception when duplicate_object then null; end $$;
do $$ begin create type public.meal_type      as enum ('breakfast','lunch','dinner','snack'); exception when duplicate_object then null; end $$;
do $$ begin create type public.meal_source    as enum ('photo','text','manual'); exception when duplicate_object then null; end $$;
do $$ begin create type public.workout_type   as enum ('home','gym','cardio','hypertrophy','mobility'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_type as enum ('meal','workout','hydration','system'); exception when duplicate_object then null; end $$;

-- ============================================================================
-- profiles  (1:1 con auth.users â€” auth.users ES la tabla "users")
-- ============================================================================
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text,
  full_name              text,
  avatar_url             text,
  role                   public.user_role      not null default 'user',
  age                    int check (age between 0 and 120),
  sex                    public.sex,
  height_cm              numeric(5,2) check (height_cm > 0),
  current_weight_kg      numeric(5,2) check (current_weight_kg > 0),
  target_weight_kg       numeric(5,2) check (target_weight_kg > 0),
  activity_level         public.activity_level default 'moderate',
  goal                   public.goal           default 'maintain',
  -- Objetivos diarios cacheados (los calcula la app al guardar el perfil)
  daily_calorie_target   int,
  daily_protein_target   int,
  daily_carbs_target     int,
  daily_fat_target       int,
  onboarding_completed    boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ============================================================================
-- foods  (catÃ¡logo de alimentos; macros por 100 g)
-- ============================================================================
create table if not exists public.foods (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  brand              text,
  kcal_per_100g      numeric(7,2) not null default 0 check (kcal_per_100g >= 0),
  protein_per_100g   numeric(6,2) not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g     numeric(6,2) not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g       numeric(6,2) not null default 0 check (fat_per_100g >= 0),
  is_public          boolean not null default true,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ============================================================================
-- meals  (comida registrada â€” cabecera con totales)
-- ============================================================================
create table if not exists public.meals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text,
  meal_type       public.meal_type   not null default 'snack',
  source          public.meal_source not null default 'manual',
  image_url       text,
  notes           text,
  ai_confidence   numeric(4,3) check (ai_confidence between 0 and 1),
  total_kcal      numeric(8,2) not null default 0,
  total_protein   numeric(7,2) not null default 0,
  total_carbs     numeric(7,2) not null default 0,
  total_fat       numeric(7,2) not null default 0,
  consumed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- meal_items  (alimentos dentro de una comida)
-- ============================================================================
create table if not exists public.meal_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals(id) on delete cascade,
  food_id     uuid references public.foods(id) on delete set null,
  name        text not null,
  grams       numeric(7,2) not null default 0 check (grams >= 0),
  kcal        numeric(8,2) not null default 0,
  protein     numeric(7,2) not null default 0,
  carbs       numeric(7,2) not null default 0,
  fat         numeric(7,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- progress  (peso y composiciÃ³n corporal en el tiempo)
-- ============================================================================
create table if not exists public.progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  weight_kg       numeric(5,2) check (weight_kg > 0),
  body_fat_pct    numeric(4,1) check (body_fat_pct between 0 and 100),
  muscle_mass_kg  numeric(5,2),
  photo_url       text,
  recorded_at     date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (user_id, recorded_at)
);

-- ============================================================================
-- measurements  (medidas perimetrales)
-- ============================================================================
create table if not exists public.measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  waist_cm     numeric(5,1),
  chest_cm     numeric(5,1),
  arm_cm       numeric(5,1),
  leg_cm       numeric(5,1),
  hip_cm       numeric(5,1),
  recorded_at  date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (user_id, recorded_at)
);

-- ============================================================================
-- workouts  (rutinas de entrenamiento)
-- ============================================================================
create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  workout_type  public.workout_type not null default 'gym',
  goal          public.goal,
  duration_min  int,
  difficulty    text,
  -- Plan estructurado: [{ "block": "...", "exercises": [{ "name","sets","reps","rest_sec","notes" }] }]
  plan          jsonb not null default '[]'::jsonb,
  ai_generated  boolean not null default false,
  scheduled_for date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- notifications  (recordatorios: comida / entrenamiento / hidrataciÃ³n)
-- ============================================================================
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          public.notification_type not null default 'system',
  title         text not null,
  body          text,
  scheduled_for timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- ai_conversations + ai_messages  (chat del Coach IA)
-- ============================================================================
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Nueva conversaciÃ³n',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null check (role in ('user','assistant','system')),
  content          text not null,
  created_at       timestamptz not null default now()
);

-- ============================================================================
-- Ãndices
-- ============================================================================
create index if not exists idx_meals_user_consumed       on public.meals (user_id, consumed_at desc);
create index if not exists idx_meals_user_type           on public.meals (user_id, meal_type);
create index if not exists idx_meal_items_meal           on public.meal_items (meal_id);
create index if not exists idx_progress_user_date        on public.progress (user_id, recorded_at desc);
create index if not exists idx_measurements_user_date    on public.measurements (user_id, recorded_at desc);
create index if not exists idx_workouts_user_created     on public.workouts (user_id, created_at desc);
create index if not exists idx_workouts_user_scheduled   on public.workouts (user_id, scheduled_for);
create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where read_at is null;
create index if not exists idx_ai_conv_user_updated      on public.ai_conversations (user_id, updated_at desc);
create index if not exists idx_ai_msg_conversation       on public.ai_messages (conversation_id, created_at);
create index if not exists idx_foods_name_trgm           on public.foods using gin (name gin_trgm_ops);

-- ============================================================================
-- Funciones y triggers
-- ============================================================================

-- updated_at automÃ¡tico
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

drop trigger if exists ai_conv_set_updated_at on public.ai_conversations;
create trigger ai_conv_set_updated_at
  before update on public.ai_conversations
  for each row execute procedure extensions.moddatetime(updated_at);

-- Crear profile automÃ¡ticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Â¿El usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Recalcular totales de una comida a partir de sus items
create or replace function public.recalc_meal_totals(p_meal_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.meals m set
    total_kcal    = coalesce((select sum(kcal)    from public.meal_items where meal_id = p_meal_id), 0),
    total_protein = coalesce((select sum(protein) from public.meal_items where meal_id = p_meal_id), 0),
    total_carbs   = coalesce((select sum(carbs)   from public.meal_items where meal_id = p_meal_id), 0),
    total_fat     = coalesce((select sum(fat)     from public.meal_items where meal_id = p_meal_id), 0)
  where m.id = p_meal_id;
$$;


-- >>> 20260608000002_rls_policies.sql >>>
-- ============================================================================
-- NutriAI Â· 0002 Â· Row Level Security (RLS)
-- Cada usuario sÃ³lo accede a SUS datos. Los admins pueden LEER todo.
-- Las escrituras privilegiadas del panel admin usan la service_role key
-- (que ignora RLS), por eso aquÃ­ los admins sÃ³lo tienen polÃ­ticas de lectura.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.progress          enable row level security;
alter table public.measurements      enable row level security;
alter table public.workouts          enable row level security;
alter table public.notifications     enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.ai_messages       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_insert_own   on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;

create policy profiles_select_own   on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_insert_own   on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own   on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- foods  (pÃºblicos visibles para todos; privados sÃ³lo del dueÃ±o)
-- ---------------------------------------------------------------------------
drop policy if exists foods_select on public.foods;
drop policy if exists foods_insert on public.foods;
drop policy if exists foods_update on public.foods;
drop policy if exists foods_delete on public.foods;

create policy foods_select on public.foods for select
  using (is_public or created_by = auth.uid() or public.is_admin());
create policy foods_insert on public.foods for insert
  with check (created_by = auth.uid());
create policy foods_update on public.foods for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy foods_delete on public.foods for delete
  using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------
drop policy if exists meals_owner        on public.meals;
drop policy if exists meals_select_admin on public.meals;

create policy meals_owner on public.meals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meals_select_admin on public.meals for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- meal_items  (propiedad heredada de la comida padre)
-- ---------------------------------------------------------------------------
drop policy if exists meal_items_owner on public.meal_items;

create policy meal_items_owner on public.meal_items for all
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- progress
-- ---------------------------------------------------------------------------
drop policy if exists progress_owner        on public.progress;
drop policy if exists progress_select_admin on public.progress;

create policy progress_owner on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_select_admin on public.progress for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- measurements
-- ---------------------------------------------------------------------------
drop policy if exists measurements_owner on public.measurements;

create policy measurements_owner on public.measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
drop policy if exists workouts_owner        on public.workouts;
drop policy if exists workouts_select_admin on public.workouts;

create policy workouts_owner on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_select_admin on public.workouts for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_owner on public.notifications;

create policy notifications_owner on public.notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ai_conversations
-- ---------------------------------------------------------------------------
drop policy if exists ai_conv_owner on public.ai_conversations;

create policy ai_conv_owner on public.ai_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ai_messages
-- ---------------------------------------------------------------------------
drop policy if exists ai_msg_owner on public.ai_messages;

create policy ai_msg_owner on public.ai_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- >>> 20260608000003_storage.sql >>>
-- ============================================================================
-- NutriAI Â· 0003 Â· Storage (buckets para fotos)
-- meal-images / progress-photos: privados (sÃ³lo el dueÃ±o).
-- avatars: pÃºblico de lectura.
-- ConvenciÃ³n de rutas: "<user_id>/<archivo>" para poder aislar por usuario.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('meal-images',     'meal-images',     false),
  ('progress-photos', 'progress-photos', false),
  ('avatars',         'avatars',         true)
on conflict (id) do nothing;

-- ---------- meal-images ----------
drop policy if exists meal_images_rw on storage.objects;
create policy meal_images_rw on storage.objects for all
  to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- progress-photos ----------
drop policy if exists progress_photos_rw on storage.objects;
create policy progress_photos_rw on storage.objects for all
  to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- avatars (lectura pÃºblica, escritura sÃ³lo del dueÃ±o) ----------
drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_write  on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- >>> 20260608000004_seed_foods.sql >>>
-- ============================================================================
-- NutriAI Â· 0004 Â· Semilla de alimentos comunes (macros por 100 g)
-- CatÃ¡logo pÃºblico base. La IA y el buscador parten de aquÃ­.
-- ============================================================================

insert into public.foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_public)
values
  ('Pechuga de pollo a la plancha', 165, 31.0, 0.0,  3.6, true),
  ('Arroz blanco cocido',           130,  2.7, 28.0, 0.3, true),
  ('Arroz integral cocido',         123,  2.7, 25.6, 1.0, true),
  ('Huevo entero',                  155, 13.0, 1.1, 11.0, true),
  ('Clara de huevo',                 52, 11.0, 0.7,  0.2, true),
  ('Avena en hojuelas',             389, 16.9, 66.3, 6.9, true),
  ('Banano',                         89,  1.1, 22.8, 0.3, true),
  ('Manzana',                        52,  0.3, 14.0, 0.2, true),
  ('SalmÃ³n',                        208, 20.0, 0.0, 13.0, true),
  ('AtÃºn en agua',                  116, 26.0, 0.0,  1.0, true),
  ('Carne de res magra',            187, 26.0, 0.0,  9.0, true),
  ('Lomo de cerdo',                 242, 27.0, 0.0, 14.0, true),
  ('Lentejas cocidas',              116,  9.0, 20.0, 0.4, true),
  ('Frijoles cocidos',              127,  8.7, 22.8, 0.5, true),
  ('BrÃ³coli',                        34,  2.8, 6.6,  0.4, true),
  ('Patata cocida',                  87,  1.9, 20.1, 0.1, true),
  ('Batata (camote)',                86,  1.6, 20.1, 0.1, true),
  ('Pan integral',                  247, 13.0, 41.0, 3.4, true),
  ('Aguacate',                      160,  2.0, 9.0, 15.0, true),
  ('Almendras',                     579, 21.2, 21.6, 49.9, true),
  ('Aceite de oliva',               884,  0.0, 0.0, 100.0, true),
  ('Leche entera',                   61,  3.2, 4.8,  3.3, true),
  ('Yogur griego natural',           59, 10.0, 3.6,  0.4, true),
  ('Queso fresco',                  264, 18.0, 3.4, 20.0, true),
  ('ProteÃ­na whey (polvo)',         400, 80.0, 8.0,  6.0, true),
  ('Pasta cocida',                  158,  5.8, 31.0, 0.9, true),
  ('Tomate',                         18,  0.9, 3.9,  0.2, true),
  ('Lechuga',                        15,  1.4, 2.9,  0.2, true),
  ('Espinaca',                       23,  2.9, 3.6,  0.4, true),
  ('Zanahoria',                      41,  0.9, 9.6,  0.2, true)
on conflict do nothing;


-- >>> 20260608000005_subscription.sql >>>
-- ============================================================================
-- NutriAI Â· 0005 Â· SuscripciÃ³n (prueba 5 dÃ­as + mensualidad) y retenciÃ³n 90 dÃ­as
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

-- ---------- Columnas de suscripciÃ³n en profiles ----------
alter table public.profiles
  add column if not exists trial_ends_at    timestamptz,
  add column if not exists subscribed_until timestamptz;

-- Backfill: a los perfiles ya existentes les damos 5 dÃ­as desde su creaciÃ³n.
update public.profiles
set trial_ends_at = created_at + interval '5 days'
where trial_ends_at is null;

-- ---------- Trigger: asignar prueba de 5 dÃ­as al registrarse ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    now() + interval '5 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- RetenciÃ³n: borrar datos con mÃ¡s de 90 dÃ­as ----------
create or replace function public.delete_old_data()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.meals        where consumed_at < now() - interval '90 days';
  delete from public.progress     where recorded_at < (now() - interval '90 days')::date;
  delete from public.measurements where recorded_at < (now() - interval '90 days')::date;
  delete from public.workouts     where created_at  < now() - interval '90 days';
  delete from public.notifications where created_at < now() - interval '90 days';
  delete from public.ai_messages  where created_at  < now() - interval '90 days';
  -- conversaciones vacÃ­as y antiguas
  delete from public.ai_conversations c
  where c.updated_at < now() - interval '90 days'
    and not exists (select 1 from public.ai_messages m where m.conversation_id = c.id);
end;
$$;

grant execute on function public.delete_old_data() to service_role;

-- (meal_items se borra solo por ON DELETE CASCADE al borrar su meal)


-- >>> 20260608000006_plans.sql >>>
-- ============================================================================
-- NutriAI Â· 0006 Â· Planes (General / IA) y cuota de uso de IA
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.profiles
  add column if not exists plan             text not null default 'general',
  add column if not exists ai_uses          int  not null default 0,
  add column if not exists ai_period_start  timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('general', 'ai'));
  end if;
end $$;

-- ---------- Cuota de IA: consume 1 crÃ©dito si no se ha superado el lÃ­mite ----
-- Devuelve true si se permite (y suma 1), false si ya alcanzÃ³ el lÃ­mite.
-- El periodo se reinicia automÃ¡ticamente cada 30 dÃ­as.
create or replace function public.consume_ai_credit(p_limit int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_uses  int;
  v_start timestamptz;
begin
  select ai_uses, ai_period_start
    into v_uses, v_start
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    return false;
  end if;

  if v_start is null or v_start < now() - interval '30 days' then
    v_uses := 0;
    v_start := now();
  end if;

  if v_uses >= p_limit then
    update public.profiles
       set ai_uses = v_uses, ai_period_start = v_start
     where id = auth.uid();
    return false;
  end if;

  update public.profiles
     set ai_uses = v_uses + 1, ai_period_start = v_start
   where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.consume_ai_credit(int) to authenticated;


-- >>> 20260608000007_subscription_dates.sql >>>
-- ============================================================================
-- NutriAI Â· 0007 Â· Fechas de suscripciÃ³n y control de avisos de vencimiento
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.profiles
  add column if not exists subscription_started_at timestamptz,
  add column if not exists renewal_notified_at     timestamptz;


-- >>> 20260608000008_sleep.sql >>>
-- ============================================================================
-- NutriAI Â· 0008 Â· Registro de horas de sueÃ±o (en la tabla progress, por dÃ­a)
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.progress
  add column if not exists sleep_hours numeric(3, 1)
    check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));


