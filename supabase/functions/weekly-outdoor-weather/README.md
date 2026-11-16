# Weekly outdoor weather summaries

This Edge Function writes a weekly high/low temperature and humidity journal entry to every plant assigned to an outdoor location. It uses the postcode-derived coordinates saved in `user_plant_locations.locations.coordinates`; it does not need a phone/browser to be open or to grant browser geolocation.

## Deploy and configure secrets

1. Install and sign in to the Supabase CLI for the project linked to this app.
2. Generate a long, random secret (at least 32 bytes) locally. Do not use the service-role key as the cron secret.
3. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add:
   - `FLORA_CRON_SECRET`: the random secret generated in step 2.
   - Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the function.
4. Deploy with gateway JWT verification disabled because this scheduled endpoint authenticates its own requests using `FLORA_CRON_SECRET`:
   ```sh
   supabase functions deploy weekly-outdoor-weather --no-verify-jwt
   ```
5. Store the same cron secret in Vault (replace the example values; never commit real values):
   ```sql
   -- Keep the existing flora_supabase_url secret if it is already correct.
   select vault.create_secret('GENERATED_FLORA_CRON_SECRET', 'flora_cron_secret');
   ```
   If either Vault secret already exists, update it rather than creating a duplicate.

## Schedule it weekly

In Supabase SQL Editor, enable the `pg_cron`, `pg_net`, and `vault` extensions if they are not already enabled. If the job is already scheduled, remove the old definition first so it does not keep sending the service-role key:

\`\`\`sql
select cron.unschedule('flora-weekly-outdoor-weather');
\`\`\`

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
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'flora_cron_secret')
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

The SQL schedule, Vault secret, Edge Function secrets, and Edge Function deployment are project-level setup steps and must be completed in Supabase; a GitHub commit alone does not turn on the background job. The cron secret is separate from the service-role key: the former authenticates the scheduler, while the latter remains server-side for privileged database access.
