import { Layout } from "@/components/layout";
import { useListBots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowUpRight, Grid, DollarSign, Wallet, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { getPrivateKey, derivePublicKey } from "@/lib/keys";

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

export default function Dashboard() {
  const { data: bots, isLoading } = useListBots();
  const [balance, setBalance] = useState<AccountMargin | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [pubkey, setPubkey] = useState("");

  const loadBalance = useCallback(async (key: string) => {
    if (!key) return;
    setBalanceLoading(true);
    const margin = await fetchAccountBalance(key);
    setBalance(margin);
    setBalanceLoading(false);
  }, []);

  useEffect(() => {
    const pk = getPrivateKey();
    if (pk) {
      const derived = derivePublicKey(pk);
      if (derived) {
        setPubkey(derived);
        loadBalance(derived);
      }
    }
  }, [loadBalance]);

  const botsArray = Array.isArray(bots) ? bots : [];
  const activeBots = botsArray.filter(b => b.status === "RUNNING").length;
  const totalInvestment = botsArray.reduce((acc, b) => acc + b.investment, 0);
  const totalPnl = botsArray.reduce((acc, b) => acc + (b.totalPnl || 0), 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your grid trading performance.</p>
        </div>

        {/* Bot Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBots} / {botsArray.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInvestment.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Balance */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Account Balance
            </h3>
            {pubkey && (
              <Button variant="ghost" size="sm" onClick={() => loadBalance(pubkey)} disabled={balanceLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${balanceLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>

          {!pubkey ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm mb-3">No wallet configured.</p>
                <Link href="/settings" className="text-sm text-primary underline underline-offset-2">
                  Go to Settings to add your private key
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              {(["Total Balance", "Available Balance", "Margin Used", "Unrealized P&L"] as const).map((label, i) => {
                const values = balance
                  ? [balance.totalBalance, balance.availableBalance, balance.marginUsed, balance.unrealizedPnl]
                  : null;
                const colors = ["", "text-primary", "", balance && balance.unrealizedPnl >= 0 ? "text-green-500" : "text-red-500"];
                return (
                  <Card key={label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {balanceLoading ? (
                        <Skeleton className="h-7 w-28" />
                      ) : values ? (
                        <div className={`text-2xl font-bold ${colors[i]}`}>
                          {i === 3 && values[i] >= 0 ? "+" : ""}{fmt(values[i])}
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-muted-foreground">—</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Running Bots */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Running Bots</h3>
          {isLoading ? (
            <div>Loading...</div>
          ) : activeBots === 0 ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border-dashed">
              <Grid className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">No active bots</h3>
              <p className="text-sm text-muted-foreground mb-4">You don't have any running grid bots right now.</p>
              <Link href="/bots/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                Create Bot
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {botsArray.filter(b => b.status === "RUNNING").map(bot => (
                <Link key={bot.id} href={`/bots/${bot.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-lg">{bot.name}</div>
                        <div className="text-sm text-muted-foreground">{bot.symbol} • {bot.mode}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${bot.totalPnl && bot.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {bot.totalPnl && bot.totalPnl >= 0 ? "+" : ""}${bot.totalPnl?.toFixed(2) || "0.00"}
                        </div>
                        <div className="text-sm text-muted-foreground">${bot.investment} Inv.</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
