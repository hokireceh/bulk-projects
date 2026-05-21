import { Layout } from "@/components/layout";
import { useCreateBot, useGetMarkets } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLocation } from "wouter";
import { getPrivateKey, derivePublicKey } from "@/lib/keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useWatch } from "react-hook-form";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function parseLocaleNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const s = val.trim();
    // If both separators present, last one is the decimal separator
    const lastDot   = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot > -1 && lastComma > -1) {
      if (lastComma > lastDot) {
        // Format: 1.234,56 → Indonesian → 1234.56
        return parseFloat(s.replace(/\./g, "").replace(",", "."));
      } else {
        // Format: 1,234.56 → English → 1234.56
        return parseFloat(s.replace(/,/g, ""));
      }
    }
    if (lastComma > -1) {
      // Only comma: treat as decimal separator (Indonesian style: 77,456 = 77.456)
      return parseFloat(s.replace(",", "."));
    }
    return parseFloat(s);
  }
  return NaN;
}

const priceField = z.preprocess(parseLocaleNumber, z.number().positive("Harus lebih dari 0"));
const optionalPriceField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : parseLocaleNumber(v)),
  z.number().positive("Harus lebih dari 0").optional()
);

// CROSS-RANGE-MIN-001: minimum 2% range width agar grid tidak terlalu sempit
const MIN_GRID_RANGE_PCT = 2.0;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1, "Symbol is required"),
  mode: z.enum(["LONG", "SHORT", "NEUTRAL"]),
  orderMode: z.enum(["UPFRONT", "REACTIVE"]).default("REACTIVE"),
  lowerPrice: priceField,
  upperPrice: priceField,
  gridCount: z.coerce.number().int().min(2).max(200),
  investment: priceField,
  leverage: z.coerce.number().int().min(1).max(100).default(1),
  stopLoss: optionalPriceField,
  takeProfit: optionalPriceField,
}).refine(data => data.upperPrice > data.lowerPrice, {
  message: "Upper price must be greater than lower price",
  path: ["upperPrice"],
}).refine(data => {
  const widthPct = ((data.upperPrice - data.lowerPrice) / data.lowerPrice) * 100;
  return widthPct >= MIN_GRID_RANGE_PCT;
}, {
  message: `Range grid terlalu sempit — minimum ${MIN_GRID_RANGE_PCT}% dari lower price`,
  path: ["upperPrice"],
});

