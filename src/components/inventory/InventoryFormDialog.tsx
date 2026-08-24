import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { STORAGE_LOCATIONS, StorageLocationLabel } from "@/lib/storage-locations";
import { toast } from "sonner";
import { haptics } from "@/lib/native";

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
}

interface InventoryFormDialogProps {
  item?: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  "Produce", "Dairy", "Meat & Seafood", "Grains & Pasta", "Canned Goods",
  "Spices & Seasonings", "Baking", "Snacks", "Beverages", "Condiments",
  "Frozen", "Oils & Vinegars", "Other",
];

const InventoryFormDialog = ({ item, open, onOpenChange }: InventoryFormDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState(item?.category || "");
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || "1");
  const [unit, setUnit] = useState(item?.unit || "");
  const [storageLocation, setStorageLocation] = useState<"fridge" | "freezer" | "pantry" | "cabinet" | "counter" | "other">(
    (item?.storage_location as any) || "pantry"
  );
  const [barcode, setBarcode] = useState(item?.barcode || "");
  const [pricePerUnit, setPricePerUnit] = useState(item?.price_per_unit?.toString() || "");
  const [expirationDate, setExpirationDate] = useState(item?.expiration_date || "");
  const [notes, setNotes] = useState(item?.notes || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        category: category || null,
        quantity: parseFloat(quantity) || 1,
        unit: unit || null,
        storage_location: storageLocation,
        barcode: barcode || null,
        price_per_unit: pricePerUnit ? parseFloat(pricePerUnit) : null,
        expiration_date: expirationDate || null,
        notes: notes || null,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase.from("inventory_items").update(data).eq("id", item!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(isEditing ? "Item updated!" : "Item added!");
      haptics.light();
      onOpenChange(false);
    },
    onError: () => { toast.error("Failed to save item"); haptics.error(); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Chicken breast" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Storage</Label>
              <Select value={storageLocation} onValueChange={(v) => setStorageLocation(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORAGE_LOCATIONS.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      <StorageLocationLabel value={loc.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lbs, oz, pcs" />
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="UPC code" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryFormDialog;
