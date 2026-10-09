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

// Helper: Fetch real price from DNSE Lightspeed REST API
async function fetchFromDnseLightspeed(symbol: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const isIndex = ['VNINDEX', 'VN30', 'HNX', 'HNX30', 'UPCOM'].includes(symbol);
    const endpoint = isIndex
      ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?resolution=1D&symbol=${symbol}`
      : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?resolution=1D&symbol=${symbol}`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YourFin-Market/1.0',
      },
      next: { revalidate: 15 },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    if (json && Array.isArray(json.c) && json.c.length > 0) {
      const lastIdx = json.c.length - 1;
      const prevIdx = lastIdx > 0 ? lastIdx - 1 : lastIdx;
      
      const rawClose = json.c[lastIdx];
      const rawPrev = json.c[prevIdx];
      const rawOpen = json.o[lastIdx];
      const rawHigh = json.h[lastIdx];
      const rawLow = json.l[lastIdx];
      const rawVol = json.v[lastIdx];

      // Index values are in points, stock values are in 1,000 VND
      const multiplier = isIndex ? 1 : 1000;

      const price = rawClose * multiplier;
      const ref = rawPrev * multiplier;
      const change = price - ref;
      const changePercent = ref ? (change / ref) * 100 : 0;

      return {
        price,
        referencePrice: ref,
        open: rawOpen * multiplier,
        high: rawHigh * multiplier,
        low: rawLow * multiplier,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: rawVol || 0,
      };
    }
  } catch (err) {
    // DNSE fetch failed or timed out
  }
  return null;
}

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

  let dataSource = 'vnstock';
  let priceData: any = null;

  // 3. Try primary source: Vnstock pre-warmed snapshot
  const vnstockTick = (realTicksData as Record<string, any>)[symbol];
  if (vnstockTick) {
    priceData = {
      price: vnstockTick.price,
      referencePrice: vnstockTick.ref || vnstockTick.price,
      open: vnstockTick.open || vnstockTick.price,
      high: vnstockTick.high || vnstockTick.price,
      low: vnstockTick.low || vnstockTick.price,
      volume: vnstockTick.volume || 1000000,
      change: vnstockTick.price - (vnstockTick.ref || vnstockTick.price),
      changePercent: vnstockTick.ref ? ((vnstockTick.price - vnstockTick.ref) / vnstockTick.ref) * 100 : 0,
    };
    dataSource = 'vnstock';
  } else {
    // 4. FAILOVER TRIGGER: Vnstock missing or rate-limited -> Switch immediately to DNSE Lightspeed API
    const dnseData = await fetchFromDnseLightspeed(symbol);
    if (dnseData) {
      priceData = dnseData;
      dataSource = 'dnse_lightspeed';
    } else {
      // 5. Final Graceful Fallback
      const fallbackPrice = 25000;
      priceData = {
        price: fallbackPrice,
        referencePrice: fallbackPrice,
        open: fallbackPrice,
        high: fallbackPrice * 1.01,
        low: fallbackPrice * 0.99,
        change: 0,
        changePercent: 0,
        volume: 1500000,
      };
      dataSource = 'fallback';
    }
  }

  const ref = priceData.referencePrice;
  const ceilPrice = Math.round(ref * (meta.exchange === 'HNX' ? 1.10 : meta.exchange === 'UPCOM' ? 1.15 : 1.07));
  const floorPrice = Math.round(ref * (meta.exchange === 'HNX' ? 0.90 : meta.exchange === 'UPCOM' ? 0.85 : 0.93));

  const result = {
    symbol,
    name: meta.name,
    exchange: meta.exchange,
    sector: meta.sector,
    price: priceData.price,
    referencePrice: ref,
    ceilingPrice: ceilPrice,
    floorPrice: floorPrice,
    open: priceData.open,
    high: priceData.high,
    low: priceData.low,
    change: Number(priceData.change.toFixed(2)),
    changePercent: Number(priceData.changePercent.toFixed(2)),
    volume: priceData.volume,
    dataSource,
    timestamp: Date.now(),
  };

  // Cache response for 30s
  memoryCache.set(symbol, {
    data: result,
    expiry: Date.now() + CACHE_TTL_MS,
  });

  return NextResponse.json({
    success: true,
    source: dataSource,
    data: result,
  });
}
