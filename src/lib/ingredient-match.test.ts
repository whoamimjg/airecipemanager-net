import { describe, it, expect } from "vitest";
import {
  cleanIngredientName,
  covers,
  parseAmount,
  detectPurchaseUnit,
  matchInventoryItem,
  resolveIngredients,
  toDisplayName,
  cleanIngredientSurface,
} from "./ingredient-match";

const INVENTORY = [
  { id: "1", name: "Butter" },
  { id: "2", name: "Chicken Breast" },
  { id: "3", name: "Sugar" },
  { id: "4", name: "Salt" },
  { id: "5", name: "Olive Oil" },
  { id: "6", name: "Yellow Onion" },
  { id: "7", name: "Milk" },
];

describe("cleanIngredientName", () => {
  it("strips quantity, unit and trailing prep notes", () => {
    // The headline bug: this rendered verbatim in "Already in Inventory".
    expect(cleanIngredientName("½ cup unsalted butter, softened to room temperature")).toBe("butter");
  });

  it("recovers an ingredient whose leading number was lost upstream", () => {
    // Real artifact from the scraper: "6-ounce" arrives as "-ounce".
    expect(cleanIngredientName("-ounce boneless, skinless chicken breasts")).toBe("chicken breast");
  });

  it("does not truncate at the first comma", () => {
    // A naive split(",")[0] would yield "boneless" and lose the food entirely.
    expect(cleanIngredientName("boneless, skinless chicken thighs")).toBe("chicken thigh");
  });

  it("normalises differing quantities of the same food to one key", () => {
    expect(cleanIngredientName("¼ cup granulated sugar")).toBe("sugar");
    expect(cleanIngredientName("1 cup granulated sugar")).toBe("sugar");
  });

  it("handles unicode fractions, decimals and ranges", () => {
    // "ground" is part of the product, not a prep note — you buy ground beef.
    expect(cleanIngredientName("1.5 lbs ground beef")).toBe("ground beef");
    expect(cleanIngredientName("2 1/2 cups all-purpose flour")).toBe("flour");
  });

  it("drops parentheticals", () => {
    expect(cleanIngredientName("1 can diced tomatoes (about 14 oz)")).toBe("tomato");
  });

  it("keeps adjectives that distinguish different foods", () => {
    expect(cleanIngredientName("2 tbsp olive oil")).toBe("olive oil");
    expect(cleanIngredientName("1 large yellow onion, diced")).toBe("yellow onion");
    expect(cleanIngredientName("1 cup brown rice")).toBe("brown rice");
  });

  it("returns empty when nothing meaningful survives", () => {
    expect(cleanIngredientName("1/2 tsp")).toBe("");
    expect(cleanIngredientName("")).toBe("");
  });
});

describe("covers — false positives the old two-way substring match produced", () => {
  it("does not let Salt cover salted butter", () => {
    expect(covers("Salt", "1/2 cup salted butter")).toBe(false);
  });

  it("does not let Chicken Breast cover chicken broth", () => {
    expect(covers("Chicken Breast", "2 cups chicken broth")).toBe(false);
  });

  it("does not let Milk cover buttermilk", () => {
    expect(covers("Milk", "1 cup buttermilk")).toBe(false);
  });

  it("still covers the genuine matches", () => {
    expect(covers("Butter", "½ cup unsalted butter, softened to room temperature")).toBe(true);
    expect(covers("Chicken Breast", "-ounce boneless, skinless chicken breasts")).toBe(true);
    expect(covers("Sugar", "¼ cup granulated sugar")).toBe(true);
    expect(covers("Yellow Onion", "1 large yellow onion, diced")).toBe(true);
  });
});

describe("matchInventoryItem", () => {
  it("prefers the more specific inventory item", () => {
    const inv = [{ id: "a", name: "Chicken" }, { id: "b", name: "Chicken Breast" }];
    expect(matchInventoryItem("2 boneless chicken breasts", inv)?.name).toBe("Chicken Breast");
  });

  it("returns null when nothing covers the ingredient", () => {
    expect(matchInventoryItem("2 tbsp gochujang", INVENTORY)).toBeNull();
  });
});

