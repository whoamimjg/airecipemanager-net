# Video recipe import

TikTok and Instagram links use `extract-video-recipe`. Other website imports continue to use
`scrape-recipe`; photo scanning is unchanged. The extractor returns a draft only. The website's
RecipeForm and mobile AddRecipeScreen handle review, editing, and saving with the existing
recipes table, RLS, and recipe plan limits.

## Backend

Project: `puokewpqhparawdcwkbw` (confirmed against both clients and the deployed functions).
Deploy only the new function and migration; do not replace `scrape-recipe`.

`CLIPPARSE_API_KEY` is read from Edge Function Secrets and sent only to
`https://api.clipparse.com/v1/extract` in `X-API-Key`. It never reaches a client or response.
The function uses the caller's bearer token with Auth `/user` to validate identity, rejects
anonymous users, and uses its service role solely for the import ledger RPCs. Recipe writes
remain client operations governed by their existing RLS and plan-limit trigger.

The migration revokes all client access to metering tables and RPCs, enables RLS, and uses
SECURITY INVOKER functions with a locked singleton settings row to serialize reservations.
No submitted URL, extracted recipe, or API key is stored in the ledger.

## Limits

Initial settings are 3 attempts per rolling minute, 10 per UTC day, one in-flight request per
user, and a shared 100-credit cap per UTC calendar month. These are extraction limits,
separate from saved-recipe plan limits, shared across all clients.

Every accepted attempt permanently reserves 4 credits, the maximum documented extraction
cost. Errors/no-recipe results/timeouts count as attempts locally even when ClipParse charges
nothing; successful cached/caption imports may cost only 1 credit. This intentionally
conservative cap allows at most 25 upstream attempts per month initially. It does not mirror
ClipParse's billing renewal date. There are no automatic retries that could duplicate charges.
Requests release the concurrency lease on completion; interrupted invocations expire after
120 seconds. Old ledger rows must not be deleted during an active accounting period.

An operator can adjust limits or pause video imports without a client update:

```sql
update public.video_import_settings
set per_minute = 3, per_day = 10, monthly_credit_cap = 100
where id = true;
-- Emergency pause:
update public.video_import_settings set enabled = false where id = true;
```

Keep this cap within the provider account's allowance/budget. The cap covers calls through
this function only, not other consumers of the same API key.

## Contract and failures

Input: `{ "url": "https://www.tiktok.com/@chef/video/123" }` plus a signed-in user JWT.
Only HTTPS post/reel and known short-link forms on explicitly allowed hosts are accepted.
The server never follows arbitrary user URLs itself; provider redirects are disabled.

Success: `{ success: true, recipe: { title, ingredients, instructions, prep_time, cook_time,
servings, source_url, image_url, category }, request_id }`. Ingredients/instructions use the
existing structured rows and section headings. Fractional servings are retained as yield text
because the recipes table uses integer servings. Unspecified fields stay empty for review.

Failures have `success: false`, stable `code`, safe `error`, `request_id`, and optional
`retry_after` / `Retry-After`. The clients show the server's message for no recipe, multiple
recipes, private/unavailable posts, auth failures, limits, timeouts, and provider outages.
No upstream response body is exposed. ClipParse API docs: https://docs.clipparse.com/.

## Verification

- `npm test` — server contract/auth/error handling and routing tests plus existing tests.
- `npm run build` and `npx tsc --noEmit -p tsconfig.app.json`.
- `npx playwright test --config playwright.video.config.ts` — mocked full-app paste →
  extract → edit → save, website-import regression, and error states. Install Playwright
  Chromium first or set `CHROMIUM_PATH` to a system Chromium executable.
- `supabase/tests/video_import_limits.sql` — rollback-only concurrency, rate, daily cap,
  shared budget, kill-switch and privilege checks. Requires an existing Auth user with no
  imports today; it leaves no settings/attempt changes.
- Mobile: `./gradlew :sharedLogic:testAndroidHostTest :sharedUI:compileAndroidMain`.
- On real Android/iOS devices, test paste and sharing from TikTok/Instagram, signed-out
  handoff, cold/warm launch, editor cancellation, save, and an unavailable/private post.
- iOS requires Xcode, valid App Group provisioning for both targets, and real-device checks.
  See `iosApp/ShareExtension/SETUP.md` in the mobile repository.

The deployed function's auth boundary and configured-secret presence were smoke-tested without
spending provider credits. A successful real-provider extraction still needs a signed-in
user and representative public links; automated browser tests mock all remote API calls.
