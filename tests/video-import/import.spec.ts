import { test, expect, Page } from '@playwright/test';

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const draft = { title: 'Garlic pasta', description: null, ingredients: [{ name: 'garlic', quantity: 3, unit: 'each', notes: 'minced' }], instructions: [{ text: 'Cook the garlic.', image_url: '' }], prep_time: 0, cook_time: 10, servings: 2, source_url: 'https://www.tiktok.com/@chef/video/123', image_url: null, category: null };

async function setup(page: Page, fail = false) {
  const calls: string[] = [];
  const saved: Record<string, unknown>[] = [];
  await page.addInitScript(({ user }) => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
    localStorage.setItem('sb-puokewpqhparawdcwkbw-auth-token', JSON.stringify({ user, access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' }));
  }, { user });
  // Every Supabase request is mocked: no customer data, real auth, or billable provider calls.
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json', 'Content-Range': '0-0/0' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers, body: '' });
    if (path.includes('/auth/')) return route.fulfill({ headers, json: user });
    if (path.includes('/functions/v1/')) {
      calls.push(path.split('/').at(-1)!);
      await new Promise(resolve => setTimeout(resolve, 250));
      if (fail) return route.fulfill({ status: 429, headers, json: { success: false, code: 'daily_limit', error: 'You have reached today’s video import limit. Try again tomorrow.' } });
      return route.fulfill({ headers, json: { success: true, recipe: draft } });
    }
    if (path.endsWith('/recipes') && req.method() === 'POST') {
      saved.push(req.postDataJSON());
      return route.fulfill({ status: 201, headers, body: '' });
    }
    if (path.endsWith('/profiles')) return route.fulfill({ headers, json: { user_id: user.id, display_name: 'Test cook', timezone: 'UTC' } });
    if (path.endsWith('/subscriptions')) return route.fulfill({ headers, json: { plan: 'free', recipe_limit: 25 } });
    return route.fulfill({ headers, json: [] });
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Import URL', exact: true }).click();
  return { calls, saved };
}

test('paste video, extract, review, edit and save through existing form', async ({ page }) => {
  const state = await setup(page);
  await page.getByPlaceholder('https://www.allrecipes.com/recipe/...').fill(draft.source_url);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Extracting...' })).toBeDisabled();
  await expect(page.getByPlaceholder('Recipe name')).toBeVisible();
  expect(state.calls).toEqual(['extract-video-recipe']); expect(state.saved).toHaveLength(0);
  await page.getByPlaceholder('Recipe name').fill('Reviewed garlic pasta');
  await page.getByRole('button', { name: 'Save Recipe', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Recipes', exact: true })).toBeVisible();
  expect(state.saved).toHaveLength(1);
  expect(state.saved[0]).toMatchObject({ title: 'Reviewed garlic pasta', source_url: draft.source_url, prep_time: 0, user_id: user.id, ingredients: [{ name: 'garlic', quantity: '3', unit: 'each', notes: 'minced' }] });
});

test('ordinary website import still uses scrape-recipe', async ({ page }) => {
  const state = await setup(page);
  await page.getByPlaceholder('https://www.allrecipes.com/recipe/...').fill('https://www.allrecipes.com/recipe/123');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByPlaceholder('Recipe name')).toBeVisible();
  expect(state.calls).toEqual(['scrape-recipe']); expect(state.saved).toHaveLength(0);
});

test('shows actionable extraction error without saving', async ({ page }) => {
  const state = await setup(page, true);
  await page.getByPlaceholder('https://www.allrecipes.com/recipe/...').fill(draft.source_url);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('You have reached today’s video import limit. Try again tomorrow.', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeEnabled(); expect(state.saved).toHaveLength(0);
});
