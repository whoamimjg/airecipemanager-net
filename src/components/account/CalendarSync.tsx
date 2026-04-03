import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const CalendarSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<"google" | "apple" | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile-calendar-token", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const regenerateToken = useMutation({
    mutationFn: async () => {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("profiles")
        .update({ calendar_token: newToken } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-calendar-token"] });
      toast.success("Calendar link regenerated. Update your calendar subscription with the new URL.");
    },
    onError: () => toast.error("Failed to regenerate link"),
  });

  const calendarToken = profile?.calendar_token;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const feedUrl = calendarToken
    ? `https://${projectId}.supabase.co/functions/v1/calendar-feed?token=${calendarToken}`
    : "";

  const webcalUrl = feedUrl.replace("https://", "webcal://");

  const googleSubUrl = calendarToken
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    : "";

  const handleCopy = async (type: "google" | "apple") => {
    const url = type === "apple" ? webcalUrl : feedUrl;
    await navigator.clipboard.writeText(url);
    setCopied(type);
    toast.success("Calendar URL copied!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Calendar Integration
        </CardTitle>
        <CardDescription>
          Subscribe to your meal plan — your calendar stays in sync automatically as you update meals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Google Calendar */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Google Calendar</Label>
          <p className="text-xs text-muted-foreground">
            Click to subscribe, or copy the URL and add it manually in Google Calendar → Other calendars → From URL
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => window.open(googleSubUrl, "_blank")}
              variant="outline"
              className="flex-1"
              disabled={!calendarToken}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Subscribe in Google
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy("google")}
              disabled={!calendarToken}
            >
              {copied === "google" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Apple Calendar */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Apple Calendar</Label>
          <p className="text-xs text-muted-foreground">
            Click to subscribe, or copy the URL and paste it in Calendar → File → New Calendar Subscription
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => { window.location.href = webcalUrl; }}
              variant="outline"
              className="flex-1"
              disabled={!calendarToken}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Subscribe in Apple Calendar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy("apple")}
              disabled={!calendarToken}
            >
              {copied === "apple" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Feed URL display */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Your personal feed URL</Label>
          <Input
            readOnly
            value={feedUrl}
            className="text-xs font-mono opacity-70"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>

        {/* Regenerate */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => regenerateToken.mutate()}
          disabled={regenerateToken.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${regenerateToken.isPending ? "animate-spin" : ""}`} />
          Regenerate link (invalidates old link)
        </Button>
      </CardContent>
    </Card>
  );
};

export default CalendarSync;
