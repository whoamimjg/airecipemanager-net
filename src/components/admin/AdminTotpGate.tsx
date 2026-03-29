import { useState, useEffect } from "react";
import { callAdminTotp } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, QrCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AdminTotpGateProps {
  onVerified: () => void;
}

export function AdminTotpGate({ onVerified }: AdminTotpGateProps) {
  const [status, setStatus] = useState<"loading" | "needs_setup" | "setup" | "verify">("loading");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<{ otpauth_url: string; secret: string } | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await callAdminTotp("status");
      setStatus(res.is_setup ? "verify" : "needs_setup");
    } catch {
      setStatus("needs_setup");
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await callAdminTotp("setup");
      if (res.already_setup) {
        setStatus("verify");
      } else {
        setSetupData(res);
        setStatus("setup");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await callAdminTotp("verify-setup", code);
      if (res.valid) {
        toast.success("2FA setup complete!");
        onVerified();
      } else {
        toast.error("Invalid code, try again");
        setCode("");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await callAdminTotp("verify", code);
      if (res.valid) {
        onVerified();
      } else {
        toast.error("Invalid code");
        setCode("");
      }
    } catch (err: any) {
      if (err.message?.includes("needs_setup")) {
        setStatus("needs_setup");
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Admin Authentication</CardTitle>
          <CardDescription>
            {status === "needs_setup"
              ? "Set up two-factor authentication to secure admin access"
              : status === "setup"
              ? "Scan the QR code with your authenticator app"
              : "Enter your authenticator code to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "needs_setup" && (
            <Button onClick={handleSetup} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Set Up 2FA
            </Button>
          )}

          {status === "setup" && setupData && (
            <>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.otpauth_url)}`}
                  alt="TOTP QR Code"
                  className="rounded-lg border border-border"
                  width={200}
                  height={200}
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Or enter this key manually:</p>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                  {setupData.secret}
                </code>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                />
                <Button
                  onClick={handleVerifySetup}
                  disabled={loading || code.length !== 6}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Verify & Activate
                </Button>
              </div>
            </>
          )}

          {status === "verify" && (
            <div className="space-y-3">
              <Input
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-widest"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
              <Button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
