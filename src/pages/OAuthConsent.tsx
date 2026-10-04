import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, ShoppingCart, ListChecks, ClipboardList } from "lucide-react";

/**
 * OAuth 2.1 consent screen for Supabase Auth's OAuth server.
 *
 * An MCP client (Claude, or any other agent) sends the user here with
 * ?authorization_id=…; we show who is asking and what they get, and approve or
 * deny through supabase-js. Signed-out users go through /auth and come back.
 */
type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { name?: string; uri?: string; logo_uri?: string; client_id?: string };
  user: { id: string; email: string };
  scope: string;
};

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id");
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `${window.location.pathname}${window.location.search}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !authorizationId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      if ("redirect_url" in data) {
        // Already approved for this client: straight back.
        window.location.replace(data.redirect_url);
        return;
      }
      setDetails(data as Details);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authorizationId]);

  const decide = async (choice: "approve" | "deny") => {
    if (!authorizationId) return;
    setBusy(choice);
    const { data, error } =
      choice === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }
    window.location.replace(data.redirect_url);
  };

  if (!authorizationId) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Nothing to approve</CardTitle>
          <CardDescription>
            This page is opened by an app asking to connect to your AI Recipe Manager account. Start the
            connection from that app.
          </CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  if (loading || !user || (!details && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName = details?.client?.name || "This app";

  return (
    <Shell>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-serif text-2xl">Connect {clientName}?</CardTitle>
        <CardDescription>
          {clientName} wants to use your AI Recipe Manager account
          {user.email ? <> (<span className="font-medium text-foreground">{user.email}</span>)</> : null}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">It will be able to:</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Read the grocery list you saved with “Shop my list”, your preferred store, ZIP code and diet
              restrictions.
            </li>
            <li className="flex gap-2">
              <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Record what it added to your store cart so you can see it here.
            </li>
            <li className="flex gap-2">
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Tick items off your list as it puts them in the cart. It can never delete items.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            It cannot see your password or payment details, and it cannot place an order for you. You can
            disconnect it any time from Account settings.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => decide("deny")}>
            {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
          </Button>
          <Button className="flex-1" disabled={busy !== null || !details} onClick={() => decide("approve")}>
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allow"}
          </Button>
        </div>

        <button
          type="button"
          className="mx-auto block text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={async () => {
            await signOut();
            const next = `${window.location.pathname}${window.location.search}`;
            navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
          }}
        >
          Not you? Switch account
        </button>
      </CardContent>
    </Shell>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-md space-y-4">
      <div className="flex justify-center">
        <img src="/logo-horizontal.svg" alt="AI Recipe Manager" className="h-9 w-auto" />
      </div>
      <Card>{children}</Card>
    </div>
  </div>
);

export default OAuthConsent;
