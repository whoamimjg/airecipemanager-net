// Imperatively set document head SEO tags (title, description, Open Graph, Twitter,
// canonical). Works with the Cloudflare prerenderer, which renders the final DOM per URL.

function upsert(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function setSeo(opts: {
  title?: string;
  description?: string;
  image?: string | null;
  url?: string;
  type?: "website" | "article";
}) {
  const { title, description, image, url, type = "website" } = opts;
  if (title) {
    document.title = title;
    upsert("property", "og:title", title);
    upsert("name", "twitter:title", title);
  }
  if (description) {
    upsert("name", "description", description);
    upsert("property", "og:description", description);
    upsert("name", "twitter:description", description);
  }
  if (image) {
    upsert("property", "og:image", image);
    upsert("name", "twitter:image", image);
    upsert("name", "twitter:card", "summary_large_image");
  }
  if (url) {
    upsert("property", "og:url", url);
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);
  }
  upsert("property", "og:type", type);
}
