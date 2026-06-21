// Dynamic sitemap.xml — static routes + every published blog post.
// Served at /sitemap.xml via a rewrite in vercel.json.
const SUPABASE_URL = "https://puokewpqhparawdcwkbw.supabase.co";
// Public anon/publishable key (safe to ship; RLS only exposes published posts).
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2tld3BxaHBhcmF3ZGN3a2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2OTk5MTMsImV4cCI6MjA5MzI3NTkxM30.0gHE7s9yKcaNx_7RRl2-aHUMZEW57istL9UlSDezDzo";
const BASE = "https://airecipemanager.com";

export default async function handler(_req: any, res: any) {
  const staticUrls = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/blog", priority: "0.8", changefreq: "daily" },
    { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
  ];

  let posts: { slug: string; updated_at?: string; published_at?: string }[] = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?status=eq.published&select=slug,updated_at,published_at&order=published_at.desc`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
    );
    if (r.ok) posts = await r.json();
  } catch {
    /* fall back to static urls only */
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const urls = [
    ...staticUrls.map(
      (u) => `  <url><loc>${BASE}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
    ),
    ...posts.map((p) => {
      const lastmod = (p.updated_at || p.published_at || "").slice(0, 10);
      return `  <url><loc>${BASE}/blog/${esc(p.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>monthly</changefreq><priority>0.7</priority></url>`;
    }),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
