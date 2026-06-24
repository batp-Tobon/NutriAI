-- ============================================================================
-- NutriAI · EJECUTAR ESTO EN SUPABASE (una sola vez)
-- ----------------------------------------------------------------------------
-- Cómo: Supabase → SQL Editor → New query → pega TODO → botón "Run".
-- Es seguro correrlo aunque ya hayas corrido algo antes (usa IF NOT EXISTS /
-- CREATE OR REPLACE). Incluye las migraciones 0011, 0012 y 0013.
-- ============================================================================


-- ============================================================================
-- 0011 · Recordatorio de pago del gimnasio
-- ============================================================================
alter table public.profiles
  add column if not exists gym_payment_day int
    check (gym_payment_day between 1 and 31);

alter table public.profiles
  add column if not exists gym_last_reminded_at date;


-- ============================================================================
-- 0012 · Registro de series (pesos por serie) y récords personales (PRs)
-- ============================================================================
create table if not exists public.workout_set_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workout_id    uuid references public.workouts(id) on delete set null,
  exercise_name text not null,
  set_number    int  not null default 1,
  weight_kg     numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps          int not null default 0 check (reps >= 0),
  performed_at  timestamptz not null default now()
);

create index if not exists idx_set_logs_user_exercise
  on public.workout_set_logs (user_id, exercise_name, performed_at desc);

create index if not exists idx_set_logs_workout
  on public.workout_set_logs (workout_id);

alter table public.workout_set_logs enable row level security;

drop policy if exists "set_logs_select_own" on public.workout_set_logs;
create policy "set_logs_select_own" on public.workout_set_logs
  for select using (auth.uid() = user_id);

drop policy if exists "set_logs_insert_own" on public.workout_set_logs;
create policy "set_logs_insert_own" on public.workout_set_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "set_logs_update_own" on public.workout_set_logs;
create policy "set_logs_update_own" on public.workout_set_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "set_logs_delete_own" on public.workout_set_logs;
create policy "set_logs_delete_own" on public.workout_set_logs
  for delete using (auth.uid() = user_id);


-- ============================================================================
-- 0013 · Suma atómica de agua (no se pierden los toques rápidos)
-- ============================================================================
-- Asegura la columna de agua por si la 0009 no se corrió
alter table public.progress
  add column if not exists water_ml int not null default 0
    check (water_ml >= 0);

create or replace function public.add_water(p_ml int, p_date date)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_total int;
begin
  insert into public.progress (user_id, recorded_at, water_ml)
  values (auth.uid(), p_date, greatest(0, p_ml))
  on conflict (user_id, recorded_at)
  do update set water_ml = greatest(0, public.progress.water_ml + p_ml)
  returning water_ml into v_total;
  return v_total;
end;
$$;

grant execute on function public.add_water(int, date) to authenticated;


-- ============================================================================
-- 0014 · Pagos / ingresos (base para SaaS)
-- ============================================================================
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  user_email    text,
  amount        numeric(12,2) not null default 0 check (amount >= 0),
  currency      text not null default 'COP',
  plan          text not null default 'ai',
  method        text not null default 'bre-b',
  reference     text,
  period_start  date,
  period_end    date,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_payments_created on public.payments (created_at desc);
create index if not exists idx_payments_user on public.payments (user_id);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);


-- ============================================================================
-- 0015 · Confirmación de pagos (comprobantes)
-- ============================================================================
alter table public.payments
  add column if not exists status text not null default 'confirmed',
  add column if not exists proof_url text;

create index if not exists idx_payments_status
  on public.payments (status, created_at desc);

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists payment_proofs_rw on storage.objects;
create policy payment_proofs_rw on storage.objects for all
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 0016 · Bienvenida de suscripción (mostrar una sola vez)
-- ============================================================================
alter table public.profiles
  add column if not exists welcome_seen_at timestamptz;

-- ============================================================================
-- LISTO. Si no salió ningún error en rojo, ya quedó todo.
-- ============================================================================
