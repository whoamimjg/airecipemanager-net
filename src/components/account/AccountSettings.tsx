import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Camera, Save, Trash2, LogOut, Lock, Crown, Check, Clock, CreditCard, Calendar, Loader2, MessageSquare, BookOpen, Settings } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isSandboxBilling, purchasePlan, webManagementUrl, type PaidPlan } from "@/lib/revenuecat";
import CalendarSync from "@/components/account/CalendarSync";
import FeedbackForm from "@/components/account/FeedbackForm";
import KnowledgeBase from "@/components/account/KnowledgeBase";

const DIET_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Diets",
    options: ["Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo", "Low-Carb", "Mediterranean", "Whole30"],
  },
  {
    label: "Religious / Cultural",
    options: ["Halal", "Kosher"],
  },
  {
    label: "Intolerances",
    options: ["Gluten-Free", "Dairy-Free", "Lactose-Free", "Egg-Free", "Soy-Free", "Shellfish-Free", "Fish-Free"],
  },
  {
    label: "Nut Allergies",
    options: [
      "Peanut Allergy",
      "Tree Nut Allergy (all)",
      "Almond Allergy",
      "Cashew Allergy",
      "Walnut Allergy",
      "Pecan Allergy",
      "Pistachio Allergy",
      "Hazelnut Allergy",
      "Brazil Nut Allergy",
      "Macadamia Allergy",
      "Pine Nut Allergy",
      "Coconut Allergy",
    ],
  },
  {
    label: "Seed Allergies",
    options: ["Sesame Allergy", "Sunflower Seed Allergy", "Poppy Seed Allergy"],
  },
];

const DIET_OPTIONS = DIET_GROUPS.flatMap((g) => g.options);

const PLAN_DETAILS = {
  free: { name: "Free", price: 0, recipes: 25, features: ["25 recipes", "Basic AI generation", "Grocery list"] },
  basic: { name: "Basic", price: 5.99, recipes: 100, features: ["100 recipes", "AI generation", "Meal planning", "Grocery list"] },
  pro: { name: "Pro", price: 12.99, recipes: 500, features: ["500 recipes", "Unlimited AI", "Advanced meal planning", "Inventory tracking", "Priority support"] },
  unlimited: { name: "Unlimited", price: 24.99, recipes: -1, features: ["Unlimited recipes", "Unlimited AI", "All features", "Priority support", "Early access"] },
};

type BillingSource =
  | { kind: "store"; label: string; hint: string; url: string }
  | { kind: "web"; label: string; hint: string }
  | { kind: "legacy"; label: string; hint: string };

/** Where a subscription is billed, from `subscriptions.payment_method` (set by revenuecat-webhook). */
function billingSourceOf(paymentMethod: string | null | undefined): BillingSource {
  switch (paymentMethod) {
    case "apple_iap":
      return {
        kind: "store",
        label: "Apple App Store",
        hint: "Change or cancel in your iPhone's Settings → Apple Account → Subscriptions",
        url: "https://apps.apple.com/account/subscriptions",
      };
    case "google_play":
      return {
        kind: "store",
        label: "Google Play",
        hint: "Change or cancel in the Google Play Store → Subscriptions",
        url: "https://play.google.com/store/account/subscriptions",
      };
    case "revenuecat_web":
      return { kind: "web", label: "Card on this website", hint: "Update your card or cancel any time. Receipts are emailed." };
    default:
      return { kind: "legacy", label: "Card on this website", hint: "Contact support to change or cancel this plan." };
  }
}

