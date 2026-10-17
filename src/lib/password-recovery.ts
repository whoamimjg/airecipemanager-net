/**
 * Password reset links arrive as https://airecipemanager.com/<path>#access_token=…&type=recovery
 * (or #error=…&error_code=otp_expired when the link is stale). supabase-js reads that hash
 * and then clears it, sometimes before the reset page mounts, which made the page say
 * "Invalid or expired reset link" for good links. This module runs first (imported at the
 * top of main.tsx, before the Supabase client exists) and records what the link said.
 *
 * It also moves the reader to /reset-password when Supabase sent them to another page
 * (for example the home page, when the redirect URL isn't on Supabase's allow list).
 */
const FLAG = "passwordRecovery";
const ERROR = "passwordRecoveryError";

function readHash(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function captureRecoveryLink(): void {
  if (typeof window === "undefined") return;
  const params = readHash();
  const isRecovery = params.get("type") === "recovery";
  const errorCode = params.get("error_code");
  if (!isRecovery && !errorCode) return;

  try {
    if (isRecovery) {
      sessionStorage.setItem(FLAG, "1");
      sessionStorage.removeItem(ERROR);
    } else if (errorCode) {
      sessionStorage.setItem(
        ERROR,
        errorCode === "otp_expired"
          ? "This reset link has expired or was already used. Request a new one below."
          : params.get("error_description")?.replace(/\+/g, " ") || "This reset link didn't work. Request a new one below.",
      );
    }
  } catch {
    /* storage blocked: the page still works from the hash or the auth event */
  }

  if (window.location.pathname !== "/reset-password" && (isRecovery || errorCode)) {
    window.history.replaceState(null, "", `/reset-password${window.location.hash}`);
  }
}

export function markRecovery(): void {
  try { sessionStorage.setItem(FLAG, "1"); } catch { /* ignore */ }
}

export function isRecoveryMarked(): boolean {
  try { return sessionStorage.getItem(FLAG) === "1"; } catch { return false; }
}

export function recoveryError(): string | null {
  try { return sessionStorage.getItem(ERROR); } catch { return null; }
}

export function clearRecovery(): void {
  try {
    sessionStorage.removeItem(FLAG);
    sessionStorage.removeItem(ERROR);
  } catch { /* ignore */ }
}

captureRecoveryLink();
