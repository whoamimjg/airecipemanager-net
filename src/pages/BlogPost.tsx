import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { setSeo } from "@/lib/seo";
import { formatPostDate, monthKey, monthLabel, readingMinutes } from "@/lib/blog";
import { BLOG_POSTS_KEY, fetchPublishedPost, fetchPublishedPosts } from "@/lib/blog-queries";
import { BlogChrome } from "@/components/blog/BlogChrome";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import { Button } from "@/components/ui/button";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["blog-post", slug],
    enabled: !!slug,
    queryFn: () => fetchPublishedPost(slug!),
  });

  // The full list gives previous/next links; it is already cached by the index page.
  const { data: all } = useQuery({ queryKey: BLOG_POSTS_KEY, queryFn: fetchPublishedPosts });
  const { newer, older } = useMemo(() => {
    const list = all ?? [];
    const i = list.findIndex((p) => p.slug === slug);
    if (i === -1) return { newer: null, older: null };
    return { newer: i > 0 ? list[i - 1] : null, older: i < list.length - 1 ? list[i + 1] : null };
  }, [all, slug]);

  const url = `https://airecipemanager.com/blog/${slug}`;

  useEffect(() => {
    if (post) {
      setSeo({
        title: `${post.title} | AI Recipe Manager`,
        description: post.excerpt || undefined,
        image: post.cover_image_url,
        url,
        type: "article",
      });
    }
    return () => { document.title = "AI Recipe Manager"; };
  }, [post, url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the share links still work */
    }
  };

  return (
    <BlogChrome width="max-w-3xl">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/blog" className="mb-6 flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error || !post ? (
          <div className="text-center">
            <p className="text-muted-foreground">Post not found.</p>
            <Link to="/blog" className="mt-4 inline-block text-primary hover:underline">← Back to the blog</Link>
          </div>
        ) : (
          <>
            <article>
              {post.published_at && (
                <p className="text-sm text-muted-foreground">
                  {formatPostDate(post.published_at)} ·{" "}
                  <Link to={`/blog/month/${monthKey(post.published_at)}`} className="hover:text-foreground hover:underline">
                    {monthLabel(monthKey(post.published_at))}
                  </Link>{" "}
                  · {readingMinutes(post.body)} min read
                </p>
              )}
              <h1 className="mt-1 text-3xl font-bold text-foreground">{post.title}</h1>
              {post.cover_image_url && (
                <img src={post.cover_image_url} alt="" className="mt-6 w-full rounded-xl object-cover" />
              )}
              <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
                <ReactMarkdown>{post.body}</ReactMarkdown>
              </div>
            </article>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6 text-sm">
              <span className="text-muted-foreground">Share:</span>
              <a className="text-primary hover:underline" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener noreferrer">X</a>
              <a className="text-primary hover:underline" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
              <a className="text-primary hover:underline" href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(`${post.title}\n\n${url}`)}`}>Email</a>
              <Button variant="outline" size="sm" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</Button>
            </div>

            <nav className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="More posts">
              {older ? (
                <Link to={`/blog/${older.slug}`} className="rounded-lg border border-border bg-card p-4 hover:border-primary">
                  <span className="text-xs text-muted-foreground">Previous</span>
                  <span className="mt-1 block font-medium text-foreground">{older.title}</span>
                </Link>
              ) : <span />}
              {newer ? (
                <Link to={`/blog/${newer.slug}`} className="rounded-lg border border-border bg-card p-4 text-right hover:border-primary sm:col-start-2">
                  <span className="text-xs text-muted-foreground">Next</span>
                  <span className="mt-1 block font-medium text-foreground">{newer.title}</span>
                </Link>
              ) : null}
            </nav>

            <div className="mt-10">
              <NewsletterSignup source="blog-post" />
            </div>
          </>
        )}
      </main>
    </BlogChrome>
  );
};

export default BlogPost;
