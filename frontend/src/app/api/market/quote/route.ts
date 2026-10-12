import { NextRequest, NextResponse } from 'next/server';
import realTicksData from '../../../../features/market/data/realTicks.json';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { calculateExchangeCeilFloor } from '../../../../features/market/utils/priceColors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Cache for SSI board data (3 seconds TTL)
interface BoardCache {
  timestamp: number;
  data: Map<string, any>;
}

const ssiBoardsCache: Record<string, BoardCache> = {
  hose: { timestamp: 0, data: new Map() },
  hnx: { timestamp: 0, data: new Map() },
  upcom: { timestamp: 0, data: new Map() },
};

const BOARD_CACHE_TTL_MS = 3000;

async function getSsiBoard(exchange: string): Promise<Map<string, any>> {
  const ex = exchange.toLowerCase();
  const cacheKey = ex === 'hnx' ? 'hnx' : ex === 'upcom' ? 'upcom' : 'hose';
  const now = Date.now();
  const cached = ssiBoardsCache[cacheKey];

  if (cached && now - cached.timestamp < BOARD_CACHE_TTL_MS && cached.data.size > 0) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://iboard-query.ssi.com.vn/stock/exchange/${cacheKey}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const map = new Map<string, any>();
        json.data.forEach((item: any) => {
          if (item && item.stockSymbol) {
            map.set(item.stockSymbol.toUpperCase(), item);
          }
        });
        ssiBoardsCache[cacheKey] = {
          timestamp: now,
          data: map,
        };
        return map;
      }
    }
  } catch {
    // If fetch failed, return existing cached data if any
  }

  return cached ? cached.data : new Map();
}

// Fetch live index from Vietcap gap-chart (has today's live intraday daily candle)
async function fetchIndexFromVietcap(symbol: string): Promise<any | null> {
  const vciMap: Record<string, string> = {
    VNINDEX: 'VNINDEX',
    VN30: 'VN30',
    HNX: 'HNXIndex',
    HNX30: 'HNX30',
    UPCOM: 'UpcomIndex',
  };

  const vciSymbol = vciMap[symbol] || symbol;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        timeFrame: 'ONE_DAY',
        symbols: [vciSymbol],
        to: Math.floor(Date.now() / 1000) + 86400,
        countBack: 2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json[0]?.c?.length > 0) {
        const item = json[0];
        const len = item.c.length;
        const currentClose = item.c[len - 1];
        const refClose = len > 1 ? item.c[len - 2] : currentClose;
        const currentOpen = item.o?.[len - 1] ?? currentClose;
        const currentHigh = item.h?.[len - 1] ?? currentClose;
        const currentLow = item.l?.[len - 1] ?? currentClose;
        const currentVol = item.v?.[len - 1] ?? 0;
        const chg = currentClose - refClose;
        const chgPct = refClose > 0 ? (chg / refClose) * 100 : 0;

        return {
          price: Number(currentClose.toFixed(2)),
          referencePrice: Number(refClose.toFixed(2)),
          ceilingPrice: Number((refClose * 1.07).toFixed(2)),
          floorPrice: Number((refClose * 0.93).toFixed(2)),
          open: Number(currentOpen.toFixed(2)),
          high: Number(currentHigh.toFixed(2)),
          low: Number(currentLow.toFixed(2)),
          change: Number(chg.toFixed(2)),
          changePercent: Number(chgPct.toFixed(2)),
          volume: currentVol,
          totalVolume: currentVol,
          totalValue: (item.accumulatedValue?.[len - 1] || 0) * 1_000_000,
          dataSource: 'vietcap_live',
        };
      }
    }
  } catch {
    // Vietcap failed
  }
  return null;
}

