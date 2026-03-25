import { useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search,
  Star, Plus, X, ChefHat, Trash2, UtensilsCrossed
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_SLOTS: { key: MealSlot; label: string; color: string }[] = [
  { key: "breakfast", label: "Breakfast", color: "bg-warning/15 text-warning border-warning/30" },
  { key: "lunch", label: "Lunch", color: "bg-primary/15 text-primary border-primary/30" },
  { key: "dinner", label: "Dinner", color: "bg-accent/15 text-accent border-accent/30" },
  { key: "snack", label: "Snack", color: "bg-info/15 text-info border-info/30" },
];

interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string | null;
  date: string;
  meal_slot: string;
  notes: string | null;
  recipe?: { id: string; title: string; prep_time: number | null; cook_time: number | null; image_url: string | null; ingredients: any };
}

interface Recipe {
  id: string;
  title: string;
  category: string | null;
  prep_time: number | null;
  cook_time: number | null;
  image_url: string | null;
  ingredients: any;
}

const MealPlanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [recipeSearch, setRecipeSearch] = useState("");
  const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null);
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(new Date());

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekEnd = addDays(currentWeekStart, 6);

  // Fetch meal plans for current week
  const { data: mealPlans = [] } = useQuery({
    queryKey: ["meal-plans", format(currentWeekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .gte("date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;

      // Fetch associated recipes
      const recipeIds = [...new Set((data || []).filter(mp => mp.recipe_id).map(mp => mp.recipe_id))];
      let recipesMap: Record<string, Recipe> = {};
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from("recipes")
          .select("id, title, category, prep_time, cook_time, image_url, ingredients")
          .in("id", recipeIds);
        if (recipes) {
          recipesMap = Object.fromEntries(recipes.map(r => [r.id, r]));
        }
      }

      return (data || []).map(mp => ({
        ...mp,
        recipe: mp.recipe_id ? recipesMap[mp.recipe_id] : undefined,
      })) as MealPlan[];
    },
    enabled: !!user,
  });

  // Fetch all recipes for sidebar
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes-for-planner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, category, prep_time, cook_time, image_url, ingredients")
        .order("title");
      if (error) throw error;
      return data as Recipe[];
    },
    enabled: !!user,
  });

  // Fetch inventory for ingredient matching
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-for-planner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("name");
      if (error) throw error;
      return data.map(i => i.name.toLowerCase());
    },
    enabled: !!user,
  });

  const addMealPlan = useMutation({
    mutationFn: async ({ recipe_id, date, meal_slot }: { recipe_id: string; date: string; meal_slot: MealSlot }) => {
      const { error } = await supabase.from("meal_plans").insert({
        user_id: user!.id,
        recipe_id,
        date,
        meal_slot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success("Recipe added to meal plan");
    },
    onError: () => toast.error("Failed to add to meal plan"),
  });

  const removeMealPlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success("Removed from meal plan");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const hasIngredients = (recipe: Recipe): boolean => {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return false;
    const recipeIngredients = recipe.ingredients.map((i: any) =>
      (typeof i === "string" ? i : i.name || "").toLowerCase()
    );
    if (recipeIngredients.length === 0) return false;
    const matchCount = recipeIngredients.filter(ri =>
      inventory.some(inv => inv.includes(ri) || ri.includes(inv))
    ).length;
    return matchCount / recipeIngredients.length >= 0.7;
  };

  const filteredRecipes = recipes.filter(r =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    (r.category?.toLowerCase().includes(recipeSearch.toLowerCase()) ?? false)
  );

  const getMealsForDaySlot = (date: Date, slot: MealSlot) =>
    mealPlans.filter(mp => mp.date === format(date, "yyyy-MM-dd") && mp.meal_slot === slot);

  const handleDrop = (date: Date, slot: MealSlot) => {
    if (draggedRecipe) {
      addMealPlan.mutate({ recipe_id: draggedRecipe.id, date: format(date, "yyyy-MM-dd"), meal_slot: slot });
      setDraggedRecipe(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary");
  };

  const handleDropEvent = (e: React.DragEvent, date: Date, slot: MealSlot) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary");
    handleDrop(date, slot);
  };

  const renderDayColumn = (date: Date, compact = false) => (
    <div
      key={date.toISOString()}
      className={cn(
        "flex flex-col border-r border-border last:border-r-0",
        compact ? "min-w-[140px] flex-1" : "flex-1"
      )}
    >
      <div
        className={cn(
          "text-center py-2 border-b border-border font-medium text-sm cursor-pointer hover:bg-muted/50 transition-colors",
          isToday(date) && "bg-primary/10 text-primary font-bold",
          isSameDay(date, selectedDay) && view === "day" && "bg-primary text-primary-foreground"
        )}
        onClick={() => { setSelectedDay(date); setView("day"); }}
      >
        <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
        <div className={cn("text-lg", isToday(date) && "text-primary")}>{format(date, "d")}</div>
      </div>

      {MEAL_SLOTS.map(slot => {
        const meals = getMealsForDaySlot(date, slot.key);
        return (
          <div
            key={slot.key}
            className={cn(
              "flex-1 p-1.5 border-b border-border last:border-b-0 min-h-[70px] transition-colors",
              compact && "min-h-[60px]"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropEvent(e, date, slot.key)}
          >
            {compact && (
              <div className={cn("text-[10px] font-medium mb-0.5 px-1 rounded", slot.color)}>
                {slot.label}
              </div>
            )}
            {meals.map(meal => (
              <div
                key={meal.id}
                className={cn(
                  "group relative rounded-md p-1.5 mb-1 text-xs border cursor-default",
                  slot.color
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-medium line-clamp-2 flex-1">
                    {meal.recipe?.title || meal.notes || "Untitled"}
                  </span>
                  <button
                    onClick={() => removeMealPlan.mutate(meal.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {meals.length === 0 && (
              <div className="h-full flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDayView = () => (
    <div className="flex-1 overflow-auto">
      <div className="space-y-4 p-4">
        {MEAL_SLOTS.map(slot => {
          const meals = getMealsForDaySlot(selectedDay, slot.key);
          return (
            <Card
              key={slot.key}
              className="border-border"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropEvent(e, selectedDay, slot.key)}
            >
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", slot.color)}>
                    {slot.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {meals.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                    Drag a recipe here or click + to add
                  </div>
                ) : (
                  <div className="space-y-2">
                    {meals.map(meal => (
                      <div
                        key={meal.id}
                        className={cn("flex items-center gap-3 p-3 rounded-lg border", slot.color)}
                      >
                        {meal.recipe?.image_url && (
                          <img
                            src={meal.recipe.image_url}
                            alt=""
                            className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{meal.recipe?.title || meal.notes}</p>
                          {meal.recipe?.prep_time && (
                            <p className="text-xs text-muted-foreground">
                              {(meal.recipe.prep_time || 0) + (meal.recipe.cook_time || 0)} min
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/60 hover:text-destructive"
                          onClick={() => removeMealPlan.mutate(meal.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Recipe sidebar */}
      <div className="w-64 flex-shrink-0 border border-border rounded-xl bg-card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground mb-2">Recipes</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No recipes found
              </div>
            ) : (
              filteredRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  draggable
                  onDragStart={() => setDraggedRecipe(recipe)}
                  onDragEnd={() => setDraggedRecipe(null)}
                  className="flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors text-xs"
                >
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{recipe.title}</p>
                    {recipe.category && (
                      <p className="text-[10px] text-muted-foreground">{recipe.category}</p>
                    )}
                  </div>
                  {hasIngredients(recipe) && (
                    <Star className="h-3.5 w-3.5 text-warning fill-warning flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Calendar area */}
      <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-sm text-foreground min-w-[180px] text-center">
              {view === "week"
                ? `${format(currentWeekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
                : format(selectedDay, "EEEE, MMMM d, yyyy")}
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                setSelectedDay(new Date());
              }}
            >
              Today
            </Button>
            <Button
              variant={view === "week" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setView("week")}
            >
              Week
            </Button>
            <Button
              variant={view === "day" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setView("day")}
            >
              Day
            </Button>
          </div>
        </div>

        {/* Calendar body */}
        {view === "week" ? (
          <div className="flex-1 flex overflow-auto">
            {/* Slot labels column */}
            <div className="w-16 flex-shrink-0 border-r border-border">
              <div className="h-[52px] border-b border-border" />
              {MEAL_SLOTS.map(slot => (
                <div
                  key={slot.key}
                  className="flex-1 min-h-[70px] flex items-center justify-center border-b border-border last:border-b-0"
                >
                  <span className="text-[10px] font-medium text-muted-foreground writing-vertical-lr rotate-180" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}>
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>
            {weekDays.map(day => renderDayColumn(day, true))}
          </div>
        ) : (
          renderDayView()
        )}
      </div>
    </div>
  );
};

export default MealPlanner;
