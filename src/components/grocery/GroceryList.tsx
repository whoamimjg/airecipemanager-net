import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft, ChevronRight, ShoppingCart, Package, Check, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GroceryItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  recipes: string[];
  inInventory: boolean;
}

const GroceryList = () => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const weekEnd = addDays(weekStart, 6);
  const queryStart = format(weekStart, "yyyy-MM-dd");
  const queryEnd = format(weekEnd, "yyyy-MM-dd");

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

  const STORE_CATEGORIES = [
    "Produce", "Meats", "Dairy", "Beverages", "Cereal", "Canned Goods", "Bread", "Frozen", "Condiments & Spices", "Other"
  ];

  const categorizeIngredient = (name: string, originalCategory: string): string => {
    const n = name.toLowerCase();
    const produceKeywords = ["lettuce", "tomato", "onion", "garlic", "pepper", "carrot", "potato", "celery", "cucumber", "spinach", "kale", "broccoli", "mushroom", "zucchini", "squash", "corn", "pea", "bean", "avocado", "lemon", "lime", "orange", "apple", "banana", "berry", "blueberry", "strawberry", "grape", "mango", "pineapple", "peach", "pear", "melon", "ginger", "cilantro", "parsley", "basil", "mint", "dill", "scallion", "shallot", "leek", "cabbage", "radish", "beet", "asparagus", "artichoke", "jalapeño", "serrano", "habanero", "chili", "fruit", "vegetable", "salad", "herb"];
    const meatKeywords = ["chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "steak", "ground", "meat", "fish", "salmon", "tuna", "shrimp", "prawn", "crab", "lobster", "cod", "tilapia", "ham", "ribs", "brisket", "veal", "duck", "wing", "thigh", "breast", "drumstick", "seafood", "anchov"];
    const dairyKeywords = ["milk", "cheese", "butter", "cream", "yogurt", "sour cream", "egg", "mozzarella", "parmesan", "cheddar", "ricotta", "cottage", "whip", "half and half", "ghee", "margarine"];
    const beverageKeywords = ["juice", "soda", "water", "coffee", "tea", "wine", "beer", "drink", "lemonade", "kombucha", "smoothie", "cola"];
    const cerealKeywords = ["cereal", "oat", "granola", "rice", "pasta", "noodle", "flour", "quinoa", "couscous", "barley", "farro", "grain", "wheat", "cornmeal", "polenta", "spaghetti", "penne", "macaroni", "linguine", "fettuccine"];
    const cannedKeywords = ["canned", "can of", "tomato sauce", "tomato paste", "diced tomato", "crushed tomato", "broth", "stock", "soup", "beans", "chickpea", "lentil", "coconut milk", "condensed", "evaporated"];
    const breadKeywords = ["bread", "bun", "roll", "tortilla", "pita", "naan", "bagel", "croissant", "wrap", "flatbread", "english muffin", "biscuit", "crouton"];
    const frozenKeywords = ["frozen", "ice cream", "popsicle", "pizza"];
    const condimentKeywords = ["salt", "pepper", "sugar", "oil", "vinegar", "sauce", "soy sauce", "mustard", "ketchup", "mayo", "mayonnaise", "honey", "syrup", "spice", "cumin", "paprika", "cinnamon", "nutmeg", "oregano", "thyme", "rosemary", "bay leaf", "turmeric", "cayenne", "chili powder", "curry", "vanilla", "extract", "seasoning", "dressing", "sriracha", "hot sauce", "worcestershire", "olive oil", "sesame", "cornstarch", "baking soda", "baking powder", "yeast"];

    if (produceKeywords.some(k => n.includes(k))) return "Produce";
    if (meatKeywords.some(k => n.includes(k))) return "Meats";
    if (dairyKeywords.some(k => n.includes(k))) return "Dairy";
    if (beverageKeywords.some(k => n.includes(k))) return "Beverages";
    if (cerealKeywords.some(k => n.includes(k))) return "Cereal";
    if (cannedKeywords.some(k => n.includes(k))) return "Canned Goods";
    if (breadKeywords.some(k => n.includes(k))) return "Bread";
    if (frozenKeywords.some(k => n.includes(k))) return "Frozen";
    if (condimentKeywords.some(k => n.includes(k))) return "Condiments & Spices";

    // Fall back to original category mapping
    const oc = originalCategory.toLowerCase();
    if (["produce", "fruit", "vegetable", "fresh"].some(k => oc.includes(k))) return "Produce";
    if (["meat", "protein", "seafood", "fish", "poultry"].some(k => oc.includes(k))) return "Meats";
    if (["dairy", "egg"].some(k => oc.includes(k))) return "Dairy";
    if (["beverage", "drink"].some(k => oc.includes(k))) return "Beverages";
    if (["grain", "cereal", "pasta", "rice"].some(k => oc.includes(k))) return "Cereal";
    if (["canned", "can"].some(k => oc.includes(k))) return "Canned Goods";
    if (["bread", "bakery", "baked"].some(k => oc.includes(k))) return "Bread";
    if (["frozen"].some(k => oc.includes(k))) return "Frozen";
    if (["condiment", "spice", "seasoning", "sauce", "oil"].some(k => oc.includes(k))) return "Condiments & Spices";

    return "Other";
  };

  // Build grocery list: aggregate ingredients, exclude inventory
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
        const originalCategory = typeof ing === "object" ? (ing.category || "Other") : "Other";
        const category = categorizeIngredient(name, originalCategory);

        const inInventory = inventoryNames.some(inv => inv.includes(key) || key.includes(inv));

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          if (!existing.recipes.includes(recipe.title)) {
            existing.recipes.push(recipe.title);
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
  }, [mealPlans, inventory]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {};
    groceryItems.forEach(item => {
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [groceryItems]);

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
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-foreground">Grocery List</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated from your meal plan. Items already in your inventory are excluded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center text-foreground">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
              Add recipes to your meal plan for this week and the grocery list will be automatically generated.
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
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border border-border transition-colors cursor-pointer hover:bg-muted/50",
                            isChecked && "bg-muted/30 opacity-60"
                          )}
                          onClick={() => toggleCheck(key)}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleCheck(key)}
                            className="flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
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
                          </div>
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
