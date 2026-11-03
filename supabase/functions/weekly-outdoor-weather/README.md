# Weekly outdoor weather summaries

This Edge Function writes a weekly high/low temperature and humidity journal entry to every plant assigned to an outdoor location. It uses the postcode-derived coordinates saved in `user_plant_locations.locations.coordinates`; it does not need a phone/browser to be open or to grant browser geolocation.

## Deploy

1. Install and sign in to the Supabase CLI for the project linked to this app.
2. From the repository root, run `supabase functions deploy weekly-outdoor-weather`.
3. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the function. Never put the service-role key in this repository or in `index.html`.

## Schedule it weekly

In Supabase SQL Editor, enable the `pg_cron`, `pg_net`, and `vault` extensions if they are not already enabled. Store two secrets in Vault (replace the example values; do not commit real values):

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'flora_supabase_url');
select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'flora_service_role_key');
```

Then schedule the function for every Monday at 03:15 UTC:

```sql
select cron.schedule(
  'flora-weekly-outdoor-weather',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'flora_supabase_url')
      || '/functions/v1/weekly-outdoor-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'flora_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The run summarises the previous complete Monday–Sunday week using Open-Meteo historical hourly data. It upserts a deterministic journal-log ID for each plant/location/week, so retries do not create duplicate entries. It only processes outdoor locations that have a successfully saved postcode and coordinates. Postcodes are used as approximate area coordinates, not an exact garden sensor location.

To inspect or remove the schedule:

```sql
select * from cron.job where jobname = 'flora-weekly-outdoor-weather';
select cron.unschedule('flora-weekly-outdoor-weather');
```

The SQL schedule and Edge Function deployment are project-level setup steps and must be completed in Supabase; a GitHub commit alone does not turn on the background job.
