-- ============================================================================
-- NutriAI · 0011 · Recordatorio de pago de la mensualidad del gym
-- Ejecuta este archivo en el SQL Editor de Supabase (una vez).
-- ============================================================================

alter table public.profiles
  add column if not exists gym_payment_day int
    check (gym_payment_day is null or (gym_payment_day between 1 and 31)),
  add column if not exists gym_last_reminded_at date;
