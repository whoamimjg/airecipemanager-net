import { useState, useMemo, useEffect } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart, Package, Check, AlertTriangle, Pencil, Plus, X, Trash2, Undo2, Printer, Share2, DollarSign, Loader2
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/native";
import { cleanIngredientName, detectPurchaseUnit, formatAmount, ingredientNote, parseAmount, resolveIngredients } from "@/lib/ingredient-match";

interface GroceryItem {
  /**
   * Canonical dedup key — the cleaned, singular food name, identical to the key
   * the iOS/Android apps use. Everything persisted (ticks, removals, category
   * overrides) is keyed on THIS, not on the display name: the display name keeps
   * the plural the recipe used ("Bagels"), so keying on it wrote `bagels` where
   * the apps looked for `bagel` and neither side saw the other's changes.
   */
  key: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  recipes: string[];
  inInventory: boolean;
  /** Prep detail from the recipe ("grated", "cooked and crumbled"). */
  note: string;
  /** ISO time of the newest meal-plan entry requiring this item; "" for manual rows. */
  plannedAt: string;
}

/**
 * How long a tick on the shopping list stays meaningful. Long enough that a
 * trip survives a refresh or a phone-to-laptop switch, short enough that last
 * week's shop can't hide this week's ingredients.
 */
const CHECK_TTL_DAYS = 7;

const STORE_CATEGORIES = [
  "Produce", "Meats", "Dairy", "Beverages", "Cereal", "Dry Goods", "Canned Goods", "Bread", "Frozen", "Snacks", "Condiments & Spices", "Other"
];


