#!/usr/bin/env npx tsx
/**
 * Seeds the marketing-demo account with a coherent household of data.
 *
 *   npx tsx scripts/seed-demo.ts --email playstoretest@airecipemanager.com
 *   npx tsx scripts/seed-demo.ts --email ... --dry-run
 *   npx tsx scripts/seed-demo.ts --email ... --verify
 *
 * Safety model
 * ------------
 * The account is identified by EMAIL, not by a UUID pasted on the command line.
 * Whichever identifier is supplied, the script resolves it through the admin API
 * and then asserts the resolved account's email equals DEMO_EMAIL. Any other
 * account aborts before a single row is touched. Identity is checked rather than
 * a UUID string so a restore that reissues ids can't silently retarget the seed,
 * and so a typo fails loudly instead of pointing at a real customer.
 *
 * Idempotent: every run deletes this user's rows in the affected tables and
 * rewrites them, so re-running resets the demo to a known state.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment — RLS blocks writing
 * another user's rows with the anon key. Never commit that value.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMO_EMAIL, DISPLAY_NAME, HOUSEHOLD_SIZE, MONTHLY_BUDGET, ZIP_CODE, DEMO_PLAN,
  RECIPES, INVENTORY, WEEK_PLAN, MONTHLY_SPEND, CATEGORY_SPLIT, STORES,
  type DemoRecipe,
} from "./demo-data";
import { resolveIngredients } from "../src/lib/ingredient-match";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(__dirname, "..");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.split("=").slice(1).join("=") : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

const DRY_RUN = has("dry-run");
const VERIFY_ONLY = has("verify");
const SKIP_PHOTOS = has("skip-photos");

const die = (msg: string): never => {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
};

const log = (msg: string) => console.log(`  ${msg}`);

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Parses a dotenv-style file without pulling in a dotenv dependency. */
function readEnvFile(name = ".env"): Record<string, string> {
  try {
    const raw = readFileSync(resolvePath(REPO_ROOT, name), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = readEnvFile(".env");
// .env.local is matched by the `*.local` rule in .gitignore, so unlike .env it
// cannot be committed. That makes it the one safe place on disk for the key,
// and it saves re-exporting in every new shell.
const localEnv = readEnvFile(".env.local");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;

// Never from .env — that file IS tracked here, so a key placed there would be
// committed. The guard below turns that trap into a loud failure.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (fileEnv.SUPABASE_SERVICE_ROLE_KEY) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is present in .env — and .env is tracked by git\n" +
    "    in this repo, so that key is one commit away from being published.\n\n" +
    "    Remove it from .env and export it in your shell instead:\n\n" +
    "      export SUPABASE_SERVICE_ROLE_KEY='...'\n\n" +
    "    If it has already been committed, rotate it in the Supabase dashboard.",
  );
}

// ---------------------------------------------------------------------------
// Sanitisers
// ---------------------------------------------------------------------------

/**
 * Titles keep only letters, numbers, space, hyphen, ampersand and apostrophe —
 * this is what strips "{Copycat Recipe}" and bracketed source-site artifacts.
 * Applied at write time so a later fixture edit can't smuggle one back in.
 */
export function sanitizeTitle(title: string): string {
  return title
    .replace(/[^A-Za-z0-9 \-&']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1 pc" / "3 pcs" — never "1 pcs". */
export function formatQuantity(quantity: number, unit: string): string {
  if (!unit) return String(quantity);
  const singular = unit.replace(/s$/, "");
  const plural = /s$/.test(unit) ? unit : `${unit}s`;
  return `${quantity} ${quantity === 1 ? singular : plural}`;
}

/** Inventory names are Title Case: no lowercase "salt". */
export function toTitleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const slugify = (s: string) => sanitizeTitle(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const iso = (d: Date) => d.toISOString().slice(0, 10);

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday of the current week. */
function startOfWeekMonday(today = new Date()): Date {
  const d = new Date(today);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  d.setHours(12, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Account resolution + the safety assertion
// ---------------------------------------------------------------------------

export async function resolveDemoUser(
  admin: SupabaseClient,
  opts: { email?: string; userId?: string } = {},
): Promise<{ id: string; email: string }> {
  const wantEmail = opts.email ?? flag("email");
  const wantId = opts.userId ?? flag("user-id");

  if (!wantEmail && !wantId) {
    die("Pass --email or --user-id. Refusing to guess which account to seed.");
  }

  // paginate; the admin list API caps per-page
  let found: { id: string; email: string } | undefined;
  for (let page = 1; page <= 20 && !found; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) die(`Could not list users: ${error.message}`);
    if (!data.users.length) break;
    found = data.users
      .filter((u) => u.email)
      .map((u) => ({ id: u.id, email: u.email as string }))
      .find((u) => (wantId ? u.id === wantId : u.email.toLowerCase() === wantEmail!.toLowerCase()));
  }

  if (!found) die(`No account found for ${wantId ?? wantEmail}.`);

  // ---- the guard -----------------------------------------------------------
  if (found!.email.toLowerCase() !== DEMO_EMAIL.toLowerCase()) {
    die(
      `REFUSING TO RUN.\n` +
      `    Resolved account : ${found!.email} (${found!.id})\n` +
      `    Expected account : ${DEMO_EMAIL}\n\n` +
      `    This script only ever writes to the demo account. If you genuinely\n` +
      `    mean to seed a different one, change DEMO_EMAIL in scripts/demo-data.ts.`,
    );
  }

  return found!;
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * Downloads each recipe photo and uploads it to the recipe-images bucket, so the
 * demo doesn't hotlink a third party mid-screenshot. Paths are deterministic
 * (`{userId}/demo/{slug}.jpg`) and upserted, keeping re-runs idempotent.
 */
/**
 * Checks every photo resolves BEFORE anything is cleared or written.
 *
 * Upstream ids do rot — two 404'd between authoring and the first real run,
 * which left those recipes with a null image_url and a half-photographed demo
 * that only --verify caught. Failing here keeps the account in its previous
 * good state instead.
 */
async function preflightPhotos(): Promise<void> {
  if (SKIP_PHOTOS) return;

  const ids = [...new Set(RECIPES.map((r) => r.photo))];
  const dead: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`https://images.unsplash.com/${id}?w=64`);
        if (!res.ok) dead.push(`${id} (HTTP ${res.status})`);
      } catch (err) {
        dead.push(`${id} (${(err as Error).message})`);
      }
    }),
  );

  if (dead.length) {
    const affected = dead
      .map((d) => d.split(" ")[0])
      .flatMap((id) => RECIPES.filter((r) => r.photo === id).map((r) => `      - ${r.title} -> ${id}`));
    die(
      `${dead.length} recipe photo(s) no longer resolve upstream:\n` +
      `${affected.join("\n")}\n\n` +
      `    Nothing has been written. Replace the id(s) in scripts/demo-data.ts and\n` +
      `    re-run, or pass --skip-photos to seed without images.`,
    );
  }
  log(`· preflight: all ${ids.length} photos resolve`);
}

async function uploadPhotos(admin: SupabaseClient, userId: string): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (SKIP_PHOTOS) {
    log("· photos skipped (--skip-photos)");
    return urls;
  }

  let done = 0;
  for (const recipe of RECIPES) {
    const path = `${userId}/demo/${slugify(recipe.title)}.jpg`;
    const source = `https://images.unsplash.com/${recipe.photo}?w=1200&q=80&fm=jpg&fit=crop`;

    try {
      const res = await fetch(source);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = new Uint8Array(await res.arrayBuffer());

      const { error } = await admin.storage
        .from("recipe-images")
        .upload(path, body, { contentType: "image/jpeg", cacheControl: "3600", upsert: true });
      if (error) throw error;

      const { data } = admin.storage.from("recipe-images").getPublicUrl(path);
      urls.set(recipe.title, data.publicUrl);
      done++;
      // Progress matters here: this is the slow step, and total silence for a
      // minute or two reads as a hang.
      if (done % 10 === 0 || done === RECIPES.length) {
        log(`  … ${done}/${RECIPES.length} photos`);
      }
    } catch (err) {
      // Preflight already proved every id resolves, so a failure here is a real
      // fault (storage, network) rather than upstream rot. A recipe with no
      // photo isn't an acceptable demo, so stop rather than press on.
      die(`Photo upload failed for "${recipe.title}": ${(err as Error).message}`);
    }
  }
  log(`· uploaded ${done}/${RECIPES.length} photos`);
  return urls;
}

// ---------------------------------------------------------------------------
// Clear (idempotency)
// ---------------------------------------------------------------------------

/** Child tables first — meal_plans references recipes, receipt_items references receipt_scans. */
const CLEAR_ORDER = [
  "meal_plans",
  "grocery_items",
  "grocery_checked_keys",
  "grocery_deleted_keys",
  "grocery_overrides",
  "receipt_items",
  "receipt_scans",
  "inventory_deletions",
  "inventory_items",
  "recipes",
];

async function clearExisting(admin: SupabaseClient, userId: string) {
  for (const table of CLEAR_ORDER) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error && !/does not exist/i.test(error.message)) {
      die(`Failed clearing ${table}: ${error.message}`);
    }
  }
  log(`· cleared ${CLEAR_ORDER.length} tables for the demo account`);
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

