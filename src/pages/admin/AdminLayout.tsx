import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTotpGate } from "@/components/admin/AdminTotpGate";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { Shield } from "lucide-react";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const [totpVerified, setTotpVerified] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <Shield className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Admin access only</p>
        <p className="max-w-md text-sm text-muted-foreground">
          You're signed in as <span className="font-mono text-foreground">{user.email ?? "(no email)"}</span>, which isn't an admin account.
        </p>
        <a href="/dashboard" className="text-sm text-primary hover:underline">Back to the app</a>
      </div>
    );
  }

  if (!totpVerified) {
    return <AdminTotpGate onVerified={() => setTotpVerified(true)} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger className="ml-0" />
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Admin</h1>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
