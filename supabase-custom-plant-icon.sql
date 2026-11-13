-- Allows each plant to use a separately stored journal photo as its profile icon.
-- Apply once to the Supabase project used by FloraScan.
alter table public.plants
    add column if not exists custom_icon_path text;
