import { supabase } from '@/integrations/supabase/client';

const hosts = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'instagram.com', 'www.instagram.com', 'm.instagram.com']);
export function isVideoRecipeUrl(value: string): boolean {
  try { return hosts.has(new URL(value.trim()).hostname.toLowerCase()); } catch { return false; }
}

export interface ImportedVideoRecipe {
  title: string;
  description: string | null;
  ingredients: Array<{ heading: string } | { name: string; quantity: number | string; unit: string; notes: string }>;
  instructions: Array<{ heading: string } | { text: string; image_url: string }>;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  source_url: string;
  image_url: string | null;
  category: string | null;
}

export async function importVideoRecipe(url: string): Promise<ImportedVideoRecipe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100000);
  try {
    const { data, error } = await supabase.functions.invoke('extract-video-recipe', {
      body: { url }, signal: controller.signal,
    });
    if (error) {
      // FunctionsHttpError contains the server's safe, actionable error envelope.
      if (error.context instanceof Response) {
        const body = await error.context.json().catch(() => null);
        if (typeof body?.error === 'string') throw new Error(body.error);
      }
      throw new Error('Video extraction is unavailable. Please try again later.');
    }
    if (!data?.success || !data.recipe) throw new Error(data?.error || 'No recipe was found in this post.');
    return data.recipe;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Extraction took too long. Please wait a moment before trying again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
