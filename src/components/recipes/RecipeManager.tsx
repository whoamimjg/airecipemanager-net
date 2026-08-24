import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Clock, Users, Trash2, Edit, ChefHat, Globe, Star, CalendarDays, Camera } from "lucide-react";
import PlanRecipeButton from "./PlanRecipeButton";
import { toast } from "sonner";
import RecipeForm from "./RecipeForm";
import ImportRecipe from "./ImportRecipe";
import PhotoRecipeScanner from "./PhotoRecipeScanner";
import RecipeDetailDialog from "./RecipeDetailDialog";
import StarRating from "./StarRating";
import RecipeLimitBanner from "./RecipeLimitBanner";
import { useRecipeLimit } from "@/hooks/useRecipeLimit";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  ingredients: any;
  instructions: any;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  category: string | null;
  /** Two-axis taxonomy; null on recipes predating the split (fall back to `category`). */
  meal_type: string | null;
  dish_type: string | null;
  tags: string[] | null;
  source_url: string | null;
  image_url: string | null;
  rating: number | null;
  created_at: string;
}

const RecipeManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPhotoScan, setShowPhotoScan] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const { atLimit, nearLimit, recipeCount, limit, plan, isUnlimited } = useRecipeLimit();

  const handleUpgrade = () => {
    // Navigate to account tab
    const tabTrigger = document.querySelector('[value="account"]') as HTMLElement;
    tabTrigger?.click();
  };

  const tryAddRecipe = (action: () => void) => {
    if (atLimit) {
      toast.error(`Recipe limit reached (${limit}). Upgrade your plan to add more.`);
      return;
    }
    action();
  };

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
    enabled: !!user,
  });

  const { data: lastPlannedMap = {} } = useQuery({
    queryKey: ["recipe-last-planned", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("recipe_id, date")
        .not("recipe_id", "is", null)
        .order("date", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((mp) => {
        if (mp.recipe_id && !map[mp.recipe_id]) {
          map[mp.recipe_id] = mp.date;
        }
      });
      return map;
    },
    enabled: !!user,
  });

  const ratingMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      const { error } = await supabase.from("recipes").update({ rating }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: () => toast.error("Failed to update rating"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe deleted");
    },
    onError: () => toast.error("Failed to delete recipe"),
  });

  const filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.category?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (showImport) {
    return <ImportRecipe onClose={() => setShowImport(false)} />;
  }

  if (showPhotoScan) {
    return <PhotoRecipeScanner onClose={() => setShowPhotoScan(false)} />;
  }

  if (showForm || editingRecipe) {
    return (
      <RecipeForm
        recipe={editingRecipe}
        onClose={() => {
          setShowForm(false);
          setEditingRecipe(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Recipes</h2>
          <p className="text-sm text-muted-foreground">
            {recipes.length}{!isUnlimited ? ` / ${limit}` : ""} recipes in your collection
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => tryAddRecipe(() => setShowPhotoScan(true))} disabled={atLimit}>
            <Camera className="mr-2 h-4 w-4" /> Scan Photo
          </Button>
          <Button variant="outline" onClick={() => tryAddRecipe(() => setShowImport(true))} disabled={atLimit}>
            <Globe className="mr-2 h-4 w-4" /> Import URL
          </Button>
          <Button onClick={() => tryAddRecipe(() => setShowForm(true))} disabled={atLimit} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Recipe
          </Button>
        </div>
      </div>

      {atLimit && (
        <RecipeLimitBanner recipeCount={recipeCount} limit={limit} plan={plan} type="blocked" onUpgrade={handleUpgrade} />
      )}
      {nearLimit && (
        <RecipeLimitBanner recipeCount={recipeCount} limit={limit} plan={plan} type="warning" onUpgrade={handleUpgrade} />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <ChefHat className="h-8 w-8 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ChefHat className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No recipes yet</h3>
          <p className="text-muted-foreground mt-1">Add your first recipe to get started!</p>
          <Button onClick={() => tryAddRecipe(() => setShowForm(true))} disabled={atLimit} className="mt-4 bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add Recipe
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => (
            <Card key={recipe.id} className="group border-border bg-card hover:shadow-md transition-shadow overflow-hidden cursor-pointer" onClick={() => setViewingRecipe(recipe)}>
              {recipe.image_url && (
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2 text-card-foreground">{recipe.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlanRecipeButton recipeId={recipe.id} recipeTitle={recipe.title} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setEditingRecipe(recipe); }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(recipe.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Cards show meal_type. Falls back to the legacy mixed-axis
                    `category` for recipes not yet migrated to the two-axis
                    taxonomy, so unmigrated accounts render exactly as before. */}
                {(recipe.meal_type || recipe.category) && (
                  <Badge variant="secondary" className="w-fit text-xs">
                    {recipe.meal_type || recipe.category}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {recipe.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{recipe.description}</p>
                )}
                <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                  <StarRating
                    rating={recipe.rating}
                    onChange={(rating) => ratingMutation.mutate({ id: recipe.id, rating })}
                    size="sm"
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {recipe.prep_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {recipe.prep_time + (recipe.cook_time || 0)} min
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {recipe.servings} servings
                    </span>
                  )}
                  {lastPlannedMap[recipe.id] && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Last planned: {new Date(lastPlannedMap[recipe.id]).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecipeDetailDialog
        recipe={viewingRecipe}
        open={!!viewingRecipe}
        onOpenChange={(open) => { if (!open) setViewingRecipe(null); }}
      />
    </div>
  );
};

export default RecipeManager;
