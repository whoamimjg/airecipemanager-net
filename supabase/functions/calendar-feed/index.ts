import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      .select("user_id, breakfast_time, lunch_time, dinner_time, snack_time")
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

    const addMinutes = (time: string, minutes: number): string => {
      const [h, m] = time.split(":").map(Number);
      const total = h * 60 + m + minutes;
      const newH = Math.floor(total / 60) % 24;
      const newM = total % 60;
      return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
    };

    const toICS = (date: string, time: string): string => {
      const [y, mo, d] = date.split("-");
      const [h, mi] = time.split(":");
      return `${y}${mo}${d}T${h}${mi}00`;
    };

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
      const endTime = addMinutes(time, duration);

      return [
        "BEGIN:VEVENT",
        `UID:${meal.id}@airecipemanager`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toICS(meal.date, time)}`,
        `DTEND:${toICS(meal.date, endTime)}`,
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
