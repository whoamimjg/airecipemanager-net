/**
 * Demo household fixture data.
 *
 * Household: family of four in suburban Ohio — two adults, two school-age kids.
 * Fast weeknights, a project meal at the weekend. No restrictive diets.
 * Grocery budget $1,000/month, tracking around $900.
 *
 * Everything here is cross-referenced: the meal plan names recipes that exist,
 * those recipes' ingredients decide what lands on the grocery list, and the
 * inventory covers exactly the subset meant to show as "already have".
 * Kept separate from seed-demo.ts so the fixtures can be linted and asserted
 * without a database connection.
 */

export const DEMO_EMAIL = "playstoretest@airecipemanager.com";

export const DISPLAY_NAME = "Demo Household";
export const HOUSEHOLD_SIZE = 4;
export const MONTHLY_BUDGET = 1000;
export const ZIP_CODE = "43017"; // Dublin, OH

/**
 * The demo account needs an unlimited plan or the seed cannot exist.
 *
 * recipes_enforce_plan_limit (supabase/migrations/20260720_…) is a BEFORE INSERT
 * trigger: a user with no subscriptions row, or an inactive one, falls back to
 * the Free limit of 25 — and this fixture carries 43 recipes. A negative
 * recipe_limit is the trigger's documented "unlimited" sentinel.
 *
 * Set by the seed rather than by hand so re-running always restores it, and so
 * the demo can't silently regress to Free after a subscription sync.
 */
export const DEMO_PLAN = {
  plan: "unlimited" as const,
  recipe_limit: -1,
  is_active: true,
  price_monthly: 0,
};

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type DishType = "Main" | "Side" | "Soup" | "Salad" | "Dessert" | "Beverage";

export interface DemoRecipe {
  title: string;
  description: string;
  meal_type: MealType;
  dish_type: DishType;
  prep_time: number;
  cook_time: number;
  servings: number;
  /** null = deliberately unrated; a few of these look more honest than all-5s. */
  rating: number | null;
  /** Unsplash photo id; resolved to a stable URL and uploaded to storage. */
  photo: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  instructions: string[];
}

/**
 * Titles are already clean: letters, numbers, space, hyphen, ampersand and
 * apostrophe only. sanitizeTitle() in seed-demo.ts re-asserts this at write
 * time so a later edit can't reintroduce "{Copycat Recipe}" style artifacts.
 */
