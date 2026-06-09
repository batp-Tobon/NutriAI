-- ============================================================================
-- NutriAI · 0002 · Row Level Security (RLS)
-- Cada usuario sólo accede a SUS datos. Los admins pueden LEER todo.
-- Las escrituras privilegiadas del panel admin usan la service_role key
-- (que ignora RLS), por eso aquí los admins sólo tienen políticas de lectura.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.progress          enable row level security;
alter table public.measurements      enable row level security;
alter table public.workouts          enable row level security;
alter table public.notifications     enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.ai_messages       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_insert_own   on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;

create policy profiles_select_own   on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_insert_own   on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own   on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- foods  (públicos visibles para todos; privados sólo del dueño)
-- ---------------------------------------------------------------------------
drop policy if exists foods_select on public.foods;
drop policy if exists foods_insert on public.foods;
drop policy if exists foods_update on public.foods;
drop policy if exists foods_delete on public.foods;

create policy foods_select on public.foods for select
  using (is_public or created_by = auth.uid() or public.is_admin());
create policy foods_insert on public.foods for insert
  with check (created_by = auth.uid());
create policy foods_update on public.foods for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy foods_delete on public.foods for delete
  using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------
drop policy if exists meals_owner        on public.meals;
drop policy if exists meals_select_admin on public.meals;

create policy meals_owner on public.meals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meals_select_admin on public.meals for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- meal_items  (propiedad heredada de la comida padre)
-- ---------------------------------------------------------------------------
drop policy if exists meal_items_owner on public.meal_items;

create policy meal_items_owner on public.meal_items for all
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- progress
-- ---------------------------------------------------------------------------
drop policy if exists progress_owner        on public.progress;
drop policy if exists progress_select_admin on public.progress;

create policy progress_owner on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_select_admin on public.progress for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- measurements
-- ---------------------------------------------------------------------------
drop policy if exists measurements_owner on public.measurements;

create policy measurements_owner on public.measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
drop policy if exists workouts_owner        on public.workouts;
drop policy if exists workouts_select_admin on public.workouts;

create policy workouts_owner on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_select_admin on public.workouts for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_owner on public.notifications;

create policy notifications_owner on public.notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ai_conversations
-- ---------------------------------------------------------------------------
drop policy if exists ai_conv_owner on public.ai_conversations;

create policy ai_conv_owner on public.ai_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ai_messages
-- ---------------------------------------------------------------------------
drop policy if exists ai_msg_owner on public.ai_messages;

create policy ai_msg_owner on public.ai_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
