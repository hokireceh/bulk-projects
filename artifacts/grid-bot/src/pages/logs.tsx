import { Layout } from "@/components/layout";
import { useListBots } from "@workspace/api-client-react";
import { useBotRunnerContext } from "@/lib/botRunnerContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

export default function Logs() {
  const { data: bots } = useListBots();
  const { getRunner } = useBotRunnerContext();

  const botsArray = Array.isArray(bots) ? bots : [];

  const allEntries = useMemo(() => {
    const entries: { botId: number; botName: string; symbol: string; ts: number; text: string; level: "info" | "error" | "warn" }[] = [];
    for (const bot of botsArray) {
      const runner = getRunner(bot.id);
      if (!runner) continue;
      for (const log of runner.logs) {
        const level = log.msg.startsWith("✗") || log.msg.toLowerCase().includes("error")
          ? "error"
          : log.msg.startsWith("Skip") || log.msg.toLowerCase().includes("warn")
          ? "warn"
          : "info";
        entries.push({ botId: bot.id, botName: bot.name, symbol: bot.symbol, ts: log.ts, text: log.msg, level });
      }
    }
    return entries.sort((a, b) => b.ts - a.ts);
  }, [botsArray, getRunner]);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Trading Logs</h2>
          <p className="text-muted-foreground text-sm">Log aktivitas real-time dari semua bot yang sedang berjalan.</p>
        </div>

        {botsArray.filter(b => getRunner(b.id)).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">Tidak ada bot yang sedang berjalan.</p>
              <Link href="/bots" className="text-sm text-primary underline underline-offset-2 mt-2">
                Ke halaman My Bots
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {botsArray.filter(b => getRunner(b.id)).map(bot => {
              const runner = getRunner(bot.id);
              if (!runner) return null;
              const botLogs = [...runner.logs].reverse();
              return (
                <Card key={bot.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        <Link href={`/bots/${bot.id}`} className="hover:underline">{bot.name}</Link>
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">{bot.symbol}</Badge>
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse inline-block" />
                        RUNNING
                      </Badge>
                      {runner.sessionPnl !== 0 && (
                        <span className={`text-xs font-mono ml-auto ${runner.sessionPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          P&L: {runner.sessionPnl >= 0 ? "+" : ""}${runner.sessionPnl.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-background/50 border border-border rounded-md p-3 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
                      {botLogs.length === 0 ? (
                        <div className="text-muted-foreground">Menunggu aktivitas...</div>
                      ) : botLogs.map((log, i) => (
                        <div key={i} className={`flex gap-2 leading-relaxed ${
                          log.msg.startsWith("✗") || log.msg.toLowerCase().includes("error")
                            ? "text-red-400"
                            : log.msg.startsWith("✓") || log.msg.startsWith("Fill:")
                            ? "text-green-400"
                            : log.msg.startsWith("Skip")
                            ? "text-yellow-500/70"
                            : "text-muted-foreground"
                        }`}>
                          <span className="shrink-0 text-muted-foreground/50">{fmt(log.ts)}</span>
                          <span>{log.msg}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
