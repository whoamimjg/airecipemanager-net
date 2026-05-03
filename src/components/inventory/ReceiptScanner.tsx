import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, Receipt, Check, Package, X, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { isNative, captureNativePhoto, haptics } from "@/lib/native";

interface ScannedItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  selected: boolean;
  storage_location: string;
}

interface ReceiptData {
  store_name: string | null;
  receipt_date: string | null;
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_LOCATIONS = [
  { value: "fridge", label: "🧊 Fridge" },
  { value: "freezer", label: "❄️ Freezer" },
  { value: "pantry", label: "🏪 Pantry" },
  { value: "cabinet", label: "🗄️ Cabinet" },
  { value: "counter", label: "🍎 Counter" },
  { value: "other", label: "📦 Other" },
];

const ReceiptScanner = ({ open, onOpenChange }: ReceiptScannerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"capture" | "review" | "saving">("capture");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [storeName, setStoreName] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (payload: { file_base64: string; mime_type: string }) => {
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: payload,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as ReceiptData;
    },
    onSuccess: (data) => {
      setReceiptData(data);
      setStoreName(data.store_name || "");
      setReceiptDate(data.receipt_date || new Date().toISOString().split("T")[0]);
      setItems(
        data.items.map((item) => ({
          ...item,
          selected: true,
          storage_location: guessStorage(item.category),
        }))
      );
      setStep("review");
    },
    onError: (err) => {
      toast.error("Failed to scan receipt: " + (err instanceof Error ? err.message : "Unknown error"));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedItems = items.filter((i) => i.selected);
      if (selectedItems.length === 0) throw new Error("No items selected");

      // Create receipt scan record
      const { data: receipt, error: receiptError } = await supabase
        .from("receipt_scans")
        .insert({
          user_id: user!.id,
          store_name: storeName || null,
          receipt_date: receiptDate,
          total_amount: receiptData?.total || selectedItems.reduce((sum, i) => sum + i.price, 0),
        })
        .select("id")
        .single();
      if (receiptError) throw receiptError;

      // Create receipt items
      const { error: itemsError } = await supabase.from("receipt_items").insert(
        selectedItems.map((item) => ({
          receipt_id: receipt.id,
          user_id: user!.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit || null,
          price: item.price,
          added_to_inventory: true,
        }))
      );
      if (itemsError) throw itemsError;

      // Add to inventory
      const { error: invError } = await supabase.from("inventory_items").insert(
        selectedItems.map((item) => ({
          user_id: user!.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit || null,
          storage_location: item.storage_location as any,
          price_per_unit: item.quantity > 0 ? item.price / item.quantity : item.price,
        }))
      );
      if (invError) throw invError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_scans"] });
      toast.success(`${items.filter((i) => i.selected).length} items added to inventory!`);
      haptics.success();
      handleClose();
    },
    onError: (err) => {
      toast.error("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
      haptics.error();
    },
  });

  const guessStorage = (category: string): string => {
    const map: Record<string, string> = {
      "Produce": "fridge",
      "Dairy": "fridge",
      "Meat & Seafood": "fridge",
      "Frozen": "freezer",
      "Beverages": "fridge",
      "Canned Goods": "pantry",
      "Grains & Pasta": "pantry",
      "Spices & Seasonings": "cabinet",
      "Baking": "pantry",
      "Condiments": "fridge",
      "Oils & Vinegars": "pantry",
      "Snacks": "pantry",
    };
    return map[category] || "pantry";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      scanMutation.mutate({
        file_base64: base64,
        mime_type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleTakePhoto = async () => {
    haptics.light();
    if (isNative()) {
      try {
        const base64 = await captureNativePhoto();
        if (!base64) return;
        setPreviewUrl(`data:image/jpeg;base64,${base64}`);
        scanMutation.mutate({ file_base64: base64, mime_type: "image/jpeg" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera unavailable";
        if (!/cancel/i.test(msg)) toast.error(msg);
      }
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    haptics.light();
    uploadInputRef.current?.click();
  };

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemStorage = (idx: number, location: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, storage_location: location } : item))
    );
  };

  const handleClose = () => {
    setStep("capture");
    setReceiptData(null);
    setItems([]);
    setStoreName("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setPreviewUrl(null);
    onOpenChange(false);
  };

  const selectedTotal = items.filter((i) => i.selected).reduce((sum, i) => sum + i.price, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Scan Receipt
          </DialogTitle>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-8">
              {previewUrl ? (
                <img src={previewUrl} alt="Receipt preview" className="max-h-48 rounded-lg border border-border" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="h-16 w-16" />
                  <p className="text-sm">Take a photo of your grocery receipt</p>
                </div>
              )}

              {scanMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing receipt...
                </div>
              ) : (
                <Button onClick={handleCaptureClick}>
                  <Camera className="mr-2 h-4 w-4" />
                  {previewUrl ? "Retake Photo" : "Take Photo / Upload"}
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Store</Label>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store name" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{items.filter((i) => i.selected).length} of {items.length} items selected</span>
              <Badge variant="secondary" className="font-mono">${selectedTotal.toFixed(2)}</Badge>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <Card key={idx} className={`border ${item.selected ? "border-primary/30 bg-primary/5" : "border-border opacity-60"}`}>
                  <CardContent className="py-2 px-3">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(idx)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground truncate">{item.name}</span>
                          <span className="text-sm font-mono text-foreground shrink-0">${item.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                          <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                          <Select value={item.storage_location} onValueChange={(v) => updateItemStorage(idx, v)}>
                            <SelectTrigger className="h-6 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STORAGE_LOCATIONS.map((loc) => (
                                <SelectItem key={loc.value} value={loc.value} className="text-xs">{loc.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {receiptData?.total && (
              <div className="rounded-md bg-muted/50 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Receipt total:</span>
                <span className="font-semibold font-mono text-foreground">${receiptData.total.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === "review" && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || items.filter((i) => i.selected).length === 0}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Add {items.filter((i) => i.selected).length} to Inventory
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptScanner;
