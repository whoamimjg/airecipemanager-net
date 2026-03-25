const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping recipe from:', formattedUrl);

    // Use Firecrawl with JSON extraction to get structured recipe data
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'extract'],
        onlyMainContent: true,
        extract: {
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Recipe title/name' },
              description: { type: 'string', description: 'Brief recipe description or summary' },
              ingredients: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of ingredients with quantities',
              },
              instructions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Step-by-step cooking instructions',
              },
              prep_time: { type: 'number', description: 'Prep time in minutes' },
              cook_time: { type: 'number', description: 'Cook time in minutes' },
              servings: { type: 'number', description: 'Number of servings' },
              category: { type: 'string', description: 'Recipe category like Dinner, Dessert, Breakfast, etc.' },
              image_url: { type: 'string', description: 'Main recipe image URL' },
            },
            required: ['title', 'ingredients', 'instructions'],
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Failed to scrape recipe' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract recipe from JSON extraction or fallback to markdown
    const recipe = data.data?.extract || data.extract;

    if (!recipe || !recipe.title) {
      // Fallback: return markdown for manual parsing
      return new Response(
        JSON.stringify({
          success: true,
          recipe: null,
          markdown: data.data?.markdown || data.markdown,
          message: 'Could not auto-extract recipe. Raw content returned.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Recipe extracted:', recipe.title);

    return new Response(
      JSON.stringify({
        success: true,
        recipe: {
          title: recipe.title || '',
          description: recipe.description || '',
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || [],
          prep_time: recipe.prep_time || null,
          cook_time: recipe.cook_time || null,
          servings: recipe.servings || null,
          category: recipe.category || null,
          image_url: recipe.image_url || null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping recipe:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
