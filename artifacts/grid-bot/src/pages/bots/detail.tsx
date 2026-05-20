import { Layout } from "@/components/layout";
import {
  useGetBot, useStartBot, useStopBot,
  getGetBotQueryKey, useGetBotOrders, getListBotsQueryKey,
  useGetMarketTicker, getGetMarketTickerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Square, Terminal } from "lucide-react";
import { calculateGridLevels, sizePerGrid } from "@/lib/gridEngine";
import { BotRunner, type LogLine } from "@/lib/botRunner";
import { getPrivateKey } from "@/lib/keys";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const botId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const runnerRef = useRef<BotRunner | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { enabled: !!botId, queryKey: getGetBotQueryKey(botId), refetchInterval: 5000 }
  });

  const { data: orders } = useGetBotOrders(botId, {
    query: { enabled: !!botId, queryKey: ["orders", botId], refetchInterval: bot?.status === "RUNNING" ? 5000 : false }
  });

  const { data: ticker } = useGetMarketTicker(bot?.symbol ?? "", {
    query: {
      enabled: !!bot?.symbol,
      queryKey: getGetMarketTickerQueryKey(bot?.symbol ?? ""),
      refetchInterval: 10000,
    }
  });

  const startBot = useStartBot();
  const stopBot = useStopBot();

  const currentPrice: number = ticker?.markPrice ?? 0;
  const midPrice = bot ? (bot.lowerPrice + bot.upperPrice) / 2 : 0;
  const priceForGrid = currentPrice > 0 ? currentPrice : midPrice;

  const gridLevels = bot
    ? calculateGridLevels(bot.lowerPrice, bot.upperPrice, bot.gridCount, bot.mode, priceForGrid)
    : [];

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Stop runner on unmount
  useEffect(() => {
    return () => {
      if (runnerRef.current?.isRunning) {
        runnerRef.current.stop();
      }
    };
  }, []);

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

    // Mark RUNNING in DB
    startBot.mutate({ id: bot.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });

    // Create and start BotRunner
    setLogs([]);
    const runner = new BotRunner(
      {
        botId,
        accountPubkey: bot.accountPubkey,
        privateKey: pk,
        symbol: bot.symbol,
        mode: bot.mode,
        lowerPrice: bot.lowerPrice,
        upperPrice: bot.upperPrice,
        gridCount: bot.gridCount,
        investment: bot.investment,
        leverage: bot.leverage ?? 1,
      },
      () => setLogs([...runner.logs])
    );
    runnerRef.current = runner;
    runner.start();
  };

  const handleStop = async () => {
    if (!bot) return;

    const runner = runnerRef.current;
    if (runner) {
      await runner.stop();
      runnerRef.current = null;
    }

    stopBot.mutate({ id: bot.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "STOPPED": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "ERROR":   return "bg-red-500/10 text-red-500 border-red-500/20";
      default:        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  if (isLoading || !bot) return <Layout><div className="p-8">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold tracking-tight">{bot.name}</h2>
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
            <p className="text-muted-foreground">
              {bot.mode} Strategy • {bot.gridCount} Grids • ${bot.investment} Investment • {bot.leverage}x Leverage
            </p>
          </div>

          {bot.status === "RUNNING" ? (
            <Button size="lg" variant="destructive" onClick={handleStop} disabled={stopBot.isPending}>
              <Square className="w-4 h-4 mr-2" /> Stop Bot
            </Button>
          ) : (
            <Button size="lg" onClick={handleStart} disabled={startBot.isPending}>
              <Play className="w-4 h-4 mr-2" /> Start Bot
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Grid Visualization */}
          <Card className="col-span-1 border-primary/20">
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
                {[...gridLevels].reverse().map((level, i) => (
                  <div key={i} className="flex items-center w-full z-10 text-xs font-mono">
                    <div className={`w-20 shrink-0 tabular-nums ${level.side === "SELL" ? "text-red-400" : "text-green-400"}`}>
                      {level.price.toFixed(2)}
                    </div>
                    <div className="flex-1 h-px bg-border/40" />
                    <div className={`ml-2 shrink-0 text-[10px] font-semibold ${level.side === "SELL" ? "text-red-500" : "text-green-500"}`}>
                      {level.side}
                    </div>
                  </div>
                ))}
                {/* Current price marker */}
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
          <div className="col-span-2 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(bot.totalPnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(bot.totalPnl ?? 0) >= 0 ? "+" : ""}${(bot.totalPnl ?? 0).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Trades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bot.totalTrades ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Size / Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {priceForGrid > 0
                      ? sizePerGrid(bot.investment, bot.gridCount, priceForGrid).toFixed(5)
                      : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bot Logs */}
            {logs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4" /> Bot Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-background rounded-md border border-border p-3 h-36 overflow-y-auto font-mono text-xs space-y-0.5">
                    {logs.map((l, i) => (
                      <div key={i} className="text-muted-foreground leading-snug">
                        <span className="text-border mr-2">{new Date(l.ts).toLocaleTimeString()}</span>
                        <span>{l.msg}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Side</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!orders || orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No orders yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className={order.side === "BUY" ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                            {order.side}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">{order.price}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.size}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              order.status === "FILLED"    ? "border-green-500 text-green-500" :
                              order.status === "OPEN"      ? "border-blue-500 text-blue-500"   :
                              order.status === "CANCELLED" ? "border-gray-500 text-gray-500"   : ""
                            }>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(order.createdAt).toLocaleTimeString()}
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
