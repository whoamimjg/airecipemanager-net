import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import RecipeForm from "./RecipeForm";

interface ImportRecipeProps {
  onClose: () => void;
}

const ImportRecipe = ({ onClose }: ImportRecipeProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [scrapedRecipe, setScrapedRecipe] = useState<any>(null);

  const scrapeMutation = useMutation({
    mutationFn: async (recipeUrl: string) => {
      const { data, error } = await supabase.functions.invoke("scrape-recipe", {
        body: { url: recipeUrl },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Failed to scrape recipe");
      return data;
    },
    onSuccess: (data) => {
      if (data.recipe) {
        setScrapedRecipe({ ...data.recipe, source_url: url });
        toast.success(`Found recipe: ${data.recipe.title}`);
      } else {
        toast.error("Couldn't auto-extract recipe from this page. Try adding it manually.");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    scrapeMutation.mutate(url.trim());
  };

  // If we have a scraped recipe, show it in the form for editing before save
  if (scrapedRecipe) {
    return (
      <RecipeForm
        recipe={{
          id: "",
          title: scrapedRecipe.title || "",
          description: scrapedRecipe.description || null,
          ingredients: scrapedRecipe.ingredients || [],
          instructions: scrapedRecipe.instructions || [],
          prep_time: scrapedRecipe.prep_time || null,
          cook_time: scrapedRecipe.cook_time || null,
          servings: scrapedRecipe.servings || null,
          category: scrapedRecipe.category || null,
          source_url: scrapedRecipe.source_url || url,
        }}
        isNew
        onClose={onClose}
      />
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-card-foreground">Import Recipe from URL</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Paste a recipe URL from any website and we'll automatically extract the title, ingredients, instructions, and more.
        </p>

        <form onSubmit={handleScrape} className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.allrecipes.com/recipe/..."
              required
              className="pl-9"
            />
          </div>
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            disabled={scrapeMutation.isPending}
          >
            {scrapeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scraping...
              </>
            ) : (
              "Import"
            )}
          </Button>
        </form>

        {scrapeMutation.isPending && (
          <div className="flex flex-col items-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Reading recipe from the page...</p>
            <p className="text-xs text-muted-foreground mt-1">This usually takes 5-10 seconds</p>
          </div>
        )}

        {scrapeMutation.isError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to import</p>
              <p className="text-xs text-muted-foreground mt-1">
                The recipe couldn't be extracted. Try a different URL or add the recipe manually.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Supported Sites</h4>
          <p className="text-xs text-muted-foreground">
            Works with most recipe websites including AllRecipes, Food Network, Simply Recipes, 
            Epicurious, Bon Appétit, Tasty, and many more.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ImportRecipe;
