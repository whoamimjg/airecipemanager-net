import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, X, Loader2, Camera, Package } from "lucide-react";
import { toast } from "sonner";

interface BarcodeResult {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  quantity_text?: string;
  image_url?: string;
}

interface BarcodeScannerProps {
  onProductFound: (product: BarcodeResult) => void;
  onClose: () => void;
}

const BarcodeScanner = ({ onProductFound, onClose }: BarcodeScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        async (decodedText) => {
          // Stop scanning immediately on detection
          await scanner.stop();
          setScanning(false);
          handleBarcodeLookup(decodedText);
        },
        () => {} // Ignore scan failures (no barcode in frame)
      );
      setScanning(true);
    } catch (err: any) {
      console.error("Scanner error:", err);
      if (err?.toString()?.includes("NotAllowedError")) {
        setError("Camera permission denied. Please allow camera access and try again.");
      } else {
        setError("Could not start camera. Make sure you're on a mobile device with a camera.");
      }
    }
  };

  const handleBarcodeLookup = async (barcode: string) => {
    setLooking(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("barcode-lookup", {
        body: { barcode },
      });

      if (fnError) throw fnError;

      if (data?.found) {
        const displayName = data.brand
          ? `${data.name} (${data.brand})`
          : data.name || `Product ${barcode}`;
        toast.success(`Found: ${displayName}`);
        onProductFound(data);
      } else {
        toast.error("Product not found in database");
        // Still pass the barcode so user can manually fill in
        onProductFound({ found: false, barcode });
      }
    } catch (err) {
      console.error("Lookup error:", err);
      toast.error("Failed to look up barcode");
      onProductFound({ found: false, barcode });
    } finally {
      setLooking(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Scan Barcode</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { stopScanning(); onClose(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {looking ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Looking up product...</p>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              id="barcode-reader"
              className="w-full overflow-hidden rounded-lg bg-muted"
              style={{
                display: scanning ? "block" : "none",
                minHeight: scanning ? "300px" : "0px",
              }}
            />

            {!scanning && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                {error ? (
                  <>
                    <p className="text-sm text-destructive text-center">{error}</p>
                    <Button onClick={startScanning} variant="outline">
                      <Camera className="mr-2 h-4 w-4" /> Try Again
                    </Button>
                  </>
                ) : (
                  <>
                    <Package className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground text-center">
                      Point your camera at a barcode to scan it
                    </p>
                    <Button onClick={startScanning}>
                      <Camera className="mr-2 h-4 w-4" /> Start Camera
                    </Button>
                  </>
                )}
              </div>
            )}

            {scanning && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Position the barcode within the frame
                </p>
                <Button variant="outline" size="sm" onClick={stopScanning}>
                  Cancel Scan
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BarcodeScanner;
