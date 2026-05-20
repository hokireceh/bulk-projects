import { Layout } from "@/components/layout";
import { useGetBot, useStartBot, useStopBot, getGetBotQueryKey, useGetBotOrders, getListBotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Square } from "lucide-react";
import { calculateGridLevels, sizePerGrid } from "@/lib/gridEngine";

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const botId = Number(id);
  const queryClient = useQueryClient();

  const { data: bot, isLoading } = useGetBot(botId, { 
    query: { enabled: !!botId, queryKey: getGetBotQueryKey(botId) } 
  });

  const { data: orders } = useGetBotOrders(botId, {
    query: { enabled: !!botId, queryKey: ["orders", botId], refetchInterval: bot?.status === "RUNNING" ? 5000 : false }
  });

  const startBot = useStartBot();
  const stopBot = useStopBot();

  const handleToggle = () => {
    if (!bot) return;
    if (bot.status === "RUNNING") {
      stopBot.mutate({ id: bot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        }
      });
    } else {
      startBot.mutate({ id: bot.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
          queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "STOPPED": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "ERROR": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const currentPriceMock = (bot?.lowerPrice || 0) + ((bot?.upperPrice || 0) - (bot?.lowerPrice || 0)) / 2;
  const gridLevels = bot ? calculateGridLevels(bot.lowerPrice, bot.upperPrice, bot.gridCount, bot.mode, currentPriceMock) : [];

  if (isLoading || !bot) return <Layout><div className="p-8">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold tracking-tight">{bot.name}</h2>
              <Badge variant="outline" className={getStatusColor(bot.status)}>
                {bot.status === "RUNNING" && <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />}
                {bot.status}
              </Badge>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{bot.symbol}</Badge>
            </div>
            <p className="text-muted-foreground">
              {bot.mode} Strategy • {bot.gridCount} Grids • ${bot.investment} Inv.
            </p>
          </div>
          <Button 
            size="lg" 
            variant={bot.status === "RUNNING" ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={startBot.isPending || stopBot.isPending}
          >
            {bot.status === "RUNNING" ? (
              <><Square className="w-4 h-4 mr-2" /> Stop Bot</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Start Bot</>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Grid Visualization */}
          <Card className="col-span-1 border-primary/20 bg-card">
            <CardHeader>
              <CardTitle>Live Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] relative w-full rounded-md border border-border bg-background p-4 flex flex-col justify-between overflow-hidden">
                {gridLevels.reverse().map((level, i) => (
                  <div key={i} className="flex items-center w-full relative z-10 text-xs font-mono group">
                    <div className={`w-16 shrink-0 ${level.side === 'SELL' ? 'text-red-400' : 'text-green-400'}`}>
                      {level.price.toFixed(2)}
                    </div>
                    <div className="flex-1 h-px bg-border/50 group-hover:bg-border transition-colors"></div>
                    <div className={`px-2 shrink-0 ${level.side === 'SELL' ? 'text-red-500' : 'text-green-500'}`}>
                      {level.side}
                    </div>
                  </div>
                ))}
                {/* Mock current price line */}
                <div className="absolute top-1/2 left-0 right-0 border-t-2 border-primary/50 border-dashed z-20 pointer-events-none">
                  <div className="absolute right-2 -top-3 bg-background border border-primary px-2 py-0.5 rounded text-xs text-primary font-bold">
                    {currentPriceMock.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats & Orders */}
          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${bot.totalPnl && bot.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {bot.totalPnl && bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl?.toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Trades Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bot.totalTrades || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Size per Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sizePerGrid(bot.investment, bot.gridCount, currentPriceMock).toFixed(4)} {bot.symbol.split('-')[0]}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
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
                    {orders?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No orders yet.</TableCell>
                      </TableRow>
                    ) : (
                      orders?.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className={order.side === "BUY" ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{order.side}</TableCell>
                          <TableCell className="font-mono">{order.price}</TableCell>
                          <TableCell className="font-mono">{order.size}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              order.status === "FILLED" ? "border-green-500 text-green-500" : 
                              order.status === "OPEN" ? "border-blue-500 text-blue-500" : ""
                            }>{order.status}</Badge>
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
