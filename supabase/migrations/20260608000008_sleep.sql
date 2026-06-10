-- ============================================================================
-- NutriAI · 0008 · Registro de horas de sueño (en la tabla progress, por día)
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.progress
  add column if not exists sleep_hours numeric(3, 1)
    check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));
