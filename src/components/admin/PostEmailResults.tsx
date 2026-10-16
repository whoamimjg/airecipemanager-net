import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  sent_at: string;
  sent_to: number;
  clicks: number;
  people_clicked: number;
  unsubscribed_since: number;
  links: { url: string; clicks: number; people: number }[];
}

/** Click results for a post that was emailed: who clicked, how often, and which links. */
const PostEmailResults = ({ slug }: { slug: string }) => {
  const [showLinks, setShowLinks] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["post-email-stats", slug],
    queryFn: async (): Promise<Stats | null> => {
      const { data, error } = await supabase.rpc("newsletter_post_stats", { p_slug: slug });
      if (error) throw error;
      return (data as unknown as Stats) ?? null;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading email results…</p>;
  if (!data) return null;

  const rate = data.sent_to > 0 ? Math.round((data.people_clicked / data.sent_to) * 100) : 0;
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      <p>
        Emailed to {data.sent_to} on {new Date(data.sent_at).toLocaleDateString()} ·{" "}
        <span className="font-medium text-foreground">{data.people_clicked} clicked ({rate}%)</span> ·{" "}
        {data.clicks} total clicks · {data.unsubscribed_since} unsubscribed since
        {data.links.length > 0 && (
          <>
            {" · "}
            <button type="button" className="text-primary hover:underline" onClick={() => setShowLinks((v) => !v)}>
              {showLinks ? "Hide links" : "Links"}
            </button>
          </>
        )}
      </p>
      {showLinks && (
        <ul className="mt-1 space-y-0.5">
          {data.links.map((l) => (
            <li key={l.url} className="flex gap-2">
              <span className="w-24 shrink-0">{l.people} people, {l.clicks} clicks</span>
              <span className="truncate">{l.url}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PostEmailResults;
