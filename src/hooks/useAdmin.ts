import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ADMIN_EMAILS = ["whoamimjg50@gmail.com"];

export const useIsAdmin = () => {
  const { user } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();
  return ADMIN_EMAILS.includes(email);
};

async function fetchAdminData(endpoint: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/admin-data?endpoint=${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch admin data");
  }
  return res.json();
}

async function postAdminData(endpoint: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-data?endpoint=${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

/** Give (or take back) a free, never-expiring Unlimited plan. */
export const setLifetimeUnlimited = (userId: string, grant: boolean) =>
  postAdminData("lifetime", { user_id: userId, action: grant ? "grant" : "revoke" });

export async function callAdminTotp(action: string, code?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/admin-totp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, code }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "TOTP request failed");
  return data;
}

export const useAdminOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchAdminData("overview") });

export const useAdminUsers = () =>
  useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchAdminData("users") });

export const useAdminPayments = () =>
  useQuery({ queryKey: ["admin", "payments"], queryFn: () => fetchAdminData("payments") });

export const useAdminFeedback = () =>
  useQuery({ queryKey: ["admin", "feedback"], queryFn: () => fetchAdminData("feedback") });

async function fetchGaStats(days = 28) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/ga-stats?days=${days}`,
    { headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch analytics");
  return data as {
    days: number;
    totals: { users: number; pageViews: number; sessions: number };
    byDay: { date: string; users: number; pageViews: number; sessions: number }[];
    topPages: { path: string; views: number }[];
  };
}

export const useAdminAnalytics = (days = 28) =>
  useQuery({ queryKey: ["admin", "analytics", days], queryFn: () => fetchGaStats(days) });
