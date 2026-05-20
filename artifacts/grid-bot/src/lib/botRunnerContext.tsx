// @refresh reset
import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";
import { BotRunner, type BotConfig, type LogLine, type MarginData, type PositionData, type LiveOrder } from "./botRunner";

export interface RunnerState {
  isRunning: boolean;
  logs: LogLine[];
  margin: MarginData | null;
  position: PositionData | null;
  openOrders: LiveOrder[];
  totalTrades: number;
  currentPrice: number;
  lastLevel: number | null;
}

interface BotRunnerContextValue {
  startRunner: (config: BotConfig, onUpdate: () => void, onStopped: () => void) => void;
  stopRunner: (botId: number) => Promise<void>;
  getRunner: (botId: number) => BotRunner | null;
  isRunning: (botId: number) => boolean;
}

const BotRunnerContext = createContext<BotRunnerContextValue | null>(null);

export function BotRunnerProvider({ children }: { children: ReactNode }) {
  const runnersRef = useRef<Map<number, BotRunner>>(new Map());

  const startRunner = useCallback((config: BotConfig, onUpdate: () => void, onStopped: () => void) => {
    const existing = runnersRef.current.get(config.botId);
    if (existing?.isRunning) return;

    const runner = new BotRunner(config, onUpdate, () => {
      runnersRef.current.delete(config.botId);
      onStopped();
    });
    runnersRef.current.set(config.botId, runner);
    runner.start();
  }, []);

  const stopRunner = useCallback(async (botId: number) => {
    const runner = runnersRef.current.get(botId);
    if (runner) {
      await runner.stop();
      runnersRef.current.delete(botId);
    }
  }, []);

  const getRunner = useCallback((botId: number): BotRunner | null => {
    return runnersRef.current.get(botId) ?? null;
  }, []);

  const isRunning = useCallback((botId: number): boolean => {
    return runnersRef.current.get(botId)?.isRunning ?? false;
  }, []);

  return (
    <BotRunnerContext.Provider value={{ startRunner, stopRunner, getRunner, isRunning }}>
      {children}
    </BotRunnerContext.Provider>
  );
}

export function useBotRunnerContext(): BotRunnerContextValue {
  const ctx = useContext(BotRunnerContext);
  if (!ctx) throw new Error("useBotRunnerContext must be used within BotRunnerProvider");
  return ctx;
}
