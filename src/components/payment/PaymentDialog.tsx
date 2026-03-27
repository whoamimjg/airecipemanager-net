import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    HostedTokenization: new (sourceKey: string) => {
      create: (type: string) => {
        mount: (selector: string) => void;
        getNonceToken: () => Promise<{
          nonce: string;
          expiry_month: number;
          expiry_year: number;
          avs_zip?: string;
          last4?: string;
          card_type?: string;
          status: string;
        }>;
        setStyles: (styles: Record<string, string>) => void;
        on: (event: string, handler: (data: unknown) => void) => void;
        destroy?: () => void;
      };
    };
  }
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planKey: string;
  planName: string;
  amount: number;
  mode: "one-time" | "subscription";
  frequency?: string;
  onSuccess?: () => void;
}

const TOKENIZATION_SCRIPT_URL = "https://tokenization.accept.blue/tokenization/v0.2";

const PaymentDialog = ({
  open,
  onOpenChange,
  planKey,
  planName,
  amount,
  mode,
  frequency = "monthly",
  onSuccess,
}: PaymentDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [cardFormReady, setCardFormReady] = useState(false);
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const cardFormRef = useRef<ReturnType<InstanceType<typeof window.HostedTokenization>["create"]> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardholderName, setCardholderName] = useState("");

  // Load tokenization script
  useEffect(() => {
    if (!open) return;

    const existingScript = document.querySelector(`script[src="${TOKENIZATION_SCRIPT_URL}"]`);
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = TOKENIZATION_SCRIPT_URL;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => toast.error("Failed to load payment form");
    document.head.appendChild(script);
  }, [open]);

  // Fetch tokenization source key
  useEffect(() => {
    if (!open || sourceKey) return;

    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("accept-blue-tokenize", {
          body: { action: "get-tokenization-key" },
        });
        if (error) throw error;
        setSourceKey(data.tokenization_source);
      } catch (err) {
        console.error("Failed to get tokenization key:", err);
        toast.error("Failed to initialize payment form");
      }
    };
    fetchKey();
  }, [open, sourceKey]);

  // Initialize card form when both script and key are ready
  useEffect(() => {
    if (!open || !scriptLoaded || !sourceKey || !containerRef.current || !window.HostedTokenization) return;

    // Clean up existing form
    if (cardFormRef.current?.destroy) {
      cardFormRef.current.destroy();
    }
    containerRef.current.innerHTML = "";

    try {
      const hostedTokenization = new window.HostedTokenization(sourceKey);
      const cardForm = hostedTokenization.create("card-form");

      cardForm.mount("#accept-blue-card-container");

      // accept.blue creates its iframe during mount; setStyles before that throws "iframe not found".
      requestAnimationFrame(() => {
        try {
          cardForm.setStyles({
            card: "font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 10px; border: 1px solid hsl(30, 20%, 88%); border-radius: 8px; background: hsl(40, 33%, 98%);",
          });
        } catch (styleError) {
          console.warn("Card form style initialization skipped:", styleError);
        }
      });

      cardFormRef.current = cardForm;
      setCardFormReady(true);
    } catch (err) {
      console.error("Failed to initialize card form:", err);
      toast.error("Failed to initialize payment form");
    }

    return () => {
      if (cardFormRef.current?.destroy) {
        cardFormRef.current.destroy();
      }
      cardFormRef.current = null;
      setCardFormReady(false);
    };
  }, [open, scriptLoaded, sourceKey]);

  const handleSubmit = useCallback(async () => {
    if (!cardFormRef.current) {
      toast.error("Payment form not ready");
      return;
    }

    setLoading(true);
    try {
      // Get nonce from hosted tokenization
      const result = await cardFormRef.current.getNonceToken();
      console.log("DEBUG: getNonceToken result:", JSON.stringify(result));

      if (result.status !== "success" && !result.nonce) {
        toast.error("Failed to tokenize card. Please check your card details.");
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to continue");
        setLoading(false);
        return;
      }

      const card = {
        nonce: result.nonce,
        expiry_month: result.expiry_month,
        expiry_year: result.expiry_year,
        avs_zip: result.avs_zip,
        last4: result.last4,
        card_type: result.card_type,
      };

      if (mode === "one-time") {
        const { data, error } = await supabase.functions.invoke("accept-blue-charge", {
          body: {
            amount,
            card,
            name: cardholderName,
            description: `${planName} Plan`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Payment successful!");
      } else {
        const { data, error } = await supabase.functions.invoke("accept-blue-recurring", {
          body: {
            action: "create",
            amount,
            card,
            frequency,
            title: `${planName} Plan Subscription`,
            plan: planKey,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Subscription activated!");
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : "Payment failed";

      if (
        err &&
        typeof err === "object" &&
        "context" in err &&
        (err as { context?: Response }).context
      ) {
        const context = (err as { context?: Response }).context as Response;
        try {
          const payload = await context.clone().json() as { error?: string; details?: unknown };
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          try {
            const text = await context.clone().text();
            if (text) message = text;
          } catch {
          }
        }
      }

      console.error("Payment error:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [amount, cardholderName, mode, frequency, planKey, planName, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <CreditCard className="h-5 w-5 text-primary" />
            {mode === "subscription" ? `Subscribe to ${planName}` : `Pay for ${planName}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "subscription"
              ? `$${amount.toFixed(2)}/mo — billed ${frequency}`
              : `One-time payment of $${amount.toFixed(2)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cardholder-name">Cardholder Name</Label>
            <Input
              id="cardholder-name"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Card Details</Label>
            <div
              id="accept-blue-card-container"
              ref={containerRef}
              className="min-h-[80px] rounded-lg border border-input bg-background p-1"
            />
            {!cardFormReady && (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading secure payment form...
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !cardFormReady}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                Pay ${amount.toFixed(2)}
                {mode === "subscription" && "/mo"}
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Secured by accept.blue — your card details never touch our servers
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
