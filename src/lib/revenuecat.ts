import { ErrorCode, Purchases, PurchasesError, type Package } from "@revenuecat/purchases-js";

/**
 * Website subscriptions run through RevenueCat on the web (Stripe underneath), the
 * same RevenueCat project the iOS app uses. The app user ID is the Supabase user
 * ID on every platform, so a plan bought here unlocks the apps and vice versa;
 * the revenuecat-webhook edge function writes the result to `subscriptions`.
 *
 * These are PUBLIC keys (safe in front-end code). Deployed builds take real
 * payments with the live key; `npm run dev` uses the sandbox key, where checkout
 * accepts Stripe test cards and charges nothing. VITE_REVENUECAT_WEB_KEY
 * overrides either (e.g. set it to the sandbox key to test a deployed preview).
 */
const LIVE_KEY = "rcb_beNbnYBiURNJzeAStuDGAdgxVzrT";
const SANDBOX_KEY = "rcb_sb_aOzxMCLHoatBKnUQDgoFKTfqM";
const API_KEY =
  import.meta.env.VITE_REVENUECAT_WEB_KEY || (import.meta.env.DEV ? SANDBOX_KEY : LIVE_KEY);

export const isSandboxBilling = API_KEY.startsWith("rcb_sb_");

export type PaidPlan = "basic" | "pro" | "unlimited";

let configuredFor: string | null = null;

function purchasesFor(userId: string): Purchases {
  if (Purchases.isConfigured() && configuredFor === userId) {
    return Purchases.getSharedInstance();
  }
  const instance = Purchases.configure({ apiKey: API_KEY, appUserId: userId });
  configuredFor = userId;
  return instance;
}

/**
 * The web package for a plan. RevenueCat Billing product ids contain basic / pro /
 * unlimited (`com.michaelgreene.airecipemanager.pro.monthly`); Stripe Billing products
 * have ids like `prod_…`, so their package id, display name or title is checked too.
 * "pro" is matched as a whole word so it never picks up "product".
 */
function matchesPlan(p: Package, plan: PaidPlan): boolean {
  const word = new RegExp(`(^|[^a-z])${plan}([^a-z]|$)`, "i");
  const product = p.webBillingProduct;
  return [product.identifier, p.identifier, product.displayName, product.title].some((s) => s && word.test(s));
}

async function packageFor(userId: string, plan: PaidPlan): Promise<Package> {
  const offerings = await purchasesFor(userId).getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const pkg = packages.find((p) => matchesPlan(p, plan));
  if (!pkg) {
    throw new Error(
      `The ${plan} plan isn't available for web checkout yet. ` +
        `Found: ${packages.map((p) => p.webBillingProduct.identifier).join(", ") || "no web products"}`,
    );
  }
  return pkg;
}

export type WebPurchaseOutcome = "purchased" | "cancelled";

/** Opens RevenueCat's checkout for the plan. Throws with a readable message on failure. */
export async function purchasePlan(
  userId: string,
  email: string | undefined,
  plan: PaidPlan,
): Promise<WebPurchaseOutcome> {
  const rcPackage = await packageFor(userId, plan);
  try {
    await purchasesFor(userId).purchase({
      rcPackage,
      customerEmail: email,
      termsAndConditionsUrl: "https://airecipemanager.com/terms",
    });
    return "purchased";
  } catch (err) {
    if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
      return "cancelled";
    }
    throw new Error(describe(err));
  }
}

/** Link to RevenueCat's page where a web subscriber can cancel or update their card. */
export async function webManagementUrl(userId: string): Promise<string | null> {
  const info = await purchasesFor(userId).getCustomerInfo();
  return info.managementURL;
}

function describe(err: unknown): string {
  if (err instanceof PurchasesError) {
    return err.underlyingErrorMessage ? `${err.message} — ${err.underlyingErrorMessage}` : err.message;
  }
  return err instanceof Error ? err.message : "Purchase failed";
}
