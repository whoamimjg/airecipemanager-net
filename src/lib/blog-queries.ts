import { supabase } from "@/integrations/supabase/client";
import type { BlogCard, BlogPostFull } from "@/lib/blog";

/** Every published post, newest first. Shared by the index, archive, and post pages. */
export const BLOG_POSTS_KEY = ["blog-posts"] as const;

export async function fetchPublishedPosts(): Promise<BlogCard[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data || []) as BlogCard[];
}

export async function fetchPublishedPost(slug: string): Promise<BlogPostFull | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, body, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as BlogPostFull) ?? null;
}
