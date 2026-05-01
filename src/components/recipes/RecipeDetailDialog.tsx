import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import CookingTimer from "./CookingTimer";
import CookingMode from "./CookingMode";
import StarRating from "./StarRating";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import ShareRecipeButton from "./ShareRecipeButton";

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
  rating: number | null;
  created_at: string;
}

interface RecipeDetailDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecipeDetailDialog = ({ recipe, open, onOpenChange }: RecipeDetailDialogProps) => {
  const [showCookingMode, setShowCookingMode] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (!recipe) return null;

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          {recipe.image_url && (
            <div className="w-full h-48 sm:h-64 overflow-hidden">
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  {recipe.title}
                </DialogTitle>
                <ShareRecipeButton recipeId={recipe.id} recipeTitle={recipe.title} />
              </div>
              {recipe.description && (
                <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
              )}
            </DialogHeader>

            {recipe.rating && (
              <StarRating rating={recipe.rating} readonly size="md" />
            )}

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {recipe.category && <Badge variant="secondary">{recipe.category}</Badge>}
              {totalTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {totalTime} min
                  {recipe.prep_time && recipe.cook_time && (
                    <span className="text-xs">({recipe.prep_time} prep + {recipe.cook_time} cook)</span>
                  )}
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {recipe.servings} servings
                </span>
              )}
              {recipe.source_url && (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Source
                </a>
              )}
            </div>

            {ingredients.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Ingredients</h3>
                <ul className="space-y-1">
                  {ingredients.map((ing: any, i: number) => {
                    const text = typeof ing === "string"
                      ? ing
                      : [ing?.quantity || ing?.amount, ing?.unit, ing?.name, ing?.notes ? `(${ing.notes})` : ""]
                          .filter(Boolean)
                          .join(" ");
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {instructions.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Instructions</h3>
                <ol className="space-y-3">
                  {instructions.map((step: any, i: number) => {
                    const text = typeof step === "string" ? step : step?.text || "";
                    const img = typeof step === "object" ? step?.image_url : "";
                    return (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                          {i + 1}
                        </span>
                        <div className="flex-1 flex items-start gap-3">
                          <span className="text-muted-foreground pt-0.5 flex-1">{text}</span>
                          {img && (
                            <button
                              type="button"
                              onClick={() => setExpandedImage(img)}
                              className="shrink-0 hover:opacity-80 transition-opacity"
                              aria-label={`View image for step ${i + 1}`}
                            >
                              <img src={img} alt={`Step ${i + 1}`} className="h-14 w-14 object-cover rounded border border-border cursor-pointer" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {instructions.length > 0 && (
              <Button
                onClick={() => setShowCookingMode(true)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
              >
                <PlayCircle className="mr-2 h-5 w-5" /> Start Cooking Mode
              </Button>
            )}

            <CookingTimer />
          </div>
        </ScrollArea>
      </DialogContent>

      <CookingMode
        open={showCookingMode}
        onOpenChange={setShowCookingMode}
        title={recipe.title}
        ingredients={ingredients}
        instructions={instructions}
        prepTime={recipe.prep_time}
        cookTime={recipe.cook_time}
      />
    </Dialog>
  );
};

export default RecipeDetailDialog;
