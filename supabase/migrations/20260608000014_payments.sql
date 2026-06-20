-- ============================================================================
-- NutriAI · 0014 · Pagos / ingresos (base para SaaS)
-- Registra cada pago de mensualidad (manual por Bre-B) para llevar ingresos,
-- historial y métricas. Ejecuta este archivo en el SQL Editor de Supabase.
-- ============================================================================

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  -- Si se elimina el usuario, conservamos el pago para el histórico de ingresos.
  user_id       uuid references auth.users(id) on delete set null,
  user_email    text,                       -- copia para el histórico
  amount        numeric(12,2) not null default 0 check (amount >= 0),
  currency      text not null default 'COP',
  plan          text not null default 'ai', -- 'general' | 'ai'
  method        text not null default 'bre-b',
  reference     text,                        -- nº de comprobante / nota
  period_start  date,
  period_end    date,
  created_by    uuid references auth.users(id) on delete set null, -- admin
  created_at    timestamptz not null default now()
);

create index if not exists idx_payments_created on public.payments (created_at desc);
create index if not exists idx_payments_user on public.payments (user_id);

alter table public.payments enable row level security;

-- Cada usuario puede ver SUS pagos (para un futuro historial de facturación).
-- El panel admin usa la service_role (salta RLS), así que no necesita política.
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);
