export function calculateGridLevels(lowerPrice: number, upperPrice: number, gridCount: number, mode: 'LONG' | 'SHORT' | 'NEUTRAL', currentPrice: number) {
  const step = (upperPrice - lowerPrice) / gridCount;
  const levels = [];
  for (let i = 0; i <= gridCount; i++) {
    const price = lowerPrice + i * step;
    
    if (mode === 'LONG' && price < currentPrice) {
      levels.push({ price, side: 'BUY' });
    } else if (mode === 'SHORT' && price > currentPrice) {
      levels.push({ price, side: 'SELL' });
    } else if (mode === 'NEUTRAL') {
      levels.push({ price, side: price < currentPrice ? 'BUY' : 'SELL' });
    }
  }
  return levels;
}

export function sizePerGrid(investment: number, gridCount: number, price: number) {
  return (investment / gridCount) / price;
}
