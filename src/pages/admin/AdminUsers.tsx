import { useAdminUsers } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export default function AdminUsers() {
  const { data, isLoading, error } = useAdminUsers();
  const [search, setSearch] = useState("");

  if (error) {
    return <div className="text-center py-12 text-destructive">Failed to load users.</div>;
  }

  const users = (data as any[] | undefined) ?? [];
  const filtered = users.filter(
    (u: any) =>
      (u.display_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => (
                  <TableRow key={u.user_id}>
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
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === "free" ? "secondary" : plan === "unlimited" ? "default" : "outline";
  return <Badge variant={variant}>{plan}</Badge>;
}