function GridRangePreview({ control }: { control: any }) {
  const lower    = useWatch({ control, name: "lowerPrice" });
  const upper    = useWatch({ control, name: "upperPrice" });
  const gridCount = useWatch({ control, name: "gridCount" });

  const preview = useMemo(() => {
    const lo = typeof lower === "number" ? lower : parseLocaleNumber(lower);
    const hi = typeof upper === "number" ? upper : parseLocaleNumber(upper);
    const n  = Number(gridCount);
    if (!lo || !hi || !n || hi <= lo) return null;
    const step = (hi - lo) / n;
    return { lo, hi, step, n };
  }, [lower, upper, gridCount]);

  if (!preview) return null;

  return (
    <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
      <p className="font-medium text-foreground/80">Preview Grid</p>
      <div className="flex gap-6 text-muted-foreground font-mono text-xs">
        <span>Lower: <span className="text-foreground">{preview.lo.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span></span>
        <span>Upper: <span className="text-foreground">{preview.hi.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span></span>
        <span>Step: <span className="text-primary">{preview.step.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span> / grid</span>
      </div>
      {preview.hi > preview.lo * 2 && (
        <p className="text-amber-400 text-xs">
          Peringatan: range sangat besar ({((preview.hi / preview.lo - 1) * 100).toFixed(0)}%). Pastikan angka yang dimasukkan benar.
        </p>
      )}
    </div>
  );
}

export default function CreateBot() {
  const [, setLocation] = useLocation();
  const createBot = useCreateBot();
  const { toast } = useToast();
  const [symbolOpen, setSymbolOpen] = useState(false);

  const { data: markets, isLoading: marketsLoading } = useGetMarkets();

  const tradingMarkets = markets?.filter(m => m.status === "TRADING") ?? [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "My Grid Bot",
      symbol: "",
      mode: "NEUTRAL",
      orderMode: "REACTIVE",
      lowerPrice: 50000,
      upperPrice: 70000,
      gridCount: 10,
      investment: 1000,
      leverage: 1,
      stopLoss: undefined,
      takeProfit: undefined,
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const pk = getPrivateKey();
    if (!pk) {
      toast({
        title: "Missing Private Key",
        description: "Please configure your wallet in settings first.",
        variant: "destructive"
      });
      setLocation("/settings");
      return;
    }

    const pubkey = derivePublicKey(pk);
    if (!pubkey) {
      toast({
        title: "Invalid Private Key",
        description: "Failed to derive public key. Check your settings.",
        variant: "destructive"
      });
      return;
    }

    createBot.mutate({
      data: {
        ...values,
        accountPubkey: pubkey,
        stopLoss: values.stopLoss ?? null,
        takeProfit: values.takeProfit ?? null,
      }
    }, {
      onSuccess: (bot) => {
        toast({ title: "Bot Created", description: "Your grid bot was successfully created." });
        setLocation(`/bots/${bot.id}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create bot.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Create Grid Bot</h2>
          <p className="text-muted-foreground">Configure your new algorithmic trading bot.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="symbol"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Trading Pair</FormLabel>
                        <Popover open={symbolOpen} onOpenChange={setSymbolOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={symbolOpen}
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? (() => {
                                      const m = tradingMarkets.find(m => m.symbol === field.value);
                                      return m ? `${m.symbol} (${m.baseAsset}/${m.quoteAsset})` : field.value;
                                    })()
                                  : marketsLoading
                                  ? "Loading markets..."
                                  : "Select trading pair"}
                                {marketsLoading
                                  ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                                  : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search pair..." />
                              <CommandList>
                                <CommandEmpty>No markets found.</CommandEmpty>
                                <CommandGroup>
                                  {tradingMarkets.map((market) => (
                                    <CommandItem
                                      key={market.symbol}
                                      value={market.symbol}
                                      onSelect={(val) => {
                                        field.onChange(val.toUpperCase());
                                        setSymbolOpen(false);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Check
                                        className={cn(
                                          "h-4 w-4 shrink-0",
                                          field.value === market.symbol ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="font-medium shrink-0">{market.symbol}</span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {market.baseAsset}/{market.quoteAsset} · {market.maxLeverage}x max
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LONG">Long — buy low, sell high (uptrend)</SelectItem>
                          <SelectItem value="SHORT">Short — sell high, buy low (downtrend)</SelectItem>
                          <SelectItem value="NEUTRAL">Neutral — profit from sideways oscillation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cara Pasang Order</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {(["REACTIVE", "UPFRONT"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => field.onChange(val)}
                            className={`rounded-lg border p-4 text-left transition-colors ${
                              field.value === val
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-muted/20 text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            <div className="font-semibold text-sm mb-1">
                              {val === "REACTIVE" ? "Reaktif (default)" : "Upfront"}
                            </div>
                            <div className="text-xs leading-snug">
                              {val === "REACTIVE"
                                ? "Order dipasang hanya saat harga crossing level grid"
                                : "Semua order grid langsung dipasang saat bot start"}
                            </div>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lowerPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lower Price Limit</FormLabel>
                        <FormControl>
                          <Input type="text" inputMode="decimal" placeholder="e.g. 76500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="upperPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upper Price Limit</FormLabel>
                        <FormControl>
                          <Input type="text" inputMode="decimal" placeholder="e.g. 78000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <GridRangePreview control={form.control} />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gridCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grids</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="investment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investment (USDC)</FormLabel>
                        <FormControl>
                          <Input type="text" inputMode="decimal" placeholder="e.g. 1000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverage (x)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/80">Stop Loss / Take Profit <span className="text-muted-foreground font-normal">(opsional)</span></p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="stopLoss"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">
                            Stop Loss (LONG/NETRAL: di bawah lower · SHORT: di atas upper)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Kosongkan jika tidak dipakai"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="takeProfit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">
                            Take Profit (LONG/NETRAL: di atas upper · SHORT: di bawah lower)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Kosongkan jika tidak dipakai"
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createBot.isPending}>
                  {createBot.isPending ? "Creating..." : "Create Bot"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
