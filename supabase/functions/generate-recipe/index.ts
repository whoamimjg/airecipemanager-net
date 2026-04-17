import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { inventory, preferences, mode, dietRestrictions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const restrictions: string[] = Array.isArray(dietRestrictions) ? dietRestrictions : [];
    const restrictionsBlock =
      restrictions.length > 0
        ? `\n\nCRITICAL DIETARY RESTRICTIONS & ALLERGIES (MUST be strictly respected — never include these ingredients or any derivatives, oils, or trace sources):\n${restrictions
            .map((r) => `- ${r}`)
            .join("\n")}\n\nIf an inventory item conflicts with a restriction, DO NOT use it. Allergy entries (e.g. "Peanut Allergy", "Tree Nut Allergy", "Sesame Allergy") mean the user can have a severe reaction — exclude all forms of that ingredient including oils, flours, butters, and cross-contamination risks.`
        : "";

    let systemPrompt = `You are a creative, professional chef AI. You generate delicious, practical recipes.
Always respond with valid JSON matching this exact structure:
{
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "Brief appealing description",
      "category": "Main Course|Appetizer|Dessert|Breakfast|Snack|Side Dish|Soup|Salad|Beverage",
      "prep_time": 15,
      "cook_time": 30,
      "servings": 4,
      "ingredients": [{"name": "ingredient", "amount": "1 cup", "available": true}],
      "instructions": ["Step 1...", "Step 2..."],
      "tags": ["quick", "healthy"],
      "missing_ingredients": ["ingredient not in inventory"]
    }
  ]
}
Mark each ingredient's "available" field as true if it's in the user's inventory, false if not.
List any ingredients not in the inventory under "missing_ingredients".${restrictionsBlock}`;

    let userPrompt = "";

    if (mode === "from_inventory") {
      const inventoryList = (inventory || [])
        .map((i: any) => `${i.name} (${i.quantity} ${i.unit || "pcs"}, stored in ${i.storage_location})`)
        .join("\n");

      userPrompt = `Here's what I have in my kitchen:\n${inventoryList}\n\n${
        preferences ? `Preferences: ${preferences}\n\n` : ""
      }Generate 3 creative recipes I can make with these ingredients. Minimize missing ingredients. Prioritize items expiring soon if any.`;
    } else if (mode === "custom") {
      userPrompt = `${preferences}\n\nGenerate 2-3 recipes based on this request. If I provided inventory, use those ingredients when possible.`;
      if (inventory?.length) {
        const inventoryList = (inventory || [])
          .map((i: any) => `${i.name} (${i.quantity} ${i.unit || "pcs"})`)
          .join(", ");
        userPrompt += `\n\nAvailable ingredients: ${inventoryList}`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_recipes",
              description: "Return generated recipes",
              parameters: {
                type: "object",
                properties: {
                  recipes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        category: { type: "string" },
                        prep_time: { type: "number" },
                        cook_time: { type: "number" },
                        servings: { type: "number" },
                        ingredients: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              amount: { type: "string" },
                              available: { type: "boolean" },
                            },
                            required: ["name", "amount", "available"],
                          },
                        },
                        instructions: { type: "array", items: { type: "string" } },
                        tags: { type: "array", items: { type: "string" } },
                        missing_ingredients: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "description", "category", "prep_time", "cook_time", "servings", "ingredients", "instructions", "tags", "missing_ingredients"],
                    },
                  },
                },
                required: ["recipes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_recipes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Failed to generate recipes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Unexpected AI response format" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipes = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(recipes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-recipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
