import { useAdminUsers } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Mail, Calendar, CreditCard, ChefHat } from "lucide-react";

export default function AdminUsers() {
  const { data, isLoading, error } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  if (error) {
    return <div className="text-center py-12 text-destructive">Failed to load users.</div>;
  }

  const users = (data as any[] | undefined) ?? [];
  const filtered = users.filter(
    (u: any) =>
      (u.display_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (userId: string) => {
    setExpandedUserId(prev => prev === userId ? null : userId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Users</h2>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{filtered.length} Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="hidden md:table-cell">Recipes</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => (
                  <>
                    <TableRow
                      key={u.user_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(u.user_id)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {u.display_name || "—"}
                        <span className="block sm:hidden text-xs text-muted-foreground">{u.email}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <PlanBadge plan={u.subscription?.plan ?? "free"} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {u.recipeCount}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {expandedUserId === u.user_id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedUserId === u.user_id && (
                      <TableRow key={`${u.user_id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <UserDetail user={u} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserDetail({ user }: { user: any }) {
  const sub = user.subscription;
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <DetailItem
        icon={<Mail className="h-4 w-4 text-primary" />}
        label="Email"
        value={user.email ?? "—"}
      />
      <DetailItem
        icon={<Calendar className="h-4 w-4 text-primary" />}
        label="Joined"
        value={new Date(user.created_at).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric"
        })}
      />
      <DetailItem
        icon={<ChefHat className="h-4 w-4 text-primary" />}
        label="Recipes Created"
        value={String(user.recipeCount ?? 0)}
      />
      <DetailItem
        icon={<CreditCard className="h-4 w-4 text-primary" />}
        label="Subscription Plan"
        value={
          <PlanBadge plan={sub?.plan ?? "free"} />
        }
      />
      <DetailItem
        icon={<CreditCard className="h-4 w-4 text-primary" />}
        label="Monthly Price"
        value={sub ? `$${sub.price_monthly}` : "$0"}
      />
      <DetailItem
        icon={<CreditCard className="h-4 w-4 text-primary" />}
        label="Recipe Limit"
        value={String(sub?.recipe_limit ?? 25)}
      />
      {sub?.next_billing_date && (
        <DetailItem
          icon={<Calendar className="h-4 w-4 text-primary" />}
          label="Next Billing"
          value={new Date(sub.next_billing_date).toLocaleDateString()}
        />
      )}
      {sub?.payment_method && (
        <DetailItem
          icon={<CreditCard className="h-4 w-4 text-primary" />}
          label="Payment Method"
          value={sub.payment_method}
        />
      )}
      <DetailItem
        icon={<Calendar className="h-4 w-4 text-primary" />}
        label="Status"
        value={
          <Badge variant={sub?.is_active ? "default" : "secondary"}>
            {sub?.is_active ? "Active" : "Inactive"}
          </Badge>
        }
      />
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === "free" ? "secondary" : plan === "unlimited" ? "default" : "outline";
  return <Badge variant={variant}>{plan}</Badge>;
}
