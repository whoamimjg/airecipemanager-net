import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, X } from "lucide-react";
import { ANDROID_TEST_URL, IOS_APP_STORE_URL } from "@/lib/beta";

// New key for the iPhone launch, so people who closed the old testing banner see this once.
const DISMISSED_KEY = "ios_live_card_dismissed";

/**
 * Tells signed-in users the iPhone app is live on the App Store (Android is still in
 * testing). Dismissible; the links stay on /beta and in Account settings afterwards.
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
              The iPhone app is now live
            </p>
            <p className="text-sm text-muted-foreground">
              Download it on the App Store and sign in with this account. Everything syncs. Android is in testing.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <a href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer">Download on the App Store</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/beta">Android</Link>
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
