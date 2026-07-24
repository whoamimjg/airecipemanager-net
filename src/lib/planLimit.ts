/**
 * Recognises the plan-limit rejection raised by the `recipes_enforce_plan_limit` trigger
 * (see supabase/migrations/20260720_enforce_recipe_plan_limit.sql) so we can show the
 * user what actually happened instead of a generic "failed to save".
 *
 * The trigger's message is deliberately surface-neutral — it states the limit and nothing
 * about how to upgrade — because the mobile apps surface the same error and must not point
 * at a purchase flow (App Store guideline 3.1.1). On the web we're free to add that.
 */
export function planLimitMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message;
  if (!message) return null;
  return /recipe limit for your plan/i.test(message) ? message : null;
}

/** The web-facing version: the limit, plus where to do something about it. */
export function recipeSaveErrorMessage(error: unknown, fallback = "Failed to save recipe"): string {
  const limit = planLimitMessage(error);
  return limit ? `${limit} Upgrade your plan in Settings to add more.` : fallback;
}
