import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Loader2, Save, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/lib/native";
import { recipeSaveErrorMessage } from "@/lib/planLimit";

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error("You must be signed in to upload images");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };
  type IngredientRow = { quantity: string; unit: string; name: string; notes: string; heading?: string };

  const parseIngredient = (ing: any): IngredientRow => {
    if (ing && typeof ing === "object") {
      if (typeof ing.heading === "string") {
        return { quantity: "", unit: "", name: "", notes: "", heading: ing.heading };
      }
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
  const ingredientAmountRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndexRef.current !== null) {
      const idx = focusIndexRef.current;
      ingredientAmountRefs.current[idx]?.focus();
      focusIndexRef.current = null;
    }
  }, [ingredients.length]);

  const UNIT_OPTIONS = [
    "each", "cup", "cups", "tsp", "tbsp", "teaspoon", "tablespoon",
    "oz", "fl oz", "lb", "lbs", "g", "kg", "mg", "ml", "l", "liter",
    "pinch", "dash", "clove", "cloves", "slice", "slices", "can", "cans",
    "package", "stick", "sticks", "bunch", "head", "piece", "pieces",
    "quart", "pint", "gallon",
  ];

  const completeUnit = (value: string): string => {
    const v = value.trim().toLowerCase();
    if (!v) return value;
    const exact = UNIT_OPTIONS.find((u) => u.toLowerCase() === v);
    if (exact) return exact;
    const matches = UNIT_OPTIONS.filter((u) => u.toLowerCase().startsWith(v));
    return matches.length === 1 ? matches[0] : value;
  };
  type InstructionRow = { text: string; image_url: string; heading?: string };
  const parseInstruction = (s: any): InstructionRow => {
    if (s && typeof s === "object") {
      if (typeof s.heading === "string") return { text: "", image_url: "", heading: s.heading };
      return { text: s.text || "", image_url: s.image_url || "" };
    }
    return { text: (s || "").toString(), image_url: "" };
  };
  const [instructions, setInstructions] = useState<InstructionRow[]>(
    Array.isArray(recipe?.instructions) && recipe!.instructions.length > 0
      ? recipe!.instructions.map(parseInstruction)
      : [{ text: "", image_url: "" }]
  );
  const [uploadingStepIdx, setUploadingStepIdx] = useState<number | null>(null);
  const stepImageRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleStepImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be smaller than 5MB"); return; }
    setUploadingStepIdx(idx);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/steps/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      const next = [...instructions];
      next[idx] = { ...next[idx], image_url: data.publicUrl };
      setInstructions(next);
      toast.success("Step image added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploadingStepIdx(null);
      if (stepImageRefs.current[idx]) stepImageRefs.current[idx]!.value = "";
    }
  };

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
          .filter((ing) => ing.heading !== undefined ? ing.heading.trim() : (ing.name.trim() || ing.quantity.trim()))
          .map((ing) =>
            ing.heading !== undefined
              ? { heading: ing.heading.trim() }
              : {
                  quantity: ing.quantity.trim(),
                  unit: ing.unit.trim(),
                  name: ing.name.trim(),
                  notes: ing.notes.trim(),
                }
          ),
        instructions: instructions
          .filter((s) => s.heading !== undefined ? s.heading.trim() : (s.text.trim() || s.image_url))
          .map((s) =>
            s.heading !== undefined
              ? { heading: s.heading.trim() }
              : { text: s.text.trim(), image_url: s.image_url || "" }
          ),
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
      haptics.success();
      onClose();
    },
    onError: (error) => { toast.error(recipeSaveErrorMessage(error)); haptics.error(); },
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
          <div className="space-y-2">
            <Label className="text-card-foreground">Recipe Photo</Label>
            {imageUrl ? (
              <div className="relative group">
                <img src={imageUrl} alt={title || "Recipe"} className="w-full max-h-64 object-cover rounded-lg border border-border" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button asChild type="button" variant="secondary" size="sm" disabled={uploadingImage}>
                    <label htmlFor="recipe-image-input" style={{ cursor: uploadingImage ? "default" : "pointer" }}>
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span className="ml-1">Replace</span>
                    </label>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setImageUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="recipe-image-input"
                style={{ cursor: uploadingImage ? "default" : "pointer" }}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-border rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload a photo</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG up to 5MB</span>
                  </>
                )}
              </label>
            )}
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Or paste an image URL"
              className="text-xs"
            />
            <input
              id="recipe-image-input"
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
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
            <div className="grid grid-cols-13 gap-2 text-xs text-muted-foreground px-1" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Unit</div>
              <div className="col-span-4">Ingredient</div>
              <div className="col-span-4">Notes</div>
              <div className="col-span-1" />
            </div>
            <datalist id="unit-options">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {ingredients.map((ing, i) => {
              const isLast = i === ingredients.length - 1;
              if (ing.heading !== undefined) {
                return (
                  <div key={i} className="flex gap-2 items-center pt-2">
                    <Input
                      className="flex-1 font-semibold bg-muted/40"
                      value={ing.heading}
                      onChange={(e) => {
                        const next = [...ingredients];
                        next[i] = { ...next[i], heading: e.target.value };
                        setIngredients(next);
                      }}
                      placeholder="Section heading (e.g. For the sauce)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              }
              return (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                  <Input
                    ref={(el) => (ingredientAmountRefs.current[i] = el)}
                    className="col-span-2"
                    value={ing.quantity}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], quantity: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder="1"
                  />
                  <Input
                    className="col-span-2"
                    list="unit-options"
                    value={ing.unit}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], unit: e.target.value };
                      setIngredients(next);
                    }}
                    onBlur={(e) => {
                      const completed = completeUnit(e.target.value);
                      if (completed !== ing.unit) {
                        const next = [...ingredients];
                        next[i] = { ...next[i], unit: completed };
                        setIngredients(next);
                      }
                    }}
                    placeholder="cup"
                  />
                  <Input
                    className="col-span-4"
                    value={ing.name}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], name: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder={`Ingredient ${i + 1}`}
                  />
                  <Input
                    className="col-span-4"
                    value={ing.notes}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[i] = { ...next[i], notes: e.target.value };
                      setIngredients(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey && isLast) {
                        e.preventDefault();
                        addIngredientBtnRef.current?.focus();
                      }
                    }}
                    placeholder="optional"
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
            <div className="flex flex-wrap gap-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setIngredients([...ingredients, { quantity: "", unit: "", name: "", notes: "", heading: "" }])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add Heading
              </Button>
            </div>
          </div>


          {/* Instructions */}
          <div className="space-y-3">
            <Label className="text-card-foreground">Instructions</Label>
            {(() => {
              let stepNum = 0;
              return instructions.map((step, i) => {
                if (step.heading !== undefined) {
                  return (
                    <div key={i} className="flex gap-2 items-center pt-2">
                      <Input
                        className="flex-1 font-semibold bg-muted/40"
                        value={step.heading}
                        onChange={(e) => {
                          const next = [...instructions];
                          next[i] = { ...next[i], heading: e.target.value };
                          setInstructions(next);
                        }}
                        placeholder="Section heading (e.g. For the filling)"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setInstructions(instructions.filter((_, idx) => idx !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                }
                stepNum += 1;
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                      {stepNum}
                    </span>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={step.text}
                        onChange={(e) => {
                          const next = [...instructions];
                          next[i] = { ...next[i], text: e.target.value };
                          setInstructions(next);
                        }}
                        placeholder={`Step ${stepNum}`}
                      />
                      {step.image_url && (
                        <div className="relative inline-block">
                          <img src={step.image_url} alt={`Step ${stepNum}`} className="h-16 w-16 object-cover rounded border border-border" />
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...instructions];
                              next[i] = { ...next[i], image_url: "" };
                              setInstructions(next);
                            }}
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => stepImageRefs.current[i]?.click()}
                      disabled={uploadingStepIdx === i}
                      title="Add step photo"
                    >
                      {uploadingStepIdx === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    </Button>
                    <input
                      ref={(el) => (stepImageRefs.current[i] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleStepImageUpload(e, i)}
                    />
                    {instructions.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setInstructions(instructions.filter((_, idx) => idx !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setInstructions([...instructions, { text: "", image_url: "" }])}>
                <Plus className="mr-1 h-3 w-3" /> Add Step
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setInstructions([...instructions, { text: "", image_url: "", heading: "" }])}>
                <Plus className="mr-1 h-3 w-3" /> Add Heading
              </Button>
            </div>
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