function recipeRow(recipe: DemoRecipe, userId: string, photoUrl?: string) {
  return {
    user_id: userId,
    title: sanitizeTitle(recipe.title),
    description: recipe.description,
    category: recipe.meal_type,          // legacy mixed-axis field, kept in sync
    meal_type: recipe.meal_type,
    dish_type: recipe.dish_type,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    servings: recipe.servings,
    rating: recipe.rating,
    image_url: photoUrl ?? null,
    // Shapes match RecipeForm.tsx: ingredients {quantity, unit, name},
    // instructions {text, image_url}.
    ingredients: recipe.ingredients.map((i) => ({ quantity: i.quantity, unit: i.unit, name: i.name, notes: "" })),
    instructions: recipe.instructions.map((text) => ({ text, image_url: null })),
    is_ai_generated: false,
    tags: [recipe.meal_type, recipe.dish_type],
  };
}

/**
 * Guarantees the demo account is on an unlimited plan.
 *
 * Runs before the photo upload deliberately: the recipe insert is gated by the
 * recipes_enforce_plan_limit trigger, and failing that check after uploading 43
 * images wastes the slow part of the run.
 */
async function ensureUnlimitedPlan(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, ...DEMO_PLAN }, { onConflict: "user_id" });
  if (error) die(`Could not set the demo account to an unlimited plan: ${error.message}`);
  log(`· plan set to ${DEMO_PLAN.plan} (recipe_limit ${DEMO_PLAN.recipe_limit} = unlimited)`);
}

