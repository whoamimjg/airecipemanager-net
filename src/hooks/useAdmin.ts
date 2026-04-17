import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ADMIN_EMAILS = ["whoamimjg50@gmail.com"];

export const useIsAdmin = () => {
  const { user } = useAuth();
  return ADMIN_EMAILS.includes(user?.email ?? "");
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
