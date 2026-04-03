import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks } from "date-fns";

const CalendarSync = () => {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState("1");
  const [copied, setCopied] = useState(false);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(addWeeks(weekStart, parseInt(weeks)), -1);

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["meal-plans-export", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;

      const recipeIds = [...new Set((data || []).filter(mp => mp.recipe_id).map(mp => mp.recipe_id))];
      let recipesMap: Record<string, { title: string; prep_time: number | null; cook_time: number | null }> = {};
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from("recipes")
          .select("id, title, prep_time, cook_time")
          .in("id", recipeIds);
        if (recipes) {
          recipesMap = Object.fromEntries(recipes.map(r => [r.id, r]));
        }
      }

      return (data || []).map(mp => ({
        ...mp,
        recipe: mp.recipe_id ? recipesMap[mp.recipe_id] : undefined,
      }));
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-times", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("breakfast_time, lunch_time, dinner_time, snack_time")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const getMealTime = (slot: string): string => {
    const times: Record<string, string> = {
      breakfast: profile?.breakfast_time?.slice(0, 5) ?? "08:00",
      lunch: profile?.lunch_time?.slice(0, 5) ?? "12:00",
      dinner: profile?.dinner_time?.slice(0, 5) ?? "18:00",
      snack: profile?.snack_time?.slice(0, 5) ?? "15:00",
    };
    return times[slot] || "12:00";
  };

  const getDurationMinutes = (meal: any): number => {
    if (meal.recipe) {
      return (meal.recipe.prep_time || 0) + (meal.recipe.cook_time || 0) || 60;
    }
    return 60;
  };

  const toICSDatetime = (date: string, time: string): string => {
    const [y, m, d] = date.split("-");
    const [h, min] = time.split(":");
    return `${y}${m}${d}T${h}${min}00`;
  };

  const addMinutesToTime = (time: string, minutes: number): string => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  const generateICS = (): string => {
    const events = mealPlans.map(meal => {
      const title = meal.recipe?.title || meal.notes || "Meal";
      const slotLabel = meal.meal_slot.charAt(0).toUpperCase() + meal.meal_slot.slice(1);
      const time = getMealTime(meal.meal_slot);
      const duration = getDurationMinutes(meal);
      const endTime = addMinutesToTime(time, duration);
      const dtstart = toICSDatetime(meal.date, time);
      const dtend = toICSDatetime(meal.date, endTime);
      const uid = `${meal.id}@airecipemanager`;

      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${slotLabel}: ${title}`,
        `DESCRIPTION:${slotLabel} meal from AI Recipe Manager`,
        "END:VEVENT",
      ].join("\r\n");
    });

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AI Recipe Manager//Meal Plan//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Meal Plan",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
  };

  const handleDownloadICS = () => {
    if (mealPlans.length === 0) {
      toast.error("No meals planned for the selected period");
      return;
    }
    const ics = generateICS();
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meal-plan.ics";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar file downloaded! Open it to add to Apple Calendar or any calendar app.");
  };

  const handleAddToGoogle = () => {
    if (mealPlans.length === 0) {
      toast.error("No meals planned for the selected period");
      return;
    }
    // Google Calendar only supports adding one event at a time via URL,
    // so we open the first meal as an example and download ICS for bulk
    const meal = mealPlans[0];
    const title = meal.recipe?.title || meal.notes || "Meal";
    const slotLabel = meal.meal_slot.charAt(0).toUpperCase() + meal.meal_slot.slice(1);
    const time = getMealTime(meal.meal_slot);
    const duration = getDurationMinutes(meal);
    const endTime = addMinutesToTime(time, duration);
    const dtstart = toICSDatetime(meal.date, time);
    const dtend = toICSDatetime(meal.date, endTime);

    const googleUrl = new URL("https://calendar.google.com/calendar/render");
    googleUrl.searchParams.set("action", "TEMPLATE");
    googleUrl.searchParams.set("text", `${slotLabel}: ${title}`);
    googleUrl.searchParams.set("dates", `${dtstart}/${dtend}`);
    googleUrl.searchParams.set("details", `${slotLabel} meal from AI Recipe Manager`);

    if (mealPlans.length > 1) {
      toast.info("Google Calendar opens one event at a time. Use the .ics download to add all meals at once.", { duration: 5000 });
    }

    window.open(googleUrl.toString(), "_blank");
  };

  const handleCopyICS = async () => {
    if (mealPlans.length === 0) {
      toast.error("No meals planned for the selected period");
      return;
    }
    const ics = generateICS();
    await navigator.clipboard.writeText(ics);
    setCopied(true);
    toast.success("Calendar data copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Calendar Integration
        </CardTitle>
        <CardDescription>
          Export your meal plan to Google Calendar or Apple Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Export Range</Label>
          <Select value={weeks} onValueChange={setWeeks}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">This week</SelectItem>
              <SelectItem value="2">Next 2 weeks</SelectItem>
              <SelectItem value="4">Next 4 weeks</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {mealPlans.length} meal{mealPlans.length !== 1 ? "s" : ""} planned for this period
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={handleAddToGoogle} variant="outline" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Add to Google Calendar
          </Button>
          <Button onClick={handleDownloadICS} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download .ics (Apple)
          </Button>
        </div>

        <Button onClick={handleCopyICS} variant="ghost" size="sm" className="w-full">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied!" : "Copy calendar data"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CalendarSync;
