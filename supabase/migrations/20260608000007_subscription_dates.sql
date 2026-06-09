-- ============================================================================
-- NutriAI · 0007 · Fechas de suscripción y control de avisos de vencimiento
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.profiles
  add column if not exists subscription_started_at timestamptz,
  add column if not exists renewal_notified_at     timestamptz;
