import { Link } from "react-router-dom";
import { ChefHat } from "lucide-react";
import type { ReactNode } from "react";
import { formatPostDate, type BlogCard } from "@/lib/blog";

/** Header and footer shared by the blog and recipe pages. */
export const BlogChrome = ({ children, width = "max-w-4xl" }: { children: ReactNode; width?: string }) => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className={`mx-auto flex ${width} items-center justify-between gap-4 px-4 py-4`}>
        <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
          <ChefHat className="h-5 w-5 text-primary" /> AI Recipe Manager
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link>
          <Link to="/recipes" className="text-muted-foreground hover:text-foreground">Recipes</Link>
          <Link to="/dashboard" className="hidden text-primary hover:underline sm:inline">Open app</Link>
        </nav>
      </div>
    </header>
    {children}
    <footer className="border-t border-border">
      <div className={`mx-auto ${width} px-4 py-6 text-xs text-muted-foreground`}>
        AI Recipe Manager, by AI Manager LLC · <Link to="/privacy" className="hover:underline">Privacy</Link> · <Link to="/terms" className="hover:underline">Terms</Link>
      </div>
    </footer>
  </div>
);

export const PostGrid = ({ posts }: { posts: BlogCard[] }) => (
  <div className="grid gap-6 sm:grid-cols-2">
    {posts.map((p) => (
      <Link key={p.slug} to={`/blog/${p.slug}`} className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
        {p.cover_image_url && <img src={p.cover_image_url} alt="" className="h-44 w-full object-cover" loading="lazy" />}
        <div className="p-4">
          {p.published_at && <p className="text-xs text-muted-foreground">{formatPostDate(p.published_at)}</p>}
          <h2 className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">{p.title}</h2>
          {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
        </div>
      </Link>
    ))}
  </div>
);
