-- New accounts start without pre-populated growing locations.
-- Changing the column default affects future inserts only; existing users' rows are preserved.
alter table public.user_plant_locations
    alter column locations set default '[]'::jsonb;
