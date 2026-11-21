# Chrome Web Store listing — AI Recipe Manager: Shop my list

Package: `~/Documents/airecipemanager-shop-my-list-0.1.0.zip` (built from `extension/dist`, manifest
keeps the `key` so the published id stays `dillgnbahmjedhhgihmefdbgaknenhgh`, which the OAuth
redirect URI expects).

## Store listing

**Name:** AI Recipe Manager: Shop my list

**Summary (132 max):**
Puts your AI Recipe Manager grocery list into your grocery store's online cart. Stops at the cart; you place the order.

**Category:** Shopping

**Language:** English (United States)

**Description:**
Shop my list takes the grocery list you built in AI Recipe Manager and adds it to the online cart of
the grocery store you already use.

How it works
1. Sign in to your AI Recipe Manager account from the side panel.
2. Open your store's website (Kroger, Meijer, Walmart, Giant Eagle, Target, and most others).
3. Press Start. The extension searches for each item, picks the best match, and presses the store's
   own "Add to cart" button. Items it adds are ticked off your list.
4. Review the cart and place the order yourself.

What it never does
- It never checks out, never enters passwords or payment details.
- It never gets around a store's sign-in or bot check. If a store asks you to sign in or prove
  you're human, it stops and waits for you.
- It never removes anything from your list.

Works on stores it has never seen
Built-in support for major chains, plus a "Teach this store" mode: click the search box and one
Add button, and the extension learns the layout for everyone.

Optional AI matching
With the AI switch on, the item name and the products on the page are sent to our AI provider to
choose the best match (size, pack, diet restrictions from your profile). With it off, matching
happens entirely in your browser.

Requires a free AI Recipe Manager account (airecipemanager.com). Plans only change how many recipes
you can save; shopping works on every plan.

## Privacy tab

**Single purpose:** Add the items on the user's AI Recipe Manager grocery list to the online cart of
the grocery store website the user is viewing.

**Permission justifications**
- `identity`: sign the user in to their AI Recipe Manager account with OAuth (launchWebAuthFlow).
- `storage`: keep the sign-in token and the user's settings (AI switch, preferred store).
- `sidePanel`: the extension's whole UI is a side panel next to the store tab.
- `scripting` + `activeTab` + `tabs`: inject the content script into the store tab the user chose and
  read that tab's URL to pick the right store adapter.
- Optional host permission `https://*/*`: requested only when the user presses Start on a store, so
  the content script can read product tiles and press "Add to cart" on that store's domain.
- Host permission `puokewpqhparawdcwkbw.supabase.co`: the AI Recipe Manager backend (list, report).

**Remote code:** No. All code ships in the package.

**Data usage disclosures (tick):**
- Personally identifiable information: No (the account email is shown but comes from the user's own
  backend session; nothing is collected by the extension).
- Authentication information: Yes — OAuth token stored locally to call the user's own account.
- Website content: Yes — product names/prices on the store page the user chose, used to match items;
  sent to the AI provider only when the AI switch is on.
- Everything else: No.

**Certifications:** tick all three (not sold, not used for unrelated purposes, not used for
creditworthiness or lending).

**Privacy policy URL:** https://airecipemanager.com/privacy (section 5 covers the extension).

## Assets still needed from you (need a signed-in browser)
- Screenshots: 1280×800 or 640×400, at least one. Suggested: side panel beside Kroger with the list
  loading; mid-run with items added; a "sign in to add" wall message.
- Small promo tile 440×280 (optional but recommended).
- Store icon: `extension/icons/icon-128.png` (already in the package).

## Before pressing Publish
1. Load `extension/dist` unpacked, sign in, run a real list on one store, confirm the items tick off
   on airecipemanager.com.
2. Chrome Web Store developer account ($5 one-time), same Google account as the OAuth client.
3. Upload the zip, fill in the above, set visibility Public, submit for review (typically 1–3 days).
