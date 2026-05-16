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
  CalendarIcon, ShoppingCart, Package, Check, AlertTriangle, Pencil, Plus, X
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

  // Combine recipe-derived items with manually added items
  const allGroceryItems = useMemo(() => {
    const combined = [...groceryItems];
    dbManualItems.forEach(manual => {
      const key = manual.name.toLowerCase();
      const existing = combined.find(i => i.name.toLowerCase() === key);
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
  }, [groceryItems, dbManualItems]);

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

  const removeManualItem = (itemName: string) => {
    deleteManualItemMutation.mutate(itemName);
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

  const updateOverride = (key: string, field: string, value: string) => {
    setItemOverrides(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
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

  const needToBuy = allGroceryItems.filter(i => !i.inInventory && !checkedItems.has(i.name.toLowerCase()));
  const alreadyHave = allGroceryItems.filter(i => i.inInventory);
  const allCheckedItems = [
    ...adjustedItems.filter(i => !i.inInventory && checkedItems.has(i.name.toLowerCase())),
    ...dbCheckedManualItems.filter(mi => !checkedItems.has(mi.name.toLowerCase()) && !adjustedItems.some(ai => ai.name.toLowerCase() === mi.name.toLowerCase())),
  ];
  const checkedCount = allCheckedItems.length;
  const totalToBuy = allGroceryItems.filter(i => !i.inInventory).length;

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
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
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
                              {item.recipes.length === 1 && item.recipes[0] === "Manual" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={e => { e.stopPropagation(); removeManualItem(item.name); }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
                  <ScrollArea className="max-h-[400px]">
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
                  </ScrollArea>
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
