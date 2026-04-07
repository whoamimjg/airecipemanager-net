import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, Trash2, Edit, AlertTriangle, ScanLine, Receipt, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import InventoryFormDialog from "./InventoryFormDialog";
import BarcodeScanner from "./BarcodeScanner";
import ReceiptScanner from "./ReceiptScanner";

const DELETE_REASONS = [
  "Used / Consumed",
  "Expired",
  "Spoiled",
  "Damaged",
  "Given Away",
  "Recalled",
  "Other",
];

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  storage_location: string;
  barcode: string | null;
  price_per_unit: number | null;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
}

const STORAGE_LABELS: Record<string, string> = {
  fridge: "🧊 Fridge",
  freezer: "❄️ Freezer",
  pantry: "🏪 Pantry",
  cabinet: "🗄️ Cabinet",
  counter: "🍎 Counter",
  other: "📦 Other",
};

const getExpirationStatus = (date: string | null) => {
  if (!date) return null;
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return { label: "Expired", variant: "destructive" as const, days };
  if (days <= 3) return { label: `${days}d left`, variant: "destructive" as const, days };
  if (days <= 7) return { label: `${days}d left`, variant: "secondary" as const, days };
  return { label: format(parseISO(date), "MMM d"), variant: "outline" as const, days };
};

const InventoryManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [prefillItem, setPrefillItem] = useState<Partial<InventoryItem> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteNotes, setDeleteNotes] = useState("");
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error("Item not found");

      // Log the deletion with reason
      const { error: logError } = await supabase.from("inventory_deletions").insert({
        user_id: user!.id,
        item_name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_cost: item.price_per_unit ? item.price_per_unit * item.quantity : null,
        reason,
        notes: notes || null,
      });
      if (logError) throw logError;

      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item removed");
      setDeleteId(null);
      setDeleteReason("");
      setDeleteNotes("");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesLocation = filterLocation === "all" || item.storage_location === filterLocation;
    return matchesSearch && matchesLocation;
  });

  const expiringSoon = items.filter((item) => {
    const status = getExpirationStatus(item.expiration_date);
    return status && status.days <= 3;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kitchen Inventory</h2>
          <p className="text-sm text-muted-foreground">{items.length} items tracked</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowReceiptScanner(true)}>
            <Receipt className="mr-2 h-4 w-4" /> Scan Receipt into Inventory
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onClose={() => setShowScanner(false)}
          onProductFound={(product) => {
            setShowScanner(false);
            setPrefillItem({
              name: product.name || "",
              category: product.category || null,
              barcode: product.barcode,
            });
            setShowForm(true);
          }}
        />
      )}

      {/* Expiration alerts */}
      {expiringSoon.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-sm text-destructive font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              {expiringSoon.length} item{expiringSoon.length > 1 ? "s" : ""} expiring soon or expired
            </div>
            <div className="flex flex-wrap gap-2">
              {expiringSoon.map((item) => (
                <Badge key={item.id} variant="destructive" className="text-xs">
                  {item.name} — {getExpirationStatus(item.expiration_date)?.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-36 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {Object.entries(STORAGE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Package className="h-8 w-8 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            {items.length === 0 ? "No items yet" : "No matching items"}
          </h3>
          <p className="text-muted-foreground mt-1">
            {items.length === 0 ? "Add your first kitchen item to get started!" : "Try a different search or filter."}
          </p>
          {items.length === 0 && (
            <Button onClick={() => setShowForm(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const expStatus = getExpirationStatus(item.expiration_date);
            return (
              <Card key={item.id} className="border-border bg-card">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{item.name}</span>
                      {item.category && (
                        <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                      )}
                      {expStatus && (
                        <Badge variant={expStatus.variant} className="text-xs">
                          {expStatus.days <= 3 && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {expStatus.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{item.quantity} {item.unit || "pcs"}</span>
                      <span>{STORAGE_LABELS[item.storage_location] || item.storage_location}</span>
                      {item.price_per_unit != null && <span>${item.price_per_unit.toFixed(2)}/unit</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingItem(item)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      {(showForm || editingItem) && (
        <InventoryFormDialog
          item={editingItem || (prefillItem as any) || null}
          open={showForm || !!editingItem}
          onOpenChange={(open) => {
            if (!open) {
              setShowForm(false);
              setEditingItem(null);
              setPrefillItem(null);
            }
          }}
        />
      )}

      {/* Receipt Scanner */}
      <ReceiptScanner open={showReceiptScanner} onOpenChange={setShowReceiptScanner} />

      {/* Delete confirmation with reason */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteReason(""); setDeleteNotes(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              Please select a reason for removing this item. This helps track food costs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={deleteReason} onValueChange={setDeleteReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {DELETE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {deleteId && (() => {
              const item = items.find((i) => i.id === deleteId);
              if (item?.price_per_unit) {
                return (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <span className="text-muted-foreground">Estimated cost: </span>
                    <span className="font-semibold text-foreground">
                      ${(item.price_per_unit * item.quantity).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground"> ({item.quantity} {item.unit || "pcs"} × ${item.price_per_unit.toFixed(2)})</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="space-y-2">
              <Label>Additional notes</Label>
              <Textarea
                value={deleteNotes}
                onChange={(e) => setDeleteNotes(e.target.value)}
                placeholder="Optional details..."
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteReason}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId, reason: deleteReason, notes: deleteNotes })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InventoryManager;
