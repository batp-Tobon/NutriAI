-- ============================================================================
-- NutriAI · 0006 · Planes (General / IA) y cuota de uso de IA
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

-- ---------- Cuota de IA: consume 1 crédito si no se ha superado el límite ----
-- Devuelve true si se permite (y suma 1), false si ya alcanzó el límite.
-- El periodo se reinicia automáticamente cada 30 días.
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
