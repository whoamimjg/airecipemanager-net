import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { setSeo } from "@/lib/seo";
import { adjacentMonths, archiveMonths, isMonthKey, monthKey, monthLabel } from "@/lib/blog";
import { BLOG_POSTS_KEY, fetchPublishedPosts } from "@/lib/blog-queries";
import { BlogChrome, PostGrid } from "@/components/blog/BlogChrome";
import MonthArchive from "@/components/blog/MonthArchive";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import NotFound from "@/pages/NotFound";

const BlogMonth = () => {
  const { month } = useParams<{ month: string }>();
  const valid = isMonthKey(month);

  const { data: posts, isLoading } = useQuery({ queryKey: BLOG_POSTS_KEY, queryFn: fetchPublishedPosts });

  const months = useMemo(() => archiveMonths(posts ?? []), [posts]);
  const inMonth = useMemo(() => (posts ?? []).filter((p) => p.published_at && monthKey(p.published_at) === month), [posts, month]);
  const monthKeys = months.map((m) => m.key);
  const { newer, older } = adjacentMonths(monthKeys, month ?? "");

  const label = valid ? monthLabel(month!) : "";

  useEffect(() => {
    if (!valid) return;
    setSeo({
      title: `Posts from ${label} | AI Recipe Manager Blog`,
      description: `AI Recipe Manager blog posts published in ${label}.`,
      url: `https://airecipemanager.com/blog/month/${month}`,
    });
  }, [valid, label, month]);

  if (!valid) return <NotFound />;

  return (
    <BlogChrome>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/blog" className="mb-6 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <h1 className="mb-8 text-3xl font-bold text-foreground">{label}</h1>

        <div className="grid gap-10 lg:grid-cols-[1fr_15rem]">
          <section>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : inMonth.length === 0 ? (
              <p className="text-muted-foreground">Nothing was published in {label}.</p>
            ) : (
              <PostGrid posts={inMonth} />
            )}

            <nav className="mt-10 flex justify-between gap-4 border-t border-border pt-6 text-sm" aria-label="Other months">
              {older ? <Link to={`/blog/month/${older}`} className="text-primary hover:underline">← {monthLabel(older)}</Link> : <span />}
              {newer ? <Link to={`/blog/month/${newer}`} className="text-primary hover:underline">{monthLabel(newer)} →</Link> : <span />}
            </nav>
          </section>

          <aside className="space-y-8">
            <MonthArchive months={months} current={month} />
            <NewsletterSignup source={`blog-month-${month}`} />
          </aside>
        </div>
      </main>
    </BlogChrome>
  );
};

export default BlogMonth;