export const RECIPES: DemoRecipe[] = [
  // ---- Breakfast ----------------------------------------------------------
  {
    title: "Sheet Pan Pancakes",
    description: "One pan, no flipping, feeds the whole table at once.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 10, cook_time: 18, servings: 6, rating: 5,
    photo: "photo-1567620905732-2d1ec7ab7445",
    ingredients: [
      { name: "all-purpose flour", quantity: "2", unit: "cups" },
      { name: "granulated sugar", quantity: "3", unit: "tbsp" },
      { name: "baking powder", quantity: "1", unit: "tbsp" },
      { name: "milk", quantity: "1.5", unit: "cups" },
      { name: "large eggs", quantity: "2", unit: "" },
      { name: "unsalted butter, melted", quantity: "4", unit: "tbsp" },
      { name: "blueberries", quantity: "1", unit: "cup" },
    ],
    instructions: [
      "Heat oven to 425F and butter a rimmed sheet pan.",
      "Whisk dry ingredients, then stir in milk, eggs and melted butter until just combined.",
      "Spread on the pan, scatter blueberries, bake 15 to 18 minutes until set.",
      "Cut into squares and serve with syrup.",
    ],
  },
  {
    title: "Overnight Oats with Peanut Butter & Banana",
    description: "Assembled the night before, grabbed on the way out the door.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 8, cook_time: 0, servings: 4, rating: 4,
    photo: "photo-1517673132405-a56a62b18caf",
    ingredients: [
      { name: "rolled oats", quantity: "2", unit: "cups" },
      { name: "milk", quantity: "2", unit: "cups" },
      { name: "peanut butter", quantity: "4", unit: "tbsp" },
      { name: "bananas", quantity: "2", unit: "" },
      { name: "honey", quantity: "2", unit: "tbsp" },
    ],
    instructions: [
      "Divide oats between four jars.",
      "Add milk, peanut butter and honey, stir well.",
      "Refrigerate overnight and top with sliced banana before serving.",
    ],
  },
  {
    title: "Scrambled Eggs & Toast",
    description: "The five-minute weekday default.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 3, cook_time: 6, servings: 4, rating: 4,
    photo: "photo-1525351484163-7529414344d8",
    ingredients: [
      { name: "large eggs", quantity: "8", unit: "" },
      { name: "unsalted butter", quantity: "2", unit: "tbsp" },
      { name: "milk", quantity: "0.25", unit: "cup" },
      { name: "bread", quantity: "4", unit: "slices" },
      { name: "salt", quantity: "0.5", unit: "tsp" },
    ],
    instructions: [
      "Beat eggs with milk and salt.",
      "Melt butter over low heat, add eggs, stir slowly until just set.",
      "Serve on buttered toast.",
    ],
  },
  {
    title: "Greek Yogurt Parfaits",
    description: "Layered in a glass so the kids think it's dessert.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 6, cook_time: 0, servings: 4, rating: 3,
    photo: "photo-1488477181946-6428a0291777",
    ingredients: [
      { name: "greek yogurt", quantity: "3", unit: "cups" },
      { name: "granola", quantity: "1.5", unit: "cups" },
      { name: "strawberries", quantity: "2", unit: "cups" },
      { name: "honey", quantity: "3", unit: "tbsp" },
    ],
    instructions: [
      "Layer yogurt, granola and sliced strawberries in glasses.",
      "Drizzle with honey and serve straight away so the granola stays crisp.",
    ],
  },
  {
    title: "Freezer Breakfast Burritos",
    description: "Make a dozen on Sunday, microwave them all week.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 20, cook_time: 15, servings: 8, rating: 5,
    photo: "photo-1626700051175-6818013e1d4f",
    ingredients: [
      { name: "large eggs", quantity: "10", unit: "" },
      { name: "breakfast sausage", quantity: "1", unit: "lb" },
      { name: "shredded cheddar cheese", quantity: "2", unit: "cups" },
      { name: "flour tortillas", quantity: "8", unit: "" },
      { name: "bell peppers", quantity: "2", unit: "" },
    ],
    instructions: [
      "Brown the sausage, add diced peppers and cook until soft.",
      "Scramble the eggs and fold through the sausage mixture.",
      "Fill tortillas, add cheese, roll tightly and wrap in foil.",
      "Freeze up to three months; reheat 2 minutes in the microwave.",
    ],
  },
  {
    title: "Blueberry Baked Oatmeal",
    description: "A weekend bake that reheats all week.",
    meal_type: "Breakfast", dish_type: "Main",
    prep_time: 12, cook_time: 35, servings: 6, rating: 4,
    photo: "photo-1595908129746-57ca1a63dd4d",
    ingredients: [
      { name: "rolled oats", quantity: "3", unit: "cups" },
      { name: "milk", quantity: "2", unit: "cups" },
      { name: "large eggs", quantity: "2", unit: "" },
      { name: "maple syrup", quantity: "0.5", unit: "cup" },
      { name: "blueberries", quantity: "2", unit: "cups" },
      { name: "baking powder", quantity: "2", unit: "tsp" },
    ],
    instructions: [
      "Heat oven to 350F and grease a baking dish.",
      "Combine oats and baking powder; whisk milk, eggs and syrup separately.",
      "Fold together with the blueberries, pour into the dish and bake 35 minutes.",
    ],
  },

  // ---- Lunch --------------------------------------------------------------
  {
    title: "Turkey & Swiss Wraps",
    description: "Lunchbox staple that survives until noon.",
    meal_type: "Lunch", dish_type: "Main",
    prep_time: 10, cook_time: 0, servings: 4, rating: 3,
    photo: "photo-1509722747041-616f39b57569",
    ingredients: [
      { name: "flour tortillas", quantity: "4", unit: "" },
      { name: "sliced turkey", quantity: "12", unit: "oz" },
      { name: "swiss cheese", quantity: "4", unit: "slices" },
      { name: "romaine lettuce", quantity: "4", unit: "leaves" },
      { name: "mayonnaise", quantity: "3", unit: "tbsp" },
    ],
    instructions: [
      "Spread mayonnaise over each tortilla.",
      "Layer turkey, cheese and lettuce, then roll tightly and halve on the diagonal.",
    ],
  },
  {
    title: "Chicken Caesar Salad",
    description: "Leftover roast chicken, put to work.",
    meal_type: "Lunch", dish_type: "Salad",
    prep_time: 15, cook_time: 0, servings: 4, rating: 4,
    photo: "photo-1550304943-4f24f54ddde9",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "2", unit: "" },
      { name: "romaine lettuce", quantity: "2", unit: "heads" },
      { name: "parmesan cheese", quantity: "0.5", unit: "cup" },
      { name: "croutons", quantity: "1.5", unit: "cups" },
      { name: "caesar dressing", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Slice the cooked chicken.",
      "Toss chopped romaine with dressing, then add chicken, parmesan and croutons.",
    ],
  },
  {
    title: "Tomato Soup & Grilled Cheese",
    description: "The rainy-Tuesday answer.",
    meal_type: "Lunch", dish_type: "Soup",
    prep_time: 10, cook_time: 25, servings: 4, rating: 5,
    photo: "photo-1547592166-23ac45744acd",
    ingredients: [
      { name: "canned crushed tomatoes", quantity: "28", unit: "oz" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "heavy cream", quantity: "0.5", unit: "cup" },
      { name: "bread", quantity: "8", unit: "slices" },
      { name: "shredded cheddar cheese", quantity: "2", unit: "cups" },
      { name: "unsalted butter", quantity: "4", unit: "tbsp" },
    ],
    instructions: [
      "Soften the diced onion in butter, add tomatoes and simmer 20 minutes.",
      "Blend smooth and stir in cream.",
      "Griddle the sandwiches until golden and serve alongside.",
    ],
  },
  {
    title: "Ham & Cheese Quesadillas",
    description: "Ten minutes start to finish.",
    meal_type: "Lunch", dish_type: "Main",
    prep_time: 5, cook_time: 8, servings: 4, rating: 3,
    photo: "photo-1618040996337-56904b7850b9",
    ingredients: [
      { name: "flour tortillas", quantity: "4", unit: "" },
      { name: "diced ham", quantity: "8", unit: "oz" },
      { name: "shredded cheddar cheese", quantity: "2", unit: "cups" },
      { name: "sour cream", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Fill each tortilla with ham and cheese and fold.",
      "Griddle 3 to 4 minutes per side until crisp; serve with sour cream.",
    ],
  },
  {
    title: "Chicken Noodle Soup",
    description: "Freezes well and never gets turned down.",
    meal_type: "Lunch", dish_type: "Soup",
    prep_time: 15, cook_time: 40, servings: 6, rating: 5,
    photo: "photo-1476718406336-bb5a9690ee2a",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "1.5", unit: "lbs" },
      { name: "chicken broth", quantity: "8", unit: "cups" },
      { name: "carrots", quantity: "3", unit: "" },
      { name: "celery", quantity: "3", unit: "stalks" },
      { name: "egg noodles", quantity: "3", unit: "cups" },
      { name: "yellow onion", quantity: "1", unit: "" },
    ],
    instructions: [
      "Simmer the chicken in broth 20 minutes, then shred.",
      "Add diced carrot, celery and onion; cook until tender.",
      "Stir in noodles, cook 8 minutes, return the chicken and season.",
    ],
  },
  {
    title: "Buffalo Chicken Sliders",
    description: "Game-day lunch on soft rolls.",
    meal_type: "Lunch", dish_type: "Main",
    prep_time: 12, cook_time: 20, servings: 6, rating: 4,
    photo: "photo-1606755962773-d324e0a13086",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "2", unit: "lbs" },
      { name: "hot sauce", quantity: "0.5", unit: "cup" },
      { name: "slider buns", quantity: "12", unit: "" },
      { name: "ranch dressing", quantity: "0.5", unit: "cup" },
      { name: "unsalted butter", quantity: "3", unit: "tbsp" },
    ],
    instructions: [
      "Poach and shred the chicken.",
      "Toss with melted butter and hot sauce.",
      "Pile onto buns and finish with ranch.",
    ],
  },

  {
    title: "Egg Salad Pitas",
    description: "Uses up the eggs nobody wanted hard-boiled.",
    meal_type: "Lunch", dish_type: "Main",
    prep_time: 15, cook_time: 12, servings: 4, rating: 3,
    photo: "photo-1525351484163-7529414344d8",
    ingredients: [
      { name: "large eggs", quantity: "8", unit: "" },
      { name: "pita bread", quantity: "4", unit: "" },
      { name: "mayonnaise", quantity: "0.33", unit: "cup" },
      { name: "celery", quantity: "2", unit: "stalks" },
      { name: "dijon mustard", quantity: "1", unit: "tbsp" },
    ],
    instructions: [
      "Hard boil the eggs, cool and chop.",
      "Fold with mayonnaise, diced celery and mustard.",
      "Spoon into warm pita halves.",
    ],
  },
  {
    title: "Greek Pasta Salad",
    description: "Made Sunday, better by Tuesday.",
    meal_type: "Lunch", dish_type: "Salad",
    prep_time: 20, cook_time: 10, servings: 6, rating: 4,
    photo: "photo-1512621776951-a57141f2eefd",
    ingredients: [
      { name: "penne pasta", quantity: "1", unit: "lb" },
      { name: "cucumbers", quantity: "2", unit: "" },
      { name: "cherry tomatoes", quantity: "2", unit: "cups" },
      { name: "feta cheese", quantity: "1", unit: "cup" },
      { name: "black olives", quantity: "0.5", unit: "cup" },
      { name: "italian dressing", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Cook and cool the pasta.",
      "Toss with chopped cucumber, halved tomatoes, feta and olives.",
      "Dress and chill at least an hour.",
    ],
  },
  {
    title: "Mediterranean Hummus Plate",
    description: "Assembled, not cooked — the no-appetite lunch.",
    meal_type: "Lunch", dish_type: "Main",
    prep_time: 12, cook_time: 0, servings: 4, rating: null,
    photo: "photo-1512621776951-a57141f2eefd",
    ingredients: [
      { name: "hummus", quantity: "2", unit: "cups" },
      { name: "pita bread", quantity: "4", unit: "" },
      { name: "cucumbers", quantity: "2", unit: "" },
      { name: "bell peppers", quantity: "2", unit: "" },
      { name: "black olives", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Cut the vegetables into sticks and the pita into wedges.",
      "Arrange around a bowl of hummus with the olives alongside.",
    ],
  },

  // ---- Dinner: fast weeknights -------------------------------------------
  {
    title: "Sheet Pan Chicken Fajitas",
    description: "Everything on one pan, on the table in half an hour.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 15, cook_time: 22, servings: 6, rating: 5,
    photo: "photo-1512838243191-e81e8f66f1fd",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "2", unit: "lbs" },
      { name: "bell peppers", quantity: "3", unit: "" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "olive oil", quantity: "3", unit: "tbsp" },
      { name: "chili powder", quantity: "2", unit: "tsp" },
      { name: "flour tortillas", quantity: "8", unit: "" },
      { name: "limes", quantity: "2", unit: "" },
    ],
    instructions: [
      "Heat oven to 425F.",
      "Toss sliced chicken, peppers and onion with oil and chili powder.",
      "Spread on a sheet pan and roast 20 to 22 minutes.",
      "Finish with lime and serve in warm tortillas.",
    ],
  },
  {
    title: "Weeknight Spaghetti & Meat Sauce",
    description: "Doubles easily and the leftovers go in tomorrow's lunch.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 10, cook_time: 30, servings: 6, rating: 5,
    photo: "photo-1621996346565-e3dbc646d9a9",
    ingredients: [
      { name: "ground beef", quantity: "1.5", unit: "lbs" },
      { name: "spaghetti", quantity: "1", unit: "lb" },
      { name: "marinara sauce", quantity: "24", unit: "oz" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "garlic", quantity: "3", unit: "cloves" },
      { name: "parmesan cheese", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Brown the beef with diced onion and garlic; drain.",
      "Add marinara and simmer 20 minutes.",
      "Toss with cooked spaghetti and finish with parmesan.",
    ],
  },
  {
    title: "Honey Garlic Salmon",
    description: "Fifteen minutes and it looks like you tried.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 8, cook_time: 14, servings: 4, rating: 4,
    photo: "photo-1467003909585-2f8a72700288",
    ingredients: [
      { name: "salmon fillets", quantity: "4", unit: "" },
      { name: "honey", quantity: "3", unit: "tbsp" },
      { name: "soy sauce", quantity: "3", unit: "tbsp" },
      { name: "garlic", quantity: "3", unit: "cloves" },
      { name: "olive oil", quantity: "1", unit: "tbsp" },
    ],
    instructions: [
      "Whisk honey, soy sauce and minced garlic.",
      "Sear the salmon skin-side down 4 minutes, flip, add the glaze.",
      "Spoon over the sauce and cook 3 more minutes.",
    ],
  },
  {
    title: "Slow Cooker Beef Chili",
    description: "Starts before school, ready at six.",
    meal_type: "Dinner", dish_type: "Soup",
    prep_time: 20, cook_time: 240, servings: 8, rating: 5,
    photo: "photo-1455619452474-d2be8b1e70cd",
    ingredients: [
      { name: "ground beef", quantity: "2", unit: "lbs" },
      { name: "canned kidney beans", quantity: "30", unit: "oz" },
      { name: "canned crushed tomatoes", quantity: "28", unit: "oz" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "chili powder", quantity: "3", unit: "tbsp" },
      { name: "shredded cheddar cheese", quantity: "1", unit: "cup" },
    ],
    instructions: [
      "Brown the beef with the onion and drain.",
      "Add everything but the cheese to the slow cooker.",
      "Cook on low 4 hours; serve with cheese on top.",
    ],
  },
  {
    title: "Baked Chicken Parmesan",
    description: "Baked rather than fried, still disappears.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 20, cook_time: 30, servings: 6, rating: 4,
    photo: "photo-1632778149955-e80f8ceca2e8",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "2", unit: "lbs" },
      { name: "breadcrumbs", quantity: "1.5", unit: "cups" },
      { name: "marinara sauce", quantity: "24", unit: "oz" },
      { name: "mozzarella cheese", quantity: "2", unit: "cups" },
      { name: "parmesan cheese", quantity: "0.5", unit: "cup" },
      { name: "large eggs", quantity: "2", unit: "" },
    ],
    instructions: [
      "Heat oven to 400F.",
      "Dip the cutlets in beaten egg, then breadcrumbs mixed with parmesan.",
      "Bake 20 minutes, top with sauce and mozzarella, bake 10 more.",
    ],
  },
  {
    title: "Taco Tuesday Beef Tacos",
    description: "Non-negotiable, weekly.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 12, cook_time: 15, servings: 6, rating: 4,
    photo: "photo-1565299585323-38d6b0865b47",
    ingredients: [
      { name: "ground beef", quantity: "2", unit: "lbs" },
      { name: "taco seasoning", quantity: "2", unit: "tbsp" },
      { name: "corn tortillas", quantity: "12", unit: "" },
      { name: "shredded cheddar cheese", quantity: "2", unit: "cups" },
      { name: "romaine lettuce", quantity: "1", unit: "head" },
      { name: "sour cream", quantity: "1", unit: "cup" },
    ],
    instructions: [
      "Brown the beef, drain, add seasoning and a splash of water.",
      "Warm the tortillas and set out the toppings.",
    ],
  },
  {
    title: "Creamy Tuscan Chicken",
    description: "Tastes like a restaurant, cooks in one skillet.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 12, cook_time: 25, servings: 4, rating: 5,
    photo: "photo-1604908176997-125f25cc6f3d",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "1.5", unit: "lbs" },
      { name: "heavy cream", quantity: "1", unit: "cup" },
      { name: "spinach", quantity: "4", unit: "cups" },
      { name: "sun dried tomatoes", quantity: "0.5", unit: "cup" },
      { name: "garlic", quantity: "4", unit: "cloves" },
      { name: "parmesan cheese", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Sear the chicken and set aside.",
      "Soften garlic, add cream, tomatoes and parmesan.",
      "Wilt in the spinach, return the chicken and simmer 5 minutes.",
    ],
  },
  {
    title: "Baked Ziti",
    description: "Assembles ahead and bakes straight from the fridge.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 20, cook_time: 40, servings: 8, rating: 4,
    photo: "photo-1621996346565-e3dbc646d9a9",
    ingredients: [
      { name: "ziti pasta", quantity: "1", unit: "lb" },
      { name: "ground beef", quantity: "1", unit: "lb" },
      { name: "marinara sauce", quantity: "32", unit: "oz" },
      { name: "ricotta cheese", quantity: "15", unit: "oz" },
      { name: "mozzarella cheese", quantity: "3", unit: "cups" },
    ],
    instructions: [
      "Cook the ziti to just under al dente.",
      "Brown the beef and mix with sauce.",
      "Layer pasta, ricotta, sauce and mozzarella; bake 40 minutes at 375F.",
    ],
  },
  {
    title: "Teriyaki Chicken Rice Bowls",
    description: "Rice cooker does most of the work.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 15, cook_time: 20, servings: 4, rating: 4,
    photo: "photo-1603133872878-684f208fb84b",
    ingredients: [
      { name: "boneless, skinless chicken thighs", quantity: "1.5", unit: "lbs" },
      { name: "white rice", quantity: "2", unit: "cups" },
      { name: "soy sauce", quantity: "0.33", unit: "cup" },
      { name: "honey", quantity: "3", unit: "tbsp" },
      { name: "broccoli", quantity: "1", unit: "head" },
      { name: "sesame seeds", quantity: "1", unit: "tbsp" },
    ],
    instructions: [
      "Start the rice.",
      "Sear the thighs, add soy sauce and honey, reduce to a glaze.",
      "Steam the broccoli and build the bowls.",
    ],
  },
  {
    title: "Sloppy Joes",
    description: "Twenty minutes, one skillet, zero complaints.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 8, cook_time: 20, servings: 6, rating: 3,
    photo: "photo-1594212699903-ec8a3eca50f5",
    ingredients: [
      { name: "ground beef", quantity: "1.5", unit: "lbs" },
      { name: "bbq sauce", quantity: "1", unit: "cup" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "hamburger buns", quantity: "6", unit: "" },
      { name: "worcestershire sauce", quantity: "1", unit: "tbsp" },
    ],
    instructions: [
      "Brown the beef with the onion and drain.",
      "Stir in the sauces and simmer 10 minutes.",
      "Spoon onto toasted buns.",
    ],
  },
  {
    title: "Pork Chops with Apples",
    description: "Autumn on a plate, one pan.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 10, cook_time: 25, servings: 4, rating: 4,
    photo: "photo-1432139555190-58524dae6a55",
    ingredients: [
      { name: "pork chops", quantity: "4", unit: "" },
      { name: "apples", quantity: "3", unit: "" },
      { name: "yellow onion", quantity: "1", unit: "" },
      { name: "chicken broth", quantity: "1", unit: "cup" },
      { name: "unsalted butter", quantity: "2", unit: "tbsp" },
    ],
    instructions: [
      "Sear the chops 4 minutes per side and set aside.",
      "Soften apple and onion wedges in butter.",
      "Add broth, return the chops and simmer until cooked through.",
    ],
  },
  {
    title: "Shrimp Scampi",
    description: "Faster than ordering in.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 10, cook_time: 12, servings: 4, rating: 4,
    photo: "photo-1633504581786-316c8002b1b9",
    ingredients: [
      { name: "shrimp", quantity: "1.5", unit: "lbs" },
      { name: "linguine", quantity: "1", unit: "lb" },
      { name: "garlic", quantity: "5", unit: "cloves" },
      { name: "unsalted butter", quantity: "5", unit: "tbsp" },
      { name: "lemons", quantity: "2", unit: "" },
      { name: "parsley", quantity: "0.25", unit: "cup" },
    ],
    instructions: [
      "Cook the linguine.",
      "Sizzle garlic in butter, add shrimp and cook 3 minutes.",
      "Toss with pasta, lemon juice and parsley.",
    ],
  },

  // ---- Dinner: weekend project meals --------------------------------------
  {
    title: "Sunday Pot Roast",
    description: "Three hours in the oven, worth every minute.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 25, cook_time: 180, servings: 8, rating: 5,
    photo: "photo-1544025162-d76694265947",
    ingredients: [
      { name: "chuck roast", quantity: "4", unit: "lbs" },
      { name: "carrots", quantity: "6", unit: "" },
      { name: "potatoes", quantity: "2", unit: "lbs" },
      { name: "yellow onion", quantity: "2", unit: "" },
      { name: "beef broth", quantity: "3", unit: "cups" },
      { name: "garlic", quantity: "4", unit: "cloves" },
    ],
    instructions: [
      "Heat oven to 325F and sear the roast on all sides.",
      "Add broth, aromatics and vegetables; cover.",
      "Braise 3 hours until it pulls apart with a fork.",
    ],
  },
  {
    title: "Homemade Pizza Night",
    description: "Everyone builds their own; the dough rests while homework happens.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 90, cook_time: 15, servings: 6, rating: 5,
    photo: "photo-1513104890138-7c749659a591",
    ingredients: [
      { name: "all-purpose flour", quantity: "4", unit: "cups" },
      { name: "active dry yeast", quantity: "1", unit: "tbsp" },
      { name: "marinara sauce", quantity: "16", unit: "oz" },
      { name: "mozzarella cheese", quantity: "3", unit: "cups" },
      { name: "pepperoni", quantity: "6", unit: "oz" },
      { name: "olive oil", quantity: "3", unit: "tbsp" },
    ],
    instructions: [
      "Mix and knead the dough, then let it rise about an hour.",
      "Heat oven as hot as it goes with a stone inside.",
      "Shape, top and bake 12 to 15 minutes.",
    ],
  },
  {
    title: "Beef Stew",
    description: "Better on day two, which is the point.",
    meal_type: "Dinner", dish_type: "Soup",
    prep_time: 30, cook_time: 150, servings: 8, rating: 4,
    photo: "photo-1547592166-23ac45744acd",
    ingredients: [
      { name: "beef stew meat", quantity: "3", unit: "lbs" },
      { name: "potatoes", quantity: "2", unit: "lbs" },
      { name: "carrots", quantity: "5", unit: "" },
      { name: "beef broth", quantity: "6", unit: "cups" },
      { name: "tomato paste", quantity: "3", unit: "tbsp" },
      { name: "all-purpose flour", quantity: "0.33", unit: "cup" },
    ],
    instructions: [
      "Toss the beef in flour and brown in batches.",
      "Add tomato paste, then broth, and simmer 90 minutes.",
      "Add the vegetables and cook another hour.",
    ],
  },
  {
    title: "Smoked Baby Back Ribs",
    description: "A Saturday project with a payoff.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 30, cook_time: 300, servings: 6, rating: 5,
    photo: "photo-1544025162-d76694265947",
    ingredients: [
      { name: "baby back ribs", quantity: "2", unit: "racks" },
      { name: "brown sugar", quantity: "0.5", unit: "cup" },
      { name: "paprika", quantity: "3", unit: "tbsp" },
      { name: "bbq sauce", quantity: "2", unit: "cups" },
      { name: "apple cider vinegar", quantity: "0.5", unit: "cup" },
    ],
    instructions: [
      "Pull the membrane and coat with the sugar and spice rub.",
      "Smoke at 225F for 3 hours, wrap, then 2 hours more.",
      "Sauce and finish over direct heat.",
    ],
  },
  {
    title: "Chicken Pot Pie",
    description: "Uses up the roast chicken and half the crisper.",
    meal_type: "Dinner", dish_type: "Main",
    prep_time: 35, cook_time: 45, servings: 6, rating: 4,
    photo: "photo-1476718406336-bb5a9690ee2a",
    ingredients: [
      { name: "boneless, skinless chicken breasts", quantity: "1.5", unit: "lbs" },
      { name: "frozen peas and carrots", quantity: "2", unit: "cups" },
      { name: "chicken broth", quantity: "2", unit: "cups" },
      { name: "heavy cream", quantity: "1", unit: "cup" },
      { name: "pie crust", quantity: "2", unit: "" },
      { name: "all-purpose flour", quantity: "0.33", unit: "cup" },
    ],
    instructions: [
      "Make a roux, whisk in broth and cream until thick.",
      "Fold in the chicken and vegetables.",
      "Fill the crust, top, vent and bake 45 minutes at 400F.",
    ],
  },

  // ---- Sides & salads -----------------------------------------------------
  {
    title: "Garlic Mashed Potatoes",
    description: "The side that gets requested by name.",
    meal_type: "Dinner", dish_type: "Side",
    prep_time: 15, cook_time: 25, servings: 6, rating: 5,
    photo: "photo-1600891964092-4316c288032e",
    ingredients: [
      { name: "potatoes", quantity: "3", unit: "lbs" },
      { name: "unsalted butter", quantity: "6", unit: "tbsp" },
      { name: "milk", quantity: "1", unit: "cup" },
      { name: "garlic", quantity: "5", unit: "cloves" },
      { name: "salt", quantity: "2", unit: "tsp" },
    ],
    instructions: [
      "Boil the potatoes with the garlic until tender.",
      "Drain, mash with warm milk and butter, season well.",
    ],
  },
  {
    title: "Roasted Broccoli with Parmesan",
    description: "The only way the eight-year-old eats it.",
    meal_type: "Dinner", dish_type: "Side",
    prep_time: 8, cook_time: 20, servings: 4, rating: 4,
    photo: "photo-1459411621453-7b03977f4bfc",
    ingredients: [
      { name: "broccoli", quantity: "2", unit: "heads" },
      { name: "olive oil", quantity: "3", unit: "tbsp" },
      { name: "parmesan cheese", quantity: "0.33", unit: "cup" },
      { name: "garlic", quantity: "3", unit: "cloves" },
    ],
    instructions: [
      "Heat oven to 425F.",
      "Toss florets with oil and garlic, roast 18 to 20 minutes.",
      "Shower with parmesan straight out of the oven.",
    ],
  },
  {
    title: "Buttermilk Cornbread",
    description: "Goes with the chili, no discussion.",
    meal_type: "Dinner", dish_type: "Side",
    prep_time: 10, cook_time: 25, servings: 8, rating: 4,
    photo: "photo-1509440159596-0249088772ff",
    ingredients: [
      { name: "cornmeal", quantity: "1.5", unit: "cups" },
      { name: "all-purpose flour", quantity: "1", unit: "cup" },
      { name: "buttermilk", quantity: "1.5", unit: "cups" },
      { name: "large eggs", quantity: "2", unit: "" },
      { name: "unsalted butter", quantity: "6", unit: "tbsp" },
      { name: "granulated sugar", quantity: "0.25", unit: "cup" },
    ],
    instructions: [
      "Heat a skillet in a 400F oven with butter in it.",
      "Combine the batter, pour into the hot pan and bake 25 minutes.",
    ],
  },
  {
    title: "Simple House Salad",
    description: "Five minutes while dinner finishes.",
    meal_type: "Dinner", dish_type: "Salad",
    prep_time: 8, cook_time: 0, servings: 4, rating: 3,
    photo: "photo-1512621776951-a57141f2eefd",
    ingredients: [
      { name: "romaine lettuce", quantity: "1", unit: "head" },
      { name: "cherry tomatoes", quantity: "1", unit: "cup" },
      { name: "cucumbers", quantity: "1", unit: "" },
      { name: "ranch dressing", quantity: "0.33", unit: "cup" },
    ],
    instructions: ["Chop everything, toss with dressing just before serving."],
  },
  {
    title: "Creamy Coleslaw",
    description: "Made an hour ahead so it softens.",
    meal_type: "Dinner", dish_type: "Salad",
    prep_time: 15, cook_time: 0, servings: 8, rating: null,
    photo: "photo-1512621776951-a57141f2eefd",
    ingredients: [
      { name: "green cabbage", quantity: "1", unit: "head" },
      { name: "carrots", quantity: "2", unit: "" },
      { name: "mayonnaise", quantity: "0.75", unit: "cup" },
      { name: "apple cider vinegar", quantity: "2", unit: "tbsp" },
      { name: "granulated sugar", quantity: "2", unit: "tbsp" },
    ],
    instructions: ["Shred the cabbage and carrot.", "Whisk the dressing, toss, and chill an hour."],
  },

  // ---- Snacks & desserts --------------------------------------------------
  {
    title: "Chocolate Chip Cookies",
    description: "The recipe on the back of the bag, slightly improved.",
    meal_type: "Snack", dish_type: "Dessert",
    prep_time: 20, cook_time: 11, servings: 8, rating: 5,
    photo: "photo-1499636136210-6f4ee915583e",
    ingredients: [
      { name: "all-purpose flour", quantity: "2.25", unit: "cups" },
      { name: "unsalted butter", quantity: "1", unit: "cup" },
      { name: "brown sugar", quantity: "0.75", unit: "cup" },
      { name: "granulated sugar", quantity: "0.75", unit: "cup" },
      { name: "large eggs", quantity: "2", unit: "" },
      { name: "chocolate chips", quantity: "2", unit: "cups" },
    ],
    instructions: [
      "Cream butter and both sugars, beat in the eggs.",
      "Fold in flour then the chips.",
      "Bake at 375F for 10 to 11 minutes.",
    ],
  },
  {
    title: "Apple Slices with Peanut Butter",
    description: "After school, every day.",
    meal_type: "Snack", dish_type: "Side",
    prep_time: 4, cook_time: 0, servings: 4, rating: 4,
    photo: "photo-1568702846914-96b305d2aaeb",
    ingredients: [
      { name: "apples", quantity: "4", unit: "" },
      { name: "peanut butter", quantity: "0.5", unit: "cup" },
      { name: "cinnamon", quantity: "1", unit: "tsp" },
    ],
    instructions: ["Core and slice the apples.", "Serve with peanut butter and a dusting of cinnamon."],
  },
  {
    title: "Stovetop Popcorn",
    description: "Movie night, three ingredients.",
    meal_type: "Snack", dish_type: "Side",
    prep_time: 3, cook_time: 7, servings: 6, rating: 4,
    photo: "photo-1578849278619-e73505e9610f",
    ingredients: [
      { name: "popcorn kernels", quantity: "0.5", unit: "cup" },
      { name: "vegetable oil", quantity: "3", unit: "tbsp" },
      { name: "unsalted butter", quantity: "3", unit: "tbsp" },
      { name: "salt", quantity: "1", unit: "tsp" },
    ],
    instructions: [
      "Heat oil with three kernels until they pop.",
      "Add the rest, cover, shake until popping slows.",
      "Toss with melted butter and salt.",
    ],
  },
  {
    title: "Banana Bread",
    description: "The answer to four brown bananas.",
    meal_type: "Snack", dish_type: "Dessert",
    prep_time: 15, cook_time: 60, servings: 8, rating: 5,
    photo: "photo-1569762404472-026308ba6b64",
    ingredients: [
      { name: "bananas", quantity: "4", unit: "" },
      { name: "all-purpose flour", quantity: "2", unit: "cups" },
      { name: "granulated sugar", quantity: "0.75", unit: "cup" },
      { name: "unsalted butter", quantity: "0.5", unit: "cup" },
      { name: "large eggs", quantity: "2", unit: "" },
      { name: "baking soda", quantity: "1", unit: "tsp" },
    ],
    instructions: [
      "Mash the bananas and mix with melted butter, sugar and eggs.",
      "Fold in flour and baking soda; bake at 350F for an hour.",
    ],
  },
  {
    title: "Homemade Lemonade",
    description: "Summer on the back porch.",
    meal_type: "Snack", dish_type: "Beverage",
    prep_time: 12, cook_time: 0, servings: 8, rating: 3,
    photo: "photo-1621263764928-df1444c5e859",
    ingredients: [
      { name: "lemons", quantity: "8", unit: "" },
      { name: "granulated sugar", quantity: "1", unit: "cup" },
      { name: "water", quantity: "8", unit: "cups" },
    ],
    instructions: [
      "Warm the sugar with a cup of water into a syrup.",
      "Juice the lemons, combine with the syrup and remaining water, chill.",
    ],
  },
  {
    title: "No Bake Energy Bites",
    description: "Lunchbox filler that isn't a granola bar.",
    meal_type: "Snack", dish_type: "Side",
    prep_time: 15, cook_time: 0, servings: 6, rating: 4,
    photo: "photo-1596723455658-72ebb0d12edd",
    ingredients: [
      { name: "rolled oats", quantity: "1.5", unit: "cups" },
      { name: "peanut butter", quantity: "0.75", unit: "cup" },
      { name: "honey", quantity: "0.5", unit: "cup" },
      { name: "chocolate chips", quantity: "0.5", unit: "cup" },
    ],
    instructions: ["Mix everything.", "Chill 30 minutes, then roll into balls."],
  },
];

