import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { format, parseISO } from "date-fns";
import { ChefHat, ArrowLeft } from "lucide-react";
import { setSeo } from "@/lib/seo";

interface Post {
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body: string;
  published_at: string | null;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["blog-post", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Post | null> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("title, excerpt, cover_image_url, body, published_at")
        .eq("slug", slug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return (data as Post) ?? null;
    },
  });

  useEffect(() => {
    if (post) {
      setSeo({
        title: `${post.title} | AI Recipe Manager`,
        description: post.excerpt || undefined,
        image: post.cover_image_url,
        url: `https://airecipemanager.com/blog/${slug}`,
        type: "article",
      });
    }
    return () => { document.title = "AI Recipe Manager"; };
  }, [post, slug]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <ChefHat className="h-5 w-5 text-primary" /> AI Recipe Manager
          </Link>
          <Link to="/blog" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> All posts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error || !post ? (
          <div className="text-center">
            <p className="text-muted-foreground">Post not found.</p>
            <Link to="/blog" className="mt-4 inline-block text-primary hover:underline">← Back to the blog</Link>
          </div>
        ) : (
          <article>
            {post.published_at && (
              <p className="text-sm text-muted-foreground">{format(parseISO(post.published_at), "MMMM d, yyyy")}</p>
            )}
            <h1 className="mt-1 text-3xl font-bold text-foreground">{post.title}</h1>
            {post.cover_image_url && (
              <img src={post.cover_image_url} alt={post.title} className="mt-6 w-full rounded-xl object-cover" />
            )}
            <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
              <ReactMarkdown>{post.body}</ReactMarkdown>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};

export default BlogPost;
