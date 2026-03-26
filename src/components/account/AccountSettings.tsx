import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Camera, Save, Trash2, LogOut, Lock, Crown, Check, Clock, CreditCard, FileText, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto",
  "Paleo", "Nut-Free", "Low-Carb", "Halal", "Kosher",
];

const PLAN_DETAILS = {
  free: { name: "Free", price: 0, recipes: 25, features: ["25 recipes", "Basic AI generation", "Grocery list"] },
  basic: { name: "Basic", price: 4.99, recipes: 100, features: ["100 recipes", "AI generation", "Meal planning", "Grocery list"] },
  pro: { name: "Pro", price: 9.99, recipes: 500, features: ["500 recipes", "Unlimited AI", "Advanced meal planning", "Inventory tracking", "Priority support"] },
  unlimited: { name: "Unlimited", price: 19.99, recipes: -1, features: ["Unlimited recipes", "Unlimited AI", "All features", "Priority support", "Early access"] },
};

const AccountSettings = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
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

  // Fetch billing history
  const { data: billingHistory } = useQuery({
    queryKey: ["billingHistory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Seed sample billing data if none exists
  const seedBillingData = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("billing_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) > 0) return;

    const sampleInvoices = [
      { user_id: user.id, invoice_number: "INV-2025-001", date: "2025-01-15", amount: 9.99, plan: "pro", status: "paid", payment_method: "Visa •••• 4242", description: "Pro Plan - Monthly" },
      { user_id: user.id, invoice_number: "INV-2024-012", date: "2024-12-15", amount: 9.99, plan: "pro", status: "paid", payment_method: "Visa •••• 4242", description: "Pro Plan - Monthly" },
      { user_id: user.id, invoice_number: "INV-2024-011", date: "2024-11-15", amount: 4.99, plan: "basic", status: "paid", payment_method: "Visa •••• 4242", description: "Basic Plan - Monthly" },
      { user_id: user.id, invoice_number: "INV-2024-010", date: "2024-10-15", amount: 4.99, plan: "basic", status: "paid", payment_method: "Visa •••• 4242", description: "Basic Plan - Monthly" },
    ];
    await supabase.from("billing_history").insert(sampleInvoices);
    queryClient.invalidateQueries({ queryKey: ["billingHistory"] });
  };

  useEffect(() => {
    if (user) seedBillingData();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setDietRestrictions(profile.diet_restrictions ?? []);
      setBreakfastTime(profile.breakfast_time?.slice(0, 5) ?? "08:00");
      setLunchTime(profile.lunch_time?.slice(0, 5) ?? "12:00");
      setDinnerTime(profile.dinner_time?.slice(0, 5) ?? "18:00");
      setSnackTime(profile.snack_time?.slice(0, 5) ?? "15:00");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const currentPlan = subscription?.plan ?? "free";
  const planInfo = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS];

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
        diet_restrictions: dietRestrictions,
        breakfast_time: breakfastTime + ":00",
        lunch_time: lunchTime + ":00",
        dinner_time: dinnerTime + ":00",
        snack_time: snackTime + ":00",
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

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("generate-invoice", {
        body: { invoiceId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Invoice downloaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download invoice");
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
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
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
        </CardContent>
      </Card>

      {/* Diet & Meal Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Diet & Meal Preferences</CardTitle>
          <CardDescription>Personalize your recipe and meal plan suggestions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Diet restrictions */}
          <div className="space-y-2">
            <Label>Diet Restrictions</Label>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((diet) => {
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
      <Card>
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
                  {!isCurrent && (
                    <Button
                      variant={key === "pro" ? "default" : "outline"}
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => toast.info("Payment integration coming soon!")}
                    >
                      <Crown className="h-3.5 w-3.5 mr-1" />
                      {Object.keys(PLAN_DETAILS).indexOf(key) > Object.keys(PLAN_DETAILS).indexOf(currentPlan)
                        ? "Upgrade"
                        : "Switch"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Next Billing & Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment & Billing
          </CardTitle>
          <CardDescription>Manage your payment method and view upcoming charges</CardDescription>
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
                ${planInfo.price.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {subscription?.payment_method ?? "No payment method"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subscription?.payment_method ? "Default payment method" : "Add a payment method to upgrade"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Payment method management coming soon!")}
              >
                {subscription?.payment_method ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" /> Billing History
          </CardTitle>
          <CardDescription>View and download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {billingHistory && billingHistory.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingHistory.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(inv.date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{inv.plan}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">${Number(inv.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={inv.status === "paid" ? "default" : "destructive"}
                          className="text-xs capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(inv.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No billing history yet</p>
            </div>
          )}
        </CardContent>
      </Card>


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
  );
};

export default AccountSettings;
