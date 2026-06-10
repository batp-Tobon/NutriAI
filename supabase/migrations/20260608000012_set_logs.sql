-- ============================================================================
-- NutriAI · 0012 · Registro de series (peso/reps) y récords personales
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

create table if not exists public.workout_set_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  workout_id     uuid references public.workouts(id) on delete set null,
  exercise_name  text not null,
  set_number     int  not null default 1,
  weight_kg      numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps           int  not null default 0 check (reps >= 0),
  performed_at   timestamptz not null default now()
);

create index if not exists idx_set_logs_user_exercise
  on public.workout_set_logs (user_id, exercise_name, performed_at desc);
create index if not exists idx_set_logs_user_weight
  on public.workout_set_logs (user_id, weight_kg desc);

alter table public.workout_set_logs enable row level security;

drop policy if exists set_logs_owner on public.workout_set_logs;
create policy set_logs_owner on public.workout_set_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Retención: incluir los registros de series en la limpieza de 90 días
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
  delete from public.workout_set_logs where performed_at < now() - interval '90 days';
  delete from public.ai_conversations c
  where c.updated_at < now() - interval '90 days'
    and not exists (select 1 from public.ai_messages m where m.conversation_id = c.id);
end;
$$;
