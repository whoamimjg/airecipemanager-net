import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_TIMEOUT_MS = 40_000;

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const file_base64: string | undefined = body.file_base64 ?? body.image_base64;
    const mime_type: string = body.mime_type ?? "image/jpeg";
    const receipt_text: string | undefined = body.receipt_text;

    if ((!file_base64 || typeof file_base64 !== "string") && (!receipt_text || typeof receipt_text !== "string")) {
      return new Response(
        JSON.stringify({ error: "file_base64 or receipt_text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Analyze this grocery receipt image and extract all items with their details.

Return a JSON object with this exact structure:
{
  "store_name": "Store name if visible, or null",
  "receipt_date": "YYYY-MM-DD format if visible, or null",
  "items": [
    {
      "name": "Item name (clean, readable product name)",
      "category": "One of: Produce, Dairy, Meat & Seafood, Grains & Pasta, Canned Goods, Spices & Seasonings, Baking, Snacks, Beverages, Condiments, Frozen, Oils & Vinegars, Other",
      "quantity": 1,
      "unit": "pcs, lbs, oz, gal, etc.",
      "price": 3.99
    }
  ],
  "subtotal": null,
  "tax": null,
  "total": null
}

Important:
- Extract every line item from the receipt
- Clean up abbreviated names to be readable (e.g. "ORG BNS CKEN" -> "Organic Boneless Chicken")
- Categorize each item into the most appropriate category
- Price should be the total price for that line item
- If quantity > 1 is shown, include it; otherwise default to 1
- Include subtotal, tax, and total if visible
- EXCLUDE non-food items such as: coupons, discounts, loyalty rewards, store perks, bag fees, bottle deposits, gift cards, cash back, savings lines, tax lines, subtotal lines, membership fees, and any other non-grocery items
- Only include actual food/grocery products that were purchased
- Return ONLY valid JSON, no markdown or explanation`;

    const userContent = receipt_text
      ? [
          { type: "text", text: `${prompt}\n\nReceipt text:\n${receipt_text.slice(0, 60_000)}` },
        ]
      : [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mime_type};base64,${file_base64}` },
          },
        ];

    const response = await withTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        response_format: { type: "json_object" },
      }),
    }, AI_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process receipt image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse receipt data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Receipt scan error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