// Fallback: Fetch price from Entrade (checking resolution 1 for live intraday price)
async function fetchFromEntrade(symbol: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = nowSec - 30 * 86400;
    const isIndex = ['VNINDEX', 'VN30', 'HNX', 'HNX30', 'UPCOM'].includes(symbol);

    // 1. Fetch 1D for official previous close reference
    const url1D = isIndex
      ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${fromSec}&to=${nowSec}&resolution=1D&symbol=${encodeURIComponent(symbol)}`
      : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&resolution=1D&symbol=${encodeURIComponent(symbol)}`;

    // 2. Fetch 1-min for latest live price of today
    const url1M = isIndex
      ? `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${nowSec - 86400}&to=${nowSec}&resolution=1&symbol=${encodeURIComponent(symbol)}`
      : `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${nowSec - 86400}&to=${nowSec}&resolution=1&symbol=${encodeURIComponent(symbol)}`;

    const [res1D, res1M] = await Promise.all([
      fetch(url1D, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(url1M, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }),
    ]);
    clearTimeout(timeout);

    if (res1D.ok) {
      const json1D = await res1D.json();
      const mult = isIndex ? 1 : 1000;
      if (json1D?.c?.length > 0) {
        const last1D = json1D.c.length - 1;
        const ref = json1D.c[last1D] * mult;

        let livePrice = ref;
        let liveOpen = json1D.o[last1D] * mult;
        let liveHigh = json1D.h[last1D] * mult;
        let liveLow = json1D.l[last1D] * mult;
        let liveVol = json1D.v[last1D] || 0;

        if (res1M.ok) {
          const json1M = await res1M.json();
          if (json1M?.c?.length > 0) {
            const last1M = json1M.c.length - 1;
            livePrice = json1M.c[last1M] * mult;
            // Aggregate today's high, low, volume
            const hs = json1M.h as number[];
            const ls = json1M.l as number[];
            const vs = json1M.v as number[];
            if (hs.length > 0) liveHigh = Math.max(...hs) * mult;
            if (ls.length > 0) liveLow = Math.min(...ls) * mult;
            if (json1M.o.length > 0) liveOpen = json1M.o[0] * mult;
            if (vs.length > 0) liveVol = vs.reduce((a: number, b: number) => a + b, 0);
          }
        }

        const chg = livePrice - ref;
        const chgPct = ref > 0 ? (chg / ref) * 100 : 0;

        return {
          price: livePrice,
          referencePrice: ref,
          open: liveOpen,
          high: liveHigh,
          low: liveLow,
          change: Number(chg.toFixed(2)),
          changePercent: Number(chgPct.toFixed(2)),
          volume: liveVol,
          totalVolume: liveVol,
          totalValue: livePrice * liveVol,
          dataSource: 'entrade',
        };
      }
    }
  } catch {
    // Entrade failed
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  // 1. Lookup metadata
  const meta = STOCK_LOOKUP.get(symbol) || {
    symbol,
    name: `${symbol} Company`,
    exchange: 'HOSE',
    sector: 'Tổng hợp',
  };

  const isIndex = ['VNINDEX', 'VN30', 'HNX', 'HNX30', 'UPCOM'].includes(symbol);

  // 2. FOR INDICES: Query Vietcap live gap-chart first
  if (isIndex) {
    const vciIndexData = await fetchIndexFromVietcap(symbol);
    if (vciIndexData) {
      return NextResponse.json({
        success: true,
        source: 'vietcap_live',
        data: {
          symbol,
          name: meta.name,
          exchange: meta.exchange,
          sector: meta.sector,
          ...vciIndexData,
          timestamp: Date.now(),
        },
      });
    }

    const entradeIndex = await fetchFromEntrade(symbol);
    if (entradeIndex) {
      return NextResponse.json({
        success: true,
        source: 'entrade',
        data: {
          symbol,
          name: meta.name,
          exchange: meta.exchange,
          sector: meta.sector,
          ...entradeIndex,
          timestamp: Date.now(),
        },
      });
    }
  }

  // 3. FOR STOCKS: Primary source is SSI iBoard (Live real-time feed from HOSE, HNX, UPCOM)
  try {
    const preferredExchange = meta.exchange.toLowerCase();
    let ssiMap = await getSsiBoard(preferredExchange);
    let ssiItem = ssiMap.get(symbol);

    // If not found in expected exchange, check others
    if (!ssiItem) {
      for (const otherEx of ['hose', 'hnx', 'upcom']) {
        if (otherEx !== preferredExchange) {
          const otherMap = await getSsiBoard(otherEx);
          if (otherMap.has(symbol)) {
            ssiItem = otherMap.get(symbol);
            break;
          }
        }
      }
    }

    if (ssiItem) {
      const refPrice = Number(ssiItem.refPrice || 0);
      const matchedPrice = Number(ssiItem.matchedPrice || 0);
      const expectedMatched = Number(ssiItem.expectedMatchedPrice || 0);
      const price = matchedPrice > 0 ? matchedPrice : expectedMatched > 0 ? expectedMatched : refPrice;

      const ceilPrice = Number(ssiItem.ceiling || 0) || calculateExchangeCeilFloor(refPrice, meta.exchange).ceilingPrice;
      const floorPrice = Number(ssiItem.floor || 0) || calculateExchangeCeilFloor(refPrice, meta.exchange).floorPrice;

      const rawChange = ssiItem.priceChange !== undefined && ssiItem.priceChange !== null
        ? Number(ssiItem.priceChange)
        : (price && refPrice ? price - refPrice : 0);

      const rawChangePct = ssiItem.priceChangePercent !== undefined && ssiItem.priceChangePercent !== null
        ? Number(ssiItem.priceChangePercent)
        : (refPrice > 0 ? (rawChange / refPrice) * 100 : 0);

      const openPrice = Number(ssiItem.openPrice || 0) || (matchedPrice > 0 ? matchedPrice : refPrice);
      const highPrice = Number(ssiItem.highest || 0) || price;
      const lowPrice = Number(ssiItem.lowest || 0) || price;
      const totalVolume = Number(ssiItem.nmTotalTradedQty || ssiItem.stockVol || 0);
      const totalValue = Number(ssiItem.nmTotalTradedValue || 0) || (price * totalVolume);

      // Best 3 bid / offer levels
      const bids = [
        { price: Number(ssiItem.best1Bid || 0), volume: Number(ssiItem.best1BidVol || 0) },
        { price: Number(ssiItem.best2Bid || 0), volume: Number(ssiItem.best2BidVol || 0) },
        { price: Number(ssiItem.best3Bid || 0), volume: Number(ssiItem.best3BidVol || 0) },
      ].filter((b) => b.price > 0);

      const asks = [
        { price: Number(ssiItem.best1Offer || 0), volume: Number(ssiItem.best1OfferVol || 0) },
        { price: Number(ssiItem.best2Offer || 0), volume: Number(ssiItem.best2OfferVol || 0) },
        { price: Number(ssiItem.best3Offer || 0), volume: Number(ssiItem.best3OfferVol || 0) },
      ].filter((a) => a.price > 0);

      const result = {
        symbol,
        name: meta.name,
        exchange: ssiItem.exchange?.toUpperCase() || meta.exchange,
        sector: meta.sector,
        price,
        referencePrice: refPrice,
        ceilingPrice: ceilPrice,
        floorPrice: floorPrice,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        change: Number(rawChange.toFixed(2)),
        changePercent: Number(rawChangePct.toFixed(2)),
        volume: totalVolume,
        totalVolume,
        totalValue,
        bids,
        asks,
        dataSource: 'ssi_iboard',
        timestamp: Date.now(),
      };

      return NextResponse.json({
        success: true,
        source: 'ssi_iboard',
        data: result,
      });
    }
  } catch {
    // Continue to secondary source
  }

  // 4. SECONDARY SOURCE: Entrade Intraday REST API
  const entradeData = await fetchFromEntrade(symbol);
  if (entradeData) {
    const { ceilingPrice, floorPrice } = calculateExchangeCeilFloor(entradeData.referencePrice, meta.exchange);
    const result = {
      symbol,
      name: meta.name,
      exchange: meta.exchange,
      sector: meta.sector,
      ...entradeData,
      ceilingPrice,
      floorPrice,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      source: 'entrade',
      data: result,
    });
  }

  // 5. TERTIARY SOURCE: Pre-warmed snapshot
  const vnstockTick = (realTicksData as Record<string, any>)[symbol];
  if (vnstockTick) {
    const ref = vnstockTick.ref || vnstockTick.price;
    const { ceilingPrice, floorPrice } = calculateExchangeCeilFloor(ref, meta.exchange);
    const p = vnstockTick.price;
    const chg = p - ref;
    const chgPct = ref ? (chg / ref) * 100 : 0;

    const result = {
      symbol,
      name: meta.name,
      exchange: meta.exchange,
      sector: meta.sector,
      price: p,
      referencePrice: ref,
      ceilingPrice,
      floorPrice,
      open: vnstockTick.open || p,
      high: vnstockTick.high || p,
      low: vnstockTick.low || p,
      change: Number(chg.toFixed(2)),
      changePercent: Number(chgPct.toFixed(2)),
      volume: vnstockTick.volume || 1000000,
      totalVolume: vnstockTick.volume || 1000000,
      totalValue: p * (vnstockTick.volume || 1000000),
      dataSource: 'vnstock_snapshot',
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      source: 'vnstock_snapshot',
      data: result,
    });
  }

  // 6. Final safety fallback
  const fallbackPrice = 25000;
  const { ceilingPrice, floorPrice } = calculateExchangeCeilFloor(fallbackPrice, meta.exchange);
  return NextResponse.json({
    success: true,
    source: 'fallback',
    data: {
      symbol,
      name: meta.name,
      exchange: meta.exchange,
      sector: meta.sector,
      price: fallbackPrice,
      referencePrice: fallbackPrice,
      ceilingPrice,
      floorPrice,
      open: fallbackPrice,
      high: fallbackPrice,
      low: fallbackPrice,
      change: 0,
      changePercent: 0,
      volume: 100000,
      totalVolume: 100000,
      totalValue: fallbackPrice * 100000,
      dataSource: 'fallback',
      timestamp: Date.now(),
    },
  });
}
