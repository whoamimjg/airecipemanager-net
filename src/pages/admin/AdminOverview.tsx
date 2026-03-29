import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminOverview } from "@/hooks/useAdmin";
import { Users, CreditCard, ChefHat, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminOverview() {
  const { data, isLoading, error } = useAdminOverview();

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>Failed to load admin data: {(error as Error).message}</p>
      </div>
    );
  }

  const signupChartData = data?.signupsByDay
    ? Object.entries(data.signupsByDay as Record<string, number>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date: date.slice(5), signups: count }))
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data?.totalUsers}
          icon={<Users className="h-5 w-5 text-primary" />}
          loading={isLoading}
        />
        <StatCard
          title="Paid Subscribers"
          value={data?.activeSubscribers}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          loading={isLoading}
        />
        <StatCard
          title="Monthly Revenue"
          value={data?.monthlyRevenue != null ? `$${data.monthlyRevenue}` : undefined}
          icon={<CreditCard className="h-5 w-5 text-primary" />}
          loading={isLoading}
        />
        <StatCard
          title="Total Recipes"
          value={data?.totalRecipes}
          subtitle={data?.aiRecipes != null ? `${data.aiRecipes} AI-generated` : undefined}
          icon={<ChefHat className="h-5 w-5 text-primary" />}
          loading={isLoading}
        />
      </div>

      {/* Plan breakdown */}
      {data?.planCounts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.planCounts as Record<string, number>).map(([plan, count]) => (
                <Badge key={plan} variant="secondary" className="text-sm px-3 py-1.5">
                  {plan}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signups chart */}
      {signupChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent payments */}
      {data?.recentPayments && (data.recentPayments as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.recentPayments as any[]).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{p.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">${p.amount}</p>
                    <Badge variant={p.status === "paid" ? "default" : "destructive"} className="text-xs">
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, loading }: {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <>
                <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </>
            )}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
