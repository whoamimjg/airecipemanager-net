import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Brain, ChefHat, Clock, Users, Sparkles, Plus, ShoppingCart, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIIngredient {
  name: string;
  amount: string;
  available: boolean;
}

interface AIRecipe {
  title: string;
  description: string;
  category: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  ingredients: AIIngredient[];
  instructions: string[];
  tags: string[];
  missing_ingredients: string[];
}

const AIRecipeGenerator = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedRecipes, setGeneratedRecipes] = useState<AIRecipe[]>([]);

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("name, quantity, unit, storage_location, expiration_date, category")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-diet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("diet_restrictions")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const dietRestrictions = profile?.diet_restrictions ?? [];

  const generateMutation = useMutation({
    mutationFn: async ({ mode, preferences }: { mode: string; preferences?: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-recipe", {
        body: { inventory, mode, preferences, dietRestrictions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { recipes: AIRecipe[] };
    },
    onSuccess: (data) => {
      setGeneratedRecipes(data.recipes || []);
      toast.success(`Generated ${data.recipes?.length || 0} recipe ideas!`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate recipes");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (recipe: AIRecipe) => {
      const { error } = await supabase.from("recipes").insert({
        user_id: user!.id,
        title: recipe.title,
        description: recipe.description,
        category: recipe.category,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        ingredients: recipe.ingredients.map((i) => `${i.amount} ${i.name}`),
        instructions: recipe.instructions,
        tags: recipe.tags,
        is_ai_generated: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe saved to your collection!");
    },
    onError: () => toast.error("Failed to save recipe"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">AI Chef</h2>
        <p className="text-sm text-muted-foreground">
          Generate recipe ideas from your kitchen inventory using AI
        </p>
      </div>

      {/* Inventory summary */}
      <Card className="border-border bg-card">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Kitchen Inventory: {inventory.length} items
            </span>
          </div>
          {inventory.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {inventory.slice(0, 20).map((item, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {item.name}
                </Badge>
              ))}
              {inventory.length > 20 && (
                <Badge variant="outline" className="text-xs">
                  +{inventory.length - 20} more
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add items to your inventory first for better suggestions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Generation options */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className="border-border bg-card hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => !generateMutation.isPending && generateMutation.mutate({ mode: "from_inventory" })}
        >
          <CardContent className="py-6 px-5 text-center">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold text-foreground">Use My Inventory</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Generate recipes from what you already have
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="py-4 px-5 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Custom Request</h3>
            </div>
            <Textarea
              placeholder="E.g. 'Quick weeknight pasta', 'Low-carb dinner for 2', 'Use up my chicken and broccoli'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!customPrompt.trim() || generateMutation.isPending}
              onClick={() =>
                generateMutation.mutate({ mode: "custom", preferences: customPrompt })
              }
            >
              Generate
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Cooking up recipe ideas...
          </p>
        </div>
      )}

      {/* Results */}
      {generatedRecipes.length > 0 && !generateMutation.isPending && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Generated Recipes
          </h3>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {generatedRecipes.map((recipe, idx) => (
              <Card key={idx} className="border-border bg-card overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{recipe.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {recipe.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{recipe.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {recipe.prep_time + recipe.cook_time} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {recipe.servings} servings
                    </span>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Ingredients</p>
                    <ul className="space-y-0.5">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs">
                          {ing.available ? (
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          <span className={ing.available ? "text-foreground" : "text-muted-foreground"}>
                            {ing.amount} {ing.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Missing */}
                  {recipe.missing_ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.missing_ingredients.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Need: {m}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => saveMutation.mutate(recipe)}
                    disabled={saveMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Save to My Recipes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no results yet */}
      {generatedRecipes.length === 0 && !generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <ChefHat className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-sm">
            Click "Use My Inventory" or type a custom request to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default AIRecipeGenerator;
