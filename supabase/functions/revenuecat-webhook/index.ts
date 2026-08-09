import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH")!;

// RevenueCat event types that mean the user has (or had) an active subscription.
const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "CANCELLATION", // cancelled but still active until expiry
]);

const EXPIRY_EVENTS = new Set(["EXPIRATION", "BILLING_ISSUE"]);

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${WEBHOOK_AUTH}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return new Response(JSON.stringify({ ok: true, skipped: "no event" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = event.type as string;
  const userId = event.app_user_id as string;
  const productId = event.product_id as string | undefined;

  if (!userId || !ACTIVE_EVENTS.has(eventType) && !EXPIRY_EVENTS.has(eventType)) {
    return new Response(JSON.stringify({ ok: true, skipped: `event type ${eventType}` }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const isActive = ACTIVE_EVENTS.has(eventType);
  const tier = isActive && productId ? tierFromProductId(productId) : "free";
  const expirationMs = event.expiration_at_ms as number | null | undefined;
  const nextBillingDate = expirationMs
    ? new Date(expirationMs).toISOString().split("T")[0]
    : null;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: tier,
      recipe_limit: recipeLimitForTier(tier),
      price_monthly: priceForTier(tier),
      is_active: isActive,
      payment_method: "apple_iap",
      next_billing_date: nextBillingDate,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[revenuecat-webhook] upsert error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, userId, tier, eventType }),
    { headers: { "Content-Type": "application/json" } },
  );
});

function tierFromProductId(productId: string): string {
  if (productId.includes("unlimited")) return "unlimited";
  if (productId.includes("pro")) return "pro";
  if (productId.includes("basic")) return "basic";
  return "free";
}

function recipeLimitForTier(tier: string): number {
  switch (tier) {
    case "basic": return 100;
    case "pro": return 500;
    case "unlimited": return -1;
    default: return 25;
  }
}

function priceForTier(tier: string): number {
  switch (tier) {
    case "basic": return 5.99;
    case "pro": return 11.99;
    case "unlimited": return 22.99;
    default: return 0;
  }
}
