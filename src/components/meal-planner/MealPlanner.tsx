import { useState, useMemo } from "react";
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth
} from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search,
  Star, Plus, X, ChefHat, Trash2, UtensilsCrossed, GripVertical, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RecipeDetailDialog from "@/components/recipes/RecipeDetailDialog";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_SLOTS: { key: MealSlot; label: string; color: string; bgCard: string }[] = [
  { key: "breakfast", label: "Breakfast", color: "bg-warning/15 text-warning border-warning/30", bgCard: "bg-warning/10 border-warning/20" },
  { key: "lunch", label: "Lunch", color: "bg-primary/15 text-primary border-primary/30", bgCard: "bg-primary/10 border-primary/20" },
  { key: "dinner", label: "Dinner", color: "bg-secondary/30 text-secondary-foreground border-secondary", bgCard: "bg-secondary/20 border-secondary/40" },
  { key: "snack", label: "Snack", color: "bg-info/15 text-info border-info/30", bgCard: "bg-info/10 border-info/20" },
];

const DAY_HEADERS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

const MealHoverCard = ({ meal, children }: { meal: MealPlan; children: React.ReactNode }) => {
  const recipe = meal.recipe;
  if (!recipe) return <>{children}</>;
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  return (
    <HoverCard openDelay={150} closeDelay={50}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-0 overflow-hidden" side="top">
        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.title} className="h-32 w-full object-cover" />
        )}
        <div className="p-3 space-y-2">
          <p className="font-semibold text-sm text-foreground line-clamp-2">{recipe.title}</p>
          {totalTime > 0 && (
            <p className="text-xs text-muted-foreground">{totalTime} min total</p>
          )}
          {ingredients.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Ingredients ({ingredients.length})
              </p>
              <ul className="text-xs text-foreground space-y-0.5 max-h-40 overflow-y-auto">
                {ingredients.slice(0, 12).map((ing: any, i: number) => {
                  const text = typeof ing === "string"
                    ? ing
                    : [ing?.quantity || ing?.amount, ing?.unit, ing?.name].filter(Boolean).join(" ");
                  return <li key={i} className="line-clamp-1">• {text}</li>;
                })}
                {ingredients.length > 12 && (
                  <li className="text-muted-foreground italic">+ {ingredients.length - 12} more…</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

const MealPlanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [recipeSearch, setRecipeSearch] = useState("");
  const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null);
  const [view, setView] = useState<"week" | "day" | "month">("week");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());
  const [recipePanelOpen, setRecipePanelOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekEnd = addDays(currentWeekStart, 6);

  // Compute date range based on view
  const queryStart = view === "month"
    ? format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), "yyyy-MM-dd")
    : format(currentWeekStart, "yyyy-MM-dd");
  const queryEnd = view === "month"
    ? format(addDays(endOfMonth(currentMonth), 7), "yyyy-MM-dd")
    : format(weekEnd, "yyyy-MM-dd");

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["meal-plans", queryStart, queryEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .gte("date", queryStart)
        .lte("date", queryEnd)
        .order("date");
      if (error) throw error;

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

  // Group recipes by category for sidebar
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, Recipe[]> = {};
    filteredRecipes.forEach(r => {
      const cat = r.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRecipes]);

  // Recipes filtered for the picker dialog
  const pickerFilteredRecipes = useMemo(() => {
    const search = pickerSearch.toLowerCase();
    const filtered = recipes.filter(r =>
      r.title.toLowerCase().includes(search) ||
      (r.category?.toLowerCase().includes(search) ?? false)
    );
    const groups: Record<string, Recipe[]> = {};
    filtered.forEach(r => {
      const cat = r.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [recipes, pickerSearch]);

  const openRecipePicker = (date: Date, slot: MealSlot) => {
    setPickerSearch("");
    setPickerTarget({ date, slot });
  };

  const pickRecipe = (recipe: Recipe) => {
    if (!pickerTarget) return;
    addMealPlan.mutate({
      recipe_id: recipe.id,
      date: format(pickerTarget.date, "yyyy-MM-dd"),
      meal_slot: pickerTarget.slot,
    });
    setPickerTarget(null);
  };

  const getMealsForDaySlot = (date: Date, slot: MealSlot) =>
    mealPlans.filter(mp => mp.date === format(date, "yyyy-MM-dd") && mp.meal_slot === slot);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary/50", "bg-primary/5");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary/50", "bg-primary/5");
  };

  const handleDropEvent = (e: React.DragEvent, date: Date, slot: MealSlot) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary/50", "bg-primary/5");
    if (draggedRecipe) {
      addMealPlan.mutate({ recipe_id: draggedRecipe.id, date: format(date, "yyyy-MM-dd"), meal_slot: slot });
      setDraggedRecipe(null);
    }
  };

  const toggleWeekCollapse = (weekIndex: number) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekIndex)) next.delete(weekIndex);
      else next.add(weekIndex);
      return next;
    });
  };

  // ── Month View (Plan to Eat style) ──
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const totalDays: Date[] = [];
    let d = calStart;
    while (d <= monthEnd || totalDays.length % 7 !== 0) {
      totalDays.push(d);
      d = addDays(d, 1);
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < totalDays.length; i += 7) {
      weeks.push(totalDays.slice(i, i + 7));
    }

    return (
      <div className="flex-1 overflow-auto">
        {/* Day name headers */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] sticky top-0 z-10 bg-card border-b border-border">
          <div className="border-r border-border" />
          {DAY_HEADERS.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-foreground py-2.5 border-r border-border last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => {
          const isCollapsed = collapsedWeeks.has(wi);
          return (
            <div key={wi} className="border-b border-border last:border-b-0">
              {/* Meal slot rows for this week */}
              {MEAL_SLOTS.map((slot, si) => (
                <div
                  key={slot.key}
                  className={cn(
                    "grid grid-cols-[80px_repeat(7,1fr)] border-b border-border/50 last:border-b-0",
                    isCollapsed && si > 0 && "hidden"
                  )}
                >
                  {/* Slot label + date (first slot shows date header & collapse toggle) */}
                  <div className="border-r border-border px-2 py-1.5 flex flex-col justify-center">
                    {si === 0 && (
                      <button
                        onClick={() => toggleWeekCollapse(wi)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-0.5"
                      >
                        {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        {isCollapsed ? "Show" : "Hide"}
                      </button>
                    )}
                    <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
                  </div>

                  {/* Day cells */}
                  {week.map(day => {
                    const meals = getMealsForDaySlot(day, slot.key);
                    const inMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r border-border/50 last:border-r-0 min-h-[36px] p-1 transition-colors relative",
                          !inMonth && "bg-muted/20",
                          today && "bg-primary/5"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropEvent(e, day, slot.key)}
                      >
                        {/* Date badge on first slot */}
                        {si === 0 && (
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={cn(
                              "text-[10px] text-muted-foreground",
                              !inMonth && "opacity-40"
                            )}>
                              {format(day, "MMM").toUpperCase()}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-bold cursor-pointer hover:text-primary transition-colors",
                                today ? "text-primary" : inMonth ? "text-foreground" : "text-muted-foreground/40"
                              )}
                              onClick={() => { setSelectedDay(day); setView("day"); }}
                            >
                              {format(day, "d")}
                            </span>
                          </div>
                        )}

                        {/* Meal cards */}
                        {meals.map(meal => (
                          <MealHoverCard key={meal.id} meal={meal}>
                            <div
                              className={cn(
                                "group rounded px-1.5 py-1 mb-0.5 text-[11px] border cursor-default",
                                slot.bgCard
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                                <span className="font-medium line-clamp-1 flex-1">
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
                          </MealHoverCard>
                        ))}

                        {/* Drop hint */}
                        {meals.length === 0 && (
                          <button
                            onClick={() => openRecipePicker(day, slot.key)}
                            className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-50 transition-opacity"
                          >
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Week View ──
  const renderWeekView = () => (
    <div className="flex-1 flex overflow-auto">
      {weekDays.map(date => (
        <div
          key={date.toISOString()}
          className="flex flex-col border-r border-border last:border-r-0 min-w-[140px] flex-1"
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
                className="flex-1 p-1.5 border-b border-border last:border-b-0 min-h-[60px] transition-colors"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropEvent(e, date, slot.key)}
              >
                <div className={cn("text-[10px] font-medium mb-0.5 px-1 rounded", slot.color)}>
                  {slot.label}
                </div>
                {meals.map(meal => (
                  <MealHoverCard key={meal.id} meal={meal}>
                    <div
                      className={cn("group relative rounded-md p-1.5 mb-1 text-xs border cursor-default", slot.color)}
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
                  </MealHoverCard>
                ))}
                {meals.length === 0 && (
                  <button
                    onClick={() => openRecipePicker(date, slot.key)}
                    className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-50 transition-opacity"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  // ── Day View ──
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
                  <button
                    onClick={() => openRecipePicker(selectedDay, slot.key)}
                    className="w-full text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    Click to add a recipe
                  </button>
                ) : (
                  <div className="space-y-2">
                    {meals.map(meal => (
                      <div
                        key={meal.id}
                        className={cn("flex items-center gap-3 p-3 rounded-lg border", slot.color)}
                      >
                        {meal.recipe?.image_url && (
                          <img src={meal.recipe.image_url} alt="" className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
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

  const recipeSidebarContent = (
    <div className={cn(
      "flex flex-col overflow-hidden",
      isMobile ? "h-full" : "w-64 flex-shrink-0 border border-border rounded-xl bg-card"
    )}>
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
        <div className="p-2 space-y-3">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No recipes found
            </div>
          ) : (
            groupedRecipes.map(([category, catRecipes]) => (
              <div key={category}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                  {category} ({catRecipes.length})
                </div>
                <div className="space-y-0.5">
                  {catRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      draggable={!isMobile}
                      onDragStart={() => setDraggedRecipe(recipe)}
                      onDragEnd={() => setDraggedRecipe(null)}
                      onClick={() => {
                        if (isMobile) {
                          const dateStr = view === "day" ? format(selectedDay, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
                          addMealPlan.mutate({ recipe_id: recipe.id, date: dateStr, meal_slot: "dinner" });
                          setRecipePanelOpen(false);
                        }
                      }}
                      className="flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors text-xs group"
                    >
                      {!isMobile && <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0" />}
                      {recipe.image_url ? (
                        <img src={recipe.image_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <ChefHat className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{recipe.title}</p>
                      </div>
                      {hasIngredients(recipe) && (
                        <Star className="h-3.5 w-3.5 text-warning fill-warning flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Recipe sidebar: Sheet on mobile, inline on desktop */}
      {isMobile ? (
        <Sheet open={recipePanelOpen} onOpenChange={setRecipePanelOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Recipe Browser</SheetTitle>
            </SheetHeader>
            {recipeSidebarContent}
          </SheetContent>
        </Sheet>
      ) : (
        recipeSidebarContent
      )}

      {/* Calendar area */}
      <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRecipePanelOpen(true)}>
                <BookOpen className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (view === "month") setCurrentMonth(subMonths(currentMonth, 1));
              else if (view === "day") setSelectedDay(addDays(selectedDay, -1));
              else setCurrentWeekStart(subWeeks(currentWeekStart, 1));
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-sm text-foreground min-w-[120px] md:min-w-[180px] text-center">
              {view === "month"
                ? format(currentMonth, "MMM yyyy")
                : view === "week"
                  ? `${format(currentWeekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
                  : format(selectedDay, "EEEE, MMMM d, yyyy")}
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (view === "month") setCurrentMonth(addMonths(currentMonth, 1));
              else if (view === "day") setSelectedDay(addDays(selectedDay, 1));
              else setCurrentWeekStart(addWeeks(currentWeekStart, 1));
            }}>
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
                setCurrentMonth(new Date());
                setSelectedDay(new Date());
              }}
            >
              Today
            </Button>
            <Button
              variant={view === "month" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setView("month")}
            >
              Month
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
        {view === "month" ? (
          renderMonthView()
        ) : view === "week" ? (
          renderWeekView()
        ) : (
          renderDayView()
        )}
      </div>

      {/* Recipe Picker Dialog */}
      <Dialog open={!!pickerTarget} onOpenChange={(open) => !open && setPickerTarget(null)}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Add Recipe to {pickerTarget && MEAL_SLOTS.find(s => s.key === pickerTarget.slot)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-4 pb-2">
              {pickerFilteredRecipes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No recipes found
                </div>
              ) : (
                pickerFilteredRecipes.map(([category, catRecipes]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                      {category} ({catRecipes.length})
                    </div>
                    <div className="space-y-1">
                      {catRecipes.map(recipe => (
                        <button
                          key={recipe.id}
                          onClick={() => pickRecipe(recipe)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors text-left"
                        >
                          {recipe.image_url ? (
                            <img src={recipe.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <ChefHat className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-foreground">{recipe.title}</p>
                            {(recipe.prep_time || recipe.cook_time) && (
                              <p className="text-xs text-muted-foreground">
                                {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min
                              </p>
                            )}
                          </div>
                          {hasIngredients(recipe) && (
                            <Star className="h-4 w-4 text-warning fill-warning flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealPlanner;
