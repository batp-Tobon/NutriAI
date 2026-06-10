-- ============================================================================
-- NutriAI · 0009 · Hidratación (agua) por día, en la tabla progress
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.progress
  add column if not exists water_ml int not null default 0
    check (water_ml >= 0);
