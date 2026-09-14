import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Used until the user's own zone has been recorded from their browser or device. */
const DEFAULT_TIME_ZONE = "America/New_York";

const isValidTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up user by calendar token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, breakfast_time, lunch_time, dinner_time, snack_time, timezone")
      .eq("calendar_token", token)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response("Invalid token", { status: 404, headers: corsHeaders });
    }

    // Fetch meal plans for the next 60 days and past 7 days
    const now = new Date();
    const past = new Date(now);
    past.setDate(past.getDate() - 7);
    const future = new Date(now);
    future.setDate(future.getDate() + 60);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const { data: mealPlans } = await supabase
      .from("meal_plans")
      .select("id, date, meal_slot, notes, recipe_id")
      .eq("user_id", profile.user_id)
      .gte("date", fmt(past))
      .lte("date", fmt(future))
      .order("date");

    // Fetch recipe titles
    const recipeIds = [...new Set((mealPlans || []).filter(mp => mp.recipe_id).map(mp => mp.recipe_id))];
    let recipesMap: Record<string, { title: string; prep_time: number | null; cook_time: number | null }> = {};
    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, title, prep_time, cook_time")
        .in("id", recipeIds);
      if (recipes) {
        recipesMap = Object.fromEntries(recipes.map((r: any) => [r.id, r]));
      }
    }

    const getMealTime = (slot: string): string => {
      const times: Record<string, string> = {
        breakfast: profile.breakfast_time?.slice(0, 5) ?? "08:00",
        lunch: profile.lunch_time?.slice(0, 5) ?? "12:00",
        dinner: profile.dinner_time?.slice(0, 5) ?? "18:00",
        snack: profile.snack_time?.slice(0, 5) ?? "15:00",
      };
      return times[slot] || "12:00";
    };

    // Meal times are wall-clock times with no zone. They used to be written as
    // floating ICS times ("DTSTART:20260914T080000"), which Google Calendar reads
    // as UTC — an 8:00 AM breakfast showed at 4:00 AM Eastern, and each calendar
    // app guessed differently. Convert each one to an exact UTC instant in the
    // user's own time zone instead; every calendar shows UTC correctly in the
    // viewer's local time, daylight saving included.
    const timeZone = isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIME_ZONE;

    /** Epoch ms for a wall-clock date + "HH:MM" in [timeZone]. */
    const zonedToUtcMs = (date: string, time: string): number => {
      const [y, mo, d] = date.split("-").map(Number);
      const [h, mi] = time.split(":").map(Number);
      const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
      // Offset of the zone at a given instant, in ms (local - UTC).
      const offsetAt = (ms: number) => {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat("en-US", {
            timeZone, hourCycle: "h23",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
        );
        const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        return local - ms;
      };
      // Two passes so a date on a daylight-saving boundary uses that day's offset.
      let utc = asIfUtc - offsetAt(asIfUtc);
      utc = asIfUtc - offsetAt(utc);
      return utc;
    };

    const toICSUtc = (ms: number): string =>
      new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    // Escape ICS text per RFC 5545 (backslash, semicolon, comma, newlines) so titles like
    // "Rice, Beans" don't corrupt the event and get dropped by the calendar.
    const esc = (s: string): string =>
      (s || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

    // DTSTAMP is REQUIRED on every VEVENT — many calendars silently drop events without it.
    const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const events = (mealPlans || []).map(meal => {
      const recipe = meal.recipe_id ? recipesMap[meal.recipe_id] : undefined;
      const title = recipe?.title || meal.notes || "Meal";
      const slotLabel = meal.meal_slot.charAt(0).toUpperCase() + meal.meal_slot.slice(1);
      const time = getMealTime(meal.meal_slot);
      const duration = recipe ? (recipe.prep_time || 0) + (recipe.cook_time || 0) || 60 : 60;
      const startMs = zonedToUtcMs(meal.date, time);
      // Add the duration as real time, so a late meal ends the next day instead of
      // producing an end before its start (which calendars silently drop).
      const endMs = startMs + duration * 60_000;

      return [
        "BEGIN:VEVENT",
        `UID:${meal.id}@airecipemanager`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toICSUtc(startMs)}`,
        `DTEND:${toICSUtc(endMs)}`,
        `SUMMARY:${esc(`${slotLabel}: ${title}`)}`,
        `DESCRIPTION:${esc(`${slotLabel} meal from AI Recipe Manager`)}`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AI Recipe Manager//Meal Plan//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Meal Plan",
      `X-WR-TIMEZONE:${timeZone}`,
      "X-PUBLISHED-TTL:PT1H",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ics, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="meal-plan.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Calendar feed error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