const AccountSettings = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [dietRestrictions, setDietRestrictions] = useState<string[]>([]);
  const [breakfastTime, setBreakfastTime] = useState("08:00");
  const [lunchTime, setLunchTime] = useState("12:00");
  const [dinnerTime, setDinnerTime] = useState("18:00");
  const [snackTime, setSnackTime] = useState("15:00");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingCheckout = useRef(searchParams.get("checkout"));

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch subscription
  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch recipe count
  const { data: recipeCount } = useQuery({
    queryKey: ["recipeCount", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recipes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });


  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setZipCode((profile as any).zip_code ?? "");

      setDietRestrictions(profile.diet_restrictions ?? []);
      setBreakfastTime(profile.breakfast_time?.slice(0, 5) ?? "08:00");
      setLunchTime(profile.lunch_time?.slice(0, 5) ?? "12:00");
      setDinnerTime(profile.dinner_time?.slice(0, 5) ?? "18:00");
      setSnackTime(profile.snack_time?.slice(0, 5) ?? "15:00");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const currentPlan = subscription?.plan ?? "free";
  const planInfo = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS] ?? PLAN_DETAILS.free;
  const hasPaidPlan = currentPlan !== "free" && !!subscription?.is_active;
  const billingSource = billingSourceOf(subscription?.payment_method);

  /** Waits for the RevenueCat webhook to record the new plan, then refreshes the page's data. */
  const waitForPlan = async (plan: PaidPlan) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, is_active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data?.plan === plan && data.is_active) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  };

  const startCheckout = async (plan: PaidPlan) => {
    if (!user) return;
    if (hasPaidPlan && billingSource.kind === "store") {
      // Buying here as well would bill the customer twice.
      toast.info(`Your plan is billed through ${billingSource.label}. Change it there.`, {
        action: { label: "Open", onClick: () => window.open(billingSource.url, "_blank") },
      });
      return;
    }
    if (hasPaidPlan && billingSource.kind === "legacy") {
      toast.info("Your current plan is billed by our previous card processor. Contact support to switch plans.");
      return;
    }
    if (hasPaidPlan && billingSource.kind === "web") {
      toast.info("To switch plans, cancel your current plan under Manage subscription, then choose the new one.");
      return;
    }
    setCheckoutPlan(plan);
    try {
      const outcome = await purchasePlan(user.id, user.email ?? undefined, plan);
      if (outcome === "purchased") {
        toast.success(`You're subscribed to ${PLAN_DETAILS[plan].name}!`);
        await waitForPlan(plan);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutPlan(null);
    }
  };

  // Sign-up from a pricing card lands here as /account?checkout=<plan>.
  useEffect(() => {
    const pending = pendingCheckout.current;
    if (!user || subscription === undefined || !pending) return;
    pendingCheckout.current = null;
    setSearchParams({}, { replace: true });
    if (pending === "basic" || pending === "pro" || pending === "unlimited") startCheckout(pending);
  }, [user, subscription]);

  const handleManageSubscription = async () => {
    if (!user) return;
    if (billingSource.kind === "store") {
      window.open(billingSource.url, "_blank");
      return;
    }
    setOpeningPortal(true);
    try {
      const url = await webManagementUrl(user.id);
      if (url) window.open(url, "_blank");
      else toast.info("No website subscription found for this account.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open subscription management");
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Append cache-buster
      const url = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);

      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", user.id);

      toast.success("Avatar updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        display_name: displayName || null,
        zip_code: zipCode.trim() || null,
        diet_restrictions: dietRestrictions,

        breakfast_time: breakfastTime + ":00",
        lunch_time: lunchTime + ":00",
        dinner_time: dinnerTime + ":00",
        snack_time: snackTime + ":00",
        // The calendar feed turns these wall-clock times into real instants using
        // this zone; without it Google Calendar showed meals hours off.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        updated_at: new Date().toISOString(),
      };

      // Upsert profile
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, email: user.email, ...updates }, { onConflict: "user_id" });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleDiet = (diet: string) => {
    setDietRestrictions((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };


  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      await supabase.auth.signOut();
      toast.success("Account deleted. Goodbye!");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  if (isLoading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <Tabs defaultValue="settings" className="space-y-4">
      <TabsList className="bg-muted">
        <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
          <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
        </TabsTrigger>
        <TabsTrigger value="feedback" className="gap-1.5 text-xs sm:text-sm">
          <MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">Feedback</span>
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="gap-1.5 text-xs sm:text-sm">
          <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Knowledge Base</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="feedback">
        <FeedbackForm />
      </TabsContent>

      <TabsContent value="knowledge">
        <KnowledgeBase />
      </TabsContent>

      <TabsContent value="settings">
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Profile</CardTitle>
          <CardDescription>Manage your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={avatarUrl ?? undefined} alt="Avatar" />
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <label
                style={{ cursor: uploading ? "default" : "pointer" }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-5 w-5 text-white" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="opacity-60" />
          </div>

          {/* ZIP code for store pricing */}
          <div className="space-y-1">
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="e.g. 43215"
              inputMode="numeric"
              maxLength={5}
              className="max-w-[140px]"
            />
            <p className="text-xs text-muted-foreground">Used to fetch prices from your local Kroger, Aldi, Meijer, and Giant Eagle.</p>
          </div>

        </CardContent>
      </Card>

      {/* Diet & Meal Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Diet & Meal Preferences</CardTitle>
          <CardDescription>Personalize your recipe and meal plan suggestions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Diet restrictions & allergies */}
          <div className="space-y-3">
            <Label>Diet Restrictions & Allergies</Label>
            <p className="text-xs text-muted-foreground">
              Selected items will be strictly avoided in AI-generated recipes and meal suggestions.
            </p>
            {DIET_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((diet) => {
                    const active = dietRestrictions.includes(diet);
                    return (
                      <Badge
                        key={diet}
                        variant={active ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => toggleDiet(diet)}
                      >
                        {active && <Check className="h-3 w-3 mr-1" />}
                        {diet}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Meal Times */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Meal Times
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Breakfast", value: breakfastTime, setter: setBreakfastTime },
                { label: "Lunch", value: lunchTime, setter: setLunchTime },
                { label: "Dinner", value: dinnerTime, setter: setDinnerTime },
                { label: "Snack", value: snackTime, setter: setSnackTime },
              ].map(({ label, value, setter }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input type="time" value={value} onChange={(e) => setter(e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card id="subscription" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-xl">Subscription</CardTitle>
          <CardDescription>
            You're on the <span className="font-semibold text-foreground">{planInfo.name}</span> plan
            {recipeCount !== undefined && planInfo.recipes > 0 && (
              <> — {recipeCount}/{planInfo.recipes} recipes used</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
              const isCurrent = key === currentPlan;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 space-y-2 transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-semibold">{plan.name}</span>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold font-serif">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                    {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && plan.price > 0 && (
                    <Button
                      variant={key === "pro" ? "default" : "outline"}
                      size="sm"
                      className="w-full mt-2"
                      disabled={checkoutPlan !== null}
                      onClick={() => startCheckout(key as PaidPlan)}
                    >
                      {checkoutPlan === key ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Crown className="h-3.5 w-3.5 mr-1" />
                      )}
                      {Object.keys(PLAN_DETAILS).indexOf(key) > Object.keys(PLAN_DETAILS).indexOf(currentPlan)
                        ? "Upgrade"
                        : "Switch"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {isSandboxBilling && (
            <p className="mt-3 text-xs text-muted-foreground">
              Test mode: checkout uses Stripe test cards (4242 4242 4242 4242) and charges nothing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Next Billing & Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment & Billing
          </CardTitle>
          <CardDescription>Upcoming charges, payment method and receipts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Next billing */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" /> Next Billing Date
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {subscription?.next_billing_date
                  ? new Date(subscription.next_billing_date).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })
                  : "No upcoming charges"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-lg font-bold font-serif text-foreground">
                {hasPaidPlan ? `$${planInfo.price.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>

          {/* Where the plan is billed */}
          <div className="space-y-2">
            <Label>Billed through</Label>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {hasPaidPlan ? billingSource.label : "No active subscription"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasPaidPlan ? billingSource.hint : "Choose a plan above to subscribe"}
                  </p>
                </div>
              </div>
              {hasPaidPlan && billingSource.kind !== "legacy" && (
                <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={openingPortal}>
                  {openingPortal && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Manage subscription
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Calendar Integration */}
      <CalendarSync />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Account Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Change Password */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> Change Password
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>

          <Separator />

          {/* Sign Out */}
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>

          <Separator />

          {/* Delete Account */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your data including recipes,
                  meal plans, inventory, and preferences. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

    </div>
      </TabsContent>
    </Tabs>
  );
};

export default AccountSettings;
