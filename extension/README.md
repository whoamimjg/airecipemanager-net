# Chrome extension: Shop my list

A Manifest V3 extension with a side panel that puts the user's AI Recipe Manager grocery list
into **any** grocery store's online cart. It stops at the cart. It never checks out, never types
passwords or payment details, never solves bot checks, and never removes anything from the list.

## How it works on a store it has never seen

1. **Sign-in** is OAuth 2.1 + PKCE against Supabase Auth's OAuth server (public client, no secret),
   through `chrome.identity.launchWebAuthFlow`. The user approves on airecipemanager.com/oauth/consent.
2. **The list** comes from the MCP server (`functions/v1/mcp`) over plain JSON-RPC
   (`tools/call get_shopping_list`). The run ends with `report_shopping_result`, which ticks the
   added items off the user's list. Same data path as Claude and the MCP skill.
3. **The store page** is handled by the content script `src/content/engine.ts`, injected on demand
   into the store tab (the extension asks for that origin's permission when Start is pressed):
   - **Built-in adapter** (`src/shared/stores.ts`): search/cart URL templates and, for the big
     chains, tile selectors from their `data-testid`s. Missing fields fall through to heuristics.
   - **Learned adapter** (`store_adapters` table): selectors the AI inferred from a page outline
     the first time someone shopped that host, or that a user taught by clicking the search box
     and one Add button ("Teach this store"). Taught beats learned; learned never overwrites taught.
   - **Heuristics**: every visible control labelled Add / Add to cart (never Checkout, Buy, Pay,
     Subscribe, Sign in…) is a tile; the tile is the widest ancestor holding only that one add
     control; name comes from the add button's own label, a heading, the longest link or the
     image alt; price, size and unit price are regexes over the tile text; schema.org JSON-LD
     fills brand/price when present. Verified on Meijer, Giant Eagle and Walmart with no
     store-specific code (15 tiles each).
4. **Choosing the product**: with the AI switch on, `shop-assist` (`action: pick`) sends the one
   item plus the tiles to Gemini through OpenRouter. Off, `src/shared/match.ts` ranks tiles by
   word coverage, size fit, pack size, availability and diet keywords, and only adds when the
   top score is believable. Diet restrictions from the profile apply either way.
5. **Adding** clicks the tile's add control and confirms by watching the cart badge, the button
   label, a quantity stepper, or an "added to cart" toast. Unconfirmed adds are reported as such.
6. **Walls**: a press-and-hold / CAPTCHA page, or a "Sign in to add" store, stops the run with a
   message; the user clears it and presses Continue. Checkout pages are never navigated to.

## Backend pieces

- `supabase/functions/shop-assist` (`verify_jwt = false`, validates the bearer itself; signed-in
  users only): `pick`, `infer_selectors`, `get_adapter`, `save_adapter`.
- `supabase/migrations/20261014120000_store_adapters.sql`: host → selectors, read by signed-in
  users, written only by the function (service role).

## Build and load

```bash
npm run build:extension     # → extension/dist
npm run check:extension     # tsc type-check
```

Load it unpacked: chrome://extensions → Developer mode → Load unpacked → `extension/dist`.
The manifest carries the public key, so the unpacked id is always
`dillgnbahmjedhhgihmefdbgaknenhgh`, which is what the OAuth client's redirect URI expects.
Private key: `~/keystores/airecipemanager-extension.pem` (not in git); OAuth client id
`1c76f628-c1af-4f4e-aaae-afa37ca6fb72`.

Publishing needs a Chrome Web Store developer account ($5 one-time). Store listing copy must
keep the plan rule (plans only change how many recipes you can save) and the never-checkout rule.

## Testing a store without loading the extension

Build, then paste a minified copy of `dist/content.js` into the store page's console with a stub
`chrome.runtime.onMessage` (the harness used on 2026-10-14 lived in the scratchpad); call the
handler with `{type:"collect"}`. Store CSPs block fetching scripts from localhost, so paste.
Target shows a press-and-hold check to a fresh browser profile; Kroger shows "Sign In to Add"
when signed out — both are detected and reported, not bypassed.
