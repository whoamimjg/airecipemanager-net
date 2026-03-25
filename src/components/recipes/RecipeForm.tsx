import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface RecipeFormProps {
  recipe?: {
    id: string;
    title: string;
    description: string | null;
    ingredients: any;
    instructions: any;
    prep_time: number | null;
    cook_time: number | null;
    servings: number | null;
    category: string | null;
    source_url: string | null;
  } | null;
  onClose: () => void;
}

const RecipeForm = ({ recipe, onClose }: RecipeFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!recipe;

  const [title, setTitle] = useState(recipe?.title || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [category, setCategory] = useState(recipe?.category || "");
  const [prepTime, setPrepTime] = useState(recipe?.prep_time?.toString() || "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time?.toString() || "");
  const [servings, setServings] = useState(recipe?.servings?.toString() || "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url || "");
  const [ingredients, setIngredients] = useState<string[]>(
    Array.isArray(recipe?.ingredients) ? recipe.ingredients : [""]
  );
  const [instructions, setInstructions] = useState<string[]>(
    Array.isArray(recipe?.instructions) ? recipe.instructions : [""]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        title,
        description: description || null,
        category: category || null,
        prep_time: prepTime ? parseInt(prepTime) : null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : null,
        source_url: sourceUrl || null,
        ingredients: ingredients.filter(Boolean),
        instructions: instructions.filter(Boolean),
        user_id: user!.id,
      };

      if (isEditing) {
        const { error } = await supabase.from("recipes").update(data).eq("id", recipe!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recipes").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(isEditing ? "Recipe updated!" : "Recipe added!");
      onClose();
    },
    onError: () => toast.error("Failed to save recipe"),
  });

  const addItem = (list: string[], setter: (v: string[]) => void) => {
    setter([...list, ""]);
  };

  const removeItem = (list: string[], setter: (v: string[]) => void, index: number) => {
    setter(list.filter((_, i) => i !== index));
  };

  const updateItem = (list: string[], setter: (v: string[]) => void, index: number, value: string) => {
    const updated = [...list];
    updated[index] = value;
    setter(updated);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-card-foreground">{isEditing ? "Edit Recipe" : "Add New Recipe"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-card-foreground">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Recipe name" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-card-foreground">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Dinner, Dessert" />
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Source URL</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Prep Time (min)</Label>
              <Input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" />
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Cook Time (min)</Label>
              <Input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" />
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Servings</Label>
              <Input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <Label className="text-card-foreground">Ingredients</Label>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={ing}
                  onChange={(e) => updateItem(ingredients, setIngredients, i, e.target.value)}
                  placeholder={`Ingredient ${i + 1}`}
                />
                {ingredients.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(ingredients, setIngredients, i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addItem(ingredients, setIngredients)}>
              <Plus className="mr-1 h-3 w-3" /> Add Ingredient
            </Button>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <Label className="text-card-foreground">Instructions</Label>
            {instructions.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                  {i + 1}
                </span>
                <Input
                  value={step}
                  onChange={(e) => updateItem(instructions, setInstructions, i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                />
                {instructions.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(instructions, setInstructions, i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addItem(instructions, setInstructions)}>
              <Plus className="mr-1 h-3 w-3" /> Add Step
            </Button>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? "Update" : "Save"} Recipe
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RecipeForm;
