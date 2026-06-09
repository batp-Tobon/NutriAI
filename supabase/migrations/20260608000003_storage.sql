-- ============================================================================
-- NutriAI · 0003 · Storage (buckets para fotos)
-- meal-images / progress-photos: privados (sólo el dueño).
-- avatars: público de lectura.
-- Convención de rutas: "<user_id>/<archivo>" para poder aislar por usuario.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('meal-images',     'meal-images',     false),
  ('progress-photos', 'progress-photos', false),
  ('avatars',         'avatars',         true)
on conflict (id) do nothing;

-- ---------- meal-images ----------
drop policy if exists meal_images_rw on storage.objects;
create policy meal_images_rw on storage.objects for all
  to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- progress-photos ----------
drop policy if exists progress_photos_rw on storage.objects;
create policy progress_photos_rw on storage.objects for all
  to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- avatars (lectura pública, escritura sólo del dueño) ----------
drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_write  on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
