import { Layout } from "@/components/layout";
import {
  useListBots, useDeleteBot, useStartBot, useStopBot,
  getListBotsQueryKey, getGetBotQueryKey,
  type Bot,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Plus, Square, Play, Pencil, Trash2, Eye, BarChart2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useBotRunnerContext } from "@/lib/botRunnerContext";
import { getPrivateKey, getEndpoint } from "@/lib/keys";
import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { type MarginData, type PositionData } from "@/lib/botRunner";

// ── Per-card live state ───────────────────────────────────────────────────────

interface LiveState {
  sessionPnl: number | null;
  unrealizedPnl: number | null;
  totalTrades: number;
}

function useLiveState(botId: number): LiveState {
  const { getRunner } = useBotRunnerContext();
  const [state, setState] = useState<LiveState>({
    sessionPnl: null,
    unrealizedPnl: null,
    totalTrades: 0,
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const r = getRunner(botId);
      if (!r) return;
      setState({
        sessionPnl:     r.sessionPnl,
        unrealizedPnl:  r.position?.unrealizedPnl ?? null,
        totalTrades:    r.totalTrades,
      });
    }, 800);
    return () => clearInterval(iv);
  }, [botId, getRunner]);

  return state;
}

// ── BotCard ───────────────────────────────────────────────────────────────────

function BotCard({ bot }: { bot: Bot }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { startRunner, stopRunner, getRunner, isRunning } = useBotRunnerContext();
  const [, navigate] = useLocation();
  const live = useLiveState(bot.id);

  const startBot = useStartBot();
  const stopBot  = useStopBot();

  const handleRunnerStopped = useCallback(() => {
    stopBot.mutate({ id: bot.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(bot.id) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });
  }, [bot.id, stopBot, queryClient]);

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const pk = getPrivateKey();
    if (!pk) {
      toast({ title: "No Private Key", description: "Configure your wallet in Settings first.", variant: "destructive" });
      return;
    }
    startBot.mutate({ id: bot.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(bot.id) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
    });
    startRunner(
      {
        botId: bot.id,
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
        stopLoss:   bot.stopLoss   ?? null,
        takeProfit: bot.takeProfit ?? null,
      },
      () => {},
      handleRunnerStopped,
    );
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    const runner = getRunner(bot.id);
    if (runner) {
      await stopRunner(bot.id);
    } else {
      stopBot.mutate({ id: bot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(bot.id) });
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        },
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Delete bot "${bot.name}"?`)) return;
    deleteBot.mutate({ id: bot.id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() }),
    });
  };

  const deleteBot = useDeleteBot();

  const running = bot.status === "RUNNING";
  const perGrid = bot.investment / bot.gridCount;

  const modeColor = bot.mode === "LONG"
    ? "bg-green-500/15 text-green-400 border-green-500/20"
    : bot.mode === "SHORT"
      ? "bg-red-500/15 text-red-400 border-red-500/20"
      : "bg-blue-500/15 text-blue-400 border-blue-500/20";

  const pnlColor = (v: number | null) =>
    v === null ? "text-muted-foreground" : v >= 0 ? "text-green-400" : "text-red-400";

  const fmtPnl = (v: number | null) =>
    v === null ? "—" : `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`;

  return (
    <div
      className="rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer flex flex-col h-full"
      onClick={() => navigate(`/bots/${bot.id}`)}
    >

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <div className="min-w-0">
            <div className="font-semibold text-base leading-tight truncate">{bot.name}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">{bot.symbol}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">GRID</Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${modeColor}`}>{bot.mode}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">{bot.orderMode ?? "REACTIVE"}</Badge>
            </div>
          </div>
          {running ? (
            <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              RUNNING
            </span>
          ) : (
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground bg-muted/40 border rounded-full px-2 py-0.5">
              {bot.status}
            </span>
          )}
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-px bg-border mx-4 rounded-lg overflow-hidden text-sm mb-3">
          <div className="bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Range</div>
            <div className="font-medium text-xs leading-tight">
              ${bot.lowerPrice.toLocaleString("en-US")} – ${bot.upperPrice.toLocaleString("en-US")}
            </div>
          </div>
          <div className="bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Level</div>
            <div className="font-medium">{bot.gridCount}</div>
          </div>
          <div className="bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Per Grid</div>
            <div className="font-medium">${perGrid.toFixed(2)}</div>
          </div>
          <div className="bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">Leverage</div>
            <div className="font-medium">{bot.leverage ?? 1}×</div>
          </div>
        </div>

        {/* ── PnL ── */}
        <div className="grid grid-cols-2 gap-3 px-4 mb-3">
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <span className="text-[8px]">↓</span> Realized PnL
            </div>
            <div className={`text-sm font-semibold ${pnlColor(live.sessionPnl)}`}>
              {fmtPnl(live.sessionPnl)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <span className="text-[8px]">↗</span> Unrealized PnL
            </div>
            <div className={`text-sm font-semibold ${pnlColor(live.unrealizedPnl)}`}>
              {fmtPnl(live.unrealizedPnl)}
            </div>
          </div>
        </div>

        {/* ── Session counter ── */}
        <div className="px-4 pb-3 text-[11px] text-muted-foreground">
          Total: {live.totalTrades} trade{live.totalTrades !== 1 ? "s" : ""} sesi ini
        </div>

        {/* ── Actions ── */}
        <div className="mt-auto border-t px-4 py-3 flex items-center gap-2" onClick={e => e.preventDefault()}>
          {running ? (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 h-8 text-xs"
              onClick={handleStop}
            >
              <Square className="h-3 w-3 mr-1.5 fill-current" />
              Stop Bot
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleStart}
            >
              <Play className="h-3 w-3 mr-1.5 fill-current" />
              Start Bot
            </Button>
          )}

          <Link href={`/bots/${bot.id}`} onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Detail">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Link>

          {!running && (
            <Link href={`/bots/${bot.id}/edit`} onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}

          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BotList() {
  const { data: bots, isLoading } = useListBots();
  const botsArray = Array.isArray(bots) ? bots : [];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">My Bots</h2>
            <p className="text-muted-foreground text-sm">Manage your grid trading bots.</p>
          </div>
          <Link href="/bots/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Create Bot</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border bg-card h-64 animate-pulse" />
            ))}
          </div>
        ) : botsArray.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-muted/10 border-dashed">
            <BarChart2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-sm mb-4">No bots yet. Create one to get started.</p>
            <Link href="/bots/new">
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Create Bot
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {botsArray.map(bot => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
