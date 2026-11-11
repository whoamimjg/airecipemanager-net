// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { mapRecipe, videoUrl } from '../supabase/functions/extract-video-recipe/recipe';
import { createHandler } from '../supabase/functions/extract-video-recipe/handler';

const url = 'https://www.tiktok.com/@chef/video/123';
const recipe = {
  title: 'Garlic pasta', servings: 2, prepTimeMinutes: 0, cookTimeMinutes: 10,
  ingredients: [{ name: 'garlic', quantity: 3, unit: 'each', prep: 'minced', section: 'Sauce' }],
  steps: [{ text: 'Cook the garlic.', section: 'Sauce', durationMinutes: 2 }], thumbnailUrl: 'https://cdn.example.com/pasta.jpg',
};
function setup(outcome: object = { status: 'success', recipe }, status = 200, reserve = { allowed: true }) {
  const calls: string[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const target = String(input); calls.push(target);
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' });
    if (target.endsWith('/reserve_video_import')) return Response.json(reserve);
    if (target.endsWith('/finish_video_import')) return Response.json({ finished: true });
    expect(target).toBe('https://api.clipparse.com/v1/extract');
    expect(new Headers(init?.headers).get('X-API-Key')).toBe('secret');
    expect(JSON.parse(String(init?.body))).toEqual({ url });
    return Response.json(outcome, { status, headers: { 'Retry-After': '120' } });
  });
  const handler = createHandler({ env: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', CLIPPARSE_API_KEY: 'secret' })[key], fetch: fetcher as typeof fetch, uuid: () => 'request-1' });
  const request = (body: object = { url }, auth = true) => new Request('https://test/import', {
    method: 'POST', headers: auth ? { Authorization: 'Bearer user-token' } : {}, body: JSON.stringify(body),
  });
  return { handler, request, calls, fetcher };
}

describe('server URL boundary', () => {
  it.each(['https://vm.tiktok.com/abc/', 'https://www.tiktok.com/t/ABC/', 'https://instagram.com/reel/abc_123/'])('accepts public post form %s', value => expect(videoUrl(value)).toBe(value));
  it.each(['http://www.tiktok.com/@a/video/1', 'https://www.tiktok.com.evil.test/@a/video/1', 'https://user:pass@instagram.com/p/abc/', 'https://instagram.com:444/p/abc/', 'https://instagram.com/profile/', 'https://127.0.0.1/', 'file:///etc/passwd'])('rejects %s', value => expect(() => videoUrl(value)).toThrow());
});
describe('existing recipe shape', () => {
  it('preserves structured ingredients, headings, notes, zero times, and source', () => {
    expect(mapRecipe(recipe, url)).toMatchObject({ prep_time: 0, servings: 2, source_url: url,
      ingredients: [{ heading: 'Sauce' }, { name: 'garlic', quantity: 3, unit: 'each', notes: 'minced' }],
      instructions: [{ heading: 'Sauce' }, { text: 'Cook the garlic.', image_url: '' }],
    });
  });
  it('preserves unquantified source notes', () => expect(mapRecipe({ ...recipe, ingredients: [{ name: 'salt', quantity: null, raw: 'salt to taste' }] }, url).ingredients[0]).toMatchObject({ notes: 'salt to taste' }));
  it('keeps fractional yield visible without coercing integer database columns', () => expect(mapRecipe({ ...recipe, servings: 2.5 }, url)).toMatchObject({ servings: null, description: 'Yield: 2.5 servings' }));
  it.each([{ ...recipe, ingredients: [] }, { ...recipe, steps: [{}] }, { ...recipe, prepTimeMinutes: -1 }])('rejects malformed provider recipes', value => expect(() => mapRecipe(value, url)).toThrow());
});
describe('authenticated extraction', () => {
  it('rejects unsigned requests without spending credits', async () => {
    const s = setup(); expect((await s.handler(s.request({ url }, false))).status).toBe(401); expect(s.calls).toHaveLength(0);
  });
  it('rejects invalid URLs before reserving credits', async () => {
    const s = setup(); expect((await s.handler(s.request({ url: 'https://evil.test/' }))).status).toBe(400); expect(s.calls).toHaveLength(1);
  });
  it('returns a draft without writing a recipe and releases the concurrency lease', async () => {
    const s = setup(); const result = await s.handler(s.request());
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ success: true, recipe: { title: recipe.title } });
    expect(s.calls).toHaveLength(4); expect(s.calls.at(-1)).toContain('finish_video_import');
  });
  it('stops at the atomic usage gate', async () => {
    const s = setup({}, 200, { allowed: false, code: 'daily_limit', retry_after: 60 } as never);
    const result = await s.handler(s.request()); expect(result.status).toBe(429); expect(result.headers.get('Retry-After')).toBe('60'); expect(s.calls).toHaveLength(2);
  });
  it.each([
    [200, { status: 'no_recipe', code: 'no_recipe_found' }, 422, 'no_recipe_found'],
    [200, { status: 'no_recipe', code: 'multiple_recipes_detected' }, 422, 'multiple_recipes_detected'],
    [404, { status: 'error' }, 404, 'post_unavailable'],
    [429, { status: 'error', code: 'quota_exceeded' }, 429, 'quota_exceeded'],
    [401, { message: 'secret provider error' }, 503, 'unavailable'],
    [500, { message: 'secret provider error' }, 503, 'unavailable'],
    [200, { status: 'success', recipe: {} }, 503, 'unavailable'],
  ])('maps provider outcome %s safely', async (status, body, expectedStatus, code) => {
    const s = setup(body, status); const result = await s.handler(s.request());
    expect(result.status).toBe(expectedStatus); const text = await result.text(); expect(JSON.parse(text).code).toBe(code);
    expect(text).not.toContain('secret'); expect(s.calls.at(-1)).toContain('finish_video_import');
  });
  it('fails closed if quota storage is unavailable', async () => {
    const s = setup(); s.fetcher.mockImplementation(async target => String(target).endsWith('/auth/v1/user') ? Response.json({ id: 'user-1' }) : new Response('down', { status: 500 }));
    expect((await s.handler(s.request())).status).toBe(503); expect(s.fetcher).toHaveBeenCalledTimes(2);
  });
  it('releases the lease after a timeout without retrying the billed provider call', async () => {
    const s = setup(); s.fetcher.mockImplementation(async target => {
      if (String(target).includes('clipparse.com')) throw new DOMException('timeout', 'TimeoutError');
      return Response.json(String(target).includes('/auth/') ? { id: 'user-1' } : { allowed: true });
    });
    const result = await s.handler(s.request()); expect((await result.json()).code).toBe('timeout'); expect(s.fetcher).toHaveBeenCalledTimes(4);
  });
});
