import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Trash2, Receipt } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 200 70% 50%))",
  "hsl(340 75% 55%)",
  "hsl(60 70% 45%)",
  "hsl(120 40% 50%)",
  "hsl(220 60% 55%)",
  "hsl(0 65% 50%)",
];

const ExpenseReport = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("3months");
  const [startDate, setStartDate] = useState(
    format(subMonths(new Date(), 3), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch receipt items (purchases)
  const { data: receiptItems = [] } = useQuery({
    queryKey: ["receipt_items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_items")
        .select("*, receipt_scans!inner(receipt_date, store_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch receipt scans for totals
  const { data: receiptScans = [] } = useQuery({
    queryKey: ["receipt_scans", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_scans")
        .select("*")
        .order("receipt_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch inventory deletions (waste)
  const { data: deletions = [] } = useQuery({
    queryKey: ["inventory_deletions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_deletions")
        .select("*")
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Handle date range presets
  const handleDateRange = (value: string) => {
    setDateRange(value);
    const now = new Date();
    switch (value) {
      case "1month":
        setStartDate(format(subMonths(now, 1), "yyyy-MM-dd"));
        break;
      case "3months":
        setStartDate(format(subMonths(now, 3), "yyyy-MM-dd"));
        break;
      case "6months":
        setStartDate(format(subMonths(now, 6), "yyyy-MM-dd"));
        break;
      case "1year":
        setStartDate(format(subMonths(now, 12), "yyyy-MM-dd"));
        break;
    }
    setEndDate(format(now, "yyyy-MM-dd"));
  };

  // Filter data by date range
  const filteredReceipts = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return receiptScans.filter((r) => {
      const d = parseISO(r.receipt_date);
      return isWithinInterval(d, { start, end });
    });
  }, [receiptScans, startDate, endDate]);

  const filteredReceiptItems = useMemo(() => {
    const receiptIds = new Set(filteredReceipts.map((r) => r.id));
    return receiptItems.filter((i) => receiptIds.has(i.receipt_id));
  }, [receiptItems, filteredReceipts]);

  const filteredDeletions = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return deletions.filter((d) => {
      const date = parseISO(d.deleted_at);
      return isWithinInterval(date, { start, end });
    });
  }, [deletions, startDate, endDate]);

  // Summary stats
  const totalSpent = filteredReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalWaste = filteredDeletions
    .filter((d) => d.reason !== "Used / Consumed")
    .reduce((sum, d) => sum + (d.total_cost || 0), 0);
  const totalReceipts = filteredReceipts.length;

  // Category breakdown for purchases
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredReceiptItems.forEach((item) => {
      const cat = item.category || "Other";
      map.set(cat, (map.get(cat) || 0) + Number(item.price));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReceiptItems]);

  // Monthly spending trend
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { spent: number; waste: number }>();
    filteredReceipts.forEach((r) => {
      const month = format(parseISO(r.receipt_date), "MMM yyyy");
      const entry = map.get(month) || { spent: 0, waste: 0 };
      entry.spent += r.total_amount || 0;
      map.set(month, entry);
    });
    filteredDeletions
      .filter((d) => d.reason !== "Used / Consumed")
      .forEach((d) => {
        const month = format(parseISO(d.deleted_at), "MMM yyyy");
        const entry = map.get(month) || { spent: 0, waste: 0 };
        entry.waste += d.total_cost || 0;
        map.set(month, entry);
      });
    return Array.from(map.entries())
      .map(([month, data]) => ({
        month,
        spent: Number(data.spent.toFixed(2)),
        waste: Number(data.waste.toFixed(2)),
      }))
      .reverse();
  }, [filteredReceipts, filteredDeletions]);

  // Waste breakdown by reason
  const wasteByReason = useMemo(() => {
    const map = new Map<string, number>();
    filteredDeletions.forEach((d) => {
      map.set(d.reason, (map.get(d.reason) || 0) + (d.total_cost || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeletions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Expense Report</h2>
          <p className="text-sm text-muted-foreground">Track spending and food waste costs</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Range</Label>
          <Select value={dateRange} onValueChange={handleDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">1 Month</SelectItem>
              <SelectItem value="3months">3 Months</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
          </>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold font-mono text-foreground">${totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Food Waste Cost</p>
                <p className="text-2xl font-bold font-mono text-foreground">${totalWaste.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receipts Scanned</p>
                <p className="text-2xl font-bold font-mono text-foreground">{totalReceipts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend chart */}
      {monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Monthly Spending Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`]}
                />
                <Legend />
                <Bar dataKey="spent" fill="hsl(var(--primary))" name="Spent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="waste" fill="hsl(var(--destructive))" name="Waste" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category pie chart */}
        {categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: $${value}`}
                    labelLine={{ strokeWidth: 1 }}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Waste by reason */}
        {wasteByReason.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Waste by Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wasteByReason.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{entry.name}</Badge>
                    </div>
                    <span className="font-mono text-sm text-foreground">${entry.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent receipts table */}
      {filteredReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.slice(0, 20).map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="text-sm">{format(parseISO(receipt.receipt_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">{receipt.store_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${(receipt.total_amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filteredReceipts.length === 0 && filteredDeletions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Receipt className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No expense data yet</h3>
          <p className="text-muted-foreground mt-1">
            Scan a grocery receipt from the Inventory tab to start tracking expenses.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpenseReport;
