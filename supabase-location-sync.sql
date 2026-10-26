-- FloraScan location sync prerequisites
-- Run this in Supabase SQL Editor for the project used by FloraScan.
-- Plant assignments are stored on each plant row.
alter table public.plants add column if not exists location text not null default '';

-- Store the user's configured list of growing locations across devices.
create table if not exists public.user_plant_locations (
    user_id uuid primary key references auth.users(id) on delete cascade,
    locations jsonb not null default '["Grow Tent","Front Garden","Back Garden","Greenhouse","Windowsill"]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.user_plant_locations enable row level security;

drop policy if exists "Users can read their own plant locations" on public.user_plant_locations;
create policy "Users can read their own plant locations"
    on public.user_plant_locations for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own plant locations" on public.user_plant_locations;
create policy "Users can insert their own plant locations"
    on public.user_plant_locations for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own plant locations" on public.user_plant_locations;
create policy "Users can update their own plant locations"
    on public.user_plant_locations for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Ensure the existing plants table has row-level security policies that allow
-- authenticated users to select and insert/update only their own rows.
-- Keep your existing plant policies if they already enforce this correctly.