const GroceryList = () => {
  const { user } = useAuth();
  const today = startOfDay(new Date());

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  // Removing a recipe-derived row hides it for THIS session only. It used to be
  // written to grocery_deleted_keys, which suppressed that ingredient in every
  // future list for every recipe — one click on "Ground Beef" meant no recipe
  // could ever put beef on the list again. A planned meal must always be able
  // to put its ingredients back on the list.
  const [sessionHidden, setSessionHidden] = useState<Set<string>>(new Set());
  // Inventory is advisory: an item the user has is shown under "Already in
  // Inventory" rather than dropped, and ticking it there forces it onto the buy
  // list at the full recipe amount without touching the inventory row.
  const [wantAnyway, setWantAnyway] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemOverrides, setItemOverrides] = useState<Record<string, { quantity?: string; unit?: string; category?: string }>>({});

  // Store pricing
  type StoreId = "kroger" | "aldi" | "meijer" | "giant_eagle";
  const STORES: { id: StoreId; label: string }[] = [
    { id: "kroger", label: "Kroger" },
    { id: "aldi", label: "Aldi" },
    { id: "meijer", label: "Meijer" },
    { id: "giant_eagle", label: "Giant Eagle" },
  ];
  const [activeStore, setActiveStore] = useState<StoreId | null>(null);
  const [pricesByStore, setPricesByStore] = useState<Partial<Record<StoreId, Record<string, { price: number | null; productName: string | null; currency: string }>>>>({});
  const [loadingStore, setLoadingStore] = useState<StoreId | null>(null);


  // Load persisted overrides so edits survive refresh / re-login
  useQuery({
    queryKey: ["grocery-overrides", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grocery_overrides")
        .select("item_key, quantity, unit, category");
      if (error) throw error;
      const map: Record<string, { quantity?: string; unit?: string; category?: string }> = {};
      (data || []).forEach((row: any) => {
        map[row.item_key] = {
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: row.category ?? undefined,
        };
      });
      setItemOverrides(map);
      return data;
    },
    enabled: !!user,
  });
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");

  // How far ahead to shop for. "All upcoming" is the default because it is what
  // the list has always done — narrowing it silently would make a planned meal
  // look like it had gone missing again.
  const RANGES = [
    { id: "7", label: "Next 7 days", days: 7 },
    { id: "14", label: "Next 14 days", days: 14 },
    { id: "30", label: "Next 30 days", days: 30 },
    { id: "all", label: "All upcoming", days: null as number | null },
    { id: "custom", label: "Custom range…", days: null as number | null },
  ];
  const [rangeId, setRangeId] = useState<string>(() => {
    try {
      return localStorage.getItem("grocery-range") ?? "all";
    } catch {
      return "all";
    }
  });
  // A custom range can start on a day other than today — shopping on Saturday
  // for next week's plan is the obvious case — so it carries its own start.
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    try {
      const stored = localStorage.getItem("grocery-range-custom");
      if (!stored) return undefined;
      const { from, to } = JSON.parse(stored) as { from?: string; to?: string };
      return { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined };
    } catch {
      return undefined;
    }
  });
  const [customOpen, setCustomOpen] = useState(false);

  const range = RANGES.find(r => r.id === rangeId) ?? RANGES[3];
  const isCustom = rangeId === "custom";

  const rangeStart = isCustom && customRange?.from ? startOfDay(customRange.from) : today;
  const rangeEnd = isCustom
    ? (customRange?.to ? startOfDay(customRange.to) : customRange?.from ? startOfDay(customRange.from) : null)
    : range.days
      ? addDays(today, range.days - 1)
      : null;

  const queryStart = format(rangeStart, "yyyy-MM-dd");
  const queryEnd = rangeEnd ? format(rangeEnd, "yyyy-MM-dd") : null;

  const setRange = (id: string) => {
    setRangeId(id);
    try { localStorage.setItem("grocery-range", id); } catch { /* private mode */ }
    if (id === "custom") setCustomOpen(true);
  };

  const applyCustomRange = (next: DateRange | undefined) => {
    setCustomRange(next);
    try {
      localStorage.setItem(
        "grocery-range-custom",
        JSON.stringify({ from: next?.from?.toISOString(), to: next?.to?.toISOString() }),
      );
    } catch { /* private mode */ }
    // Close once both ends are chosen, so picking a start doesn't dismiss it.
    if (next?.from && next?.to) setCustomOpen(false);
  };

  // Fetch meal plans in range, with recipe details, in a single joined query.
  const { data: mealPlans = [] } = useQuery({
    queryKey: ["grocery-meal-plans", queryStart, queryEnd],
    queryFn: async () => {
      let q = supabase
        .from("meal_plans")
        .select("*, recipe:recipes(id, title, ingredients)")
        .gte("date", queryStart);
      if (queryEnd) q = q.lte("date", queryEnd);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch inventory
  const { data: inventory = [] } = useQuery({
    queryKey: ["grocery-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, quantity, unit");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // "Need it" used to delete the covering inventory row to force an ingredient
  // onto the buy list — destructive, and wrong now that inventory is advisory.
  // It is handled in the UI by `wantAnyway`, which touches no data.

  // Pantry-level food names for AI categorization. Sending cleaned names rather
  // than raw lines keeps the returned keys aligned with the grocery list's own
  // dedup keys, and collapses the cache across differing quantities.
  const rawIngredients = useMemo(() => {
    const names = new Set<string>();
    mealPlans.forEach(mp => {
      const recipe = mp.recipe;
      if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) return;
      recipe.ingredients.forEach((ing: any) => {
        const raw = (typeof ing === "string" ? ing : ing.name || "").trim();
        const cleaned = cleanIngredientName(raw);
        if (cleaned) names.add(cleaned);
      });
    });
    return Array.from(names);
  }, [mealPlans]);

  // AI-powered categorization
  const { data: aiCategories = {} } = useQuery({
    queryKey: ["ingredient-categories", rawIngredients.sort().join(",")],
    queryFn: async () => {
      if (rawIngredients.length === 0) return {};
      const { data, error } = await supabase.functions.invoke("categorize-ingredients", {
        body: { ingredients: rawIngredients },
      });
      if (error) {
        console.error("AI categorization failed, using fallback:", error);
        return {};
      }
      return (data?.categories || {}) as Record<string, string>;
    },
    enabled: rawIngredients.length > 0,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  // Build grocery list.
  //
  // Entries are keyed on the *cleaned* food name, not the raw ingredient line,
  // so "¼ cup granulated sugar" and "1 cup granulated sugar" collapse into one
  // "Sugar". When an inventory item covers the ingredient the entry takes that
  // item's name, which is what "Already in Inventory" renders — previously it
  // showed the raw line verbatim. See src/lib/ingredient-match.ts.
  const groceryItems = useMemo(() => {
    const contributors: { raw: string; recipeTitle: string; quantity: string; unit: string; plannedAt: string }[] = [];

    mealPlans.forEach(mp => {
      const recipe = mp.recipe;
      if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) return;

      recipe.ingredients.forEach((ing: any) => {
        const raw = (typeof ing === "string" ? ing : ing.name || "").trim();
        if (!raw) return;
        contributors.push({
          raw,
          plannedAt: String(mp.created_at ?? ""),
          recipeTitle: recipe.title,
          quantity: typeof ing === "object" ? String(ing.quantity ?? ing.amount ?? "") : "",
          // Fall back to the unit you'd buy in ("1 head of cabbage") when the
          // recipe gave none, so the row says how much to pick up.
          unit:
            (typeof ing === "object" ? String(ing.unit ?? "") : "") ||
            detectPurchaseUnit(raw),
        });
      });
    });

    const resolved = resolveIngredients(contributors.map(c => c.raw), inventory as { id: string; name: string }[]);

    return resolved.map<GroceryItem>(entry => {
      const mine = contributors.filter(c => entry.sources.includes(c.raw));

      // Total per unit, never across units. Meatloaf asks for Worcestershire
      // twice — 1 tsp and 1 Tbsp — which used to be added together and labelled
      // with whichever unit happened to come first ("2 tsp").
      const byUnit = new Map<string, number>();
      mine.forEach(c => {
        const n = parseAmount(c.quantity);
        if (n === null) return;
        const u = c.unit.trim();
        byUnit.set(u, (byUnit.get(u) ?? 0) + n);
      });
      const measured = Array.from(byUnit.entries());
      // One unit renders as a plain quantity; mixed units keep their own totals
      // ("1 tsp + 1 Tbsp") rather than being silently combined.
      const quantityText =
        measured.length === 1
          ? formatAmount(measured[0][1])
          : measured.map(([u, n]) => `${formatAmount(n)}${u ? ` ${u}` : ""}`).join(" + ");
      const unitText = measured.length === 1 ? measured[0][0] : "";

      let category = aiCategories[entry.key] || "";
      if (!category) {
        for (const [aiName, aiCat] of Object.entries(aiCategories)) {
          if (entry.key.includes(aiName) || aiName.includes(entry.key)) {
            category = aiCat;
            break;
          }
        }
      }
      if (!category) category = "Other";

      // Keep the prep wording the recipe used, without letting it into the name.
      const notes = Array.from(
        new Set(mine.map(c => ingredientNote(c.raw)).filter(Boolean))
      );

      // The newest meal-plan entry needing this item. A tick made before this
      // was about a different shopping list and must not suppress the item now.
      const plannedAt = mine.map(c => c.plannedAt).filter(Boolean).sort().pop() ?? "";

      return {
        key: entry.key,
        name: entry.displayName,
        plannedAt,
        note: notes.join("; "),
        quantity: measured.length > 0 ? quantityText : "",
        unit: unitText,
        category,
        recipes: Array.from(new Set(mine.map(c => c.recipeTitle))),
        inInventory: entry.inInventory,
      };
    });
  }, [mealPlans, inventory, aiCategories]);

  // Fetch manually added grocery items from database
  const { data: dbManualItems = [] } = useQuery({
    queryKey: ["manual-grocery-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("*")
        .eq("is_checked", false);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity || "1",
        unit: item.unit || "",
        category: item.category || "Other",
        recipes: ["Manual"] as string[],
        inInventory: false,
        dbId: item.id,
      }));
    },
    enabled: !!user,
  });

  const { data: dbCheckedManualItems = [] } = useQuery({
    queryKey: ["checked-grocery-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grocery_items")
        .select("*")
        .eq("is_checked", true);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity || "1",
        unit: item.unit || "",
        category: item.category || "Other",
        recipes: ["Manual"] as string[],
        inInventory: false,
        dbId: item.id,
      }));
    },
    enabled: !!user,
  });

  const addManualItemMutation = useMutation({
    mutationFn: async (item: { name: string; quantity: string; unit: string; category: string }) => {
      const { error } = await supabase.from("grocery_items").insert({
        user_id: user!.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
    },
  });

  // Persisted checked keys for recipe-derived items (so checks survive logout / refresh)
  const { data: dbCheckedKeys = [] } = useQuery({
    queryKey: ["grocery-checked-keys"],
    queryFn: async () => {
      // Only recent checks count. These persist so a shopping trip survives a
      // refresh, but they were never cleared, so a tick from a previous trip
      // silently hid that ingredient the next time a recipe called for it —
      // the same disappearing act the deleted-keys blocklist used to cause.
      const cutoff = new Date(Date.now() - CHECK_TTL_DAYS * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("grocery_checked_keys")
        .select("item_key, created_at")
        .gte("created_at", cutoff);
      if (error) throw error;
      return (data || []).map((r: any) => ({ key: r.item_key as string, checkedAt: String(r.created_at) }));
    },
    enabled: !!user,
  });

  const normalizeKey = (s: string) => s.trim().toLowerCase();
  // Removals last for this session only — see `sessionHidden`. The old
  // grocery_deleted_keys table and its "Deleted Items" panel are gone: a
  // permanent blocklist is the wrong model for a list rebuilt from meal plans.
  // Removals are shared, so clearing a row on the laptop clears it on the phone.
  // They are NOT a permanent blocklist: the same recency rule as ticks applies,
  // so planning a new meal brings the ingredient back.
  const { data: dbRemovedKeys = [] } = useQuery({
    queryKey: ["grocery-deleted-keys"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - CHECK_TTL_DAYS * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("grocery_deleted_keys")
        .select("item_key, deleted_at")
        .gte("deleted_at", cutoff);
      if (error) throw error;
      return (data || []).map((r: any) => ({ key: r.item_key as string, removedAt: String(r.deleted_at) }));
    },
    enabled: !!user,
  });

  const removedAtByKey = useMemo(() => {
    const m = new Map<string, string>();
    dbRemovedKeys.forEach(r => {
      const prev = m.get(r.key);
      if (!prev || r.removedAt > prev) m.set(r.key, r.removedAt);
    });
    return m;
  }, [dbRemovedKeys]);

  /** Hidden if removed on this device, or removed since the meal was planned. */
  const isDeleted = (key: string, plannedAt = "") => {
    if (sessionHidden.has(key)) return true;
    const removedAt = removedAtByKey.get(key);
    if (!removedAt) return false;
    return !plannedAt || removedAt >= plannedAt;
  };

  // Seed local Set from DB whenever it changes (merge, don't overwrite optimistic toggles)
  useEffect(() => {
    if (!dbCheckedKeys.length) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      dbCheckedKeys.forEach(r => next.add(r.key));
      return next;
    });
  }, [dbCheckedKeys]);

  const persistCheckKey = async (key: string, checked: boolean) => {
    if (!user) return;
    if (checked) {
      await supabase
        .from("grocery_checked_keys")
        .upsert({ user_id: user.id, item_key: key }, { onConflict: "user_id,item_key" });
    } else {
      await supabase
        .from("grocery_checked_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("item_key", key);
    }
  };

  const checkManualItemMutation = useMutation({
    mutationFn: async ({ name, checked }: { name: string; checked: boolean }) => {
      const { error } = await supabase
        .from("grocery_items")
        .update({ is_checked: checked })
        .ilike("name", name);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["checked-grocery-items"] });
    },
  });

  const deleteManualItemMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("grocery_items")
        .delete()
        .ilike("name", name);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["checked-grocery-items"] });
    },
  });

  const clearAllCheckedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("grocery_items")
        .delete()
        .eq("user_id", user!.id)
        .eq("is_checked", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["checked-grocery-items"] });
    },
  });

  const clearAllChecked = async () => {
    const keysToClear = Array.from(checkedItems);
    setCheckedItems(new Set());
    clearAllCheckedMutation.mutate();
    if (user && keysToClear.length) {
      await supabase
        .from("grocery_checked_keys")
        .delete()
        .eq("user_id", user.id)
        .in("item_key", keysToClear);
      queryClient.invalidateQueries({ queryKey: ["grocery-checked-keys"] });
    }
  };

  // Combine recipe-derived items with manually added items, excluding anything the user deleted
  const allGroceryItems = useMemo(() => {
    const combined = [...groceryItems].filter(i => !isDeleted(i.key, i.plannedAt));
    dbManualItems
      .filter(m => !isDeleted(cleanIngredientName(m.name) || normalizeKey(m.name)))
      .forEach(manual => {
        const key = cleanIngredientName(manual.name) || normalizeKey(manual.name);
        const existing = combined.find(i => i.key === key);
        if (existing) {
          const mNum = parseFloat(manual.quantity);
          const eNum = parseFloat(existing.quantity);
          if (!isNaN(mNum) && mNum > 0) {
            existing.quantity = !isNaN(eNum) ? String(eNum + mNum) : String(mNum);
          }
          if (!existing.recipes.includes("Manual")) existing.recipes.push("Manual");
        } else {
          // Manually added rows carry no recipe prep note.
          combined.push({
            ...manual,
            key: cleanIngredientName(manual.name) || normalizeKey(manual.name),
            note: "",
            plannedAt: "",
          });
        }
      });
    return combined.sort((a, b) => {
      if (a.inInventory !== b.inInventory) return a.inInventory ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [groceryItems, dbManualItems, sessionHidden, removedAtByKey]);

  const addManualItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    addManualItemMutation.mutate({
      name,
      quantity: newItemQuantity || "1",
      unit: newItemUnit,
      category: newItemCategory,
    });
    haptics.light();
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemUnit("");
    setNewItemCategory("Other");
    setShowAddForm(false);
  };

  // Remove a row from the list.
  //
  // A manual row is genuinely the user's own, so it is deleted from
  // grocery_items and stays gone. A recipe-derived row is only hidden for this
  // session — it belongs to a planned meal, so the next time that meal is
  // planned the ingredient must come back. Nothing is written to a blocklist.
  const softDeleteItem = useMutation({
    mutationFn: async (item: GroceryItem) => {
      if (!user) return;
      const key = item.key;
      // Drop any stored check so the row doesn't return pre-ticked.
      await supabase
        .from("grocery_checked_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("item_key", key);
      if (item.recipes.includes("Manual")) {
        await supabase
          .from("grocery_items")
          .delete()
          .eq("user_id", user.id)
          .ilike("name", item.name);
      } else {
        // Recorded so the other devices agree, and stamped so a future meal plan
        // overrides it. deleted_at defaults to now().
        await supabase.from("grocery_deleted_keys").upsert(
          { user_id: user.id, item_key: key, display_name: item.name, source: "recipe" },
          { onConflict: "user_id,item_key" },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-deleted-keys"] });
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["checked-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["grocery-checked-keys"] });
    },
  });

  // Plan-to-Eat style undo: removals and inventory overrides only ever applied
  // to this list, so putting it back is just clearing them.
  const resetList = () => {
    haptics.light();
    setSessionHidden(new Set());
    setWantAnyway(new Set());
    if (user) {
      void supabase
        .from("grocery_deleted_keys")
        .delete()
        .eq("user_id", user.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["grocery-deleted-keys"] }));
    }
    toast({ title: "List reset", description: "Removed items are back." });
  };

  const removeItem = (item: GroceryItem) => {
    haptics.light();
    setSessionHidden(prev => new Set(prev).add(item.key));
    softDeleteItem.mutate(item);
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.delete(item.name.toLowerCase());
      return next;
    });
  };


  const applyOverrides = (items: GroceryItem[]) =>
    items.map(item => {
      const o = itemOverrides[item.name.toLowerCase()];
      if (!o) return item;
      return {
        ...item,
        quantity: o.quantity ?? item.quantity,
        unit: o.unit ?? item.unit,
        category: o.category ?? item.category,
      };
    });

  const updateOverride = (key: string, field: "quantity" | "unit" | "category", value: string) => {
    setItemOverrides(prev => {
      const merged = { ...(prev[key] || {}), [field]: value };
      // persist to DB (fire-and-forget)
      if (user) {
        void supabase
          .from("grocery_overrides")
          .upsert(
            {
              user_id: user.id,
              item_key: key,
              quantity: merged.quantity ?? null,
              unit: merged.unit ?? null,
              category: merged.category ?? null,
            },
            { onConflict: "user_id,item_key" }
          )
          .then(() => queryClient.invalidateQueries({ queryKey: ["grocery-overrides"] }));
      }
      return { ...prev, [key]: merged };
    });
  };

  // Apply overrides then group by store category in aisle order
  const adjustedItems = useMemo(() => applyOverrides(allGroceryItems), [allGroceryItems, itemOverrides]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {};
    adjustedItems.forEach(item => {
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return STORE_CATEGORIES
      .filter(cat => groups[cat]?.length > 0)
      .map(cat => [cat, groups[cat]] as [string, GroceryItem[]]);
  }, [adjustedItems]);

  const toggleCheck = (name: string) => {
    const isManualOnly = dbManualItems.some(i => i.name.toLowerCase() === name) &&
      !groceryItems.some(i => i.name.toLowerCase() === name);
    if (isManualOnly) {
      checkManualItemMutation.mutate({ name, checked: true });
    }
    const isCheckedManual = dbCheckedManualItems.some(i => i.name.toLowerCase() === name);
    if (isCheckedManual) {
      checkManualItemMutation.mutate({ name, checked: false });
    }
    let willBeChecked = false;
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        willBeChecked = false;
      } else {
        next.add(name);
        willBeChecked = true;
      }
      return next;
    });
    // Persist for recipe-derived items so checks survive logout / refresh
    if (!isManualOnly && !isCheckedManual) {
      void persistCheckKey(name, willBeChecked).then(() => {
        queryClient.invalidateQueries({ queryKey: ["grocery-checked-keys"] });
      });
    }
  };

  // When each key was last ticked, so a tick can be compared against the plan
  // that needs it.
  const checkedAtByKey = useMemo(() => {
    const m = new Map<string, string>();
    dbCheckedKeys.forEach(r => {
      const prev = m.get(r.key);
      if (!prev || r.checkedAt > prev) m.set(r.key, r.checkedAt);
    });
    return m;
  }, [dbCheckedKeys]);

  /**
   * A tick means "I bought this for the list I was looking at". If a recipe was
   * planned AFTER the tick, this is a different list and the item is needed
   * again — otherwise last night's shop quietly hides tonight's ingredients.
   * A tick the user just made has no stored timestamp yet and always counts.
   */
  const isChecked = (i: GroceryItem) => {
    const key = i.key;
    if (!checkedItems.has(key)) return false;
    const checkedAt = checkedAtByKey.get(key);
    if (!checkedAt || !i.plannedAt) return true;
    return checkedAt >= i.plannedAt;
  };

  // An owned item the user has explicitly asked for moves onto the buy list at
  // the full recipe amount — we never subtract what's in the pantry.
  const wanted = (i: GroceryItem) => wantAnyway.has(i.key);
  const needToBuy = adjustedItems.filter(i => (!i.inInventory || wanted(i)) && !isChecked(i));
  const alreadyHave = adjustedItems.filter(i => i.inInventory && !wanted(i));
  const allCheckedItems = [
    ...adjustedItems.filter(i => !i.inInventory && isChecked(i)),
    ...dbCheckedManualItems
      .filter(mi => !isDeleted(cleanIngredientName(mi.name) || normalizeKey(mi.name)))
      .filter(mi => {
        const k = cleanIngredientName(mi.name) || normalizeKey(mi.name);
        return !checkedItems.has(k) && !adjustedItems.some(ai => ai.key === k);
      })
      // Give manual rows the same canonical key so the rendered list is uniform.
      .map(mi => ({ ...mi, key: cleanIngredientName(mi.name) || normalizeKey(mi.name) })),
  ];
  const checkedCount = allCheckedItems.length;
  const totalToBuy = needToBuy.length;

  // Build grouped "need to buy" items for print/share, preserving category headings.
  // Mirror the on-screen grouping: known store categories in aisle order, then any
  // extra categories (alphabetical), then a final "Other" bucket for unknowns.
  const buildShareGroups = () => {
    const groups: Record<string, GroceryItem[]> = {};
    needToBuy.forEach(item => {
      const raw = (item.category || "").trim();
      const cat = STORE_CATEGORIES.includes(raw) ? raw : (raw || "Other");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    const ordered: [string, GroceryItem[]][] = [];
    STORE_CATEGORIES.forEach(cat => {
      if (cat !== "Other" && groups[cat]?.length) {
        ordered.push([cat, groups[cat]]);
        delete groups[cat];
      }
    });
    Object.keys(groups)
      .filter(c => c !== "Other")
      .sort()
      .forEach(c => ordered.push([c, groups[c]]));
    if (groups["Other"]?.length) ordered.push(["Other", groups["Other"]]);
    return ordered;
  };

  const formatItemLine = (item: GroceryItem) => {
    const qty = [item.quantity, item.unit].filter(Boolean).join(" ").trim();
    return qty ? `${qty} ${item.name}` : item.name;
  };

  const buildShareText = () => {
    const groups = buildShareGroups();
    const header = `Grocery List (planned from ${format(today, "MMM d, yyyy")})\n`;
    if (groups.length === 0) return `${header}\nNo items to buy.`;
    const body = groups
      .map(([cat, items]) =>
        `\n${cat.toUpperCase()}\n${items.map(i => `  • ${formatItemLine(i)}`).join("\n")}`
      )
      .join("\n");
    return `${header}${body}`;
  };

  // Fetch user's ZIP code (used for store-specific pricing)
  const normalizeKeyLocal = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

  const fetchPricesForStore = async (storeId: StoreId) => {
    if (!user) return;
    // Always read the latest ZIP straight from the DB — avoids stale cache
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("zip_code")
      .eq("user_id", user.id)
      .maybeSingle();
    const zip = ((profileRow as any)?.zip_code ?? "").toString().trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      toast({
        title: "Add your ZIP code",
        description: "Set a 5-digit ZIP in Account settings to fetch store prices.",
        variant: "destructive",
      });
      return;
    }
    if (needToBuy.length === 0) {
      setActiveStore(storeId);
      return;
    }
    setLoadingStore(storeId);
    setActiveStore(storeId);
    try {
      const items = needToBuy.map(i => ({ key: normalizeKeyLocal(i.name), name: i.name }));
      const { data, error } = await supabase.functions.invoke("fetch-grocery-prices", {
        body: { items, store: storeId, zip },
      });
      if (error) throw error;
      const prices = (data as any)?.prices ?? {};
      setPricesByStore(prev => ({ ...prev, [storeId]: prices }));
    } catch (e: any) {
      toast({
        title: "Couldn't fetch prices",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoadingStore(null);
    }
  };


  const getItemPrice = (itemName: string) => {
    if (!activeStore) return null;
    const map = pricesByStore[activeStore];
    if (!map) return null;
    return map[normalizeKeyLocal(itemName)] ?? null;
  };

  const handlePrint = () => {

    const groups = buildShareGroups();
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const rows = groups.length === 0
      ? `<p>No items to buy.</p>`
      : groups.map(([cat, items]) => `
          <section style="margin-bottom:18px;break-inside:avoid;">
            <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #1B2A3A;padding-bottom:4px;margin:0 0 8px;color:#1B2A3A;">${cat}</h2>
            <ul style="list-style:none;padding:0;margin:0;">
              ${items.map(i => `<li style="padding:4px 0;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:14px;height:14px;border:1.5px solid #4B6981;border-radius:3px;flex-shrink:0;"></span>
                <span>${formatItemLine(i).replace(/</g, "&lt;")}</span>
              </li>`).join("")}
            </ul>
          </section>
        `).join("");
    win.document.write(`<!doctype html><html><head><title>Grocery List</title>
      <meta charset="utf-8" />
      <style>
        body{font-family:Inter,system-ui,sans-serif;color:#1B2A3A;max-width:680px;margin:24px auto;padding:0 16px;}
        h1{font-size:22px;margin:0 0 4px;}
        .range{color:#666;font-size:13px;margin-bottom:20px;}
        @media print { @page { margin: 0.5in; } }
      </style></head><body>
      <h1>Grocery List</h1>
      <div class="range">Planned from ${format(today, "MMM d, yyyy")}</div>
      ${rows}
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  // OS detection — used to tailor share options
  const detectOS = (): "ios" | "android" | "mac" | "windows" | "other" => {
    if (typeof navigator === "undefined") return "other";
    const ua = navigator.userAgent || "";
    const platform = (navigator as any).platform || "";
    const isIPad = /iPad/.test(ua) || (platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    if (/iPhone|iPod/.test(ua) || isIPad) return "ios";
    if (/Android/.test(ua)) return "android";
    if (/Mac/i.test(platform)) return "mac";
    if (/Win/i.test(platform)) return "windows";
    return "other";
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent("Grocery List");
    const body = encodeURIComponent(buildShareText());
    // Use an anchor click so the OS default mail handler is invoked
    // (window.location.href / window.open can be intercepted by the browser
    // and routed to a web mail client like Gmail instead).
    const a = document.createElement("a");
    a.href = `mailto:?subject=${subject}&body=${body}`;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareViaSMS = () => {
    const os = detectOS();
    const body = encodeURIComponent(buildShareText());
    // iOS uses `&`, Android uses `?` for the body param
    const sep = os === "ios" ? "&" : "?";
    window.location.href = `sms:${sep}body=${body}`;
  };

  const shareViaCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast({ title: "Copied to clipboard", description: "Grocery list ready to paste anywhere." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  const shareViaNative = async () => {
    try {
      await (navigator as any).share({ title: "Grocery List", text: buildShareText() });
    } catch {
      // user cancelled
    }
  };

  const os = detectOS();
  const isMobile = os === "ios" || os === "android";
  const hasNativeShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";


  return (
    <div className="space-y-6">
      {/* Header with date range selection */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold font-serif text-foreground">Grocery List</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-generated from your meal plan. Add extra items manually too.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Select value={rangeId} onValueChange={setRange}>
                <SelectTrigger className="h-8 w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustom && (
                <Popover open={customOpen} onOpenChange={setCustomOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8">
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {customRange?.from ? "Edit dates" : "Pick dates"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 space-y-2" align="start">
                    <p className="text-sm font-medium text-foreground">Shop for these dates</p>
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={applyCustomRange}
                      numberOfMonths={1}
                      defaultMonth={customRange?.from ?? today}
                      className={cn("p-0 pointer-events-auto")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {customRange?.from
                        ? customRange.to
                          ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
                          : "Now pick the last day."
                        : "Pick the first day."}
                    </p>
                  </PopoverContent>
                </Popover>
              )}
              <span className="text-xs text-muted-foreground">
                {isCustom && !customRange?.from
                  ? "No dates chosen yet"
                  : rangeEnd
                    ? `${format(rangeStart, "EEE, MMM d")} – ${format(rangeEnd, "EEE, MMM d")}`
                    : `${format(rangeStart, "EEE, MMM d")} onward`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Store price selector */}
            <div className="flex items-center gap-1 mr-1 flex-wrap">
              {STORES.map(s => {
                const isActive = activeStore === s.id;
                const isLoading = loadingStore === s.id;
                return (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => fetchPricesForStore(s.id)}
                    disabled={isLoading || needToBuy.length === 0}
                    title={`Show ${s.label} prices`}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {s.label}
                  </Button>
                );
              })}
              {activeStore && (
                <Button size="sm" variant="ghost" onClick={() => setActiveStore(null)} title="Hide prices">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {(sessionHidden.size > 0 || wantAnyway.size > 0) && (
              <Button
                onClick={resetList}
                size="sm"
                variant="outline"
                title="Bring back everything you removed from this list"
              >
                <Undo2 className="mr-2 h-4 w-4" /> Reset list
              </Button>
            )}
            <Button onClick={handlePrint} size="sm" variant="outline" disabled={needToBuy.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>

            {isMobile && hasNativeShare ? (
              <Button onClick={shareViaNative} size="sm" variant="outline" disabled={needToBuy.length === 0}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={needToBuy.length === 0}>
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  {hasNativeShare && (
                    <DropdownMenuItem onClick={shareViaNative}>
                      <Share2 className="mr-2 h-4 w-4" /> System share…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={shareViaEmail}>Email</DropdownMenuItem>
                  {isMobile && (
                    <DropdownMenuItem onClick={shareViaSMS}>Text message</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={shareViaCopy}>Copy to clipboard</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {rangeEnd
            ? `Includes ingredients from every recipe planned ${format(rangeStart, "EEE, MMM d")} through ${format(rangeEnd, "EEE, MMM d")}.`
            : "Includes ingredients from every recipe planned for today or later."}
        </p>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Add Grocery Item</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Item name *"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && addManualItem()}
              />
              <Input
                placeholder="Qty"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
                className="w-20"
              />
              <Input
                placeholder="Unit"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                className="w-24"
              />
              <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addManualItem} disabled={!newItemName.trim()}>Add</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{totalToBuy}</p>
              <p className="text-xs text-muted-foreground">Items to buy</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{checkedCount}</p>
              <p className="text-xs text-muted-foreground">Checked off</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{alreadyHave.length}</p>
              <p className="text-xs text-muted-foreground">Already have</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-2xl font-bold text-foreground">{mealPlans.length}</p>
              <p className="text-xs text-muted-foreground">Planned meals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {allGroceryItems.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No items yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Add recipes to your meal plan for today or later and the grocery list will be automatically generated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main grocery list */}
          <div className="lg:col-span-2 space-y-4">
            {groupedItems.map(([category, items]) => {
              const toBuyItems = items.filter(i => !i.inInventory && !checkedItems.has(i.name.toLowerCase()));
              if (toBuyItems.length === 0) return null;

              return (
                <Card key={category} className="border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
                      {category}
                      <Badge variant="secondary" className="text-xs">{toBuyItems.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1">
                    {toBuyItems.map(item => {
                      const key = item.key;
                      const isEditing = editingItem === key;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border border-border transition-colors",
                            !isEditing && "cursor-pointer hover:bg-muted/50"
                          )}
                          onClick={() => !isEditing && toggleCheck(key)}
                        >
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => toggleCheck(key)}
                            className="flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    className="h-7 w-20 text-xs"
                                    placeholder="Qty"
                                    defaultValue={item.quantity}
                                    onBlur={e => updateOverride(key, "quantity", e.target.value)}
                                  />
                                  <Input
                                    className="h-7 w-20 text-xs"
                                    placeholder="Unit"
                                    defaultValue={item.unit}
                                    onBlur={e => updateOverride(key, "unit", e.target.value)}
                                  />
                                  <Select
                                    defaultValue={item.category}
                                    onValueChange={v => updateOverride(key, "category", v)}
                                  >
                                    <SelectTrigger className="h-7 w-32 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STORE_CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingItem(null)}>
                                    Done
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-foreground">
                                  {item.name}
                                  {item.quantity && (
                                    <span className="text-muted-foreground font-normal ml-1">
                                      — {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                    </span>
                                  )}
                                  {activeStore && (() => {
                                    const p = getItemPrice(item.name);
                                    if (loadingStore === activeStore && !p) {
                                      return (
                                        <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> {STORES.find(s => s.id === activeStore)?.label}…
                                        </span>
                                      );
                                    }
                                    if (!p) return null;
                                    const storeLabel = STORES.find(s => s.id === activeStore)?.label;
                                    return (
                                      <span className="ml-2 inline-flex items-center text-xs font-semibold text-primary">
                                        {storeLabel} {p.price != null ? `$${Number(p.price).toFixed(2)}` : "—"}
                                      </span>
                                    );
                                  })()}
                                </p>
                                {item.note && (
                                  <p className="text-xs text-muted-foreground/90 truncate">
                                    {item.note}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground truncate">
                                  Used in: {item.recipes.join(", ")}
                                </p>
                              </>
                            )}

                          </div>
                          {!isEditing && (
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={e => { e.stopPropagation(); setEditingItem(key); }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={e => { e.stopPropagation(); removeItem(item); }}
                                title="Delete item"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}

          </div>

          {/* Sidebar: items already in inventory */}
          <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4 scrollbar-thin">
            <Card className="border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Already in Inventory
                  <Badge variant="secondary" className="text-xs ml-auto">{alreadyHave.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {alreadyHave.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No matching inventory items found.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px] pr-2">
                    <div className="space-y-1">
                      {alreadyHave.map(item => (
                        <div
                          key={item.name.toLowerCase()}
                          className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10"
                        >
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.recipes.join(", ")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] flex-shrink-0"
                            onClick={() => {
                              haptics.light();
                              setWantAnyway(prev => new Set(prev).add(item.key));
                              toast({ title: "Added to your list" });
                            }}
                          >
                            Need it
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {checkedCount > 0 && (
              <Card className="border-border">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    All Bought Items
                    <Badge variant="secondary" className="text-xs ml-auto">{checkedCount}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={clearAllChecked}
                    >
                      Clear
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-[400px] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      {allCheckedItems.map(item => {
                          const key = item.key;
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => toggleCheck(key)}
                            >
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => toggleCheck(key)}
                                className="flex-shrink-0 h-3.5 w-3.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-muted-foreground line-through truncate">
                                  {item.name}
                                  {item.quantity && (
                                    <span className="font-normal ml-1">
                                      — {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted-foreground/70 truncate">
                                  {item.recipes.join(", ")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default GroceryList;
