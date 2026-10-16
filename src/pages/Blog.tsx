import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setSeo } from "@/lib/seo";
import { archiveMonths, monthLabel } from "@/lib/blog";
import { BLOG_POSTS_KEY, fetchPublishedPosts } from "@/lib/blog-queries";
import { BlogChrome, PostGrid } from "@/components/blog/BlogChrome";
import MonthArchive from "@/components/blog/MonthArchive";
import NewsletterSignup from "@/components/blog/NewsletterSignup";

const Blog = () => {
  useEffect(() => {
    setSeo({
      title: "Blog | AI Recipe Manager",
      description: "Recipes, kitchen tips, and meal-planning ideas from AI Recipe Manager. Browse by month or get new posts by email.",
      url: "https://airecipemanager.com/blog",
    });
  }, []);

  const [query, setQuery] = useState("");
  const { data: posts, isLoading } = useQuery({ queryKey: BLOG_POSTS_KEY, queryFn: fetchPublishedPosts });

  const months = useMemo(() => archiveMonths(posts ?? []), [posts]);
  const latestMonth = months[0]?.key;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts ?? [];
    return (posts ?? []).filter((p) => `${p.title} ${p.excerpt ?? ""}`.toLowerCase().includes(q));
  }, [posts, query]);

  return (
    <BlogChrome>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Blog</h1>
        <p className="mb-6 text-muted-foreground">Recipes, kitchen tips, and meal-planning ideas.</p>

        <div className="relative mb-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts"
            aria-label="Search posts"
            className="pl-9"
          />
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_15rem]">
          <section>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">
                {posts && posts.length > 0 ? "No posts match that search." : "No posts yet. Check back soon."}
              </p>
            ) : (
              <PostGrid posts={filtered} />
            )}
            {!query && latestMonth && (
              <p className="mt-8 text-sm text-muted-foreground">
                Latest: {monthLabel(latestMonth)}. Browse older months in the archive.
              </p>
            )}
          </section>

          <aside className="space-y-8">
            <MonthArchive months={months} />
            <NewsletterSignup source="blog-index" />
          </aside>
        </div>
      </main>
    </BlogChrome>
  );
};

export default Blog;