async function seed(admin: SupabaseClient, userId: string) {
  await ensureUnlimitedPlan(admin, userId);
  const photos = await uploadPhotos(admin, userId);

  // --- recipes -------------------------------------------------------------
  const { data: insertedRecipes, error: recipeErr } = await admin
    .from("recipes")
    .insert(RECIPES.map((r) => recipeRow(r, userId, photos.get(r.title))))
    .select("id, title");
  if (recipeErr) die(`Recipe insert failed: ${recipeErr.message}`);
  const recipeIdByTitle = new Map((insertedRecipes ?? []).map((r) => [r.title, r.id]));
  log(`· ${insertedRecipes?.length ?? 0} recipes`);

  // --- inventory -----------------------------------------------------------
  const today = new Date();
  const inventoryRows = INVENTORY.map((item) => ({
    user_id: userId,
    name: toTitleCase(item.name),
    quantity: item.quantity,
    unit: item.unit,
    storage_location: item.storage_location,
    category: item.category,
    price_per_unit: item.price_per_unit,
    expiration_date: item.expiresInDays === null ? null : iso(addDays(today, item.expiresInDays)),
  }));
  const { error: invErr } = await admin.from("inventory_items").insert(inventoryRows);
  if (invErr) die(`Inventory insert failed: ${invErr.message}`);
  log(`· ${inventoryRows.length} inventory items`);

  // --- meal plan -----------------------------------------------------------
  const monday = startOfWeekMonday(today);
  const planRows: Record<string, unknown>[] = [];
  WEEK_PLAN.forEach((day, i) => {
    const date = iso(addDays(monday, i));
    const slots: [string, string | undefined][] = [
      ["breakfast", day.breakfast], ["lunch", day.lunch],
      ["dinner", day.dinner], ["snack", day.snack],
    ];
    for (const [slot, title] of slots) {
      if (!title) continue;
      const recipeId = recipeIdByTitle.get(sanitizeTitle(title));
      if (!recipeId) die(`Meal plan references unknown recipe "${title}".`);
      planRows.push({ user_id: userId, date, meal_slot: slot, recipe_id: recipeId });
    }
  });
  const { error: planErr } = await admin.from("meal_plans").insert(planRows);
  if (planErr) die(`Meal plan insert failed: ${planErr.message}`);
  log(`· ${planRows.length} meal plan entries across 7 days`);

  // --- grocery: checked-off items -----------------------------------------
  //
  // The list itself is derived from the meal plan at read time; only the
  // "checked" markers are persisted, keyed on the item's DISPLAY name.
  //
  // Derived through the same matcher the UI uses rather than hardcoded. Hardcoded
  // strings silently missed: they were plural ("limes" vs the rendered "Limes"
  // once singularised) and three of them were items the pantry already had, which
  // land in "Already have" and can't be checked at all. Result was 0 of 5.
  const plannedTitles = new Set(
    WEEK_PLAN.flatMap((d) => [d.breakfast, d.lunch, d.dinner, d.snack].filter(Boolean) as string[]),
  );
  const plannedLines = RECIPES
    .filter((r) => plannedTitles.has(r.title))
    .flatMap((r) => r.ingredients.map((i) => i.name));

  const toBuy = resolveIngredients(plannedLines, inventoryRows.map((i) => ({ name: i.name })))
    .filter((entry) => !entry.inInventory);

  // Spread the ticks through the list instead of taking the first five. The list
  // renders grouped by aisle, so five consecutive alphabetical entries would all
  // land in one category and read like a rendering glitch in a screenshot.
  const stride = Math.max(1, Math.floor(toBuy.length / 5));
  const checkedKeys = [0, 1, 2, 3, 4]
    .map((n) => toBuy[n * stride])
    .filter(Boolean)
    .map((entry) => entry.displayName);
  if (checkedKeys.length < 5) {
    die(`Expected at least 5 to-buy items to pre-check, found ${checkedKeys.length}.`);
  }
  const { error: checkErr } = await admin
    .from("grocery_checked_keys")
    .insert(checkedKeys.map((k) => ({ user_id: userId, item_key: k.toLowerCase() })));
  if (checkErr) die(`Grocery checked keys insert failed: ${checkErr.message}`);
  log(`· ${checkedKeys.length} grocery items pre-checked: ${checkedKeys.join(", ")}`);

  // --- budget: six months of receipts --------------------------------------
  let receiptCount = 0;
  let itemCount = 0;
  for (const month of MONTHLY_SPEND) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - month.monthsAgo, 1);
    // Split each month across 3–4 shops so the receipt count looks lived-in.
    const shops = month.monthsAgo === 0 ? 2 : 4;
    const perShop = month.total / shops;

    for (let s = 0; s < shops; s++) {
      const day = Math.min(3 + s * 7, 27);
      const receiptDate = iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
      const { data: scan, error: scanErr } = await admin
        .from("receipt_scans")
        .insert({
          user_id: userId,
          receipt_date: receiptDate,
          store_name: STORES[s % STORES.length],
          total_amount: Number(perShop.toFixed(2)),
        })
        .select("id")
        .single();
      if (scanErr) die(`Receipt insert failed: ${scanErr.message}`);
      receiptCount++;

      const items = CATEGORY_SPLIT.map((c) => ({
        user_id: userId,
        receipt_id: scan!.id,
        name: `${c.category} items`,
        category: c.category,
        price: Number((perShop * c.share).toFixed(2)),
        quantity: 1,
        added_to_inventory: true,
      }));
      const { error: itemErr } = await admin.from("receipt_items").insert(items);
      if (itemErr) die(`Receipt items insert failed: ${itemErr.message}`);
      itemCount += items.length;
    }
  }
  log(`· ${receiptCount} receipts / ${itemCount} line items across 6 months`);

  // --- a little food waste, so the waste tile isn't zero --------------------
  const { error: wasteErr } = await admin.from("inventory_deletions").insert([
    { user_id: userId, item_name: "Spinach", quantity: 1, unit: "bag", reason: "Expired", category: "Produce", price_per_unit: 3.29, total_cost: 3.29, deleted_at: new Date().toISOString() },
    { user_id: userId, item_name: "Greek Yogurt", quantity: 2, unit: "pcs", reason: "Expired", category: "Dairy", price_per_unit: 1.29, total_cost: 2.58, deleted_at: new Date().toISOString() },
  ]);
  if (wasteErr) die(`Waste insert failed: ${wasteErr.message}`);

  // --- profile -------------------------------------------------------------
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      display_name: DISPLAY_NAME,
      household_size: HOUSEHOLD_SIZE,
      monthly_grocery_budget: MONTHLY_BUDGET,
      grocery_goal: "improve",
      zip_code: ZIP_CODE,
    })
    .eq("user_id", userId);
  if (profileErr) die(`Profile update failed: ${profileErr.message}`);
  log(`· profile set to "${DISPLAY_NAME}", budget $${MONTHLY_BUDGET}/mo`);
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

