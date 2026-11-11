import { mapRecipe, videoUrl } from './recipe.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After, X-Request-Id',
};
const messages: Record<string, string> = {
  invalid_url: 'Paste a valid HTTPS TikTok or Instagram post link.',
  platform_unsupported: 'Use a TikTok video link or an Instagram post or reel link.',
  unauthorized: 'Please sign in again to import a video recipe.',
  no_recipe_found: 'No usable recipe was found in this post. Try another post or add it manually.',
  multiple_recipes_detected: 'This post contains several recipes. Try a post with one recipe or add it manually.',
  post_unavailable: 'This post is private, deleted, or unavailable. Try a public post.',
  rate_limited: 'Too many imports. Wait a minute before trying again.',
  daily_limit: 'You have reached today’s video import limit. Try again tomorrow.',
  in_progress: 'A video import is already running. Please wait before trying again.',
  quota_exceeded: 'Video imports have reached the shared usage allowance. Please try again later.',
  timeout: 'Extraction took too long. Please wait a moment before trying again.',
  unavailable: 'Video extraction is temporarily unavailable. Please try again later.',
};

// Bound streamed bodies even if Content-Length is missing or false.
async function readJson(response: Request | Response, limit: number): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('body_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_body');
  return parsed;
}

type Dependencies = { env: (key: string) => string | undefined; fetch: typeof fetch; uuid: () => string };
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const requestId = deps.uuid();
    const respond = (status: number, body: object, retryAfter?: number) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-Id': requestId,
        ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
    });
    const fail = (status: number, code: string, retryAfter?: number) => respond(status,
      { success: false, code, error: messages[code] ?? messages.unavailable, request_id: requestId, ...(retryAfter ? { retry_after: retryAfter } : {}) }, retryAfter);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'invalid_request');
    const authorization = req.headers.get('Authorization');
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail(401, 'unauthorized');
    const base = deps.env('SUPABASE_URL');
    const anon = deps.env('SUPABASE_ANON_KEY');
    const service = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = deps.env('CLIPPARSE_API_KEY');
    if (!base || !anon || !service || !apiKey) return fail(503, 'unavailable');
    let reserved = false;
    const rpc = async (name: string, body: object) => {
      const result = await deps.fetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) throw new Error('database_unavailable');
      return readJson(result, 16000);
    };
    try {
      const auth = await deps.fetch(`${base}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if (auth.status === 401 || auth.status === 403) return fail(401, 'unauthorized');
      if (!auth.ok) return fail(503, 'unavailable');
      const user = await readJson(auth, 65536);
      if (typeof user.id !== 'string' || user.is_anonymous === true) return fail(401, 'unauthorized');
      let body: Record<string, unknown>;
      try { body = await readJson(req, 4096); } catch { return fail(400, 'invalid_url'); }
      let url: string;
      try { url = videoUrl(body.url); } catch (e) { return fail(400, (e as Error).message); }
      const allowance = await rpc('reserve_video_import', { p_user_id: user.id, p_request_id: requestId });
      if (allowance.allowed !== true) {
        const code = typeof allowance.code === 'string' && allowance.code in messages ? allowance.code : 'unavailable';
        return fail(code === 'unavailable' ? 503 : 429, code, typeof allowance.retry_after === 'number' ? allowance.retry_after : undefined);
      }
      reserved = true;
      const upstream = await deps.fetch('https://api.clipparse.com/v1/extract', {
        method: 'POST', headers: { 'X-API-Key': apiKey, 'X-Request-Id': requestId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), signal: AbortSignal.timeout(80000), redirect: 'error',
      });
      const data = await readJson(upstream, 512000);
      if (upstream.status === 429) {
        const seconds = Number(upstream.headers.get('Retry-After'));
        return fail(429, data.code === 'quota_exceeded' ? 'quota_exceeded' : 'rate_limited',
          Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 86400) : 60);
      }
      if (upstream.status === 404) return fail(404, 'post_unavailable');
      if (upstream.status === 400 || upstream.status === 422) return fail(400, 'platform_unsupported');
      if (!upstream.ok) return fail(503, 'unavailable');
      if (data.status === 'no_recipe') return fail(422, data.code === 'multiple_recipes_detected' ? 'multiple_recipes_detected' : 'no_recipe_found');
      if (data.status !== 'success') return fail(503, 'unavailable');
      return respond(200, { success: true, recipe: mapRecipe(data.recipe, url), request_id: requestId });
    } catch (error) {
      // Never expose upstream bodies, credentials, or submitted URLs in errors/logs.
      return fail(503, error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'unavailable');
    } finally {
      if (reserved) {
        // Reservations remain charged even after ambiguous timeouts; only the concurrency lease is released.
        try { await rpc('finish_video_import', { p_request_id: requestId }); } catch { /* lease expires automatically */ }
      }
    }
  };
}
