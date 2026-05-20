import { Layout } from "@/components/layout";
import { useGetBot, useUpdateBot, getGetBotQueryKey, getListBotsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

function parseLocaleNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const s = val.trim();
    const lastDot   = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot > -1 && lastComma > -1) {
      if (lastComma > lastDot) {
        return parseFloat(s.replace(/\./g, "").replace(",", "."));
      } else {
        return parseFloat(s.replace(/,/g, ""));
      }
    }
    if (lastComma > -1) {
      return parseFloat(s.replace(",", "."));
    }
    return parseFloat(s);
  }
  return NaN;
}

const priceField = z.preprocess(parseLocaleNumber, z.number().positive("Harus lebih dari 0"));

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mode: z.enum(["LONG", "SHORT", "NEUTRAL"]),
  lowerPrice: priceField,
  upperPrice: priceField,
  gridCount: z.coerce.number().int().min(2).max(200),
  investment: priceField,
  leverage: z.coerce.number().int().min(1).max(100),
}).refine(data => data.upperPrice > data.lowerPrice, {
  message: "Upper price must be greater than lower price",
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

export default function EditBot() {
  const { id } = useParams<{ id: string }>();
  const botId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { enabled: !!botId, queryKey: ["bot", botId] }
  });

  const updateBot = useUpdateBot();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mode: "NEUTRAL",
      lowerPrice: 0,
      upperPrice: 0,
      gridCount: 10,
      investment: 1000,
      leverage: 1,
    },
  });

  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        mode: bot.mode as "LONG" | "SHORT" | "NEUTRAL",
        lowerPrice: bot.lowerPrice,
        upperPrice: bot.upperPrice,
        gridCount: bot.gridCount,
        investment: bot.investment,
        leverage: bot.leverage ?? 1,
      });
    }
  }, [bot, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateBot.mutate({ id: botId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        toast({ title: "Bot Updated", description: "Changes saved successfully." });
        setLocation(`/bots/${botId}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update bot.", variant: "destructive" });
      },
    });
  };

  if (isLoading || !bot) {
    return <Layout><div className="p-8 text-muted-foreground">Loading...</div></Layout>;
  }

  if (bot.status === "RUNNING") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-8 space-y-6">
          <Link href={`/bots/${botId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to bot
          </Link>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-6 text-center space-y-2">
              <p className="font-medium text-amber-400">Bot is currently running</p>
              <p className="text-sm text-muted-foreground">Stop the bot before editing its configuration.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <Link href={`/bots/${botId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to bot
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">Edit Bot</h2>
          <p className="text-muted-foreground">{bot.symbol} · {bot.name}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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

                <div className="flex gap-3">
                  <Button type="submit" className="flex-1" disabled={updateBot.isPending}>
                    {updateBot.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation(`/bots/${botId}`)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
