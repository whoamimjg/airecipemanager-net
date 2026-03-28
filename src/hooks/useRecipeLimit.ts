import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useRecipeLimit() {
  const { user } = useAuth();

  const { data: recipeCount = 0 } = useQuery({
    queryKey: ["recipe-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recipes")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const limit = subscription?.recipe_limit ?? 25;
  const isUnlimited = limit < 0;
  const atLimit = !isUnlimited && recipeCount >= limit;
  const nearLimit = !isUnlimited && !atLimit && recipeCount >= limit * 0.8;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - recipeCount);
  const plan = subscription?.plan ?? "free";

  return { recipeCount, limit, isUnlimited, atLimit, nearLimit, remaining, plan };
}
