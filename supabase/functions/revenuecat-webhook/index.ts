import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_AUTH = (Deno.env.get("REVENUECAT_WEBHOOK_AUTH") ?? "").trim();

// RevenueCat sends the Authorization field exactly as typed in its dashboard,
// so accept the secret with or without a "Bearer " prefix.
const isAuthorized = (header: string | null): boolean => {
  if (!WEBHOOK_AUTH || !header) return false;
  const value = header.trim().replace(/^Bearer\s+/i, "").trim();
  return value === WEBHOOK_AUTH;
};

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
  if (!isAuthorized(req.headers.get("Authorization"))) {
    console.warn("revenuecat-webhook: Authorization header did not match REVENUECAT_WEBHOOK_AUTH");
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
  const newProductId = event.new_product_id as string | undefined;
  const eventAtMs = Number(event.event_timestamp_ms) || Date.now();

  console.log(
    `[revenuecat-webhook] ${eventType} user=${userId} product=${productId} ` +
      `new_product=${newProductId ?? "-"} event_at=${new Date(eventAtMs).toISOString()}`,
  );

  const skip = (reason: string) =>
    new Response(JSON.stringify({ ok: true, skipped: reason }), {
      headers: { "Content-Type": "application/json" },
    });

  if (!userId || !ACTIVE_EVENTS.has(eventType) && !EXPIRY_EVENTS.has(eventType)) {
    return skip(`event type ${eventType}`);
  }

  const { data: current } = await supabase
    .from("subscriptions")
    .select("plan, iap_event_at_ms")
    .eq("user_id", userId)
    .maybeSingle();

  // RevenueCat retries failed deliveries with their original timestamp, so a
  // retry of an old purchase can arrive after a newer plan change. Never let an
  // older event overwrite a newer one.
  const lastAppliedMs = Number(current?.iap_event_at_ms) || 0;
  if (eventAtMs <= lastAppliedMs) {
    console.log(`[revenuecat-webhook] skipped stale ${eventType}; newer event already applied`);
    return skip("stale event");
  }

  let tier: string;
  if (eventType === "PRODUCT_CHANGE") {
    // product_id is the plan being left; new_product_id is the plan chosen.
    // Apple applies upgrades immediately but downgrades only at renewal (which
    // then arrives as a RENEWAL for the new product), so apply only upgrades here.
    const newTier = newProductId ? tierFromProductId(newProductId) : "free";
    const currentTier = current?.plan ?? "free";
    if (tierRank(newTier) <= tierRank(currentTier)) {
      return skip(`downgrade to ${newTier} takes effect at renewal`);
    }
    tier = newTier;
  } else if (EXPIRY_EVENTS.has(eventType)) {
    // An expiry for a plan the user already moved off must not drop them to free.
    const expiredTier = productId ? tierFromProductId(productId) : "free";
    if (current?.plan && current.plan !== "free" && current.plan !== expiredTier) {
      return skip(`${expiredTier} expired but user is on ${current.plan}`);
    }
    tier = "free";
  } else {
    tier = productId ? tierFromProductId(productId) : "free";
  }

  const isActive = tier !== "free";
  const expirationMs = event.expiration_at_ms as number | null | undefined;
  const nextBillingDate = isActive && expirationMs
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
      iap_event_at_ms: eventAtMs,
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

function tierRank(tier: string): number {
  switch (tier) {
    case "basic": return 1;
    case "pro": return 2;
    case "unlimited": return 3;
    default: return 0;
  }
}

function recipeLimitForTier(tier: string): number {
  switch (tier) {
    case "basic": return 100;
    case "pro": return 500;
    case "unlimited": return -1;
    default: return 25;
  }
}

/**
 * What the user actually pays through Apple. This webhook only ever handles App
 * Store purchases (payment_method "apple_iap"), so these must match App Store
 * Connect, not the web's accept.blue prices — Pro and Unlimited were recorded
 * at 11.99 / 22.99 while Apple charges 12.99 / 24.99.
 */
function priceForTier(tier: string): number {
  switch (tier) {
    case "basic": return 5.99;
    case "pro": return 12.99;
    case "unlimited": return 24.99;
    default: return 0;
  }
}
