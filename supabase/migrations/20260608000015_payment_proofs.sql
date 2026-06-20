-- ============================================================================
-- NutriAI · 0015 · Confirmación de pagos (comprobantes)
-- El usuario envía su comprobante → pago 'pending' → el admin lo confirma.
-- Ejecuta este archivo en el SQL Editor de Supabase (después de 0014).
-- ============================================================================

-- Estado del pago y URL/ruta del comprobante.
alter table public.payments
  add column if not exists status text not null default 'confirmed',
  add column if not exists proof_url text;

create index if not exists idx_payments_status
  on public.payments (status, created_at desc);

-- Bucket privado para los comprobantes (sólo el dueño escribe; el admin lee
-- con la service_role). Convención de ruta: "<user_id>/<archivo>".
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists payment_proofs_rw on storage.objects;
create policy payment_proofs_rw on storage.objects for all
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
