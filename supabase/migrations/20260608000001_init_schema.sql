-- ============================================================================
-- NutriAI · 0001 · Esquema inicial
-- Tablas, enums, relaciones, índices, funciones y triggers.
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";                         -- gen_random_uuid()
create extension if not exists "pg_trgm";                          -- búsqueda de alimentos
create extension if not exists "moddatetime" schema extensions;    -- updated_at automático

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
-- profiles  (1:1 con auth.users — auth.users ES la tabla "users")
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
-- foods  (catálogo de alimentos; macros por 100 g)
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
-- meals  (comida registrada — cabecera con totales)
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
-- progress  (peso y composición corporal en el tiempo)
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
-- notifications  (recordatorios: comida / entrenamiento / hidratación)
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
  title       text not null default 'Nueva conversación',
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
-- Índices
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

-- updated_at automático
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

drop trigger if exists ai_conv_set_updated_at on public.ai_conversations;
create trigger ai_conv_set_updated_at
  before update on public.ai_conversations
  for each row execute procedure extensions.moddatetime(updated_at);

-- Crear profile automáticamente al registrarse un usuario
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

-- ¿El usuario actual es admin?
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
