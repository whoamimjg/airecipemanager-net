import { useState, useMemo, useEffect } from "react";
import { format, startOfWeek, addDays, addWeeks, startOfDay } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon, ShoppingCart, Package, Check, AlertTriangle, Pencil, Plus, X, Trash2, Undo2, Printer, Share2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/native";

interface GroceryItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  recipes: string[];
  inInventory: boolean;
}

const STORE_CATEGORIES = [
  "Produce", "Meats", "Dairy", "Beverages", "Cereal", "Dry Goods", "Canned Goods", "Bread", "Frozen", "Snacks", "Condiments & Spices", "Other"
];

type RangePreset = "this-week" | "next-week" | "2-weeks" | "this-month" | "custom";

const GroceryList = () => {
  const { user } = useAuth();
  const today = startOfDay(new Date());
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });

  const [preset, setPreset] = useState<RangePreset>("this-week");
  const [customFrom, setCustomFrom] = useState<Date>(thisWeekStart);
  const [customTo, setCustomTo] = useState<Date>(addDays(thisWeekStart, 6));
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemOverrides, setItemOverrides] = useState<Record<string, { quantity?: string; unit?: string; category?: string }>>({});

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

  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (preset) {
      case "this-week":
        return { rangeStart: thisWeekStart, rangeEnd: addDays(thisWeekStart, 6) };
      case "next-week": {
        const nw = addWeeks(thisWeekStart, 1);
        return { rangeStart: nw, rangeEnd: addDays(nw, 6) };
      }
      case "2-weeks":
        return { rangeStart: thisWeekStart, rangeEnd: addDays(thisWeekStart, 13) };
      case "this-month":
        return { rangeStart: thisWeekStart, rangeEnd: addDays(thisWeekStart, 29) };
      case "custom":
        return { rangeStart: customFrom, rangeEnd: customTo };
    }
  }, [preset, thisWeekStart, customFrom, customTo]);

  const queryStart = format(rangeStart, "yyyy-MM-dd");
  const queryEnd = format(rangeEnd, "yyyy-MM-dd");

  // Fetch meal plans for the week with recipe details
  const { data: mealPlans = [] } = useQuery({
    queryKey: ["grocery-meal-plans", queryStart, queryEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .gte("date", queryStart)
        .lte("date", queryEnd);
      if (error) throw error;

      const recipeIds = [...new Set((data || []).filter(mp => mp.recipe_id).map(mp => mp.recipe_id))];
      if (recipeIds.length === 0) return [];

      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, title, ingredients")
        .in("id", recipeIds);

      const recipesMap = Object.fromEntries((recipes || []).map(r => [r.id, r]));
      return (data || []).map(mp => ({
        ...mp,
        recipe: mp.recipe_id ? recipesMap[mp.recipe_id] : undefined,
      }));
    },
    enabled: !!user,
  });

  // Fetch inventory
  const { data: inventory = [] } = useQuery({
    queryKey: ["grocery-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("name, quantity, unit");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Extract raw ingredient names for AI categorization
  const rawIngredients = useMemo(() => {
    const names = new Set<string>();
    mealPlans.forEach(mp => {
      const recipe = mp.recipe;
      if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) return;
      recipe.ingredients.forEach((ing: any) => {
        const name = (typeof ing === "string" ? ing : ing.name || "").trim();
        if (name) names.add(name.toLowerCase());
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

  // Build grocery list
  const groceryItems = useMemo(() => {
    const ingredientMap = new Map<string, GroceryItem>();
    const inventoryNames = inventory.map(i => i.name.toLowerCase());

    mealPlans.forEach(mp => {
      const recipe = mp.recipe;
      if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) return;

      recipe.ingredients.forEach((ing: any) => {
        const name = (typeof ing === "string" ? ing : ing.name || "").trim();
        if (!name) return;

        const key = name.toLowerCase();
        const quantity = typeof ing === "object" ? (ing.quantity || ing.amount || "") : "";
        const unit = typeof ing === "object" ? (ing.unit || "") : "";
        
        // Use AI category - try exact match first, then check if any AI key is contained in this ingredient
        let category = aiCategories[key] || "";
        if (!category) {
          for (const [aiName, aiCat] of Object.entries(aiCategories)) {
            if (key.includes(aiName) || aiName.includes(key)) {
              category = aiCat;
              break;
            }
          }
        }
        if (!category) category = "Other";
        const inInventory = inventoryNames.some(inv => inv.includes(key) || key.includes(inv));

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          if (!existing.recipes.includes(recipe.title)) {
            existing.recipes.push(recipe.title);
          }
          // Aggregate quantities
          const qNum = parseFloat(String(quantity));
          const eNum = parseFloat(existing.quantity);
          if (!isNaN(qNum) && qNum > 0) {
            if (!isNaN(eNum)) {
              existing.quantity = String(eNum + qNum);
            } else {
              existing.quantity = String(qNum);
            }
          }
        } else {
          ingredientMap.set(key, {
            name,
            quantity: String(quantity),
            unit: String(unit),
            category,
            recipes: [recipe.title],
            inInventory,
          });
        }
      });
    });

    return Array.from(ingredientMap.values()).sort((a, b) => {
      if (a.inInventory !== b.inInventory) return a.inInventory ? 1 : -1;
      return a.name.localeCompare(b.name);
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
      const { data, error } = await supabase
        .from("grocery_checked_keys")
        .select("item_key");
      if (error) throw error;
      return (data || []).map((r: any) => r.item_key as string);
    },
    enabled: !!user,
  });

  // Persisted deleted items (recipe-derived + manual). These never reappear unless restored.
  const { data: deletedItems = [] } = useQuery({
    queryKey: ["grocery-deleted-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grocery_deleted_keys")
        .select("*")
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        item_key: string;
        display_name: string;
        quantity: string | null;
        unit: string | null;
        category: string | null;
        source: string;
        deleted_at: string;
      }>;
    },
    enabled: !!user,
  });
  const normalizeKey = (s: string) => s.trim().toLowerCase();
  const deletedKeySet = useMemo(
    () => new Set(deletedItems.map(d => normalizeKey(d.item_key))),
    [deletedItems]
  );
  const isDeleted = (name: string) => deletedKeySet.has(normalizeKey(name));

  // Seed local Set from DB whenever it changes (merge, don't overwrite optimistic toggles)
  useEffect(() => {
    if (!dbCheckedKeys.length) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      dbCheckedKeys.forEach(k => next.add(k));
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
    const combined = [...groceryItems].filter(i => !isDeleted(i.name));
    dbManualItems
      .filter(m => !isDeleted(m.name))
      .forEach(manual => {
        const key = normalizeKey(manual.name);
        const existing = combined.find(i => normalizeKey(i.name) === key);
        if (existing) {
          const mNum = parseFloat(manual.quantity);
          const eNum = parseFloat(existing.quantity);
          if (!isNaN(mNum) && mNum > 0) {
            existing.quantity = !isNaN(eNum) ? String(eNum + mNum) : String(mNum);
          }
          if (!existing.recipes.includes("Manual")) existing.recipes.push("Manual");
        } else {
          combined.push(manual);
        }
      });
    return combined.sort((a, b) => {
      if (a.inInventory !== b.inInventory) return a.inInventory ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [groceryItems, dbManualItems, deletedKeySet]);

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

  // Soft-delete: record in grocery_deleted_keys so it never auto-reappears.
  // Manual rows are also removed from grocery_items so they aren't re-aggregated.
  const softDeleteItem = useMutation({
    mutationFn: async (item: GroceryItem) => {
      if (!user) return;
      const key = normalizeKey(item.name);
      const hasManual = item.recipes.includes("Manual");
      const isPureManual = item.recipes.length === 1 && item.recipes[0] === "Manual";
      await supabase.from("grocery_deleted_keys").upsert(
        {
          user_id: user.id,
          item_key: key,
          display_name: item.name,
          quantity: item.quantity || null,
          unit: item.unit || null,
          category: item.category || null,
          source: isPureManual ? "manual" : "recipe",
        },
        { onConflict: "user_id,item_key" }
      );
      // Always purge any active checked state for this key
      await supabase
        .from("grocery_checked_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("item_key", key);
      // Always remove any matching row from grocery_items (covers manual & combined items,
      // and any stale checked-but-not-deleted rows). Safe no-op if no rows match.
      await supabase
        .from("grocery_items")
        .delete()
        .eq("user_id", user.id)
        .ilike("name", item.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-deleted-keys"] });
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["checked-grocery-items"] });
      queryClient.invalidateQueries({ queryKey: ["grocery-checked-keys"] });
    },
  });

  const restoreDeletedItem = useMutation({
    mutationFn: async (d: { id: string; item_key: string; source: string; display_name: string; quantity: string | null; unit: string | null; category: string | null }) => {
      if (!user) return;
      // If it was a manual item, re-create it so it shows again (recipe items come back from meal plans automatically)
      if (d.source === "manual") {
        await supabase.from("grocery_items").insert({
          user_id: user.id,
          name: d.display_name,
          quantity: d.quantity || "1",
          unit: d.unit || "",
          category: d.category || "Other",
        });
      }
      await supabase.from("grocery_deleted_keys").delete().eq("id", d.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-deleted-keys"] });
      queryClient.invalidateQueries({ queryKey: ["manual-grocery-items"] });
    },
  });

  const removeItem = (item: GroceryItem) => {
    haptics.light();
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

  const needToBuy = adjustedItems.filter(i => !i.inInventory && !checkedItems.has(normalizeKey(i.name)));
  const alreadyHave = adjustedItems.filter(i => i.inInventory);
  const allCheckedItems = [
    ...adjustedItems.filter(i => !i.inInventory && checkedItems.has(normalizeKey(i.name))),
    ...dbCheckedManualItems
      .filter(mi => !isDeleted(mi.name))
      .filter(mi => !checkedItems.has(normalizeKey(mi.name)) && !adjustedItems.some(ai => normalizeKey(ai.name) === normalizeKey(mi.name))),
  ];
  const checkedCount = allCheckedItems.length;
  const totalToBuy = adjustedItems.filter(i => !i.inInventory).length;

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
    const header = `Grocery List (${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")})\n`;
    if (groups.length === 0) return `${header}\nNo items to buy.`;
    const body = groups
      .map(([cat, items]) =>
        `\n${cat.toUpperCase()}\n${items.map(i => `  • ${formatItemLine(i)}`).join("\n")}`
      )
      .join("\n");
    return `${header}${body}`;
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
      <div class="range">${format(rangeStart, "MMM d, yyyy")} – ${format(rangeEnd, "MMM d, yyyy")}</div>
      ${rows}
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  const handleShare = async () => {
    const text = buildShareText();
    const shareData = { title: "Grocery List", text };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      // user cancelled or share failed; fall through to mailto
    }
    const subject = encodeURIComponent("Grocery List");
    const body = encodeURIComponent(text);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };


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
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} size="sm" variant="outline" disabled={needToBuy.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={handleShare} size="sm" variant="outline" disabled={needToBuy.length === 0}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["this-week", "This Week"],
              ["next-week", "Next Week"],
              ["2-weeks", "2 Weeks"],
              ["this-month", "4 Weeks"],
              ["custom", "Custom"],
            ] as [RangePreset, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={preset === key ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(customFrom, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={(d) => d && setCustomFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(customTo, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={(d) => d && setCustomTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Showing: {format(rangeStart, "MMM d")} – {format(rangeEnd, "MMM d, yyyy")}
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
              Add recipes to your meal plan for this date range and the grocery list will be automatically generated.
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
                      const key = item.name.toLowerCase();
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
                                </p>
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
                          const key = item.name.toLowerCase();
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

            {deletedItems.length > 0 && (
              <Card className="border-border">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    Deleted Items
                    <Badge variant="secondary" className="text-xs ml-auto">{deletedItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="max-h-[400px] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      {deletedItems.map(d => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {d.display_name}
                              {d.quantity && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  — {d.quantity}{d.unit ? ` ${d.unit}` : ""}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 truncate">
                              {d.source === "manual" ? "Manual" : "From meal plan"} · {new Date(d.deleted_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-primary"
                            onClick={() => restoreDeletedItem.mutate(d)}
                            title="Restore"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
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
