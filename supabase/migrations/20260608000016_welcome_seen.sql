-- ============================================================================
-- NutriAI · 0016 · Bienvenida de suscripción (mostrar una sola vez)
-- Marca cuándo el usuario vio la tarjeta de "suscripción activa" para no
-- repetirla en el mismo periodo. Ejecuta en el SQL Editor de Supabase.
-- ============================================================================

alter table public.profiles
  add column if not exists welcome_seen_at timestamptz;
