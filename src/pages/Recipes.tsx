import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { setSeo } from "@/lib/seo";
import { RECIPE_CATEGORIES, normalizeRecipeCategory } from "@/lib/recipe-categories";
import { fetchPublishedRecipes } from "@/lib/public-recipes";
import { BlogChrome } from "@/components/blog/BlogChrome";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import { useQuery as useRecipesQuery } from "@tanstack/react-query";

const Recipes = () => {
  useEffect(() => {
    setSeo({
      title: "Recipes | AI Recipe Manager",
      description: "Recipes from AI Recipe Manager. Add any of them to your own recipe list with one click.",
      url: "https://airecipemanager.com/recipes",
    });
  }, []);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const { data: recipes, isLoading } = useQuery({ queryKey: ["public-recipes"], queryFn: fetchPublishedRecipes });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (recipes ?? []).filter((r) => {
      if (category !== "All" && normalizeRecipeCategory(r.category) !== category) return false;
      if (!q) return true;
      return `${r.title} ${r.description ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [recipes, query, category]);

  return (
    <BlogChrome width="max-w-5xl">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Recipes</h1>
        <p className="mb-6 text-muted-foreground">Open any recipe and add it to your own AI Recipe Manager with one click.</p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" className="pl-9" />
          </div>
        </div>
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {["All", ...RECIPE_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_15rem]">
          <section>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">
                {recipes && recipes.length > 0 ? "No recipes match those filters." : "No recipes yet. Check back soon."}
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r) => {
                  const total = (r.prep_time || 0) + (r.cook_time || 0);
                  return (
                    <Link key={r.slug} to={`/recipes/${r.slug}`} className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-40 w-full bg-muted" aria-hidden="true" />
                      )}
                      <div className="p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {normalizeRecipeCategory(r.category) && <Badge variant="secondary">{normalizeRecipeCategory(r.category)}</Badge>}
                          {total > 0 && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {total} min</span>
                          )}
                        </div>
                        <h2 className="mt-2 font-semibold text-foreground group-hover:text-primary">{r.title}</h2>
                        {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          <aside className="space-y-8">
            <NewsletterSignup source="recipes-index" />
          </aside>
        </div>
      </main>
    </BlogChrome>
  );
};

export default Recipes;
