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

interface RecipeDetailDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecipeDetailDialog = ({ recipe, open, onOpenChange }: RecipeDetailDialogProps) => {
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
              <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                {recipe.title}
              </DialogTitle>
              {recipe.description && (
                <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
              )}
            </DialogHeader>

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
                  {ingredients.map((ing: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {instructions.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Instructions</h3>
                <ol className="space-y-3">
                  {instructions.map((step: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <CookingTimer />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailDialog;
