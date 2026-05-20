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
import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1, "Symbol is required"),
  mode: z.enum(["LONG", "SHORT", "NEUTRAL"]),
  lowerPrice: z.coerce.number().positive(),
  upperPrice: z.coerce.number().positive(),
  gridCount: z.coerce.number().int().min(2).max(200),
  investment: z.coerce.number().positive(),
  leverage: z.coerce.number().int().min(1).max(100).default(1)
}).refine(data => data.upperPrice > data.lowerPrice, {
  message: "Upper price must be greater than lower price",
  path: ["upperPrice"]
});

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
      lowerPrice: 50000,
      upperPrice: 70000,
      gridCount: 10,
      investment: 1000,
      leverage: 1
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
        accountPubkey: pubkey
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lowerPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lower Price Limit</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} />
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
                          <Input type="number" step="any" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                          <Input type="number" step="any" {...field} />
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
