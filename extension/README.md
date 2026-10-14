# Chrome extension (not built yet)

Planned: a Manifest V3 extension with a side panel that shops the user's AI Recipe Manager
grocery list at their store, adds items to the cart, reports back through the MCP server, and
stops at the cart. It never completes a purchase.

Already prepared (2026-10-14):

- Stable extension id: `dillgnbahmjedhhgihmefdbgaknenhgh`. Put the contents of
  `.extension-public-key` in the manifest's `"key"` field so an unpacked install gets this id.
  The matching private key is in `~/keystores/airecipemanager-extension.pem` (not in git).
- OAuth client on the Supabase OAuth 2.1 server (public, PKCE, no secret):
  client_id `1c76f628-c1af-4f4e-aaae-afa37ca6fb72`,
  redirect `https://dillgnbahmjedhhgihmefdbgaknenhgh.chromiumapp.org/`.
  Authorize at `https://puokewpqhparawdcwkbw.supabase.co/auth/v1/oauth/authorize`,
  token at `.../auth/v1/oauth/token`, consent page is airecipemanager.com/oauth/consent.
- Data: call the MCP server at `https://puokewpqhparawdcwkbw.supabase.co/functions/v1/mcp`
  with the access token as a bearer, plain JSON-RPC (`tools/call` → `get_shopping_list`,
  `report_shopping_result`, `mark_items_bought`).

See ~/Documents/AI-Recipe-Manager-Handoff.md for the full design.
