import { useState, useRef, useEffect } from "react";
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
    image_url?: string | null;
  } | null;
  isNew?: boolean;
  onClose: () => void;
}

const RecipeForm = ({ recipe, isNew, onClose }: RecipeFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!recipe && !isNew;

  const [title, setTitle] = useState(recipe?.title || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [category, setCategory] = useState(recipe?.category || "");
  const [prepTime, setPrepTime] = useState(recipe?.prep_time?.toString() || "");
  const [cookTime, setCookTime] = useState(recipe?.cook_time?.toString() || "");
  const [servings, setServings] = useState(recipe?.servings?.toString() || "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url || "");
  const [imageUrl, setImageUrl] = useState(recipe?.image_url || "");
  type IngredientRow = { quantity: string; unit: string; name: string; notes: string };

  const parseIngredient = (ing: any): IngredientRow => {
    if (ing && typeof ing === "object") {
      return {
        quantity: ing.quantity?.toString() || ing.amount?.toString() || "",
        unit: ing.unit || "",
        name: ing.name || "",
        notes: ing.notes || "",
      };
    }
    const str = (ing || "").toString().trim();
    const match = str.match(/^([\d./\s]+)?\s*(\S+)?\s*(.*)$/);
    if (match && str) {
      const [, qty, maybeUnit, rest] = match;
      const commonUnits = ["cup","cups","tsp","tbsp","teaspoon","tablespoon","oz","lb","g","kg","ml","l","pinch","clove","cloves"];
      if (qty && maybeUnit && commonUnits.includes(maybeUnit.toLowerCase())) {
        return { quantity: qty.trim(), unit: maybeUnit, name: rest.trim(), notes: "" };
      }
      if (qty) return { quantity: qty.trim(), unit: "", name: `${maybeUnit || ""} ${rest}`.trim(), notes: "" };
    }
    return { quantity: "", unit: "", name: str, notes: "" };
  };

  const emptyRows = (n: number): IngredientRow[] =>
    Array.from({ length: n }, () => ({ quantity: "", unit: "", name: "", notes: "" }));

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    Array.isArray(recipe?.ingredients) && recipe!.ingredients.length > 0
      ? recipe!.ingredients.map(parseIngredient)
      : emptyRows(8)
  );
  const addIngredientBtnRef = useRef<HTMLButtonElement>(null);
  const ingredientNameRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndexRef.current !== null) {
      const idx = focusIndexRef.current;
      ingredientNameRefs.current[idx]?.focus();
      focusIndexRef.current = null;
    }
  }, [ingredients.length]);
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
        image_url: imageUrl || null,
        ingredients: ingredients
          .filter((ing) => ing.name.trim() || ing.quantity.trim())
          .map((ing) => ({
            quantity: ing.quantity.trim(),
            unit: ing.unit.trim(),
            name: ing.name.trim(),
            notes: ing.notes.trim(),
          })),
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
          {imageUrl && (
            <div className="sm:col-span-2">
              <img src={imageUrl} alt={title} className="w-full max-h-48 object-cover rounded-lg border border-border" />
            </div>
          )}
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
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
              <div className="col-span-3 sm:col-span-2">Qty</div>
              <div className="col-span-3 sm:col-span-2">Unit</div>
              <div className="col-span-5 sm:col-span-7">Ingredient</div>
              <div className="col-span-1" />
            </div>
            {ingredients.map((ing, i) => {
              const isLast = i === ingredients.length - 1;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3 sm:col-span-2"
                    value={ing.quantity}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], quantity: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder="1"
                  />
                  <Input
                    className="col-span-3 sm:col-span-2"
                    value={ing.unit}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], unit: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder="cup"
                  />
                  <Input
                    ref={(el) => (ingredientNameRefs.current[i] = el)}
                    className="col-span-5 sm:col-span-7"
                    value={ing.name}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], name: e.target.value };
                      setIngredients(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey && isLast) {
                        e.preventDefault();
                        addIngredientBtnRef.current?.focus();
                      }
                    }}
                    placeholder={`Ingredient ${i + 1}`}
                  />
                  {ingredients.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="col-span-1" />
                  )}
                </div>
              );
            })}
            <Button
              ref={addIngredientBtnRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                focusIndexRef.current = ingredients.length;
                setIngredients([...ingredients, { quantity: "", unit: "", name: "", notes: "" }]);
              }}
            >
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
