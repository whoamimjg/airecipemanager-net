import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const AUTH_SESSION_BACKUP_KEY = "airecipemanager.auth.session";

// Safe wrappers — Preferences plugin may not be registered in older native builds.
// Any failure must NOT block auth initialization.
const safePrefsGet = async (key: string): Promise<string | null> => {
  try {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch (e) {
    console.warn("Preferences.get failed, falling back to localStorage", e);
    try { return localStorage.getItem(key); } catch { return null; }
  }
};

const safePrefsSet = async (key: string, value: string): Promise<void> => {
  try {
    await Preferences.set({ key, value });
  } catch (e) {
    console.warn("Preferences.set failed, falling back to localStorage", e);
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
};

const safePrefsRemove = async (key: string): Promise<void> => {
  try {
    await Preferences.remove({ key });
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};

const persistSessionBackup = (session: Session | null, initialized: boolean) => {
  if (session?.access_token && session.refresh_token) {
    void safePrefsSet(
      AUTH_SESSION_BACKUP_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    );
    return;
  }

  if (initialized) {
    void safePrefsRemove(AUTH_SESSION_BACKUP_KEY);
  }
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
      (_event, session) => {
        persistSessionBackup(session, initialized);
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (initialized) setLoading(false);
      }
    );

    // Then restore session from storage — localStorage first, native Preferences backup second.
    const restoreSession = async () => {
      const { data: { session: storedSession } } = await supabase.auth.getSession();
      let restoredSession = storedSession;

      if (!restoredSession) {
        const { value } = await Preferences.get({ key: AUTH_SESSION_BACKUP_KEY });
        if (value) {
          try {
            const tokens = JSON.parse(value) as { access_token?: string; refresh_token?: string };
            if (tokens.access_token && tokens.refresh_token) {
              const { data, error } = await supabase.auth.setSession({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
              });
              restoredSession = error ? null : data.session;
              if (error) await Preferences.remove({ key: AUTH_SESSION_BACKUP_KEY });
            }
          } catch {
            await Preferences.remove({ key: AUTH_SESSION_BACKUP_KEY });
          }
        }
      }

      if (cancelled) return;
      initialized = true;
      persistSessionBackup(restoredSession, true);
      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);
      setLoading(false);
    };

    void restoreSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  }, []);

  const signInWithApple = useCallback(async () => {
    await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin + "/dashboard",
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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