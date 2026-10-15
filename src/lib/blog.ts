import { format, parseISO } from "date-fns";

/** Blog post fields the index, archive and post pages need. */
export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

export interface BlogPostFull extends BlogCard {
  body: string;
}

/** "2026-10" for a timestamp, in UTC so it matches the digest's month boundaries. */
export const monthKey = (iso: string): string => iso.slice(0, 7);

/** "October 2026" for a "2026-10" key. */
export const monthLabel = (key: string): string => format(new Date(`${key}-01T12:00:00Z`), "MMMM yyyy");

export const isMonthKey = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Previous and next month keys, given a sorted (newest first) list of months that have posts. */
export function adjacentMonths(months: string[], current: string): { newer: string | null; older: string | null } {
  const i = months.indexOf(current);
  if (i === -1) return { newer: null, older: null };
  return { newer: i > 0 ? months[i - 1] : null, older: i < months.length - 1 ? months[i + 1] : null };
}

/** Count posts per month, newest month first. */
export function archiveMonths(posts: BlogCard[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (!p.published_at) continue;
    const k = monthKey(p.published_at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, count]) => ({ key, count }));
}

/** Reading time at roughly 225 words per minute, never less than one minute. */
export const readingMinutes = (body: string): number => {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
};

export const formatPostDate = (iso: string): string => format(parseISO(iso), "MMMM d, yyyy");
