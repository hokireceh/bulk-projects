import { Layout } from "@/components/layout";
import { useListBots, useDeleteBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      case "ERROR":   return "bg-red-500/10 text-red-500 border-red-500/20";
      default:        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "LONG":  return "bg-green-500/10 text-green-500";
      case "SHORT": return "bg-red-500/10 text-red-500";
      default:      return "bg-blue-500/10 text-blue-500";
    }
  };

  const botsArray = Array.isArray(bots) ? bots : [];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
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

        {/* Mobile: card list */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : botsArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No bots found. Create one to get started.
            </div>
          ) : (
            botsArray.map(bot => (
              <Link key={bot.id} href={`/bots/${bot.id}`}>
                <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-base truncate">{bot.name}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{bot.symbol}</div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={getStatusColor(bot.status)}>
                            {bot.status === "RUNNING" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                            {bot.status}
                          </Badge>
                          <Badge variant="outline" className={getModeColor(bot.mode)}>
                            {bot.mode}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium">${bot.investment}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">investment</div>
                        <div className="flex items-center gap-1 mt-2 justify-end" onClick={e => e.preventDefault()}>
                          {bot.status !== "RUNNING" && (
                            <Link href={`/bots/${bot.id}/edit`} onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={e => handleDelete(bot.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <Card className="hidden md:block overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Investment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : botsArray.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No bots found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                botsArray.map(bot => (
                  <TableRow key={bot.id} className="cursor-pointer group relative">
                    <TableCell className="font-medium">
                      <Link href={`/bots/${bot.id}`} className="absolute inset-0 z-10" />
                      {bot.name}
                    </TableCell>
                    <TableCell>{bot.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getModeColor(bot.mode)}>{bot.mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(bot.status)}>
                        {bot.status === "RUNNING" && <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />}
                        {bot.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${bot.investment}</TableCell>
                    <TableCell className="text-right z-20 relative">
                      {bot.status !== "RUNNING" && (
                        <Link href={`/bots/${bot.id}/edit`} onClick={e => e.stopPropagation()} className="relative z-20">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={e => handleDelete(bot.id, e)}>
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
