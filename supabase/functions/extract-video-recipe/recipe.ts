/** Shared server contract: the same structured rows accepted by RecipeForm / AddRecipeScreen. */
export function videoUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2083) throw new Error('invalid_url');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('invalid_url'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('invalid_url');
  const host = url.hostname.toLowerCase();
  const tikTok = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(host) &&
    /^\/@[^/]+\/(video|photo)\/\d+\/?$/.test(url.pathname);
  const shortTikTok = ['vm.tiktok.com', 'vt.tiktok.com'].includes(host) && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
  const shortTikTokShare = ['tiktok.com', 'www.tiktok.com'].includes(host) && /^\/t\/[A-Za-z0-9]+\/?$/.test(url.pathname);
  const instagram = ['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host) &&
    /^\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  if (!tikTok && !shortTikTok && !shortTikTokShare && !instagram) throw new Error('platform_unsupported');
  url.hash = '';
  // Keep query parameters: some platform share links require them to resolve.
  return url.href;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 5000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('invalid_response');
  return value.trim();
}
function optionalText(value: unknown): string { return value == null ? '' : text(value); }
function number(value: unknown, integer = false): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000 || (integer && !Number.isInteger(value))) throw new Error('invalid_response');
  return value;
}
export function mapRecipe(value: unknown, sourceUrl: string) {
  const r = object(value);
  if (!Array.isArray(r.ingredients) || !r.ingredients.length || r.ingredients.length > 200 ||
      !Array.isArray(r.steps) || !r.steps.length || r.steps.length > 200) throw new Error('invalid_response');
  let section = '';
  const ingredients: Array<Record<string, string | number>> = [];
  for (const item of r.ingredients) {
    const i = object(item);
    const heading = optionalText(i.section);
    if (heading && heading !== section) ingredients.push({ heading });
    section = heading;
    const name = text(i.name);
    const quantity = number(i.quantity);
    const raw = optionalText(i.raw);
    const notes = optionalText(i.prep) || (quantity == null && raw !== name ? raw : '');
    ingredients.push({ name, quantity: quantity ?? '', unit: optionalText(i.unit), notes });
  }
  section = '';
  const instructions: Array<Record<string, string>> = [];
  for (const item of r.steps) {
    const s = object(item);
    const heading = optionalText(s.section);
    if (heading && heading !== section) instructions.push({ heading });
    section = heading;
    instructions.push({ text: text(s.text), image_url: '' });
  }
  let image: string | null = null;
  if (typeof r.thumbnailUrl === 'string') {
    try { const u = new URL(r.thumbnailUrl); if (u.protocol === 'https:' && !u.username && !u.password) image = u.href; } catch { /* thumbnail is optional */ }
  }
  // recipes.servings is an integer; keep fractional yield visible for review without rounding it.
  const servings = number(r.servings);
  return {
    title: text(r.title, 500), description: servings != null && !Number.isInteger(servings) ? `Yield: ${servings} servings` : null,
    ingredients, instructions, prep_time: number(r.prepTimeMinutes, true), cook_time: number(r.cookTimeMinutes, true),
    servings: servings != null && Number.isInteger(servings) ? servings : null,
    source_url: sourceUrl, image_url: image, category: null,
  };
}
