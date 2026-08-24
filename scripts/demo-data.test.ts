/**
 * Fixture integrity checks.
 *
 * These are the brief's VERIFY rules applied to the seed data itself, so a bad
 * fixture fails in CI rather than after it has been written to the demo account.
 * seed-demo.ts --verify re-runs the equivalent assertions against the database.
 */
import { describe, it, expect } from "vitest";
import { RECIPES, INVENTORY, WEEK_PLAN, MONTHLY_SPEND, MONTHLY_BUDGET } from "./demo-data";
import { sanitizeTitle, formatQuantity, toTitleCase } from "./seed-demo";
import { cleanIngredientName } from "../src/lib/ingredient-match";

describe("recipes", () => {
  it("has roughly 40", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(38);
    expect(RECIPES.length).toBeLessThanOrEqual(45);
  });

  it("has clean titles — no braces, brackets or source-site artifacts", () => {
    for (const r of RECIPES) {
      expect(r.title, r.title).not.toMatch(/[{}\[\]]/);
      // Only letters, numbers, space, hyphen, ampersand, apostrophe.
      expect(r.title, r.title).toMatch(/^[A-Za-z0-9 \-&']+$/);
      // Already canonical, so sanitizing is a no-op.
      expect(sanitizeTitle(r.title)).toBe(r.title);
    }
  });

  it("has realistic serving counts between 4 and 8", () => {
    for (const r of RECIPES) {
      expect(r.servings, r.title).toBeGreaterThanOrEqual(4);
      expect(r.servings, r.title).toBeLessThanOrEqual(8);
      expect(r.servings, r.title).toBeLessThanOrEqual(12); // the VERIFY rule
    }
  });

  it("has sensible cook times for the dish", () => {
    for (const r of RECIPES) {
      expect(r.cook_time, r.title).toBeGreaterThanOrEqual(0);
      expect(r.cook_time, r.title).toBeLessThanOrEqual(360);
      expect(r.prep_time, r.title).toBeGreaterThan(0);
    }
    // No-cook dishes really are no-cook.
    expect(RECIPES.find((r) => r.title === "Turkey & Swiss Wraps")!.cook_time).toBe(0);
  });

  it("has a varied rating spread, not all 5s", () => {
    const rated = RECIPES.filter((r) => r.rating !== null);
    const fives = rated.filter((r) => r.rating === 5).length;
    const fours = rated.filter((r) => r.rating === 4).length;
    const threes = rated.filter((r) => r.rating === 3).length;

    expect(fives / rated.length).toBeLessThan(0.45);   // ~a third
    expect(fours).toBeGreaterThan(fives);              // half-ish, the largest bucket
    expect(threes).toBeGreaterThan(0);
    // A few unrated looks honest.
    expect(RECIPES.filter((r) => r.rating === null).length).toBeGreaterThanOrEqual(2);
  });

  it("gives every recipe a well-formed photo id", () => {
    // Liveness is checked by seed-demo.ts's preflight (needs network); this only
    // guards the shape, so a typo can't reach a run.
    for (const r of RECIPES) {
      expect(r.photo, r.title).toMatch(/^photo-\d{10,13}-[0-9a-f]{12}$/);
    }
  });

  it("puts every recipe on both taxonomy axes", () => {
    for (const r of RECIPES) {
      expect(["Breakfast", "Lunch", "Dinner", "Snack"]).toContain(r.meal_type);
      expect(["Main", "Side", "Soup", "Salad", "Dessert", "Beverage"]).toContain(r.dish_type);
    }
  });

  it("never tags a soup as a snack", () => {
    const offenders = RECIPES.filter((r) => r.dish_type === "Soup" && r.meal_type === "Snack");
    expect(offenders.map((r) => r.title)).toEqual([]);
  });

  it("gives every recipe ingredients and instructions", () => {
    for (const r of RECIPES) {
      expect(r.ingredients.length, r.title).toBeGreaterThanOrEqual(3);
      expect(r.instructions.length, r.title).toBeGreaterThanOrEqual(1);
    }
  });

  it("has unique titles", () => {
    expect(new Set(RECIPES.map((r) => r.title)).size).toBe(RECIPES.length);
  });
});

describe("inventory", () => {
  it("holds 28 to 32 items", () => {
    expect(INVENTORY.length).toBeGreaterThanOrEqual(28);
    expect(INVENTORY.length).toBeLessThanOrEqual(32);
  });

  it("keeps every name under 25 characters", () => {
    for (const i of INVENTORY) {
      expect(i.name.length, `${i.name} (${i.name.length})`).toBeLessThanOrEqual(25);
    }
  });

  it("uses Title Case, never lowercase salt", () => {
    for (const i of INVENTORY) expect(toTitleCase(i.name), i.name).toBe(i.name);
  });

  it("uses generic pantry names, not receipt-scan brand strings", () => {
    const brands = /kfd|sticky fingers|canada dry|kraft|heinz|great value/i;
    for (const i of INVENTORY) expect(i.name, i.name).not.toMatch(brands);
    // The names the brief called out explicitly.
    const names = INVENTORY.map((i) => i.name);
    expect(names).toContain("Milk");
    expect(names).not.toContain("Ginger Ale (Canada Dry)");
  });

  it("spreads across all four storage locations", () => {
    const locations = new Set(INVENTORY.map((i) => i.storage_location));
    expect([...locations].sort()).toEqual(["cabinet", "freezer", "fridge", "pantry"]);
  });

  it("prices everything realistically", () => {
    for (const i of INVENTORY) {
      expect(i.price_per_unit, i.name).toBeGreaterThan(0);
      expect(i.price_per_unit, i.name).toBeLessThan(20);
    }
  });

  it("has exactly 3 items expiring within 5 days and 1 already expired", () => {
    const soon = INVENTORY.filter((i) => i.expiresInDays !== null && i.expiresInDays! >= 0 && i.expiresInDays! <= 5);
    const expired = INVENTORY.filter((i) => i.expiresInDays !== null && i.expiresInDays! < 0);
    expect(soon.map((i) => i.name).sort()).toEqual(["Greek Yogurt", "Milk", "Romaine Lettuce"]);
    expect(expired.map((i) => i.name)).toEqual(["Spinach"]);
  });
});

describe("quantity grammar", () => {
  it("never renders '1 pcs'", () => {
    expect(formatQuantity(1, "pcs")).toBe("1 pc");
    expect(formatQuantity(3, "pcs")).toBe("3 pcs");
    expect(formatQuantity(1, "pc")).toBe("1 pc");
    expect(formatQuantity(2, "bag")).toBe("2 bags");
  });

  it("produces grammatical output for every inventory row", () => {
    for (const i of INVENTORY) {
      const rendered = formatQuantity(i.quantity, i.unit);
      expect(rendered, `${i.name}: ${rendered}`).not.toMatch(/\b1 [a-z]+s\b/);
    }
  });
});

describe("meal plan", () => {
  const titles = new Set(RECIPES.map((r) => r.title));

  it("covers all 7 days with breakfast, lunch and dinner", () => {
    expect(WEEK_PLAN).toHaveLength(7);
    for (const day of WEEK_PLAN) {
      expect(day.breakfast).toBeTruthy();
      expect(day.lunch).toBeTruthy();
      expect(day.dinner).toBeTruthy();
    }
  });

  it("has a snack on about half the days", () => {
    const withSnack = WEEK_PLAN.filter((d) => d.snack).length;
    expect(withSnack).toBeGreaterThanOrEqual(3);
    expect(withSnack).toBeLessThanOrEqual(4);
  });

  it("only references recipes that exist", () => {
    for (const day of WEEK_PLAN) {
      for (const slot of [day.breakfast, day.lunch, day.dinner, day.snack]) {
        if (slot) expect(titles, slot).toContain(slot);
      }
    }
  });

  it("assigns each meal to a recipe whose meal_type matches its slot", () => {
    const byTitle = new Map(RECIPES.map((r) => [r.title, r]));
    for (const day of WEEK_PLAN) {
      expect(byTitle.get(day.breakfast)!.meal_type).toBe("Breakfast");
      expect(byTitle.get(day.lunch)!.meal_type).toBe("Lunch");
      // Sides and salads legitimately sit in the Dinner meal_type.
      expect(byTitle.get(day.dinner)!.meal_type).toBe("Dinner");
      if (day.snack) expect(byTitle.get(day.snack)!.meal_type).toBe("Snack");
    }
  });

  it("repeats no ingredient more than twice across the week", () => {
    const byTitle = new Map(RECIPES.map((r) => [r.title, r]));
    const counts = new Map<string, number>();

    for (const day of WEEK_PLAN) {
      for (const slot of [day.breakfast, day.lunch, day.dinner, day.snack]) {
        if (!slot) continue;
        // Count each distinct food once per meal.
        const foods = new Set(byTitle.get(slot)!.ingredients.map((i) => cleanIngredientName(i.name)));
        for (const food of foods) {
          if (food) counts.set(food, (counts.get(food) ?? 0) + 1);
        }
      }
    }

    // Staples that appear in almost everything aren't what "variety" means here.
    const STAPLES = new Set([
      "salt", "olive oil", "vegetable oil", "sesame oil", "butter", "garlic",
      "yellow onion", "flour", "sugar", "brown sugar", "egg", "milk", "water",
      "honey", "baking powder", "baking soda",
    ]);

    const overused = [...counts.entries()]
      .filter(([food, n]) => n > 2 && !STAPLES.has(food))
      .map(([food, n]) => `${food} x${n}`);

    expect(overused).toEqual([]);
  });
});

describe("budget", () => {
  it("covers 6 months", () => {
    expect(MONTHLY_SPEND).toHaveLength(6);
    expect(MONTHLY_SPEND.map((m) => m.monthsAgo).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("has every past month non-zero", () => {
    for (const m of MONTHLY_SPEND.filter((m) => m.monthsAgo > 0)) {
      expect(m.total, `month -${m.monthsAgo}`).toBeGreaterThan(0);
    }
  });

  it("tracks around $900 against a $1,000 target", () => {
    const past = MONTHLY_SPEND.filter((m) => m.monthsAgo > 0);
    const avg = past.reduce((s, m) => s + m.total, 0) / past.length;
    expect(avg).toBeGreaterThan(850);
    expect(avg).toBeLessThan(950);
    for (const m of past) expect(m.total).toBeLessThan(MONTHLY_BUDGET);
  });

  it("leaves the current month partial and under budget", () => {
    const current = MONTHLY_SPEND.find((m) => m.monthsAgo === 0)!;
    expect(current.total).toBeLessThan(MONTHLY_BUDGET);
    expect(current.total).toBeLessThan(600); // clearly mid-month, not a full month
  });
});
