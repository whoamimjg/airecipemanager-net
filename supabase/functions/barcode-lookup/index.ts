import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode || typeof barcode !== "string") {
      return new Response(
        JSON.stringify({ error: "Barcode is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up product on Open Food Facts
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      {
        headers: {
          "User-Agent": "AIRecipeManager/1.0 (contact@airecipemanager.com)",
        },
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to query Open Food Facts", found: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return new Response(
        JSON.stringify({ found: false, barcode }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const product = data.product;

    // Map Open Food Facts categories to our inventory categories
    const categoryMap: Record<string, string> = {
      "en:beverages": "Beverages",
      "en:dairy": "Dairy",
      "en:meats": "Meat & Seafood",
      "en:cereals-and-potatoes": "Grains & Pasta",
      "en:snacks": "Snacks",
      "en:canned-foods": "Canned Goods",
      "en:condiments": "Condiments",
      "en:frozen-foods": "Frozen",
      "en:plant-based-foods-and-beverages": "Produce",
    };

    let category = "Other";
    const tags = product.categories_tags || [];
    for (const tag of tags) {
      if (categoryMap[tag]) {
        category = categoryMap[tag];
        break;
      }
    }

    const result = {
      found: true,
      barcode,
      name: product.product_name || product.generic_name || null,
      brand: product.brands || null,
      category,
      quantity_text: product.quantity || null,
      image_url: product.image_front_small_url || product.image_url || null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
