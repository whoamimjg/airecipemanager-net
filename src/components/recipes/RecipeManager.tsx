import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Clock, Users, Trash2, Edit, ChefHat, Globe } from "lucide-react";
import { toast } from "sonner";
import RecipeForm from "./RecipeForm";
import ImportRecipe from "./ImportRecipe";

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
  tags: string[] | null;
  source_url: string | null;
  image_url: string | null;
  created_at: string;
}

const RecipeManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

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
          <p className="text-sm text-muted-foreground">{recipes.length} recipes in your collection</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Globe className="mr-2 h-4 w-4" /> Import URL
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Recipe
          </Button>
        </div>
      </div>

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
          <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add Recipe
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => (
            <Card key={recipe.id} className="group border-border bg-card hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2 text-card-foreground">{recipe.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingRecipe(recipe)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(recipe.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {recipe.category && (
                  <Badge variant="secondary" className="w-fit text-xs">
                    {recipe.category}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {recipe.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{recipe.description}</p>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipeManager;
