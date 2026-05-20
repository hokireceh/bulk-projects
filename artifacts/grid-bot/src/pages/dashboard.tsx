import { Layout } from "@/components/layout";
import { useListBots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowUpRight, Grid, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: bots, isLoading } = useListBots();

  const activeBots = bots?.filter(b => b.status === "RUNNING")?.length || 0;
  const totalInvestment = bots?.reduce((acc, b) => acc + b.investment, 0) || 0;
  const totalPnl = bots?.reduce((acc, b) => acc + (b.totalPnl || 0), 0) || 0;

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your grid trading performance.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBots} / {bots?.length || 0}</div>
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
              {bots?.filter(b => b.status === "RUNNING").map(bot => (
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
