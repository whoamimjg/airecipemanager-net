import { ErrorCode, Purchases, PurchasesError, type Package } from "@revenuecat/purchases-js";

/**
 * Website subscriptions run on RevenueCat Web Billing (Stripe underneath), the
 * same RevenueCat project the iOS app uses. The app user ID is the Supabase user
 * ID on every platform, so a plan bought here unlocks the apps and vice versa;
 * the revenuecat-webhook edge function writes the result to `subscriptions`.
 *
 * These are PUBLIC keys (safe in front-end code). `rcb_sb_` is the sandbox key:
 * purchases use Stripe test cards and charge nothing. Set VITE_REVENUECAT_WEB_KEY
 * to the live `rcb_` key to take real payments.
 */
const SANDBOX_KEY = "rcb_sb_aOzxMCLHoatBKnUQDgoFKTfqM";
const API_KEY = import.meta.env.VITE_REVENUECAT_WEB_KEY || SANDBOX_KEY;

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

/** The web package for a plan. Product identifiers contain basic / pro / unlimited. */
async function packageFor(userId: string, plan: PaidPlan): Promise<Package> {
  const offerings = await purchasesFor(userId).getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const pkg = packages.find((p) => p.webBillingProduct.identifier.toLowerCase().includes(plan));
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
