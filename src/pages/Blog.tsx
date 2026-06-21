import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ChefHat } from "lucide-react";
import { setSeo } from "@/lib/seo";

interface PostCard {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

const Blog = () => {
  useEffect(() => {
    setSeo({
      title: "Blog | AI Recipe Manager",
      description: "Recipes, kitchen tips, meal-planning ideas and more from AI Recipe Manager.",
      url: "https://airecipemanager.com/blog",
    });
  }, []);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async (): Promise<PostCard[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("slug, title, excerpt, cover_image_url, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PostCard[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <ChefHat className="h-5 w-5 text-primary" /> AI Recipe Manager
          </Link>
          <Link to="/dashboard" className="text-sm text-primary hover:underline">Open app</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Blog</h1>
        <p className="mb-8 text-muted-foreground">Recipes, kitchen tips, and meal-planning ideas.</p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !posts || posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.title} className="h-44 w-full object-cover" />
                )}
                <div className="p-4">
                  {p.published_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(p.published_at), "MMM d, yyyy")}
                    </p>
                  )}
                  <h2 className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">{p.title}</h2>
                  {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;
