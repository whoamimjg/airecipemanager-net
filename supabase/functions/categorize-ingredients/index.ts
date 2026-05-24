import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "Produce",
  "Meats",
  "Dairy",
  "Beverages",
  "Cereal",
  "Dry Goods",
  "Canned Goods",
  "Bread",
  "Frozen",
  "Snacks",
  "Condiments & Spices",
  "Other",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: "ingredients array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Categorize each ingredient into exactly one grocery store aisle category.

Categories: ${CATEGORIES.join(", ")}

Rules:
- "Produce" = fresh fruits, vegetables, herbs (fresh basil, cilantro, parsley, ginger root)
- "Meats" = all raw/fresh meat, poultry, fish, seafood (chicken, beef, salmon, shrimp, bacon, sausage)
- "Dairy" = milk, cheese, butter, cream, eggs, yogurt
- "Beverages" = drinks, juices, sodas, coffee, tea, water, wine, beer
- "Cereal" = breakfast cereals, oats, granola
- "Dry Goods" = rice, basmati rice, pasta, noodles, quinoa, couscous, flour, sugar, baking supplies, nuts, seeds, dried fruits, bouillon, cornstarch, baking powder/soda, cocoa, chocolate chips, dried beans, lentils
- "Canned Goods" = canned/jarred items, broth, stock, canned beans, canned tomatoes, coconut milk (canned)
- "Bread" = bread, buns, rolls, tortillas, pita, naan, bagels, wraps
- "Frozen" = frozen foods, ice cream, frozen vegetables, frozen pizza
- "Snacks" = chips, crackers, pretzels, popcorn, cookies, candy, snack bars, trail mix, jerky, fruit snacks
- "Condiments & Spices" = all spices, seasonings, dried herbs, salt, pepper, oils, vinegars, sauces, dressings, honey, syrups, mustard, ketchup, mayo, hot sauce, soy sauce, extracts
- "Other" = anything that doesn't fit above (cleaning supplies, paper goods, etc.)

Important: Spice names that sound like produce (e.g. "cayenne pepper", "garlic powder", "onion powder") are "Condiments & Spices", NOT "Produce".

Ingredients to categorize:
${ingredients.map((name: string, i: number) => `${i + 1}. ${name}`).join("\n")}

Respond with ONLY a JSON array of objects with "name" and "category" fields. No explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a grocery categorization expert. Respond only with valid JSON. Use short category names only, do not repeat the full ingredient text." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI categorization failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Try to parse, recovering from truncated arrays
    let categorized: any[] | null = null;
    try {
      categorized = JSON.parse(cleaned);
    } catch {
      const startIdx = cleaned.indexOf("[");
      const sliced = startIdx >= 0 ? cleaned.slice(startIdx) : cleaned;
      try {
        categorized = JSON.parse(sliced);
      } catch {
        // Extract individual complete objects from a possibly-truncated array
        const objects: any[] = [];
        const objRegex = /\{[^{}]*\}/g;
        let m;
        while ((m = objRegex.exec(sliced)) !== null) {
          try { objects.push(JSON.parse(m[0])); } catch { /* skip */ }
        }
        if (objects.length > 0) categorized = objects;
      }
    }

    if (!categorized || !Array.isArray(categorized)) {
      console.error("Could not parse AI response:", content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse categorization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a map for easy lookup
    const categoryMap: Record<string, string> = {};
    for (const item of categorized) {
      const name = (item.name || "").toLowerCase().trim();
      const cat = CATEGORIES.includes(item.category) ? item.category : "Other";
      if (name) categoryMap[name] = cat;
    }

    return new Response(
      JSON.stringify({ categories: categoryMap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
