import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { setSeo } from "@/lib/seo";
import { BlogChrome } from "@/components/blog/BlogChrome";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter`;

const NewsletterConfirm = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSeo({ title: "Confirm your subscription | AI Recipe Manager", url: "https://airecipemanager.com/newsletter/confirm" });
    if (!token) {
      setState("error");
      setMessage("This link is missing its code. Use the link from the confirmation email.");
      return;
    }
    fetch(`${FUNCTION_URL}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "We couldn't confirm this link.");
        setState("ok");
      })
      .catch((err) => {
        setState("error");
        setMessage((err as Error).message);
      });
  }, [token]);

  return (
    <BlogChrome width="max-w-xl">
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        {state === "working" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">You're subscribed</h1>
            <p className="mt-2 text-muted-foreground">You'll get an email each time we publish a new post.</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Couldn't confirm</h1>
            <p className="mt-2 text-muted-foreground">{message}</p>
          </>
        )}
        <Link to="/blog" className="mt-8 inline-block text-primary hover:underline">Read the blog</Link>
      </main>
    </BlogChrome>
  );
};

export default NewsletterConfirm;
