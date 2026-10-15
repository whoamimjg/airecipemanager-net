import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter`;

/**
 * Monthly digest sign-up. Double opt-in: the address gets a confirmation email
 * first, and nothing is sent until it is confirmed. The hidden "website" field
 * is a honeypot for bots.
 */
const NewsletterSignup = ({ source, className }: { source: string; className?: string }) => {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch(`${FUNCTION_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ email, website, source }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      setState("sent");
      setMessage(body.message || "Check your inbox to confirm.");
    } catch (err) {
      setState("error");
      setMessage((err as Error).message);
    }
  };

  return (
    <section className={className}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-foreground">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Get the monthly digest</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          One email a month with the new posts. Months without new posts get nothing.
        </p>
        {state === "sent" ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {message} Once you confirm, you're on the list.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-2">
            <div className="flex flex-col gap-2">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                autoComplete="email"
              />
              <Button type="submit" disabled={state === "sending"} className="w-full">
                {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
              </Button>
            </div>
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            {state === "error" && message && <p className="text-sm text-destructive">{message}</p>}
            <p className="text-xs text-muted-foreground">
              We'll ask you to confirm first. Unsubscribe any time from the email.
            </p>
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterSignup;
