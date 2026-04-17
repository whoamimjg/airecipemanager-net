import { useState, useMemo } from "react";
import { useAdminFeedback } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search } from "lucide-react";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  suggestion: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  bug: "bg-red-500/10 text-red-600 border-red-500/20",
  feature: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  other: "bg-muted text-muted-foreground",
};

export default function AdminFeedback() {
  const { data: feedback, isLoading } = useAdminFeedback();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    return (feedback ?? []).filter((f: any) => {
      const matchesCategory = category === "all" || f.category === category;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        f.message?.toLowerCase().includes(q) ||
        f.user_email?.toLowerCase().includes(q) ||
        f.user_display_name?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [feedback, search, category]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: feedback?.length ?? 0 };
    for (const f of feedback ?? []) {
      c[f.category] = (c[f.category] ?? 0) + 1;
    }
    return c;
  }, [feedback]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Feedback</h2>
          <p className="text-sm text-muted-foreground">
            {counts.all ?? 0} total submissions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search message, email, or name..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all ?? 0})</SelectItem>
              <SelectItem value="suggestion">Suggestions ({counts.suggestion ?? 0})</SelectItem>
              <SelectItem value="bug">Bug Reports ({counts.bug ?? 0})</SelectItem>
              <SelectItem value="feature">Feature Requests ({counts.feature ?? 0})</SelectItem>
              <SelectItem value="other">Other ({counts.other ?? 0})</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No feedback submissions found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb: any) => (
            <Card key={fb.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`capitalize ${CATEGORY_COLORS[fb.category] ?? ""}`}>
                      {fb.category}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {fb.user_display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fb.user_email}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(fb.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{fb.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
