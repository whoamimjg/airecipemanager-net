# Demo seed

Populates the marketing-demo account with a coherent household of data for
screenshots. Writes to **one** account and nothing else.

## Running it

The seed needs the service-role key — RLS blocks writing another user's rows
with the anon key.

**Do not put it in `.env`.** `.env` is tracked by git in this repo, so a key
placed there would be committed. Export it in your shell instead; the script
refuses to run if it finds the key in `.env`.

```bash
export SUPABASE_SERVICE_ROLE_KEY='...'      # Supabase dashboard > Project Settings > API

npm run seed:demo:dry     -- --email playstoretest@airecipemanager.com   # show the plan
npm run seed:demo         -- --email playstoretest@airecipemanager.com   # seed + verify
npm run seed:demo:verify  -- --email playstoretest@airecipemanager.com   # verify only
```

Flags: `--email` / `--user-id` (one required), `--dry-run`, `--verify`,
`--skip-photos`.

Apply `supabase/migrations/20260816120000_recipe_taxonomy_and_budget_fields.sql`
first — the seed writes `meal_type` / `dish_type` and the budget profile fields.

## Safety

The account is identified by **email**, not by a UUID on the command line.
Whichever identifier you pass, the script resolves it through the admin API and
asserts the resolved account's email equals `DEMO_EMAIL` in `demo-data.ts`.
Anything else aborts before a single row is touched.

Identity is checked rather than a UUID string so that a project restore which
reissues ids can't silently retarget the seed, and so a typo fails loudly
instead of pointing at a real customer. `scripts/seed-guard.test.ts` covers
this, including refusing a non-demo user id.

Idempotent: each run deletes that user's rows in the affected tables and
rewrites them, so re-running resets the demo to a known state.

Two things are checked or set before the destructive step, so a foreseeable
failure can't leave a half-built demo:

- **Photo preflight.** Every Unsplash id is resolved first; any 404 aborts the
  run with the affected recipe titles and nothing is written. Upstream ids do
  rot — two died between authoring and the first real run.
- **Plan.** The account is upserted to `plan: unlimited, recipe_limit: -1`.
  Without it the `recipes_enforce_plan_limit` trigger caps inserts at the Free
  limit of 25 and the 43-recipe fixture cannot load.

## Layout

| File | Purpose |
| --- | --- |
| `demo-data.ts` | Fixtures: recipes, inventory, meal plan, budget. No DB access. |
| `seed-demo.ts` | CLI: resolve, guard, clear, insert, verify. |
| `demo-data.test.ts` | Fixture integrity — the VERIFY rules, offline. |
| `seed-guard.test.ts` | The safety assertion. |

`demo-data.test.ts` asserts the brief's rules against the fixtures so a bad edit
fails in CI rather than after it reaches the demo account; `--verify` re-runs the
equivalent checks against the database after seeding.

## Editing the fixtures

`npm test` enforces: clean titles, servings 4–8, a varied rating spread, every
recipe photographed and on both taxonomy axes, no soup tagged Snack, inventory
names Title Case and ≤25 chars, `1 pc` / `3 pcs` grammar, exactly 3 items
expiring within 5 days and 1 expired, all 7 days planned, no non-staple
ingredient more than twice a week, and 6 budget months with the current one
partial and under target.

The variety rule is the one that bites: the lunch roster is deliberately wide
because a narrow one forces repeats that push shared ingredients (tortillas,
chicken breast, romaine) past twice a week.
