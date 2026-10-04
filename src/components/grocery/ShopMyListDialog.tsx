import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { MCP_SERVER_URL, SKILL_URL, STORES, shoppingPrompt, storeById, storeLabel } from "@/lib/stores";
import { Bot, Check, Copy, ExternalLink, Loader2, ShoppingCart, Sparkles } from "lucide-react";

/** One row of the "To buy" list, as saved for an agent to shop from. */
export interface ShopItem {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  note: string;
  recipes: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ShopItem[];
  rangeLabel: string;
  listText: string;
}

type ResultItem = { key: string; status: string; product?: string | null; note?: string | null };
type SavedList = {
  id: string;
  store: string | null;
  item_count: number;
  status: string;
  created_at: string;
  result: {
    cart_url?: string | null;
    summary?: string | null;
    estimated_total?: number | null;
    items?: ResultItem[];
  } | null;
};

/**
 * "Shop my list": saves a snapshot of the To-buy list for the user's preferred
 * store, then offers the ways to shop it — Claude through the MCP connector,
 * or the store's own site with the list copied. The snapshot is what the MCP
 * server hands to the agent; the live list on screen is untouched.
 */
const ShopMyListDialog = ({ open, onOpenChange, items, rangeLabel, listText }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<SavedList | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"url" | "prompt" | "list" | null>(null);
  const savedForOpen = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  const preferredStore = (profile as { preferred_store?: string | null } | null)?.preferred_store ?? null;
  const zip = (profile as { zip_code?: string | null } | null)?.zip_code ?? null;
  const store = storeById(preferredStore);

  // Latest saved list, polled while the dialog is open so an agent's report
  // shows up without a refresh.
  const { data: latest } = useQuery({
    queryKey: ["shopping-list-latest", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, store, item_count, status, created_at, result")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SavedList | null) ?? null;
    },
    enabled: !!user && open,
    refetchInterval: open ? 15_000 : false,
  });

  const saveSnapshot = async (storeId: string | null) => {
    if (!user || items.length === 0) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("shopping_lists")
        .insert({
          user_id: user.id,
          store: storeId,
          zip_code: zip,
          range_label: rangeLabel,
          items: items.map((i) => ({
            key: i.key,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            note: i.note,
            recipes: i.recipes,
          })),
          item_count: items.length,
        })
        .select("id, store, item_count, status, created_at, result")
        .single();
      if (error) throw error;
      setSaved(data as SavedList);
      queryClient.invalidateQueries({ queryKey: ["shopping-list-latest"] });
    } catch (e: unknown) {
      toast({
        title: "Couldn't save the list",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save once per open, as soon as the profile is known (store may be null).
  useEffect(() => {
    if (!open) {
      savedForOpen.current = false;
      setSaved(null);
      return;
    }
    if (savedForOpen.current || !user || profile === undefined) return;
    savedForOpen.current = true;
    void saveSnapshot(preferredStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, profile]);

  const changeStore = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ preferred_store: id } as never).eq("user_id", user.id);
    if (error) {
      toast({ title: "Couldn't save store", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    // Re-save so the agent sees the store the user just picked.
    await saveSnapshot(id);
  };

  const copy = async (what: "url" | "prompt" | "list", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  const prompt = shoppingPrompt(preferredStore);
  const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
  const result = latest?.result ?? null;
  const resultCounts = result?.items
    ? {
        added: result.items.filter((i) => i.status === "added" || i.status === "substituted").length,
        missing: result.items.filter((i) => i.status === "not_found" || i.status === "skipped"),
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <ShoppingCart className="h-5 w-5 text-primary" /> Shop my list
          </DialogTitle>
          <DialogDescription>
            {items.length} item{items.length === 1 ? "" : "s"} to buy · {rangeLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Store */}
        <div className="space-y-1.5">
          <Label htmlFor="shop-store">Preferred store</Label>
          <Select value={preferredStore ?? ""} onValueChange={changeStore}>
            <SelectTrigger id="shop-store" className="h-9">
              <SelectValue placeholder="Choose where you shop" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-[60]">
              {STORES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving your list…
              </span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> List saved for {storeLabel(saved.store)}
                {zip ? ` near ${zip}` : ""}. Change it in Account settings any time.
              </span>
            ) : items.length === 0 ? (
              "Nothing to buy right now."
            ) : null}
          </p>
        </div>

        {/* Last result from an agent */}
        {result && latest && latest.status !== "ready" ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Bot className="h-4 w-4 text-primary" />
              {latest.status === "in_cart" && "Your cart is ready"}
              {latest.status === "partial" && "Cart ready, a few items missing"}
              {latest.status === "failed" && "Shopping didn't finish"}
            </p>
            {result.summary ? <p className="mt-1 text-muted-foreground">{result.summary}</p> : null}
            {resultCounts ? (
              <p className="mt-1 text-muted-foreground">
                {resultCounts.added} of {latest.item_count} in the cart
                {result.estimated_total != null ? ` · about $${Number(result.estimated_total).toFixed(2)}` : ""}
                {resultCounts.missing.length > 0
                  ? `. Not found: ${resultCounts.missing.map((m) => m.key).join(", ")}`
                  : ""}
              </p>
            ) : null}
            {result.cart_url ? (
              <a
                href={result.cart_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              >
                Review cart and place order <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Claude */}
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Let Claude fill your cart
          </p>
          <p className="text-sm text-muted-foreground">
            Claude reads this list, adds each item to your {storeLabel(preferredStore)} cart in your browser, and
            stops before checkout. You review the cart and place the order yourself.
          </p>
          <ol className="space-y-3 text-sm">
            <li className="space-y-1.5">
              <p className="font-medium text-foreground">1. Connect AI Recipe Manager to Claude (once)</p>
              <p className="text-muted-foreground">
                In Claude: Settings → Connectors → Add custom connector, and paste this URL. Sign in and allow
                access.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{MCP_SERVER_URL}</code>
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => copy("url", MCP_SERVER_URL)}>
                  {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </li>
            <li className="space-y-1.5">
              <p className="font-medium text-foreground">2. Tell Claude to shop</p>
              <p className="rounded bg-background px-2 py-1.5 text-xs text-muted-foreground">{prompt}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild disabled={!preferredStore}>
                  <a href={claudeUrl} target="_blank" rel="noopener noreferrer">
                    <Bot className="mr-2 h-4 w-4" /> Open Claude
                  </a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy("prompt", prompt)}>
                  {copied === "prompt" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy prompt
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Works best with the Claude in Chrome extension, which can use your store login. Other MCP-capable
                assistants can connect with the same URL;{" "}
                <a href={SKILL_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  skill file
                </a>
                .
              </p>
            </li>
          </ol>
        </div>

        {/* Yourself */}
        <div className="space-y-2">
          <p className="font-medium text-foreground">Or shop it yourself</p>
          <div className="flex flex-wrap gap-2">
            {store?.url ? (
              <Button size="sm" variant="outline" asChild>
                <a href={store.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open {store.label}
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => copy("list", listText)}>
              {copied === "list" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Copy list
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShopMyListDialog;