const MEASUREMENT_WORDS =
  /\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|gram|grams|kg|ml|liter|liters|clove|cloves|can|cans|package|packages|slice|slices|pinch|dash)\b/i;

async function verify(admin: SupabaseClient, userId: string): Promise<boolean> {
  const failures: string[] = [];
  const check = (ok: boolean, label: string, detail = "") => {
    console.log(`    ${ok ? "✓" : "✖"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
    if (!ok) failures.push(label);
  };

  const { data: recipes } = await admin
    .from("recipes").select("title, servings, image_url, rating, meal_type, dish_type").eq("user_id", userId);
  const { data: inventory } = await admin
    .from("inventory_items").select("name, expiration_date").eq("user_id", userId);
  const { data: plans } = await admin.from("meal_plans").select("date, meal_slot").eq("user_id", userId);
  const { data: sub } = await admin
    .from("subscriptions").select("plan, recipe_limit, is_active").eq("user_id", userId).maybeSingle();
  const { data: scans } = await admin.from("receipt_scans").select("total_amount, receipt_date").eq("user_id", userId);

  // 1. no brace or bracket characters in titles
  const badTitles = (recipes ?? []).filter((r) => /[{}\[\]]/.test(r.title));
  check(badTitles.length === 0, "no recipe title contains braces or brackets", badTitles.map((r) => r.title).join(", "));

  // 2. no serving count above 12
  const bigServings = (recipes ?? []).filter((r) => (r.servings ?? 0) > 12);
  check(bigServings.length === 0, "no serving count above 12", bigServings.map((r) => `${r.title}=${r.servings}`).join(", "));

  // 3. no inventory name longer than 25 characters
  const longNames = (inventory ?? []).filter((i) => i.name.length > 25);
  check(longNames.length === 0, "no inventory name over 25 characters", longNames.map((i) => `${i.name} (${i.name.length})`).join(", "));

  // 4. no "already have" entry contains a measurement unit.
  //    Those entries render inventory item names, so this asserts on inventory.
  const unitNames = (inventory ?? []).filter((i) => MEASUREMENT_WORDS.test(i.name));
  check(unitNames.length === 0, "no already-have entry contains a measurement unit", unitNames.map((i) => i.name).join(", "));

  // 5. budget months all non-zero except the current one
  const now = new Date();
  const byMonth = new Map<string, number>();
  for (const s of scans ?? []) {
    const key = String(s.receipt_date).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(s.total_amount ?? 0));
  }
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const past = [...byMonth.entries()].filter(([k]) => k !== currentKey);
  check(past.length === 5 && past.every(([, v]) => v > 0), "5 past budget months all non-zero", past.map(([k, v]) => `${k}=${v.toFixed(0)}`).join(" "));
  check((byMonth.get(currentKey) ?? 0) < MONTHLY_BUDGET, "current month under the $1,000 budget", `${(byMonth.get(currentKey) ?? 0).toFixed(0)}`);

  // Plan: without this the recipe insert can't even complete, so assert it holds
  // rather than inferring it from the fact that the rows landed.
  check(
    !!sub && sub.is_active === true && sub.recipe_limit < 0,
    "account is on an unlimited plan (recipe_limit < 0, active)",
    sub ? `${sub.plan} limit=${sub.recipe_limit} active=${sub.is_active}` : "no subscriptions row",
  );
  check((recipes ?? []).length > 25, "recipe count exceeds the Free limit of 25", `${(recipes ?? []).length}`);

  // Supporting expectations from the brief
  check((recipes ?? []).every((r) => !!r.image_url), "every recipe has a photo");
  check((recipes ?? []).every((r) => !!r.meal_type && !!r.dish_type), "every recipe has both taxonomy axes");
  check(!(recipes ?? []).some((r) => r.dish_type === "Soup" && r.meal_type === "Snack"), "no soup tagged as a Snack");

  const { data: checked } = await admin
    .from("grocery_checked_keys").select("item_key").eq("user_id", userId);
  check((checked ?? []).length === 5, "5 grocery items pre-checked", `${(checked ?? []).length}`);

  const days = new Set((plans ?? []).map((p) => p.date));
  check(days.size === 7, "meal plan covers all 7 days", `${days.size} days`);

  const expiringSoon = (inventory ?? []).filter((i) => {
    if (!i.expiration_date) return false;
    const days = Math.ceil((new Date(i.expiration_date).getTime() - now.getTime()) / 86_400_000);
    return days >= 0 && days <= 5;
  });
  const expired = (inventory ?? []).filter((i) => i.expiration_date && new Date(i.expiration_date) < now);
  check(expiringSoon.length === 3, "exactly 3 items expiring within 5 days", `${expiringSoon.length}`);
  check(expired.length === 1, "exactly 1 item already expired", `${expired.length}`);

  console.log();
  if (failures.length) {
    console.error(`  ✖ ${failures.length} verification check(s) failed.\n`);
    return false;
  }
  console.log("  ✓ all verification checks passed.\n");
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  AI Recipe Manager — demo seed\n");

  if (!SUPABASE_URL) die("VITE_SUPABASE_URL not found in environment or .env");
  if (!SERVICE_ROLE_KEY) {
    die(
      "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
      "    RLS blocks writing another user's rows with the anon key, so the seed\n" +
      "    needs the service role key (Supabase dashboard > Project Settings > API).\n\n" +
      "    Persist it once — .env.local is gitignored, so this survives new shells:\n\n" +
      "      echo \"SUPABASE_SERVICE_ROLE_KEY='<key>'\" >> .env.local\n\n" +
      "    Or export it for this shell only:\n\n" +
      "      export SUPABASE_SERVICE_ROLE_KEY='<key>'\n\n" +
      "    Never put it in .env — that file is tracked by git.",
    );
  }

  // A real service-role key is a JWT ("eyJ...") or a "sb_secret_..." secret. Anything
  // else is almost always a placeholder copied verbatim out of the instructions,
  // and Supabase's own "Invalid API key" gives no hint of that.
  if (!/^(eyJ|sb_secret_)/.test(SERVICE_ROLE_KEY) || SERVICE_ROLE_KEY.length < 40) {
    die(
      `SUPABASE_SERVICE_ROLE_KEY does not look like a real key.\n` +
      `    Got ${SERVICE_ROLE_KEY.length} characters starting "${SERVICE_ROLE_KEY.slice(0, 3)}".\n` +
      `    Expected a few hundred characters starting "eyJ" or "sb_secret_".\n\n` +
      `    This usually means a placeholder was copied literally. Replace the value\n` +
      `    with the real key from Supabase > Project Settings > API.`,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await resolveDemoUser(admin);
  log(`account : ${user.email}`);
  log(`user id : ${user.id}`);
  log(`project : ${SUPABASE_URL}\n`);

  if (VERIFY_ONLY) {
    const ok = await verify(admin, user.id);
    process.exit(ok ? 0 : 1);
  }

  if (DRY_RUN) {
    await preflightPhotos();
    log("DRY RUN — nothing will be written.\n");
    log(`would clear   : ${CLEAR_ORDER.join(", ")}`);
    log(`would set     : plan ${DEMO_PLAN.plan}, recipe_limit ${DEMO_PLAN.recipe_limit} (unlimited)`);
    log(`would insert  : ${RECIPES.length} recipes, ${INVENTORY.length} inventory items,`);
    log(`                ${WEEK_PLAN.reduce((n, d) => n + 3 + (d.snack ? 1 : 0), 0)} meal plan entries,`);
    log(`                ${MONTHLY_SPEND.reduce((n, m) => n + (m.monthsAgo === 0 ? 2 : 4), 0)} receipts`);
    console.log();
    process.exit(0);
  }

  // Before the destructive step: a dead photo id must not cost us the account's
  // existing good state.
  await preflightPhotos();

  await clearExisting(admin, user.id);
  await seed(admin, user.id);

  console.log("\n  Verifying…\n");
  const ok = await verify(admin, user.id);
  process.exit(ok ? 0 : 1);
}

// Only run when invoked directly. The sanitisers above are imported by
// scripts/demo-data.test.ts, and importing this module must not execute a seed.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

if (invokedDirectly) {
  main().catch((err) => die(err instanceof Error ? err.stack ?? err.message : String(err)));
}