describe("resolveIngredients", () => {
  it("collapses duplicate sugar lines into a single entry", () => {
    const resolved = resolveIngredients(
      ["¼ cup granulated sugar", "1 cup granulated sugar"],
      INVENTORY,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0].displayName).toBe("Sugar");
    expect(resolved[0].sources).toHaveLength(2);
  });

  it("displays the inventory item name, never the raw line", () => {
    const resolved = resolveIngredients(
      ["½ cup unsalted butter, softened to room temperature", "-ounce boneless, skinless chicken breasts"],
      INVENTORY,
    );
    const names = resolved.map((r) => r.displayName).sort();
    expect(names).toEqual(["Butter", "Chicken Breast"]);
    // The VERIFY contract: no measurement unit may appear in an "already have" entry.
    for (const r of resolved.filter((x) => x.inInventory)) {
      expect(r.displayName).not.toMatch(/\b(cup|cups|tbsp|tsp|oz|ounce|lb|lbs|g|kg|ml)\b/i);
      expect(r.displayName).not.toMatch(/[0-9¼½¾]/);
    }
  });

  it("falls back to a title-cased food name when not in inventory", () => {
    const resolved = resolveIngredients(["2 tbsp gochujang"], INVENTORY);
    expect(resolved[0].displayName).toBe("Gochujang");
    expect(resolved[0].inInventory).toBe(false);
  });

  it("sorts items to buy ahead of items already owned", () => {
    const resolved = resolveIngredients(
      ["2 tbsp gochujang", "½ cup unsalted butter"],
      INVENTORY,
    );
    expect(resolved.map((r) => r.inInventory)).toEqual([false, true]);
  });
});

describe("toDisplayName", () => {
  it("title-cases multi-word foods", () => {
    expect(toDisplayName("chicken breast")).toBe("Chicken Breast");
    expect(toDisplayName("olive oil")).toBe("Olive Oil");
  });
});

describe("cleanIngredientSurface — display must not inherit the singular key", () => {
  it("keeps the plural the recipe line actually used", () => {
    expect(cleanIngredientSurface("8 apples")).toBe("apples");
    expect(cleanIngredientSurface("2 cups strawberries")).toBe("strawberries");
    expect(cleanIngredientSurface("3 carrots")).toBe("carrots");
    expect(cleanIngredientSurface("2 lbs potatoes")).toBe("potatoes");
  });

  it("leaves genuinely singular foods alone", () => {
    expect(cleanIngredientSurface("½ cup unsalted butter, softened")).toBe("butter");
    expect(cleanIngredientSurface("2 tbsp olive oil")).toBe("olive oil");
  });

  it("still dedups plural and singular to one key", () => {
    expect(cleanIngredientName("8 apples")).toBe(cleanIngredientName("1 apple"));
  });

  it("renders a plural buy-list label but an inventory name when matched", () => {
    const resolved = resolveIngredients(
      ["8 apples", "½ cup unsalted butter, softened"],
      [{ id: "1", name: "Butter" }],
    );
    const byKey = Object.fromEntries(resolved.map((r) => [r.key, r.displayName]));
    expect(byKey["apple"]).toBe("Apples");
    expect(byKey["butter"]).toBe("Butter");
  });
});

