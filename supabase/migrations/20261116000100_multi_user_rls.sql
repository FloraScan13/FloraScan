-- FloraScan multi-account row-level security hardening.
-- Each authenticated gardener can only read or modify their own garden records.
-- Admin privileges are deliberately NOT included in these data policies.

drop policy if exists "Users can manage own plants" on public.plants;
create policy "Users can read own plants" on public.plants
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own plants" on public.plants
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own plants" on public.plants
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own plants" on public.plants
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own plant logs" on public.plant_logs;
create policy "Users can read own plant logs" on public.plant_logs
  for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.plants p
    where p.id = plant_logs.plant_id and p.user_id = (select auth.uid())
  ));
create policy "Users can insert own plant logs" on public.plant_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.plants p
    where p.id = plant_logs.plant_id and p.user_id = (select auth.uid())
  ));
create policy "Users can update own plant logs" on public.plant_logs
  for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.plants p
    where p.id = plant_logs.plant_id and p.user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.plants p
    where p.id = plant_logs.plant_id and p.user_id = (select auth.uid())
  ));
create policy "Users can delete own plant logs" on public.plant_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.plants p
    where p.id = plant_logs.plant_id and p.user_id = (select auth.uid())
  ));

drop policy if exists "Users can insert their own plant locations" on public.user_plant_locations;
drop policy if exists "Users can read their own plant locations" on public.user_plant_locations;
drop policy if exists "Users can update their own plant locations" on public.user_plant_locations;
create policy "Users can read own plant locations" on public.user_plant_locations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own plant locations" on public.user_plant_locations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own plant locations" on public.user_plant_locations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own plant locations" on public.user_plant_locations
  for delete to authenticated using ((select auth.uid()) = user_id);
