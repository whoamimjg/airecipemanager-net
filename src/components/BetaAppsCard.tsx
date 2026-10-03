import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, X } from "lucide-react";
import { ANDROID_TEST_URL, hasIosBeta } from "@/lib/beta";

const DISMISSED_KEY = "beta_apps_card_dismissed";

/**
 * Invites signed-in users to install the pre-release apps. Dismissible, and the
 * links stay available on /beta and in Account settings afterwards.
 */
const BetaAppsCard = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing — the card just comes back next visit.
    }
  };

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Try AI Recipe Manager on your phone
            </p>
            <p className="text-sm text-muted-foreground">
              {hasIosBeta
                ? "The iPhone and Android apps are in testing. Install them with the same account and everything syncs."
                : "The Android app is in testing now, with iPhone close behind. Same account, everything syncs."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link to="/beta">Get the apps</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={dismiss}
            className="h-8 w-8 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BetaAppsCard;

export { ANDROID_TEST_URL };
