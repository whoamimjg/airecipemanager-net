import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canonicalRecipeUrl, toUserRecipeInsert, type PublicRecipe } from "@/lib/public-recipes";

/**
 * "Add to your AI Recipe Manager". Signed out, it sends the visitor to sign in and
 * brings them back here with ?add=1, which adds the recipe once they are signed in.
 * Signed in, it copies the recipe into their own recipes. The normal row-level
 * security and the plan recipe limit apply to that copy.
 */
const AddToRecipesButton = ({ recipe, size = "lg" }: { recipe: PublicRecipe; size?: "default" | "lg" }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sourceUrl = canonicalRecipeUrl(recipe.slug);

  const { data: existingId, isLoading: checking } = useQuery({
    queryKey: ["my-copy", user?.id, recipe.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id")
        .eq("user_id", user!.id)
        .eq("source_url", sourceUrl)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recipes").insert(toUserRecipeInsert(recipe, user!.id));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Added "${recipe.title}" to your recipes`);
      queryClient.invalidateQueries({ queryKey: ["my-copy"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e: { message?: string }) => {
      if (/recipe limit/i.test(e.message ?? "")) {
        toast.error("Your plan's recipe limit is full. Remove a recipe to make room.");
      } else {
        toast.error(e.message || "Couldn't add the recipe. Please try again.");
      }
    },
  });

  // Returning from sign-in with ?add=1: add once, then clear the flag so a refresh doesn't add again.
  useEffect(() => {
    if (!user || loading || checking || searchParams.get("add") !== "1") return;
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    setSearchParams(next, { replace: true });
    if (!existingId && !add.isPending) add.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, checking, existingId, searchParams]);

  if (loading) {
    return <Button size={size} disabled>Add to your AI Recipe Manager</Button>;
  }

  if (!user) {
    return (
      <div className="space-y-2">
        <Button
          size={size}
          onClick={() => navigate(`/auth?next=${encodeURIComponent(`/recipes/${recipe.slug}?add=1`)}`)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add to your AI Recipe Manager
        </Button>
        <p className="text-xs text-muted-foreground">Sign in to save this recipe to your own list.</p>
      </div>
    );
  }

  if (existingId) {
    return (
      <Button size={size} variant="outline" onClick={() => navigate("/dashboard")}>
        <Check className="mr-2 h-4 w-4" /> In your recipes. Open them
      </Button>
    );
  }

  return (
    <Button size={size} onClick={() => add.mutate()} disabled={add.isPending || checking}>
      {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
      Add to your AI Recipe Manager
    </Button>
  );
};

export default AddToRecipesButton;