// Regressions from the Classic Homemade Meatloaf report: ingredients were
// vanishing from the grocery list, and the ones that survived were mismeasured.
describe("meatloaf regressions", () => {
  it("does not let a generic pantry item cover a specific ingredient", () => {
    // "Granulated Sugar" cleans to "sugar" — it must not absorb brown sugar.
    expect(covers("Granulated Sugar", "1 Tbsp brown sugar")).toBe(false);
    expect(covers("Sugar", "1 Tbsp brown sugar")).toBe(false);
    expect(covers("Pepper", "¼ tsp black pepper")).toBe(false);
    expect(covers("Onion", "1 cup red onion, diced")).toBe(false);
  });

  it("still covers when the recipe only adds words we strip anyway", () => {
    expect(covers("Butter", "½ cup unsalted butter, softened")).toBe(true);
    expect(covers("Granulated Sugar", "¼ cup granulated sugar")).toBe(true);
  });

  it("matches compound foods written with or without a space", () => {
    expect(covers("Bread Crumbs", "½ cup plain breadcrumbs")).toBe(true);
    expect(covers("Breadcrumbs", "1 cup bread crumbs")).toBe(true);
  });

  it("parses the fraction amounts that used to render blank", () => {
    expect(parseAmount("½")).toBeCloseTo(0.5);
    expect(parseAmount("1 ½")).toBeCloseTo(1.5);
    expect(parseAmount("1½")).toBeCloseTo(1.5);
    expect(parseAmount("1/3")).toBeCloseTo(1 / 3);
    expect(parseAmount("2-3")).toBe(2);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("to taste")).toBeNull();
  });

  it("keeps ground beef resolvable, and distinct from plain beef", () => {
    const resolved = resolveIngredients(["1 ½ lbs ground beef (80/20)"], []);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].key).toBe("ground beef");
    expect(resolved[0].inInventory).toBe(false);
    // You buy ground beef, not beef — a pantry "Beef" must not cover it.
    expect(covers("Beef", "1 ½ lbs ground beef")).toBe(false);
  });
});

// Real lines from the user's own recipes. The scraper stores whole sentences in
// the ingredient `name` field, so the grocery list has to recover the food from
// prose — these all produced junk rows before clause-aware extraction.
describe("real scraped ingredient lines", () => {
  const cases: [string, string][] = [
    ["pounds ground beef (i like to use 85% lean)", "ground beef"],
    ["1 \u00bd lbs ground beef (80/20)", "ground beef"],
    ["strips bacon, cooked until crispy and broken into pieces", "bacon"],
    ["scallions, thinly sliced, green and white parts separated", "scallion"],
    ["small head of cabbage, cored and coarsely chopped", "cabbage"],
    ["Homemade Tortillas or store-bought 8-inch flour tortillas", "tortilla"],
    ["Fresh parsley or basil, chopped (optional for garnish)", "parsley"],
    ["4 boneless, skinless chicken breasts (about 6\u20138 oz each)", "chicken breast"],
    ["1 (12 ounce) bottle barbecue sauce (such as Sweet Baby Ray\u2019s)", "barbecue sauce"],
    ["cup, sliced into rounds Carrots", "carrot"],
    ["ketchup, for serving (optional)", "ketchup"],
    ["1 medium yellow onion, finely chopped", "yellow onion"],
  ];
  it.each(cases)("%s -> %s", (raw, expected) => {
    expect(cleanIngredientName(raw)).toBe(expected);
  });

  it("does not split an adjective list into a bogus food", () => {
    // "small or medium" and "red and/or yellow" join adjectives, not foods.
    expect(cleanIngredientName("2 small or medium racks baby back ribs, membranes removed"))
      .toBe("baby back rib");
    expect(cleanIngredientName("red and/or yellow bell peppers, stemmed, seeded"))
      .toBe("red yellow bell pepper");
  });

  it("keeps words that only look plural, and folds accents", () => {
    expect(cleanIngredientName("asparagus, trimmed")).toBe("asparagus");
    expect(cleanIngredientName("jalape\u00f1o pepper, stemmed, seeded, and chopped"))
      .toBe("jalapeno pepper");
  });
});

describe("purchase units", () => {
  it("recovers the unit you'd buy in when the recipe gave none", () => {
    expect(detectPurchaseUnit("1 small head of cabbage, cored")).toBe("head");
    expect(detectPurchaseUnit("1 (15 oz) can black beans, drained")).toBe("can");
    expect(detectPurchaseUnit("3 garlic cloves, minced")).toBe("clove");
    expect(detectPurchaseUnit("2 bunches scallions")).toBe("bunch");
  });

  it("ignores measuring units, which describe the recipe not the trip", () => {
    expect(detectPurchaseUnit("½ cup plain breadcrumbs")).toBe("");
    expect(detectPurchaseUnit("1 tsp Worcestershire sauce")).toBe("");
    expect(detectPurchaseUnit("1 ½ lbs ground beef")).toBe("");
  });
});
