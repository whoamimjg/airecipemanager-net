import { useState, useMemo, useEffect } from "react";
import { format, startOfWeek, addDays, addWeeks, startOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
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

interface GroceryItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  recipes: string[];
  inInventory: boolean;
}

const STORE_CATEGORIES = [
  "Produce", "Meats", "Dairy", "Beverages", "Cereal", "Dry Goods", "Canned Goods", "Bread", "Frozen", "Condiments & Spices", "Other"
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
  const [manualItems, setManualItems] = useState<GroceryItem[]>([]);
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

  // Combine recipe-derived items with manually added items
  const allGroceryItems = useMemo(() => {
    const combined = [...groceryItems];
    manualItems.forEach(manual => {
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
  }, [groceryItems, manualItems]);

  const addManualItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    setManualItems(prev => [
      ...prev,
      {
        name,
        quantity: newItemQuantity || "1",
        unit: newItemUnit,
        category: newItemCategory,
        recipes: ["Manual"],
        inInventory: false,
      },
    ]);
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemUnit("");
    setNewItemCategory("Other");
    setShowAddForm(false);
  };

  const removeManualItem = (itemName: string) => {
    setManualItems(prev => prev.filter(i => i.name.toLowerCase() !== itemName.toLowerCase()));
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
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const needToBuy = groceryItems.filter(i => !i.inInventory && !checkedItems.has(i.name.toLowerCase()));
  const alreadyHave = groceryItems.filter(i => i.inInventory);
  const checkedCount = checkedItems.size;
  const totalToBuy = groceryItems.filter(i => !i.inInventory).length;

  return (
    <div className="space-y-6">
      {/* Header with date range selection */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-foreground">Grocery List</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated from your meal plan. Items already in your inventory are excluded.
          </p>
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

      {groceryItems.length === 0 ? (
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
              const toBuyItems = items.filter(i => !i.inInventory);
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
                      const isChecked = checkedItems.has(key);
                      const isEditing = editingItem === key;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border border-border transition-colors",
                            !isEditing && "cursor-pointer hover:bg-muted/50",
                            isChecked && "bg-muted/30 opacity-60"
                          )}
                          onClick={() => !isEditing && toggleCheck(key)}
                        >
                          <Checkbox
                            checked={isChecked}
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
                                <p className={cn(
                                  "text-sm font-medium text-foreground",
                                  isChecked && "line-through text-muted-foreground"
                                )}>
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 flex-shrink-0"
                              onClick={e => { e.stopPropagation(); setEditingItem(key); }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
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
          <div>
            <Card className="border-border sticky top-24">
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
                  <ScrollArea className="max-h-[400px]">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default GroceryList;
