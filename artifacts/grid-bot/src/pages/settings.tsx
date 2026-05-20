import { Layout } from "@/components/layout";
import { getPrivateKey, derivePublicKey, savePrivateKey, saveEndpoint, getEndpoint } from "@/lib/keys";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, ShieldAlert, Wallet, RefreshCw, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountMargin {
  totalBalance: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

async function fetchAccountBalance(pubkey: string): Promise<AccountMargin | null> {
  try {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fullAccount", user: pubkey }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const account = Array.isArray(data) ? data[0]?.fullAccount : null;
    if (!account?.margin) return null;
    return account.margin as AccountMargin;
  } catch {
    return null;
  }
}

export default function Settings() {
  const [pk, setPk] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [endpoint, setEndpoint] = useState("staging");
  const [balance, setBalance] = useState<AccountMargin | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { toast } = useToast();

  const loadBalance = useCallback(async (key: string) => {
    if (!key) return;
    setBalanceLoading(true);
    const margin = await fetchAccountBalance(key);
    setBalance(margin);
    setBalanceLoading(false);
  }, []);

  useEffect(() => {
    const saved = getPrivateKey();
    if (saved) {
      setPk(saved);
      const derived = derivePublicKey(saved);
      if (derived) {
        setPubkey(derived);
        loadBalance(derived);
      }
    }
    setEndpoint(getEndpoint());
  }, [loadBalance]);

  const handleSaveKey = () => {
    if (!pk) return;
    savePrivateKey(pk);
    const derived = derivePublicKey(pk);
    if (derived) {
      setPubkey(derived);
      loadBalance(derived);
      toast({ title: "Wallet Saved", description: "Private key saved locally." });
    } else {
      toast({ title: "Invalid Key", description: "Could not derive public key.", variant: "destructive" });
    }
  };

  const handleEnvChange = (val: string) => {
    setEndpoint(val);
    saveEndpoint(val as any);
    toast({ title: "Environment Updated", description: `Set to ${val}` });
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your wallet and connection settings.</p>
        </div>

        <Card className="border-red-900/50 bg-red-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <ShieldAlert className="h-5 w-5" />
              Security Notice
            </CardTitle>
            <CardDescription className="text-red-400/80">
              Your private key is stored ONLY in your browser's localStorage. It is never transmitted to our servers.
              Transactions are signed locally before being broadcasted.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Configuration
            </CardTitle>
            <CardDescription>Setup the wallet that will execute trades.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Private Key (Base58)</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={pk}
                  onChange={e => setPk(e.target.value)}
                  placeholder="Enter base58 private key"
                />
                <Button onClick={handleSaveKey}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Derived Public Key (Account)</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all text-muted-foreground">
                <KeyRound className="h-4 w-4 shrink-0" />
                {pubkey || "No key configured"}
              </div>
            </div>
          </CardContent>
        </Card>

        {pubkey && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Account Balance
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadBalance(pubkey)}
                  disabled={balanceLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${balanceLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>Live margin snapshot from Bulk.trade.</CardDescription>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-6 w-32" />
                    </div>
                  ))}
                </div>
              ) : balance ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Balance</p>
                    <p className="text-xl font-semibold">{fmt(balance.totalBalance)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Balance</p>
                    <p className="text-xl font-semibold text-primary">{fmt(balance.availableBalance)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Margin Used</p>
                    <p className="text-lg font-medium">{fmt(balance.marginUsed)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Unrealized P&L</p>
                    <p className={`text-lg font-medium ${balance.unrealizedPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {balance.unrealizedPnl >= 0 ? "+" : ""}{fmt(balance.unrealizedPnl)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unable to load balance. Make sure your public key is registered on Bulk.trade staging.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Environment</Label>
              <Select value={endpoint} onValueChange={handleEnvChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging (staging-api.bulk.trade)</SelectItem>
                  <SelectItem value="production">Production (api.bulk.trade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
