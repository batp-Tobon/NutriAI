-- ============================================================================
-- NutriAI · 0013 · Suma atómica de agua (evita perder toques rápidos)
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

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