/**
 * Inventory. Generic pantry names in Title Case — never receipt-scan brand
 * strings like "KFD Milk Barbecue 12L" or "Sticky Fingers BBQ Sauce".
 *
 * `expiresInDays` is relative to the seed run so the expiry alerts stay true
 * however long after seeding the screenshots get taken:
 *   exactly 3 items inside 5 days, exactly 1 already expired.
 */
export interface DemoInventoryItem {
  name: string;
  quantity: number;
  unit: string;
  storage_location: "fridge" | "freezer" | "pantry" | "cabinet";
  category: string;
  price_per_unit: number;
  expiresInDays: number | null;
}

export const INVENTORY: DemoInventoryItem[] = [
  // Fridge
  { name: "Milk", quantity: 2, unit: "gal", storage_location: "fridge", category: "Dairy", price_per_unit: 3.49, expiresInDays: 4 },   // expiring
  { name: "Large Eggs", quantity: 18, unit: "pcs", storage_location: "fridge", category: "Dairy", price_per_unit: 0.28, expiresInDays: 12 },
  { name: "Butter", quantity: 2, unit: "pcs", storage_location: "fridge", category: "Dairy", price_per_unit: 4.29, expiresInDays: 45 },
  { name: "Shredded Cheddar Cheese", quantity: 2, unit: "pcs", storage_location: "fridge", category: "Dairy", price_per_unit: 3.99, expiresInDays: 21 },
  { name: "Greek Yogurt", quantity: 4, unit: "pcs", storage_location: "fridge", category: "Dairy", price_per_unit: 1.29, expiresInDays: 3 },        // expiring
  { name: "Sour Cream", quantity: 1, unit: "pc", storage_location: "fridge", category: "Dairy", price_per_unit: 2.19, expiresInDays: 18 },
  { name: "Romaine Lettuce", quantity: 2, unit: "pcs", storage_location: "fridge", category: "Produce", price_per_unit: 2.49, expiresInDays: 5 },   // expiring
  { name: "Baby Carrots", quantity: 1, unit: "bag", storage_location: "fridge", category: "Produce", price_per_unit: 2.29, expiresInDays: 14 },
  { name: "Bell Peppers", quantity: 3, unit: "pcs", storage_location: "fridge", category: "Produce", price_per_unit: 1.19, expiresInDays: 9 },
  { name: "Spinach", quantity: 1, unit: "bag", storage_location: "fridge", category: "Produce", price_per_unit: 3.29, expiresInDays: -2 },          // expired
  { name: "Chicken Breast", quantity: 3, unit: "lbs", storage_location: "fridge", category: "Meat", price_per_unit: 4.49, expiresInDays: 7 },

  // Freezer
  { name: "Ground Beef", quantity: 4, unit: "lbs", storage_location: "freezer", category: "Meat", price_per_unit: 5.29, expiresInDays: 120 },
  { name: "Frozen Peas And Carrots", quantity: 2, unit: "bags", storage_location: "freezer", category: "Produce", price_per_unit: 1.89, expiresInDays: 180 },
  { name: "Salmon Fillets", quantity: 4, unit: "pcs", storage_location: "freezer", category: "Meat", price_per_unit: 6.99, expiresInDays: 90 },
  { name: "Breakfast Sausage", quantity: 1, unit: "lb", storage_location: "freezer", category: "Meat", price_per_unit: 4.79, expiresInDays: 150 },
  { name: "Frozen Blueberries", quantity: 2, unit: "bags", storage_location: "freezer", category: "Produce", price_per_unit: 3.99, expiresInDays: 200 },

  // Pantry
  { name: "All-Purpose Flour", quantity: 1, unit: "bag", storage_location: "pantry", category: "Baking", price_per_unit: 3.79, expiresInDays: 240 },
  { name: "Granulated Sugar", quantity: 1, unit: "bag", storage_location: "pantry", category: "Baking", price_per_unit: 3.29, expiresInDays: 365 },
  { name: "Brown Sugar", quantity: 1, unit: "bag", storage_location: "pantry", category: "Baking", price_per_unit: 2.49, expiresInDays: 300 },
  { name: "Rolled Oats", quantity: 1, unit: "container", storage_location: "pantry", category: "Grains", price_per_unit: 4.19, expiresInDays: 210 },
  { name: "White Rice", quantity: 1, unit: "bag", storage_location: "pantry", category: "Grains", price_per_unit: 5.49, expiresInDays: 400 },
  { name: "Spaghetti", quantity: 3, unit: "boxes", storage_location: "pantry", category: "Grains", price_per_unit: 1.49, expiresInDays: 330 },
  { name: "Marinara Sauce", quantity: 2, unit: "jars", storage_location: "pantry", category: "Canned Goods", price_per_unit: 2.99, expiresInDays: 280 },
  { name: "Chicken Broth", quantity: 4, unit: "cartons", storage_location: "pantry", category: "Canned Goods", price_per_unit: 2.29, expiresInDays: 250 },
  { name: "Canned Crushed Tomatoes", quantity: 3, unit: "cans", storage_location: "pantry", category: "Canned Goods", price_per_unit: 1.79, expiresInDays: 320 },
  { name: "Peanut Butter", quantity: 1, unit: "jar", storage_location: "pantry", category: "Condiments", price_per_unit: 4.49, expiresInDays: 160 },
  { name: "Flour Tortillas", quantity: 2, unit: "packages", storage_location: "pantry", category: "Bread", price_per_unit: 2.79, expiresInDays: 20 },

  // Cabinet
  { name: "Olive Oil", quantity: 1, unit: "bottle", storage_location: "cabinet", category: "Condiments", price_per_unit: 8.99, expiresInDays: 300 },
  { name: "Salt", quantity: 1, unit: "container", storage_location: "cabinet", category: "Spices", price_per_unit: 1.29, expiresInDays: null },
  { name: "Chili Powder", quantity: 1, unit: "jar", storage_location: "cabinet", category: "Spices", price_per_unit: 2.99, expiresInDays: 400 },
  { name: "Soy Sauce", quantity: 1, unit: "bottle", storage_location: "cabinet", category: "Condiments", price_per_unit: 3.19, expiresInDays: 350 },
  { name: "Honey", quantity: 1, unit: "jar", storage_location: "cabinet", category: "Condiments", price_per_unit: 5.49, expiresInDays: null },
];

