import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { setSeo } from "@/lib/seo";
import { normalizeRecipeCategory } from "@/lib/recipe-categories";
import { canonicalRecipeUrl, fetchPublishedRecipe, ingredientText, isHeadingLine } from "@/lib/public-recipes";
import { BlogChrome } from "@/components/blog/BlogChrome";
import AddToRecipesButton from "@/components/recipes/AddToRecipesButton";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import ShareBar from "@/components/share/ShareBar";

const PublicRecipe = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["public-recipe", slug],
    enabled: !!slug,
    queryFn: () => fetchPublishedRecipe(slug!),
  });

  useEffect(() => {
    if (!recipe) return;
    setSeo({
      title: `${recipe.title} | AI Recipe Manager`,
      description: recipe.description || undefined,
      image: recipe.image_url,
      url: canonicalRecipeUrl(recipe.slug),
      type: "article",
    });

    // schema.org Recipe markup, so search engines can show the time, servings and steps.
    const total = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    const schema = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: recipe.title,
      description: recipe.description ?? undefined,
      image: recipe.image_url ?? undefined,
      recipeCategory: normalizeRecipeCategory(recipe.category) ?? undefined,
      recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
      prepTime: recipe.prep_time ? `PT${recipe.prep_time}M` : undefined,
      cookTime: recipe.cook_time ? `PT${recipe.cook_time}M` : undefined,
      totalTime: total ? `PT${total}M` : undefined,
      recipeIngredient: recipe.ingredients.filter((i) => !isHeadingLine(i)).map(ingredientText),
      recipeInstructions: recipe.instructions
        .filter((s) => !isHeadingLine(s))
        .map((s) => ({ "@type": "HowToStep", text: typeof s === "string" ? s : (s as { text?: string }).text ?? "" })),
      url: canonicalRecipeUrl(recipe.slug),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => {
      el.remove();
      document.title = "AI Recipe Manager";
    };
  }, [recipe]);

  if (isLoading) {
    return <BlogChrome width="max-w-2xl"><p className="px-4 py-10 text-muted-foreground">Loading…</p></BlogChrome>;
  }

  if (error || !recipe) {
    return (
      <BlogChrome width="max-w-2xl">
        <div className="px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-foreground">Recipe not found</h1>
          <p className="mt-2 text-muted-foreground">It may have been moved or isn't published yet.</p>
          <Link to="/recipes" className="mt-4 inline-block text-primary hover:underline">← All recipes</Link>
        </div>
      </BlogChrome>
    );
  }

  const total = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const category = normalizeRecipeCategory(recipe.category);
  let stepNum = 0;

  return (
    <BlogChrome width="max-w-2xl">
      {recipe.image_url && (
        <div className="h-48 w-full overflow-hidden sm:h-72">
          <img src={recipe.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Link to="/recipes" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> All recipes
        </Link>

        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{recipe.title}</h1>
        {recipe.description && <p className="text-muted-foreground">{recipe.description}</p>}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {category && <Badge variant="secondary">{category}</Badge>}
          {total > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {total} min
              {recipe.prep_time && recipe.cook_time ? <span className="text-xs">({recipe.prep_time} prep + {recipe.cook_time} cook)</span> : null}
            </span>
          )}
          {recipe.servings && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {recipe.servings} servings</span>}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <AddToRecipesButton recipe={recipe} />
        </div>

        <ShareBar url={canonicalRecipeUrl(recipe.slug)} title={recipe.title} />

        {recipe.ingredients.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Ingredients</h2>
            <ul className="space-y-1.5">
              {recipe.ingredients.map((ing, i) =>
                isHeadingLine(ing) ? (
                  <li key={i} className="pt-3 text-sm font-semibold text-foreground first:pt-0 list-none">{ing.heading}</li>
                ) : (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {ingredientText(ing)}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {recipe.instructions.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Instructions</h2>
            <ol className="space-y-3">
              {recipe.instructions.map((step, i) => {
                if (isHeadingLine(step)) {
                  return <li key={i} className="list-none pt-3 first:pt-0"><h3 className="text-sm font-semibold text-foreground">{step.heading}</h3></li>;
                }
                stepNum += 1;
                const text = typeof step === "string" ? step : (step as { text?: string }).text ?? "";
                return (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{stepNum}</span>
                    <span className="pt-0.5 text-muted-foreground">{text}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <AddToRecipesButton recipe={recipe} size="default" />
        </div>

        <NewsletterSignup source="recipe-page" />
      </main>
    </BlogChrome>
  );
};

export default PublicRecipe;
