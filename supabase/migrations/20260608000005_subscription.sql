-- ============================================================================
-- NutriAI · 0005 · Suscripción (prueba 5 días + mensualidad) y retención 90 días
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

-- ---------- Columnas de suscripción en profiles ----------
alter table public.profiles
  add column if not exists trial_ends_at    timestamptz,
  add column if not exists subscribed_until timestamptz;

-- Backfill: a los perfiles ya existentes les damos 5 días desde su creación.
update public.profiles
set trial_ends_at = created_at + interval '5 days'
where trial_ends_at is null;

-- ---------- Trigger: asignar prueba de 5 días al registrarse ----------
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

-- ---------- Retención: borrar datos con más de 90 días ----------
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
  -- conversaciones vacías y antiguas
  delete from public.ai_conversations c
  where c.updated_at < now() - interval '90 days'
    and not exists (select 1 from public.ai_messages m where m.conversation_id = c.id);
end;
$$;

grant execute on function public.delete_old_data() to service_role;

-- (meal_items se borra solo por ON DELETE CASCADE al borrar su meal)
