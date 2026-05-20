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

  if (isLoading) return <Skeleton className="h-4 w-24" />;
  if (!ticker) return <span className="text-muted-foreground">—</span>;

  const change = ticker.priceChangePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="flex items-center gap-3 justify-end">
      <div className="text-right">
        <div className="font-mono font-bold tabular-nums">
          ${ticker.markPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {ticker.lastPrice !== ticker.markPrice && (
          <div className="text-xs text-muted-foreground font-mono">
            Last: ${ticker.lastPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
      <div className={`text-sm font-medium tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
        {isUp ? <TrendingUp className="inline h-3.5 w-3.5 mr-1" /> : <TrendingDown className="inline h-3.5 w-3.5 mr-1" />}
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
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Markets</h2>
          <p className="text-muted-foreground">Live prices from Bulk.trade perpetual futures.</p>
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
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
              <span>Market</span>
              <span className="text-right">Max Leverage</span>
              <span className="text-right">Tick Size</span>
              <span className="text-right">Lot Size</span>
              <span className="text-right">Min Notional</span>
              <span className="text-right">Mark Price / 24h</span>
            </div>

            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                  <Skeleton className="h-5 w-28 ml-auto" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No markets found{search ? ` for "${search}"` : ""}.
              </div>
            ) : (
              filtered.map(market => (
                <div
                  key={market.symbol}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 hover:bg-muted/20 transition-colors"
                >
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