/**
 * Meal plan for the current week, Monday to Sunday.
 * Breakfast, lunch and dinner every day; snack on 4 of 7.
 * Titles must exist in RECIPES — assertPlanIntegrity() enforces that.
 */
export interface DemoPlanDay {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack?: string;
}

export const WEEK_PLAN: DemoPlanDay[] = [
  { // Monday
    breakfast: "Scrambled Eggs & Toast",
    lunch: "Turkey & Swiss Wraps",
    dinner: "Weeknight Spaghetti & Meat Sauce",
    snack: "Stovetop Popcorn",
  },
  { // Tuesday
    breakfast: "Overnight Oats with Peanut Butter & Banana",
    lunch: "Chicken Caesar Salad",
    dinner: "Honey Garlic Salmon",
  },
  { // Wednesday
    breakfast: "Greek Yogurt Parfaits",
    lunch: "Tomato Soup & Grilled Cheese",
    dinner: "Teriyaki Chicken Rice Bowls",
    snack: "Apple Slices with Peanut Butter",
  },
  { // Thursday
    breakfast: "Blueberry Baked Oatmeal",
    lunch: "Chicken Noodle Soup",
    dinner: "Sloppy Joes",
  },
  { // Friday
    breakfast: "Greek Yogurt Parfaits",
    lunch: "Egg Salad Pitas",
    dinner: "Homemade Pizza Night",
    snack: "Chocolate Chip Cookies",
  },
  { // Saturday — the weekend project meal
    breakfast: "Sheet Pan Pancakes",
    lunch: "Mediterranean Hummus Plate",
    dinner: "Smoked Baby Back Ribs",
    snack: "Banana Bread",
  },
  { // Sunday — the other project meal
    breakfast: "Freezer Breakfast Burritos",
    lunch: "Greek Pasta Salad",
    dinner: "Sunday Pot Roast",
  },
];

/**
 * Six months of receipts. Aug is deliberately partial — it's the month in
 * progress, and coming in under the $1,000 target is what makes the budget
 * screen read as healthy rather than abandoned.
 * Category split lands near Produce 25 / Meat 30 / Dairy 15 / Other 30.
 */
export const MONTHLY_SPEND: { monthsAgo: number; total: number }[] = [
  { monthsAgo: 5, total: 874 },
  { monthsAgo: 4, total: 912 },
  { monthsAgo: 3, total: 889 },
  { monthsAgo: 2, total: 945 },
  { monthsAgo: 1, total: 903 },
  { monthsAgo: 0, total: 412 },
];

export const CATEGORY_SPLIT: { category: string; share: number }[] = [
  { category: "Produce", share: 0.25 },
  { category: "Meat", share: 0.30 },
  { category: "Dairy", share: 0.15 },
  { category: "Other", share: 0.30 },
];

export const STORES = ["Kroger", "Meijer", "Aldi", "Costco"];
