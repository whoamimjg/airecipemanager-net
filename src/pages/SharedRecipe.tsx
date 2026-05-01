import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, ExternalLink, ChefHat, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StarRating from "@/components/recipes/StarRating";

const SharedRecipe = () => {
  const { id } = useParams<{ id: string }>();

  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["shared-recipe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <ChefHat className="h-10 w-10 animate-pulse text-primary" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ChefHat className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold text-foreground">Recipe not found</h1>
        <p className="text-muted-foreground">This recipe may have been removed.</p>
        <Link to="/">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Go Home</Button>
        </Link>
      </div>
    );
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <div className="min-h-screen bg-background">
      {recipe.image_url && (
        <div className="w-full h-48 sm:h-72 overflow-hidden">
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/" className="text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> AI Appetite Aid
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{recipe.title}</h1>
        {recipe.description && <p className="text-muted-foreground">{recipe.description}</p>}

        {recipe.rating && <StarRating rating={recipe.rating} readonly size="md" />}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {recipe.category && <Badge variant="secondary">{recipe.category}</Badge>}
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {totalTime} min
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
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Source
            </a>
          )}
        </div>

        {ingredients.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Ingredients</h2>
            <ul className="space-y-1.5">
              {ingredients.map((ing: any, i: number) => {
                const text = typeof ing === "string" ? ing : [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ");
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
            <h2 className="text-lg font-semibold text-foreground mb-3">Instructions</h2>
            <ol className="space-y-3">
              {instructions.map((step: any, i: number) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground pt-0.5">{typeof step === "string" ? step : step.text || JSON.stringify(step)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          Shared from <Link to="/" className="text-primary hover:underline font-medium">AI Appetite Aid</Link>
        </div>
      </div>
    </div>
  );
};

export default SharedRecipe;
