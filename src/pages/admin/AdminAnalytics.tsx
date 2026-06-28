import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAnalytics } from "@/hooks/useAdmin";
import { Users, Eye, MousePointerClick } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (n: number) => n.toLocaleString();

export default function AdminAnalytics() {
  const { data, isLoading, error } = useAdminAnalytics(28);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    const notConfigured = msg.toLowerCase().includes("not configured");
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="font-medium text-destructive">Couldn't load Google Analytics</p>
            <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
            {notConfigured && (
              <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">To enable, set these Supabase secrets and deploy the ga-stats function:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li><code>GA_PROPERTY_ID</code> — your GA4 numeric property ID (Admin → Property Settings)</li>
                  <li><code>GA_SERVICE_ACCOUNT_JSON</code> — a Google service-account key (with Viewer access to the GA4 property; Analytics Data API enabled)</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = (data?.byDay ?? []).map((d) => ({ date: d.date.slice(5), users: d.users, pageViews: d.pageViews }));

  const tiles = [
    { label: "Active users", value: data?.totals.users ?? 0, icon: Users },
    { label: "Page views", value: data?.totals.pageViews ?? 0, icon: Eye },
    { label: "Sessions", value: data?.totals.sessions ?? 0, icon: MousePointerClick },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <span className="text-sm text-muted-foreground">Last {data?.days ?? 28} days · Google Analytics</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><t.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{fmt(t.value)}</p>
                <p className="text-xs text-muted-foreground">{t.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Visitors & page views</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#gUsers)" name="Users" />
              <Area type="monotone" dataKey="pageViews" stroke="#8884d8" fillOpacity={0} name="Page views" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top pages</CardTitle></CardHeader>
        <CardContent>
          {(data?.topPages ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data!.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-foreground">{p.path}</span>
                  <span className="ml-3 shrink-0 font-medium text-muted-foreground">{fmt(p.views)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
