import { Layout } from "@/components/layout";
import { useGetMarkets, useGetMarketTicker, getGetMarketTickerQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { TrendingUp, TrendingDown, Search } from "lucide-react";

function TickerCell({ symbol }: { symbol: string }) {
  const { data: ticker, isLoading } = useGetMarketTicker(symbol, {
    query: {
      queryKey: getGetMarketTickerQueryKey(symbol),
      refetchInterval: 10000,
      staleTime: 5000,
    },
  });

  if (isLoading) return <Skeleton className="h-4 w-20 ml-auto" />;
  if (!ticker) return <span className="text-muted-foreground">—</span>;

  const change = ticker.priceChangePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="text-right">
        <div className="font-mono font-bold tabular-nums text-sm">
          ${ticker.markPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className={`text-xs font-medium tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
        {isUp ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
        {isUp ? "+" : ""}{change.toFixed(2)}%
      </div>
    </div>
  );
}

export default function Markets() {
  const { data: markets, isLoading } = useGetMarkets();
  const [search, setSearch] = useState("");

  const tradingMarkets = (markets ?? []).filter(m => m.status === "TRADING");
  const filtered = tradingMarkets.filter(m =>
    m.symbol.toLowerCase().includes(search.toLowerCase()) ||
    m.baseAsset.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Markets</h2>
          <p className="text-muted-foreground text-sm">Live prices from Bulk.trade perpetual futures.</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {/* Header — hide detail columns on mobile */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
              <span>Market</span>
              <span className="text-right">Max Leverage</span>
              <span className="text-right">Tick Size</span>
              <span className="text-right">Lot Size</span>
              <span className="text-right">Min Notional</span>
              <span className="text-right">Mark Price / 24h</span>
            </div>
            {/* Mobile header */}
            <div className="md:hidden grid grid-cols-[1fr_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
              <span>Market</span>
              <span className="text-right">Price / 24h</span>
            </div>

            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No markets found{search ? ` for "${search}"` : ""}.
              </div>
            ) : (
              filtered.map(market => (
                <div key={market.symbol}>
                  {/* Mobile row */}
                  <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div>
                        <div className="font-semibold text-sm">{market.symbol}</div>
                        <div className="text-xs text-muted-foreground">{market.maxLeverage}x lev · {market.baseAsset}/{market.quoteAsset}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20 shrink-0">
                        LIVE
                      </Badge>
                    </div>
                    <TickerCell symbol={market.symbol} />
                  </div>

                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold">{market.symbol}</div>
                        <div className="text-xs text-muted-foreground">{market.baseAsset} / {market.quoteAsset}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">
                        LIVE
                      </Badge>
                    </div>
                    <div className="text-right font-mono text-sm">{market.maxLeverage}x</div>
                    <div className="text-right font-mono text-sm text-muted-foreground">{market.tickSize}</div>
                    <div className="text-right font-mono text-sm text-muted-foreground">{market.lotSize}</div>
                    <div className="text-right font-mono text-sm text-muted-foreground">
                      {market.minNotional != null ? `$${market.minNotional}` : "—"}
                    </div>
                    <CardContent className="p-0">
                      <TickerCell symbol={market.symbol} />
                    </CardContent>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Prices refresh every 10 seconds · Bulk.trade Staging
        </p>
      </div>
    </Layout>
  );
}
