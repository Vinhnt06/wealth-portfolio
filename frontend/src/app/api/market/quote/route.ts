import { NextRequest, NextResponse } from 'next/server';
import realTicksData from '../../../../features/market/data/realTicks.json';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';

interface StockMeta {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}

const STOCK_LOOKUP = new Map<string, StockMeta>();
(stockDatabase as StockMeta[]).forEach((item) => {
  STOCK_LOOKUP.set(item.symbol.toUpperCase(), item);
});

// In-memory LRU Cache with TTL (30 seconds)
const memoryCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 30 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase();

  // 1. Check in-memory cache
  const cached = memoryCache.get(symbol);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      data: cached.data,
    });
  }

  // 2. Lookup metadata
  const meta = STOCK_LOOKUP.get(symbol) || {
    symbol,
    name: `${symbol} Company`,
    exchange: 'HOSE',
    sector: 'Tổng hợp',
  };

  // 3. Check pre-warmed snapshot
  const existingTick = (realTicksData as Record<string, any>)[symbol];

  const price = existingTick?.price || existingTick?.ref || 25000;
  const ref = existingTick?.ref || price;
  const change = price - ref;
  const changePercent = ref ? (change / ref) * 100 : 0;
  const ceilPrice = Math.round(ref * (meta.exchange === 'HNX' ? 1.10 : meta.exchange === 'UPCOM' ? 1.15 : 1.07));
  const floorPrice = Math.round(ref * (meta.exchange === 'HNX' ? 0.90 : meta.exchange === 'UPCOM' ? 0.85 : 0.93));

  const result = {
    symbol,
    name: meta.name,
    exchange: meta.exchange,
    sector: meta.sector,
    price,
    referencePrice: ref,
    ceilingPrice: ceilPrice,
    floorPrice: floorPrice,
    open: existingTick?.open || ref,
    high: existingTick?.high || Math.round(price * 1.01),
    low: existingTick?.low || Math.round(price * 0.99),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: existingTick?.volume || 1500000,
    timestamp: Date.now(),
  };

  // Save to memory cache
  memoryCache.set(symbol, {
    data: result,
    expiry: Date.now() + CACHE_TTL_MS,
  });

  return NextResponse.json({
    success: true,
    source: existingTick ? 'snapshot' : 'fallback',
    data: result,
  });
}
