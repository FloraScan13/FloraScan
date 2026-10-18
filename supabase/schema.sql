-- Flora Scan schema
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.plants (
  id text primary key,
  name text not null,
  variety text,
  color text not null default '#16a34a',
  medium text,
  notes text,
  date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.plant_logs (
  id text primary key,
  plant_id text not null references public.plants(id) on delete cascade,
  date date not null,
  type text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_plants_updated_at on public.plants(updated_at desc);
create index if not exists idx_plant_logs_plant_id on public.plant_logs(plant_id);
create index if not exists idx_plant_logs_created_at on public.plant_logs(created_at desc);

-- Keep updated_at current on update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_plants_updated_at on public.plants;
create trigger trg_plants_updated_at
before update on public.plants
for each row
execute function public.set_updated_at();

-- Recommended baseline RLS
alter table public.plants enable row level security;
alter table public.plant_logs enable row level security;

-- For now, allow anon read/write (adjust for auth later)
drop policy if exists "anon full access plants" on public.plants;
create policy "anon full access plants"
on public.plants
for all
to anon
using (true)
with check (true);

drop policy if exists "anon full access plant_logs" on public.plant_logs;
create policy "anon full access plant_logs"
on public.plant_logs
for all
to anon
using (true)
with check (true);

-- App settings (branding only; Supabase URL/key are never stored remotely)
create table if not exists public.app_settings (
  id text primary key,
  username text,
  logo_url text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "anon full access app_settings" on public.app_settings;
create policy "anon full access app_settings"
on public.app_settings
for all
to anon
using (true)
with check (true);
