import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { RECIPE_CATEGORIES } from "@/lib/recipe-categories";
import {
  ingredientsToLines, instructionsToLines, linesToIngredients, linesToInstructions,
  type IngredientLine, type InstructionStep, type PublicRecipe,
} from "@/lib/public-recipes";

type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  prep_time: string;
  cook_time: string;
  servings: string;
  image_url: string;
  tags: string;
  ingredients: string;
  instructions: string;
  status: "draft" | "published";
  published_at: string | null;
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const blankDraft = (): Draft => ({
  title: "", slug: "", description: "", category: "Dinner", prep_time: "", cook_time: "", servings: "",
  image_url: "", tags: "", ingredients: "", instructions: "", status: "draft", published_at: null,
});

const toDraft = (r: PublicRecipe & { status: string; updated_at?: string }): Draft => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  description: r.description ?? "",
  category: r.category ?? "Dinner",
  prep_time: r.prep_time?.toString() ?? "",
  cook_time: r.cook_time?.toString() ?? "",
  servings: r.servings?.toString() ?? "",
  image_url: r.image_url ?? "",
  tags: (r.tags ?? []).join(", "),
  ingredients: ingredientsToLines(r.ingredients as IngredientLine[]),
  instructions: instructionsToLines(r.instructions as InstructionStep[]),
  status: r.status === "published" ? "published" : "draft",
  published_at: r.published_at,
});

const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))));

const AdminRecipes = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-public-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_recipes")
        .select("id, slug, title, status, category, published_at, updated_at, tags, ingredients, instructions, description, prep_time, cook_time, servings, image_url")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (PublicRecipe & { status: string; updated_at: string })[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const slug = (d.slug.trim() || slugify(d.title)).slice(0, 120);
      if (!d.title.trim()) throw new Error("Give the recipe a title");
      if (!slug) throw new Error("The slug can't be empty");
      const payload = {
        title: d.title.trim(),
        slug,
        description: d.description.trim() || null,
        category: d.category || null,
        prep_time: num(d.prep_time),
        cook_time: num(d.cook_time),
        servings: num(d.servings),
        image_url: d.image_url.trim() || null,
        tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: linesToIngredients(d.ingredients) as never,
        instructions: linesToInstructions(d.instructions) as never,
        status: d.status,
        published_at: d.status === "published" ? d.published_at ?? new Date().toISOString() : null,
      };
      if (d.id) {
        const { error } = await supabase.from("public_recipes").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("public_recipes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-public-recipes"] });
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Couldn't save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-public-recipes"] });
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Couldn't delete"),
  });

  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{draft.id ? "Edit recipe" : "New recipe"}</h1>
          <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-title">Title</Label>
                <Input id="r-title" value={draft.title} onChange={(e) => set({ title: e.target.value, slug: slugTouched ? draft.slug : slugify(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-slug">Address (slug)</Label>
                <Input id="r-slug" value={draft.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} />
                <p className="text-xs text-muted-foreground">airecipemanager.com/recipes/{draft.slug || "…"}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-desc">Description</Label>
              <Textarea id="r-desc" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="r-cat">Category</Label>
                <select id="r-cat" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
                  {RECIPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="r-prep">Prep (min)</Label><Input id="r-prep" type="number" min={0} value={draft.prep_time} onChange={(e) => set({ prep_time: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-cook">Cook (min)</Label><Input id="r-cook" type="number" min={0} value={draft.cook_time} onChange={(e) => set({ cook_time: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-serv">Servings</Label><Input id="r-serv" type="number" min={0} value={draft.servings} onChange={(e) => set({ servings: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-img">Photo URL</Label>
              <Input id="r-img" value={draft.image_url} onChange={(e) => set({ image_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-tags">Tags</Label>
              <Input id="r-tags" value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="weeknight, one pan, vegetarian" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-ing">Ingredients (one per line)</Label>
                <Textarea id="r-ing" rows={12} value={draft.ingredients} onChange={(e) => set({ ingredients: e.target.value })} placeholder={"2 cups all-purpose flour\n## For the sauce\n1 tbsp olive oil"} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">A line starting with ## is a section heading.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-ins">Instructions (one step per line)</Label>
                <Textarea id="r-ins" rows={12} value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder={"Heat the oil over medium heat.\n## Assemble\nStir in the flour."} className="font-mono text-sm" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="r-status">Status</Label>
                <select id="r-status" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(e) => set({ status: e.target.value as Draft["status"] })}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recipes</h1>
          <p className="text-sm text-muted-foreground">Published recipes appear at /recipes. Visitors can add them to their own recipes.</p>
        </div>
        <Button onClick={() => { setSlugTouched(false); setDraft(blankDraft()); }}>
          <Plus className="mr-2 h-4 w-4" /> New recipe
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All recipes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !rows || rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipes yet.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.category ?? "No category"} · /recipes/{r.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.status === "published" && (
                      <a href={`/recipes/${r.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" aria-label="View on site">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setSlugTouched(true); setDraft(toDraft(r)); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => { if (window.confirm(`Delete "${r.title}"? Copies people already saved stay in their recipes.`)) remove.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRecipes;
