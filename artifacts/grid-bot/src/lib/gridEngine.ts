export interface GridLevel {
  price: number;
  side: "BUY" | "SELL";
  index: number; // grid level index (0 = lowerPrice, gridCount = upperPrice)
}

/**
 * Calculate grid levels between lowerPrice and upperPrice.
 * Prices are rounded to 2 decimal places to avoid floating-point drift.
 * Levels exactly at currentPrice are skipped (neither BUY nor SELL).
 */
export function calculateGridLevels(
  lowerPrice: number,
  upperPrice: number,
  gridCount: number,
  mode: "LONG" | "SHORT" | "NEUTRAL",
  currentPrice: number
): GridLevel[] {
  const step = (upperPrice - lowerPrice) / gridCount;
  const levels: GridLevel[] = [];

  for (let i = 0; i <= gridCount; i++) {
    const price = Math.round((lowerPrice + i * step) * 100) / 100;

    // Skip the level that sits exactly at the current mark price
    if (Math.abs(price - currentPrice) < 0.001) continue;

    if (mode === "LONG" && price < currentPrice) {
      levels.push({ price, side: "BUY", index: i });
    } else if (mode === "SHORT" && price > currentPrice) {
      levels.push({ price, side: "SELL", index: i });
    } else if (mode === "NEUTRAL") {
      if (price < currentPrice) levels.push({ price, side: "BUY", index: i });
      else if (price > currentPrice) levels.push({ price, side: "SELL", index: i });
    }
  }

  return levels;
}

/**
 * All grid levels (no mode filter) sorted ascending, with rounded prices.
 * Used to snap replenish prices to exact grid positions.
 */
export function allGridLevels(
  lowerPrice: number,
  upperPrice: number,
  gridCount: number
): number[] {
  const step = (upperPrice - lowerPrice) / gridCount;
  const levels: number[] = [];
  for (let i = 0; i <= gridCount; i++) {
    levels.push(Math.round((lowerPrice + i * step) * 100) / 100);
  }
  return levels;
}

/**
 * Snap a raw price to the nearest grid level.
 * Used after a fill so replenish orders land exactly on a grid level.
 */
export function snapToGridLevel(
  price: number,
  lowerPrice: number,
  upperPrice: number,
  gridCount: number
): number {
  const levels = allGridLevels(lowerPrice, upperPrice, gridCount);
  let closest = levels[0];
  let minDist = Math.abs(price - closest);
  for (const lvl of levels) {
    const dist = Math.abs(price - lvl);
    if (dist < minDist) { minDist = dist; closest = lvl; }
  }
  return closest;
}

export function sizePerGrid(
  investment: number,
  gridCount: number,
  price: number,
  leverage: number
): number {
  // investment = total margin to use; notional = investment * leverage
  return (investment * leverage / gridCount) / price;
}
