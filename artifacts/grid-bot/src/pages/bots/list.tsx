import { Layout } from "@/components/layout";
import { useListBots, useDeleteBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function BotList() {
  const { data: bots, isLoading } = useListBots();
  const deleteBot = useDeleteBot();
  const queryClient = useQueryClient();

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm("Are you sure you want to delete this bot?")) {
      deleteBot.mutate({ id }, {
        onSuccess: () => {
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

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "LONG": return "bg-green-500/10 text-green-500";
      case "SHORT": return "bg-red-500/10 text-red-500";
      default: return "bg-blue-500/10 text-blue-500";
    }
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">My Bots</h2>
            <p className="text-muted-foreground">Manage your grid trading bots.</p>
          </div>
          <Link href="/bots/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            <Plus className="mr-2 h-4 w-4" />
            Create Bot
          </Link>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Investment</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : bots?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No bots found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                bots?.map((bot) => (
                  <TableRow key={bot.id} className="cursor-pointer group relative">
                    <TableCell className="font-medium">
                      <Link href={`/bots/${bot.id}`} className="absolute inset-0 z-10" />
                      {bot.name}
                    </TableCell>
                    <TableCell>{bot.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getModeColor(bot.mode)}>
                        {bot.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(bot.status)}>
                        {bot.status === "RUNNING" && <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />}
                        {bot.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${bot.investment}</TableCell>
                    <TableCell className={`text-right ${bot.totalPnl && bot.totalPnl >= 0 ? "text-green-500" : (bot.totalPnl && bot.totalPnl < 0 ? "text-red-500" : "")}`}>
                      {bot.totalPnl ? `${bot.totalPnl >= 0 ? "+" : ""}${bot.totalPnl.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right z-20 relative">
                      {bot.status !== "RUNNING" && (
                        <Link href={`/bots/${bot.id}/edit`} onClick={(e) => e.stopPropagation()} className="relative z-20">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(bot.id, e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
