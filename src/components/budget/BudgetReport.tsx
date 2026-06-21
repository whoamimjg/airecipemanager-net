import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const money = (v: number) =>
  `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mirrors the native app's budgetBucket(): Produce / Meat / Dairy / Other.
const budgetBucket = (category?: string | null): "Produce" | "Meat" | "Dairy" | "Other" => {
  const c = (category || "").toLowerCase();
  if (c.includes("produce")) return "Produce";
  if (c.includes("meat") || c.includes("seafood") || c.includes("poultry")) return "Meat";
  if (c.includes("dairy")) return "Dairy";
  return "Other";
};

// USDA moderate-cost plan estimate (monthly), matching the native app.
const nationalMonthlyAverage = (household: number): number => {
  const h = Math.max(1, household);
  switch (h) {
    case 1: return 400;
    case 2: return 750;
    case 3: return 950;
    case 4: return 1150;
    case 5: return 1400;
    default: return 1400 + (h - 5) * 200;
  }
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

interface BudgetData {
  monthlyBudget: number | null;
  householdSize: number | null;
  goal: string | null;
  monthSpent: number;
  monthWaste: number;
  receiptCount: number;
  byCategory: { name: string; amount: number }[];
  trend: { label: string; amount: number }[];
  nationalAverage: number | null;
}

const BudgetReport = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["budget", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BudgetData> => {
      const [profileRes, scansRes, itemsRes, deletionsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("receipt_scans").select("id, total_amount, receipt_date, created_at"),
        supabase.from("receipt_items").select("category, price, receipt_id"),
        supabase.from("inventory_deletions").select("total_cost, deleted_at, reason"),
      ]);

      const profile: any = profileRes.data || {};
      const scans = (scansRes.data || []) as any[];
      const items = (itemsRes.data || []) as any[];
      const deletions = (deletionsRes.data || []) as any[];

      const now = new Date();
      const thisMonth = monthKey(now);
      const scanMonth = (s: any) => String(s.receipt_date || s.created_at || "").slice(0, 7);

      const monthScans = scans.filter((s) => scanMonth(s) === thisMonth);
      const monthScanIds = new Set(monthScans.map((s) => s.id));
      const monthSpent = monthScans.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

      const monthWaste = deletions
        .filter((d) => String(d.deleted_at || "").slice(0, 7) === thisMonth && d.reason !== "Used / Consumed")
        .reduce((sum, d) => sum + (Number(d.total_cost) || 0), 0);

      const buckets: Record<string, number> = { Produce: 0, Meat: 0, Dairy: 0, Other: 0 };
      items
        .filter((it) => monthScanIds.has(it.receipt_id))
        .forEach((it) => { buckets[budgetBucket(it.category)] += Number(it.price) || 0; });
      const byCategory = Object.entries(buckets).map(([name, amount]) => ({ name, amount }));

      const trend = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const key = monthKey(d);
        const total = scans.filter((s) => scanMonth(s) === key).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        return { label: MONTHS[d.getMonth()], amount: total };
      });

      const monthlyBudget = profile.monthly_grocery_budget != null ? Number(profile.monthly_grocery_budget) : null;
      const householdSize = profile.household_size != null ? Number(profile.household_size) : null;

      return {
        monthlyBudget,
        householdSize,
        goal: profile.grocery_goal ?? null,
        monthSpent,
        monthWaste,
        receiptCount: monthScans.length,
        byCategory,
        trend,
        nationalAverage: householdSize ? nationalMonthlyAverage(householdSize) : null,
      };
    },
  });

  const isSetUp = data?.monthlyBudget != null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Grocery Budget</h2>
        {isSetUp && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {!isSetUp || editing ? (
        <BudgetSetup
          initial={data}
          onSaved={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ["budget", user?.id] });
          }}
          onCancel={isSetUp ? () => setEditing(false) : undefined}
        />
      ) : (
        data && <BudgetDashboard s={data} />
      )}
    </div>
  );
};

const BudgetSetup = ({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: BudgetData;
  onSaved: () => void;
  onCancel?: () => void;
}) => {
  const { user } = useAuth();
  const [budget, setBudget] = useState(initial?.monthlyBudget?.toString() ?? "");
  const [household, setHousehold] = useState(initial?.householdSize?.toString() ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          monthly_grocery_budget: budget ? parseFloat(budget) : null,
          household_size: household ? parseInt(household) : null,
          grocery_goal: goal || null,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget saved!"); onSaved(); },
    onError: () => toast.error("Failed to save budget"),
  });

  const valid = !isNaN(parseFloat(budget)) && !isNaN(parseInt(household));

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-5 pt-6">
        <h3 className="text-lg font-bold text-foreground">Let's set up your grocery budget</h3>

        <div className="space-y-2">
          <Label className="text-foreground">What's your monthly grocery budget?</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input className="pl-7" inputMode="decimal" placeholder="e.g. 800" value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">How many people are in your home?</Label>
          <Input inputMode="numeric" placeholder="e.g. 4" value={household}
            onChange={(e) => setHousehold(e.target.value.replace(/[^0-9]/g, ""))} />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">How do you feel about your grocery spending?</Label>
          <RadioGroup value={goal} onValueChange={setGoal}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="happy" id="goal-happy" />
              <Label htmlFor="goal-happy" className="font-normal">Happy with it</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="improve" id="goal-improve" />
              <Label htmlFor="goal-improve" className="font-normal">There's room for improvement</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          🔒 Your information stays private. We will never sell your data.
        </div>

        <div className="flex gap-3">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button className="flex-1" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Bar = ({ frac, color }: { frac: number; color: string }) => (
  <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
    <div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(0, frac * 100))}%`, backgroundColor: color }} />
  </div>
);

