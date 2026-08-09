import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Flame, Info } from "lucide-react";
import { toast } from "sonner";

export interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
  servings: number | null;
  matched?: { ingredient: string; description: string; grams: number }[];
  unmatched?: string[];
  source?: string;
  computed_at?: string;
}

interface NutritionPanelProps {
  recipeId: string;
  ingredients: any[];
  servings: number | null;
  nutrition: Nutrition | null;
}

const MACROS = [
  { key: "protein_g", label: "Protein", className: "text-sky-600 dark:text-sky-400" },
  { key: "carbs_g", label: "Carbs", className: "text-amber-600 dark:text-amber-400" },
  { key: "fat_g", label: "Fat", className: "text-rose-600 dark:text-rose-400" },
] as const;

const NutritionPanel = ({ recipeId, ingredients, servings, nutrition }: NutritionPanelProps) => {
  const [data, setData] = useState<Nutrition | null>(nutrition);
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const compute = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("compute-nutrition", {
        body: { ingredients, servings, recipeId },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      setData(res.nutrition);
      if (res.saved === false) {
        toast.warning("Macros calculated, but couldn't be saved to this recipe.");
      } else {
        toast.success("Macros calculated.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not calculate macros.");
    } finally {
      setLoading(false);
    }
  };

  if (!ingredients.length) return null;

  // Prefer per-serving — it's the number people actually act on. Falls back to
  // recipe totals when the recipe has no serving count.
  const shown = data?.per_serving ?? data;
  const basis = data?.per_serving ? `per serving (${data.servings})` : "whole recipe";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-foreground">Nutrition</h3>
        {data && (
          <Button variant="ghost" size="sm" onClick={compute} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Recalculate"}
          </Button>
        )}
      </div>

      {!data ? (
        <Button variant="outline" size="sm" onClick={compute} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating…
            </>
          ) : (
            <>
              <Flame className="mr-2 h-4 w-4" />
              Calculate macros
            </>
          )}
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xl font-semibold text-foreground">
                {Math.round(shown!.calories)}
              </div>
              <div className="text-xs text-muted-foreground">Calories</div>
            </div>
            {MACROS.map((m) => (
              <div key={m.key} className="rounded-lg border bg-card p-3 text-center">
                <div className={`text-xl font-semibold ${m.className}`}>
                  {Math.round(shown![m.key])}
                  <span className="text-sm font-normal">g</span>
                </div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {basis} · estimated from USDA FoodData Central
            {data.unmatched && data.unmatched.length > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowDetail((v) => !v)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {data.unmatched.length} ingredient
                  {data.unmatched.length === 1 ? "" : "s"} not counted
                </button>
              </>
            )}
          </p>

          {showDetail && data.unmatched && data.unmatched.length > 0 && (
            <div className="mt-2 rounded-md border border-dashed p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Info className="h-3.5 w-3.5" />
                Not included in the totals
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {data.unmatched.map((u, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NutritionPanel;
