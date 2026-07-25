import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeft, Camera, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import RecipeForm from "./RecipeForm";

interface PhotoRecipeScannerProps {
  onClose: () => void;
}

const PhotoRecipeScanner = ({ onClose }: PhotoRecipeScannerProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scannedRecipe, setScannedRecipe] = useState<any>(null);

  const scanMutation = useMutation({
    mutationFn: async (base64: string) => {
      const { data, error } = await supabase.functions.invoke("scan-recipe-photo", {
        body: { image_base64: base64 },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.recipe) {
        setScannedRecipe(data.recipe);
        toast.success(`Found recipe: ${data.recipe.title}`);
      } else {
        toast.error("Couldn't extract a recipe from this image. Try a clearer photo.");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      scanMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  if (scannedRecipe) {
    return (
      <RecipeForm
        recipe={{
          id: "",
          title: scannedRecipe.title || "",
          description: scannedRecipe.description || null,
          ingredients: scannedRecipe.ingredients || [],
          instructions: scannedRecipe.instructions || [],
          prep_time: scannedRecipe.prep_time || null,
          cook_time: scannedRecipe.cook_time || null,
          servings: scannedRecipe.servings || null,
          category: scannedRecipe.category || null,
          source_url: null,
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
          <CardTitle className="text-card-foreground">Scan Recipe from Photo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Take a photo of a recipe from a cookbook, recipe card, or any printed/handwritten recipe and we'll extract all the details automatically.
        </p>

        <div className="flex flex-col items-center gap-4 py-8">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Recipe preview"
              className="max-h-64 rounded-lg border border-border object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="h-16 w-16 opacity-30" />
              <p className="text-sm">Take a photo of your recipe</p>
            </div>
          )}

          {scanMutation.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Reading recipe from image...</p>
              <p className="text-xs text-muted-foreground">This usually takes 5-10 seconds</p>
            </div>
          ) : (
            <label className={cn(buttonVariants(), "cursor-pointer")}>
              <Camera className="mr-2 h-4 w-4" />
              {previewUrl ? "Retake Photo" : "Take Photo / Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} />
            </label>
          )}
        </div>

        {scanMutation.isError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to read recipe</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a clearer photo with good lighting, or add the recipe manually.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Tips for best results</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Make sure the text is clearly visible and in focus</li>
            <li>Good lighting helps with handwritten recipes</li>
            <li>Include the full recipe — title, ingredients, and instructions</li>
            <li>Works with cookbook pages, recipe cards, screenshots, and more</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default PhotoRecipeScanner;
