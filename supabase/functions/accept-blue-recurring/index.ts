import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCEPT_BLUE_BASE = "https://api.accept.blue/api/v2";

const ACCEPT_BLUE_API_SOURCE_KEY = Deno.env.get("ACCEPT_BLUE_API_SOURCE_KEY")?.trim();
const ACCEPT_BLUE_API_KEY = ACCEPT_BLUE_API_SOURCE_KEY;

function getAcceptBlueHeaders(extra: HeadersInit = {}): HeadersInit {
  if (!ACCEPT_BLUE_API_KEY) {
    throw new Error("Missing ACCEPT_BLUE_API_SOURCE_KEY");
  }

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Basic ${btoa(`${ACCEPT_BLUE_API_KEY}:`)}`,
    ...extra,
  };
}

async function acceptBlueFetch(url: string, init: RequestInit = {}): Promise<Response> {
  console.log("acceptBlueFetch ->", init.method || "GET", url);
  const resp = await fetch(url, {
    ...init,
    headers: getAcceptBlueHeaders((init.headers as HeadersInit) || {}),
  });
  console.log("acceptBlueFetch <-", resp.status, resp.statusText);
  return resp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      return await createRecurring(body, { id: user.id, email: user.email }, supabase);
    } else if (action === "cancel") {
      return await cancelRecurring(body, user.id, supabase);
    } else if (action === "list") {
      return await listRecurring(user.id);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use: create, cancel, list" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Recurring error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function createRecurring(
  body: Record<string, unknown>,
  user: { id: string; email?: string | null },
  supabase: ReturnType<typeof createClient>
) {
  const { card, amount, frequency, title, plan } = body as {
    card: {
      nonce?: string;
      source?: string;
      expiration?: string;
      expiry_month?: number | string;
      expiry_year?: number | string;
      expiryMonth?: number | string;
      expiryYear?: number | string;
      avs_zip?: string;
    };
    amount: number;
    frequency: string;
    title?: string;
    plan?: string;
  };

  console.log("DEBUG: Incoming card data:", JSON.stringify(card));

  if (!card || !amount || !frequency) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: card, amount, frequency" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const frequencyMap: Record<string, string> = {
    weekly: "weekly",
    biweekly: "weekly",
    monthly: "monthly",
    quarterly: "quarterly",
    yearly: "annually",
  };

  const mappedFrequency = frequencyMap[frequency] || "monthly";

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const nextDate = startDate.toISOString().split("T")[0];

  const cardSource = card.nonce ? `nonce-${card.nonce}` : card.source;
  if (!cardSource) {
    return new Response(
      JSON.stringify({ error: "Missing card source or nonce" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const customerIdentifier = user.email || user.id;

  const customerLookupUrl = `${ACCEPT_BLUE_BASE}/customers?active=true&customer_number=${encodeURIComponent(customerIdentifier)}`;
  console.log("DEBUG: Fetching customers from:", customerLookupUrl);

  const customersResponse = await acceptBlueFetch(
    customerLookupUrl,
    {
      method: "GET",
    }
  );

  console.log("DEBUG: Customer lookup status:", customersResponse.status);

  const customersText = await customersResponse.text();
  let customersResult: unknown = [];
  if (customersText) {
    try {
      customersResult = JSON.parse(customersText);
    } catch {
      customersResult = [];
    }
  }

  let customerId: number | string | undefined;
  if (Array.isArray(customersResult) && customersResult.length > 0) {
    customerId = (customersResult[0] as { id?: number | string })?.id;
  }

  if (!customerId) {
    const createCustomerResponse = await acceptBlueFetch(`${ACCEPT_BLUE_BASE}/customers`, {
      method: "POST",
      body: JSON.stringify({
        identifier: customerIdentifier,
        customer_number: customerIdentifier,
        email: user.email || undefined,
        active: true,
      }),
    });

    const createCustomerText = await createCustomerResponse.text();
    let createCustomerResult: Record<string, unknown> = {};
    try {
      createCustomerResult = createCustomerText ? JSON.parse(createCustomerText) : {};
    } catch {
      createCustomerResult = { raw: createCustomerText };
    }

    if (!createCustomerResponse.ok) {
      console.error("accept.blue create customer error:", createCustomerResult);
      const customerError =
        createCustomerResponse.status === 403
          ? "Accept Blue denied customer creation for ACCEPT_BLUE_API_SOURCE_KEY in this environment. Enable Customers (create), Payment Methods, and Recurring permissions on this same key."
          : "Failed to create customer";
      return new Response(
        JSON.stringify({ error: customerError, details: createCustomerResult }),
        {
          status: createCustomerResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    customerId = createCustomerResult.id as number | string | undefined;
  }

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "Unable to resolve customer for recurring billing" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Accept Blue requires "expiration" in MMYY format
  const expiryMonth = card.expiry_month ?? card.expiryMonth;
  const expiryYear = card.expiry_year ?? card.expiryYear;
  const expiration: string | undefined = card.expiration
    ?? (expiryMonth && expiryYear
      ? `${String(expiryMonth).padStart(2, "0")}${String(expiryYear).slice(-2)}`
      : undefined);

  if (!expiration) {
    return new Response(
      JSON.stringify({ error: "Missing card expiration from tokenization payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const paymentMethodAttempts: Array<{ label: string; body: Record<string, unknown> }> = [
    {
      label: "source_with_prefixed_nonce",
      body: {
        source: cardSource,
        expiration,
        ...(card.avs_zip ? { avs_zip: card.avs_zip } : {}),
      },
    },
    {
      label: "source_with_raw_nonce",
      body: {
        source: card.nonce || cardSource,
        expiration,
        ...(card.avs_zip ? { avs_zip: card.avs_zip } : {}),
      },
    },
    {
      label: "token_with_customer_id",
      body: {
        token: card.nonce || cardSource,
        customer_id: customerId,
        expiration,
        ...(card.avs_zip ? { avs_zip: card.avs_zip } : {}),
      },
    },
  ];

  let createPaymentMethodResponse: Response | null = null;
  let createPaymentMethodResult: Record<string, unknown> = {};

  console.log("DEBUG: Resolved expiration:", expiration);

  for (let i = 0; i < paymentMethodAttempts.length; i += 1) {
    const attempt = paymentMethodAttempts[i];
    console.log(`DEBUG: Creating payment method [${attempt.label}]`, JSON.stringify(attempt.body));

    const response = await acceptBlueFetch(
      `${ACCEPT_BLUE_BASE}/customers/${customerId}/payment-methods`,
      {
        method: "POST",
        body: JSON.stringify(attempt.body),
      }
    );

    const responseText = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsed = { raw: responseText };
    }

    createPaymentMethodResponse = response;
    createPaymentMethodResult = parsed;

    if (response.ok) {
      break;
    }

    const isLastAttempt = i === paymentMethodAttempts.length - 1;
    if (response.status !== 400 || isLastAttempt) {
      break;
    }
  }

  if (!createPaymentMethodResponse?.ok) {
    console.error("accept.blue create payment method error:", createPaymentMethodResult);
    const paymentMethodError =
      createPaymentMethodResponse?.status === 403
        ? "Accept Blue denied payment method creation for ACCEPT_BLUE_API_SOURCE_KEY. Enable Payment Methods permission for this environment."
        : "Failed to create payment method";
    return new Response(
      JSON.stringify({
        error: paymentMethodError,
        details: createPaymentMethodResult,
      }),
      {
        status: createPaymentMethodResponse?.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const paymentMethodId = createPaymentMethodResult.id;
  if (!paymentMethodId) {
    return new Response(
      JSON.stringify({ error: "Recurring payment method ID missing" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const payload: Record<string, unknown> = {
    amount: Number(amount),
    title: title || "Subscription",
    frequency: mappedFrequency,
    next_run_date: nextDate,
    payment_method_id: paymentMethodId,
    active: true,
  };

  const response = await acceptBlueFetch(`${ACCEPT_BLUE_BASE}/customers/${customerId}/recurring-schedules`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let result: Record<string, unknown>;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = { raw: responseText };
  }

  if (!response.ok) {
    console.error("accept.blue recurring error:", result);
    const recurringError =
      response.status === 403 || response.status === 404
        ? "Accept Blue denied recurring schedule creation for ACCEPT_BLUE_API_SOURCE_KEY. Enable Recurring permission for this environment."
        : "Failed to create recurring schedule";
    return new Response(JSON.stringify({ error: recurringError, details: result }), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const planName = (plan as string) || "basic";
  const planConfig: Record<string, { limit: number; price: number }> = {
    basic: { limit: 100, price: Number(amount) },
    pro: { limit: 500, price: Number(amount) },
    unlimited: { limit: 999999, price: Number(amount) },
  };

  const config = planConfig[planName] || planConfig.basic;

  await supabase
    .from("subscriptions")
    .update({
      plan: planName as "basic" | "pro" | "unlimited",
      recipe_limit: config.limit,
      price_monthly: config.price,
      is_active: true,
      next_billing_date: nextDate,
      payment_method: `accept_blue_schedule:${result.id}`,
    })
    .eq("user_id", user.id);

  return new Response(JSON.stringify({ success: true, schedule: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cancelRecurring(
  body: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const { schedule_id } = body as { schedule_id: string };

  if (!schedule_id) {
    return new Response(
      JSON.stringify({ error: "Missing schedule_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const response = await acceptBlueFetch(
    `${ACCEPT_BLUE_BASE}/recurring-schedules/${schedule_id}`,
    {
      method: "DELETE",
    }
  );

  const resultText = await response.text();

  if (!response.ok) {
    console.error("accept.blue cancel error:", resultText);
    return new Response(
      JSON.stringify({ error: "Failed to cancel schedule" }),
      {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Reset subscription to free
  await supabase
    .from("subscriptions")
    .update({
      plan: "free" as const,
      recipe_limit: 25,
      price_monthly: 0,
      is_active: true,
      next_billing_date: null,
      payment_method: null,
    })
    .eq("user_id", userId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listRecurring(userId: string) {
  // Note: accept.blue doesn't filter by customer on list endpoint,
  // so we rely on our local subscription data for user-specific info
  const response = await acceptBlueFetch(`${ACCEPT_BLUE_BASE}/recurring-schedules`, {
    method: "GET",
  });

  const resultText = await response.text();
  let result: unknown = [];
  if (resultText) {
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { raw: resultText };
    }
  }

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to list recurring schedules", details: result }),
      {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
