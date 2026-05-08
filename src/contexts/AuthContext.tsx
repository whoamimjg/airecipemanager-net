import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { CapacitorCookies } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const AUTH_SESSION_BACKUP_KEY = "airecipemanager.auth.session";
const AUTH_SESSION_BACKUP_COOKIE = "airecipemanager_auth_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const NATIVE_STORAGE_TIMEOUT_MS = 750;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getSupabaseAuthStorageKey = () => {
  try {
    const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
};

const SUPABASE_AUTH_STORAGE_KEY = getSupabaseAuthStorageKey();

type SessionBackup = {
  session?: Session;
  access_token?: string;
  refresh_token?: string;
  updated_at?: number;
};

const readLocal = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const writeLocal = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
};

const removeLocal = (key: string) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

const readCookie = (key: string) => {
  try {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${key}=`))
      ?.split("=")
      .slice(1)
      .join("=");
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  } catch {
    return null;
  }
};

const writeCookie = (key: string, value: string) => {
  try {
    document.cookie = `${key}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax; Secure`;
  } catch { /* ignore */ }
};

const removeCookie = (key: string) => {
  try {
    document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  } catch { /* ignore */ }
};

const readSessionBackup = async (): Promise<SessionBackup | null> => {
  let value: string | null = null;
  try {
    const result = await withTimeout(
      Preferences.get({ key: AUTH_SESSION_BACKUP_KEY }),
      NATIVE_STORAGE_TIMEOUT_MS
    );
    value = result.value ?? null;
  } catch (e) {
    console.warn("Preferences.get failed, using web storage backup", e);
  }

  if (!value) {
    try {
      const cookies = await withTimeout(
        CapacitorCookies.getCookies({ url: window.location.origin }),
        NATIVE_STORAGE_TIMEOUT_MS
      );
      value = cookies[AUTH_SESSION_BACKUP_COOKIE] ?? null;
    } catch { /* ignore */ }
  }

  value = value ?? readLocal(AUTH_SESSION_BACKUP_KEY) ?? readCookie(AUTH_SESSION_BACKUP_COOKIE);
  if (!value) return null;

  try {
    return JSON.parse(value) as SessionBackup;
  } catch {
    return null;
  }
};

const writeSessionBackup = async (session: Session): Promise<void> => {
  const value = JSON.stringify({ session, updated_at: Date.now() } satisfies SessionBackup);
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    updated_at: Date.now(),
  } satisfies SessionBackup);
  writeLocal(AUTH_SESSION_BACKUP_KEY, value);
  writeCookie(AUTH_SESSION_BACKUP_COOKIE, cookieValue);
  if (SUPABASE_AUTH_STORAGE_KEY) writeLocal(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session));

  try {
    await CapacitorCookies.setCookie({
      url: window.location.origin,
      key: AUTH_SESSION_BACKUP_COOKIE,
      value: cookieValue,
      path: "/",
      expires: new Date(Date.now() + ONE_YEAR_SECONDS * 1000).toUTCString(),
    });
  } catch { /* ignore */ }

  try {
    await Preferences.set({ key: AUTH_SESSION_BACKUP_KEY, value });
  } catch (e) {
    console.warn("Preferences.set failed, relying on web storage backup", e);
  }
};

const clearSessionBackup = async (): Promise<void> => {
  removeLocal(AUTH_SESSION_BACKUP_KEY);
  removeCookie(AUTH_SESSION_BACKUP_COOKIE);
  if (SUPABASE_AUTH_STORAGE_KEY) removeLocal(SUPABASE_AUTH_STORAGE_KEY);

  try {
    await CapacitorCookies.deleteCookie({
      url: window.location.origin,
      key: AUTH_SESSION_BACKUP_COOKIE,
    });
  } catch { /* ignore */ }

  try {
    await Preferences.remove({ key: AUTH_SESSION_BACKUP_KEY });
  } catch { /* ignore */ }
};

const seedSupabaseStorageFromBackup = (backup: SessionBackup | null) => {
  if (!backup?.session || !SUPABASE_AUTH_STORAGE_KEY) return;
  writeLocal(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(backup.session));
};

const restoreBackedUpSession = async (backup: SessionBackup | null): Promise<Session | null> => {
  const access_token = backup?.session?.access_token ?? backup?.access_token;
  const refresh_token = backup?.session?.refresh_token ?? backup?.refresh_token;

  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (!error && data.session) return data.session;

  const refreshed = await supabase.auth.refreshSession({ refresh_token });
  if (!refreshed.error && refreshed.data.session) {
    return refreshed.data.session;
  }

  await clearSessionBackup();
  return null;
};

const persistSessionBackup = (session: Session | null) => {
  if (session?.access_token && session.refresh_token) void writeSessionBackup(session);
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;
    let cancelled = false;

    // Set up auth state listener FIRST (do not flip loading until initial session resolves)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session) => {
        if (session) persistSessionBackup(session);
        if (initialized && event === "SIGNED_OUT") void clearSessionBackup();
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (initialized) setLoading(false);
      }
    );

    // Then restore session from durable native storage before checking Supabase's localStorage cache.
    const restoreSession = async () => {
      let restoredSession: Session | null = null;
      const backup = await readSessionBackup();
      seedSupabaseStorageFromBackup(backup);

      try {
        const { data: { session: storedSession } } = await supabase.auth.getSession();
        restoredSession = storedSession;
      } catch (e) {
        console.warn("getSession failed", e);
      }

      if (!restoredSession) {
        restoredSession = await restoreBackedUpSession(backup);
      }

      if (cancelled) return;
      initialized = true;
      persistSessionBackup(restoredSession);
      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);
      setLoading(false);
    };

    void restoreSession();

    // Safety net: never let the app hang on the splash screen.
    // If init hasn't completed in 5s, force-resolve loading state.
    const failsafeTimer = setTimeout(() => {
      if (!initialized && !cancelled) {
        console.warn("Auth init timed out — proceeding without session");
        initialized = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) await writeSessionBackup(data.session);
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await writeSessionBackup(session);
  }, []);

  const signInWithApple = useCallback(async () => {
    await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await writeSessionBackup(session);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearSessionBackup();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      signInWithEmail, signUpWithEmail,
      signInWithGoogle, signInWithApple,
      signOut, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};