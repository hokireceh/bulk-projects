import { Layout } from "@/components/layout";
import {
  useGetBot, useStartBot, useStopBot,
  getGetBotQueryKey, getListBotsQueryKey,
  useGetMarketTicker, getGetMarketTickerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Square, Terminal, Pencil } from "lucide-react";
import { Link } from "wouter";
import { allGridLevels } from "@/lib/gridEngine";
import { type LogLine, type MarginData, type PositionData, type LiveOrder } from "@/lib/botRunner";
import { useBotRunnerContext } from "@/lib/botRunnerContext";
import { getPrivateKey, getEndpoint } from "@/lib/keys";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const PROXY_API = "/api";

async function fetchAccountData(pubkey: string, type: string): Promise<any[]> {
  const res = await fetch(`${PROXY_API}/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bulk-env": getEndpoint() },
    body: JSON.stringify({ type, user: pubkey }),
  });
  if (!res.ok) return [];
  return res.json();
}

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const botId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { startRunner, stopRunner, getRunner } = useBotRunnerContext();

  const [logs, setLogs] = useState<LogLine[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [margin, setMargin] = useState<MarginData | null>(null);
  const [position, setPosition] = useState<PositionData | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [runnerPrice, setRunnerPrice] = useState(0);
  const [lastLevel, setLastLevel] = useState<number | null>(null);

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { enabled: !!botId, queryKey: getGetBotQueryKey(botId), refetchInterval: 5000 }
  });

  const { data: ticker } = useGetMarketTicker(bot?.symbol ?? "", {
    query: {
      enabled: !!bot?.symbol,
      queryKey: getGetMarketTickerQueryKey(bot?.symbol ?? ""),
      refetchInterval: 10000,
    }
  });

  const startBot = useStartBot();
  const stopBot  = useStopBot();

  const syncFromRunner = useCallback(() => {
    const runner = getRunner(botId);
    if (!runner) return;
    setLogs([...runner.logs]);
    if (runner.margin)   setMargin({ ...runner.margin });
    if (runner.position) setPosition({ ...runner.position });
    setLiveOrders([...runner.openOrders]);
    setTotalTrades(runner.totalTrades);
    if (runner.currentPrice > 0) setRunnerPrice(runner.currentPrice);
    setLastLevel(runner.lastLevel ?? null);
  }, [botId, getRunner]);

  const handleRunnerStopped = useCallback(() => {
    stopBot.mutate({ id: botId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });
  }, [botId, stopBot, queryClient]);

  // Poll runner state every 500ms while on this page — works after re-navigation too
  useEffect(() => {
    if (!botId) return;
    // Restore saved logs immediately on mount
    try {
      const saved = localStorage.getItem(`bot_logs_${botId}`);
      if (saved) setLogs(JSON.parse(saved) as LogLine[]);
    } catch { /* ignore */ }

    const interval = setInterval(() => {
      const runner = getRunner(botId);
      if (!runner) return;
      setLogs([...runner.logs]);
      if (runner.margin)   setMargin({ ...runner.margin });
      if (runner.position) setPosition({ ...runner.position });
      setLiveOrders([...runner.openOrders]);
      setTotalTrades(runner.totalTrades);
      if (runner.currentPrice > 0) setRunnerPrice(runner.currentPrice);
      setLastLevel(runner.lastLevel ?? null);
    }, 500);

    return () => clearInterval(interval);
    // NOTE: no runner.stop() on unmount — runner lives in global context
  }, [botId, getRunner]);

  // Fetch account snapshot on mount (balance + positions + open orders)
  useEffect(() => {
    if (!bot?.accountPubkey) return;
    fetchAccountData(bot.accountPubkey, "fullAccount").then((rows) => {
      const acct = rows[0]?.fullAccount;
      if (!acct) return;
      if (acct.margin) {
        setMargin({
          totalBalance:     Number(acct.margin.totalBalance     ?? 0),
          availableBalance: Number(acct.margin.availableBalance ?? 0),
          marginUsed:       Number(acct.margin.marginUsed       ?? 0),
          notional:         Number(acct.margin.notional         ?? 0),
          realizedPnl:      Number(acct.margin.realizedPnl      ?? 0),
          unrealizedPnl:    Number(acct.margin.unrealizedPnl    ?? 0),
          fees:             Number(acct.margin.fees             ?? 0),
          funding:          Number(acct.margin.funding          ?? 0),
        });
      }
      if (Array.isArray(acct.positions)) {
        const pos = acct.positions.find((p: any) => p.symbol === bot.symbol);
        if (pos) {
          setPosition({
            symbol:           String(pos.symbol),
            size:             Number(pos.size             ?? 0),
            price:            Number(pos.price            ?? 0),
            fairPrice:        Number(pos.fairPrice        ?? 0),
            notional:         Number(pos.notional         ?? 0),
            realizedPnl:      Number(pos.realizedPnl      ?? 0),
            unrealizedPnl:    Number(pos.unrealizedPnl    ?? 0),
            leverage:         Number(pos.leverage         ?? 0),
            liquidationPrice: Number(pos.liquidationPrice ?? 0),
            fees:             Number(pos.fees             ?? 0),
            funding:          Number(pos.funding          ?? 0),
          });
        }
      }
      if (Array.isArray(acct.openOrders)) {
        setLiveOrders(
          acct.openOrders
            .filter((o: any) => o.symbol === bot.symbol)
            .map((o: any) => ({
              orderId:      String(o.orderId ?? ""),
              symbol:       String(o.symbol  ?? ""),
              price:        Number(o.price   ?? 0),
              originalSize: Number(o.originalSize ?? 0),
              size:         Number(o.size    ?? 0),
              filledSize:   Number(o.filledSize   ?? 0),
              isBuy:        Number(o.originalSize ?? 0) > 0,
              status:       String(o.status  ?? ""),
              timestamp:    Number(o.timestamp    ?? 0),
            }))
        );
      }
    }).catch(() => { /* ignore */ });
  }, [bot?.accountPubkey, bot?.symbol]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = async () => {
    if (!bot) return;
    const pk = getPrivateKey();
    if (!pk) {
      toast({
        title: "No Private Key",
        description: "Configure your wallet in Settings first.",
        variant: "destructive",
      });
      return;
    }

    startBot.mutate({ id: bot.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });

    startRunner(
      {
        botId,
        accountPubkey: bot.accountPubkey,
        privateKey: pk,
        symbol: bot.symbol,
        mode: bot.mode,
        orderMode: (bot.orderMode ?? "REACTIVE") as "UPFRONT" | "REACTIVE",
        lowerPrice: bot.lowerPrice,
        upperPrice: bot.upperPrice,
        gridCount: bot.gridCount,
        investment: bot.investment,
        leverage: bot.leverage ?? 1,
      },
      syncFromRunner,
      handleRunnerStopped,
    );
  };

  const handleStop = async () => {
    if (!bot) return;
    const runner = getRunner(botId);
    if (runner) {
      await stopRunner(botId);
    } else {
      stopBot.mutate({ id: bot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        },
      });
    }
  };

  const tickerPrice: number = ticker?.markPrice ?? 0;
  const currentPrice = runnerPrice > 0 ? runnerPrice : tickerPrice;

  const gridBoundaries = bot
    ? allGridLevels(bot.lowerPrice, bot.upperPrice, bot.gridCount)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "STOPPED": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "ERROR":   return "bg-red-500/10 text-red-500 border-red-500/20";
      default:        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  // Only use position-level P&L (symbol-specific). Never fall back to account margin
  // because margin.realizedPnl is the total for all symbols, not this bot.
  const displayedRealizedPnl   = position?.realizedPnl   ?? null;
  const displayedUnrealizedPnl = position?.unrealizedPnl ?? null;
  const totalPnl = displayedRealizedPnl !== null
    ? displayedRealizedPnl + (displayedUnrealizedPnl ?? 0)
    : null;

  if (isLoading || !bot) return <Layout><div className="p-8">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{bot.name}</h2>
              <Badge variant="outline" className={getStatusColor(bot.status)}>
                {bot.status === "RUNNING" && (
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                )}
                {bot.status}
              </Badge>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {bot.symbol}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {bot.mode} • {bot.gridCount} Grids • ${bot.investment} • {bot.leverage}x
            </p>
            <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">
              {bot.lowerPrice} – {bot.upperPrice}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bot.status !== "RUNNING" && (
              <Link href={`/bots/${botId}/edit`}>
                <Button size="sm" variant="outline">
                  <Pencil className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Edit</span>
                </Button>
              </Link>
            )}
            {bot.status === "RUNNING" ? (
              <Button size="sm" variant="destructive" onClick={handleStop} disabled={stopBot.isPending}>
                <Square className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Stop Bot</span>
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart} disabled={startBot.isPending}>
                <Play className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Start Bot</span>
              </Button>
            )}
          </div>
        </div>

        {/* Grid + Stats — stacked on mobile, side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Grid Visualization */}
          <Card className="lg:col-span-1 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Grid Levels</CardTitle>
                {currentPrice > 0 && (
                  <span className="text-xs text-primary font-mono font-bold">
                    Mark: {currentPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[420px] relative w-full rounded-md border border-border bg-background/50 p-3 flex flex-col justify-between overflow-hidden">
                {[...gridBoundaries].reverse().map((price, i) => {
                  const levelIdx = gridBoundaries.length - 1 - i;
                  const isCurrentBand = lastLevel !== null && levelIdx === lastLevel;
                  const abovePrice = currentPrice > 0 && price > currentPrice;
                  const belowPrice = currentPrice > 0 && price <= currentPrice;
                  return (
                    <div
                      key={i}
                      className={`flex items-center w-full z-10 text-xs font-mono ${isCurrentBand ? "opacity-100" : "opacity-70"}`}
                    >
                      <div className={`w-20 shrink-0 tabular-nums ${abovePrice ? "text-red-400" : belowPrice ? "text-green-400" : "text-muted-foreground"}`}>
                        {price.toFixed(2)}
                      </div>
                      <div className={`flex-1 h-px ${isCurrentBand ? "bg-primary/40" : "bg-border/40"}`} />
                      <div className={`ml-2 shrink-0 text-[10px] font-semibold w-10 text-right ${abovePrice ? "text-red-500" : belowPrice ? "text-green-500" : "text-muted-foreground"}`}>
                        {abovePrice ? "SELL" : belowPrice ? "BUY" : "—"}
                      </div>
                    </div>
                  );
                })}
                {currentPrice > 0 && bot.upperPrice > bot.lowerPrice && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-primary/60 border-dashed z-20 pointer-events-none"
                    style={{
                      top: `${(1 - (currentPrice - bot.lowerPrice) / (bot.upperPrice - bot.lowerPrice)) * 100}%`,
                    }}
                  >
                    <div className="absolute right-2 -top-4 bg-background border border-primary px-1.5 py-0.5 rounded text-[10px] text-primary font-bold">
                      {currentPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  {totalPnl !== null ? (
                    <div className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(4)}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                  )}
                  {displayedRealizedPnl !== null && displayedUnrealizedPnl !== null && (
                    <div className="text-[10px] text-muted-foreground mt-1 space-x-2">
                      <span>Real: <span className={displayedRealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>${displayedRealizedPnl.toFixed(4)}</span></span>
                      <span>Unreal: <span className={displayedUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>${displayedUnrealizedPnl.toFixed(4)}</span></span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fills (session)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTrades}</div>
                  {position && Math.abs(position.size) > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Position: {position.size > 0 ? "+" : ""}{position.size.toFixed(6)}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  {margin ? (
                    <>
                      <div className="text-2xl font-bold tabular-nums">${margin.totalBalance.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Avail: ${margin.availableBalance.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bot Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Terminal className="h-4 w-4" /> Bot Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-background rounded-md border border-border p-3 h-36 overflow-y-auto font-mono text-xs space-y-0.5">
                  {logs.length === 0 ? (
                    <div className="text-muted-foreground/50 text-center mt-12">No logs yet.</div>
                  ) : (
                    logs.map((l, i) => (
                      <div key={i} className="text-muted-foreground leading-snug">
                        <span className="text-border mr-2">{new Date(l.ts).toLocaleTimeString()}</span>
                        <span>{l.msg}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>

            {/* Live Open Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Open Orders</span>
                  <span className="text-xs font-normal text-muted-foreground">via bulk.trade API</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Side</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Filled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No open orders for {bot.symbol}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...liveOrders]
                        .sort((a, b) => b.price - a.price)
                        .map(order => (
                          <TableRow key={order.orderId}>
                            <TableCell className={order.isBuy ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                              {order.isBuy ? "BUY" : "SELL"}
                            </TableCell>
                            <TableCell className="font-mono tabular-nums">{order.price.toFixed(2)}</TableCell>
                            <TableCell className="font-mono tabular-nums">{order.originalSize.toFixed(6)}</TableCell>
                            <TableCell className="font-mono tabular-nums">{order.filledSize.toFixed(6)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                order.status === "filled"   ? "border-green-500 text-green-500" :
                                order.status === "resting"  ? "border-blue-500 text-blue-500"   :
                                order.status === "placed"   ? "border-blue-400 text-blue-400"   :
                                order.status === "working"  ? "border-yellow-500 text-yellow-500" :
                                "border-gray-500 text-gray-500"
                              }>
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