const BudgetDashboard = ({ s }: { s: BudgetData }) => {
  const budget = s.monthlyBudget ?? 0;
  const remaining = budget - s.monthSpent;
  const over = remaining < 0;
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.amount));
  const maxMonth = Math.max(1, ...s.trend.map((m) => m.amount));

  const tip =
    budget <= 0 ? null
    : s.monthSpent <= budget ? "You're on track this month — nicely done."
    : "You're over budget this month. The category breakdown shows where it's going.";

  return (
    <div className="space-y-6">
      {/* This month */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">This month</p>
          <p className="text-3xl font-bold text-foreground">{money(s.monthSpent)} <span className="text-base font-normal text-muted-foreground">spent</span></p>
          {budget > 0 && (
            <>
              <p className="text-sm text-muted-foreground">of {money(budget)} budget</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.monthSpent / budget) * 100)}%`, backgroundColor: over ? "hsl(var(--destructive))" : "hsl(var(--primary))" }} />
              </div>
              <p className={`mt-1.5 text-sm font-medium ${over ? "text-destructive" : "text-green-600"}`}>
                {over ? `${money(-remaining)} over budget` : `${money(remaining)} left`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* vs US average */}
      {s.nationalAverage != null && (
        <Card className="border-border bg-muted/30">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm font-semibold text-foreground">vs. U.S. average</p>
            <p className="text-sm text-muted-foreground">
              Estimated avg for {s.householdSize} {s.householdSize === 1 ? "person" : "people"}: {money(s.nationalAverage)}/mo
            </p>
            {(() => {
              const diff = s.monthSpent - (s.nationalAverage ?? 0);
              return (
                <p className={`text-sm font-medium ${diff <= 0 ? "text-green-600" : "text-amber-600"}`}>
                  {diff <= 0 ? `You're ${money(-diff)} below average` : `You're ${money(diff)} above average`}
                </p>
              );
            })()}
            <p className="text-[10px] text-muted-foreground/70">Source: USDA moderate-cost plan (estimate)</p>
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      <div>
        <h3 className="mb-3 font-bold text-foreground">Spending by category</h3>
        <div className="space-y-2">
          {s.byCategory.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-muted-foreground">{c.name}</span>
              <Bar frac={c.amount / maxCat} color="hsl(var(--primary))" />
              <span className="w-20 text-right text-foreground">{money(c.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div>
        <h3 className="mb-3 font-bold text-foreground">Last 6 months</h3>
        <div className="space-y-2">
          {s.trend.map((m, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="w-10 text-muted-foreground">{m.label}</span>
              <Bar frac={m.amount / maxMonth} color="hsl(248 25% 47%)" />
              <span className="w-20 text-right text-foreground">{money(m.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Waste + receipts */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Food waste</p>
            <p className="text-xl font-bold text-destructive">{money(s.monthWaste)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Receipts</p>
            <p className="text-xl font-bold text-primary">{s.receiptCount}</p>
          </CardContent>
        </Card>
      </div>

      {tip && <p className="text-sm text-muted-foreground">{tip}</p>}
    </div>
  );
};

export default BudgetReport;
