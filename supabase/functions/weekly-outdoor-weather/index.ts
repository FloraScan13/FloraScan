// Scheduled weekly outdoor weather journal summaries.
// Deploy with: supabase functions deploy weekly-outdoor-weather
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
function dateOnly(d: Date): string { return d.toISOString().slice(0, 10); }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return Response.json({ error: "Server configuration is incomplete" }, { status: 500, headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  if (auth !== "Bearer " + serviceKey) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  // The run on Monday summarises the previous, fully completed Monday-Sunday week.
  const today = new Date();
  const thisMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const day = thisMonday.getUTCDay() || 7;
  thisMonday.setUTCDate(thisMonday.getUTCDate() - day + 1);
  const weekStart = new Date(thisMonday); weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekEnd = new Date(thisMonday); weekEnd.setUTCDate(weekEnd.getUTCDate() - 1);
  const startDate = dateOnly(weekStart);
  const endDate = dateOnly(weekEnd);
  const weekKey = isoWeekKey(weekStart);

  const { data: locationRows, error: locationsError } = await supabase
    .from("user_plant_locations").select("user_id, locations");
  if (locationsError) return Response.json({ error: locationsError.message }, { status: 500, headers: corsHeaders });

  let locationsProcessed = 0, logsCreated = 0, skippedLocations = 0;
  const errors: string[] = [];

  for (const row of (locationRows || [])) {
    const settings = row.locations && !Array.isArray(row.locations) ? row.locations : {};
    const names: string[] = Array.isArray(settings.names) ? settings.names : [];
    const types = settings.types || {};
    const coords = settings.coordinates || {};
    const postcodes = settings.postcodes || {};
    const outdoorNames = names.filter((name: string) => types[name] === "outdoor" && coords[name]?.latitude != null && coords[name]?.longitude != null);
    if (!outdoorNames.length) continue;

    const { data: userPlants, error: plantsError } = await supabase
      .from("plants").select("id, name, location").eq("user_id", row.user_id);
    if (plantsError) { errors.push("Plant lookup failed for user " + row.user_id + ": " + plantsError.message); continue; }

    for (const location of outdoorNames) {
      const matchingPlants = (userPlants || []).filter((plant: any) => (plant.location || "").trim() === location);
      if (!matchingPlants.length) continue;
      const latitude = Number(coords[location].latitude), longitude = Number(coords[location].longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { skippedLocations++; continue; }
      try {
        const api = new URL("https://archive-api.open-meteo.com/v1/archive");
        api.search = new URLSearchParams({
          latitude: String(latitude), longitude: String(longitude),
          start_date: startDate, end_date: endDate,
          hourly: "temperature_2m,relative_humidity_2m",
          temperature_unit: "celsius", timezone: "UTC"
        }).toString();
        const response = await fetch(api);
        if (!response.ok) throw new Error("Weather API returned " + response.status);
        const weather = await response.json();
        const temps: number[] = (weather.hourly?.temperature_2m || []).filter((v: unknown) => typeof v === "number" && Number.isFinite(v));
        const humidity: number[] = (weather.hourly?.relative_humidity_2m || []).filter((v: unknown) => typeof v === "number" && Number.isFinite(v));
        if (!temps.length || !humidity.length) throw new Error("No hourly readings returned for " + startDate + " to " + endDate);
        const summary = [
          "Weekly outdoor weather summary (" + startDate + " to " + endDate + ")",
          "Location: " + location + (postcodes[location] ? " (" + postcodes[location] + ")" : ""),
          "Temperature: high " + Math.max(...temps).toFixed(1) + "°C · low " + Math.min(...temps).toFixed(1) + "°C",
          "Humidity: high " + Math.max(...humidity).toFixed(0) + "% · low " + Math.min(...humidity).toFixed(0) + "%"
        ].join("\n");
        const records = matchingPlants.map((plant: any) => ({
          id: "weather-week-" + weekKey + "-" + slug(location) + "-" + plant.id,
          plant_id: plant.id, user_id: row.user_id,
          date: new Date().toISOString(), type: "Weekly Weather Summary", text: summary, photos: []
        }));
        const { error: upsertError } = await supabase.from("plant_logs").upsert(records, { onConflict: "id" });
        if (upsertError) throw upsertError;
        logsCreated += records.length;
        locationsProcessed++;
      } catch (error) {
        errors.push(location + " (" + (postcodes[location] || "postcode not set") + "): " + String(error));
        skippedLocations++;
      }
    }
  }

  return Response.json({ ok: errors.length === 0, week: weekKey, period: { start: startDate, end: endDate }, locationsProcessed, logsCreated, skippedLocations, errors }, { headers: corsHeaders });
});
