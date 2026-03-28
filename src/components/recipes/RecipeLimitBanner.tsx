import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Lock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RecipeLimitBannerProps {
  recipeCount: number;
  limit: number;
  plan: string;
  type: "warning" | "blocked";
  onUpgrade: () => void;
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  unlimited: "Unlimited",
};

const RecipeLimitBanner = ({ recipeCount, limit, plan, type, onUpgrade }: RecipeLimitBannerProps) => {
  const percentage = Math.min(100, (recipeCount / limit) * 100);

  if (type === "blocked") {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <Lock className="h-10 w-10 text-destructive" />
          <div>
            <h3 className="font-semibold text-foreground">Recipe limit reached</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You've used all {limit} recipes on the {PLAN_NAMES[plan] ?? plan} plan. Upgrade to add more.
            </p>
          </div>
          <Progress value={100} className="h-2 w-full max-w-xs" />
          <p className="text-xs text-muted-foreground">{recipeCount} / {limit} recipes</p>
          <Button onClick={onUpgrade} className="mt-1">
            <TrendingUp className="mr-2 h-4 w-4" /> Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="flex items-center gap-4 py-4">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Approaching recipe limit ({recipeCount}/{limit})
          </p>
          <Progress value={percentage} className="h-1.5 mt-1.5" />
        </div>
        <Button variant="outline" size="sm" onClick={onUpgrade}>
          Upgrade
        </Button>
      </CardContent>
    </Card>
  );
};

export default RecipeLimitBanner;
