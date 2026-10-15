import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { setSeo } from "@/lib/seo";
import { BlogChrome } from "@/components/blog/BlogChrome";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter`;

/** Unsubscribing takes one click on this page. Mail scanners that open links alone never unsubscribe anyone. */
const NewsletterUnsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"ready" | "working" | "done" | "error">("ready");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSeo({ title: "Unsubscribe | AI Recipe Manager", url: "https://airecipemanager.com/newsletter/unsubscribe" });
  }, []);

  const unsubscribe = async () => {
    setState("working");
    try {
      const res = await fetch(`${FUNCTION_URL}/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "We couldn't unsubscribe this address.");
      setState("done");
    } catch (err) {
      setState("error");
      setMessage((err as Error).message);
    }
  };

  return (
    <BlogChrome width="max-w-xl">
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        {!token && <p className="text-muted-foreground">This link is missing its code. Use the unsubscribe link from the email.</p>}
        {token && state !== "done" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Unsubscribe from the monthly digest?</h1>
            <p className="mt-2 text-muted-foreground">You won't get any more digest emails.</p>
            <Button className="mt-6" onClick={unsubscribe} disabled={state === "working"}>Unsubscribe</Button>
            {state === "error" && <p className="mt-4 text-sm text-destructive">{message}</p>}
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">You're unsubscribed</h1>
            <p className="mt-2 text-muted-foreground">You won't get any more digest emails.</p>
          </>
        )}
        <Link to="/blog" className="mt-8 inline-block text-primary hover:underline">Read the blog</Link>
      </main>
    </BlogChrome>
  );
};

export default NewsletterUnsubscribe;
