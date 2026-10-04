---
name: shop-my-list
description: Shop a user's AI Recipe Manager grocery list at their preferred store (Kroger, Walmart, Meijer, Giant Eagle, Aldi, Target, Costco). Use when the user asks to shop, order, or buy their groceries, fill their cart, or "shop my list". Reads the list through the AI Recipe Manager MCP connector, adds items to the store cart in the user's browser, reports back, and always stops before checkout.
---

# Shop my list

You are putting the user's AI Recipe Manager grocery list into their store's online cart.
The user places the order. You never do.

## Before you start

- The **AI Recipe Manager** MCP connector must be connected. Its URL is
  `https://puokewpqhparawdcwkbw.supabase.co/functions/v1/mcp`. If its tools
  (`get_shopping_list`, `report_shopping_result`, `mark_items_bought`) are not
  available, tell the user to add it: Claude → Settings → Connectors → Add custom
  connector → paste the URL → sign in and Allow.
- You need a browser the user is signed in to at their store (Claude in Chrome, or the
  built-in browser after they sign in). Never type their store password; ask them to
  sign in if a login page appears.

## Steps

1. **Get the list.** Call `get_shopping_list`. It returns the saved items grouped by
   aisle, the store (`store_label`), ZIP code, and diet restrictions. If it says there
   is no saved list, ask the user to open airecipemanager.com → Grocery List → **Shop my
   list**, then call it again. If the user names a different store than the saved one,
   use the user's store.
2. **Open the store** site in the browser and confirm the user is signed in and the
   shopping location (pickup store or delivery ZIP) matches the ZIP returned. Change
   the location only if it is clearly wrong, and tell the user you did.
3. **Add each item.** Search by the item name, and choose the product that best fits
   the quantity and unit (for "2 lb chicken thighs" pick a pack near 2 lb; for
   "1 can black beans" pick a single standard can). Prefer store brands when no brand is
   given. Respect the diet restrictions when choosing substitutes. If the first result
   is a multipack or wildly different size, look at the next few results before settling.
4. **Track what happened** per item: `added`, `substituted` (say what with),
   `not_found`, or `skipped` (say why).
5. **Report once.** Call `report_shopping_result` with `list_id`, `store`, `status`
   (`in_cart` when everything is in, `partial` when some items are missing, `failed`
   when you could not shop), `cart_url` if the site has a cart page, `estimated_total`
   if shown, a one-sentence `summary`, and the per-item statuses.
6. **Hand over.** Tell the user what is in the cart, what was substituted, what you
   could not find, and the cart total if visible. Leave the cart page open. Stop.

## Hard rules

- **Never check out.** Do not press Checkout, Place order, Buy now, or any payment
  button. Do not enter, select, or confirm payment methods, addresses, phone numbers,
  or passwords. Do not solve CAPTCHAs or "press and hold" challenges; stop and tell the
  user if one appears.
- **Never remove or hide items** from the user's list. If an item cannot be bought,
  report it as `not_found`; the user decides.
- **Only tick items as bought** (`mark_items_bought`) after the user says the order
  was actually placed, and only the items they confirm.
- Do not add items the list does not contain unless the user asks for them.
- Do not change account, loyalty, subscription, or notification settings at the store.

## Store notes

- **Kroger** (and banners such as Fred Meyer, Ralphs, King Soopers, Fry's): site search
  at kroger.com; the cart shows an estimated total; pickup/delivery toggle at the top.
- **Walmart**: use walmart.com/grocery; watch for "press and hold" bot checks and
  stop if one appears. Pickup vs delivery is set from the location banner.
- **Meijer**: meijer.com; pickup/delivery chosen when the cart is first used.
- **Giant Eagle**: gianteagle.com; curbside and delivery share one cart.
- **Aldi**: online ordering on aldi.us is fulfilled through Instacart; the cart may
  hand off to an Instacart page. Still stop before checkout.
- **Target** and **Costco**: standard site search and cart. Costco sells many items only
  in bulk; prefer `substituted` with a note over skipping.
