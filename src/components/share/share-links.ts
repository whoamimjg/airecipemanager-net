import { toast } from "sonner";

/** Web share intents. Each opens the network's own composer with the page link filled in. */
export const shareLinks = (url: string, title: string) => ({
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
});

/**
 * Instagram has no web share link: it can't be sent a URL from a web page. On a
 * phone, the system share sheet lists Instagram and passes the link along. On a
 * computer, the link is copied and the user pastes it into a post, story or bio.
 */
export async function shareToInstagram(url: string, title: string): Promise<"shared" | "copied" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const data: ShareData = { title, text: title, url };
  if (typeof navigator.share === "function" && (!nav.canShare || nav.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied. Instagram can't take a link from a web page, so paste it into your post, story or bio.");
  } catch {
    toast.error("Couldn't copy the link. Copy it from the address bar.");
  }
  return "copied";
}
