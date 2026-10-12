import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

interface CandleItem {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// SSI Board Cache
interface BoardCache {
  timestamp: number;
  data: Map<string, any>;
}

const ssiBoardsCache: Record<string, BoardCache> = {
  hose: { timestamp: 0, data: new Map() },
  hnx: { timestamp: 0, data: new Map() },
  upcom: { timestamp: 0, data: new Map() },
};

const BOARD_CACHE_TTL_MS = 5000;

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
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`https://iboard-query.ssi.com.vn/stock/exchange/${cacheKey}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
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
    // Return existing cache if any
  }

  return cached ? cached.data : new Map();
}

/**
 * Fetch live or historical candles from Vietcap gap-chart API
 */
async function fetchVietcapGapChart(
  symbol: string,
  isIndex: boolean,
  countBack: number,
  timeFrame = 'ONE_DAY'
): Promise<CandleItem[] | null> {
  const vciMap: Record<string, string> = {
    VNINDEX: 'VNINDEX',
    VN30: 'VN30',
    HNX: 'HNXIndex',
    HNX30: 'HNX30',
    UPCOM: 'UpcomIndex',
  };

  const vciSymbol = isIndex ? vciMap[symbol] || symbol : symbol;
  const mult = isIndex ? 1 : 0.001; // Vietcap gives stock prices in VND (e.g. 23950), Entrade uses thousands (23.95)

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        timeFrame,
        symbols: [vciSymbol],
        to: Math.floor(Date.now() / 1000) + 86400,
        countBack,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0 || !json[0]?.t?.length) return null;

    const item = json[0];
    const candles: CandleItem[] = [];
    const len = item.t.length;

    for (let i = 0; i < len; i++) {
      const t = typeof item.t[i] === 'string' ? parseInt(item.t[i], 10) : Number(item.t[i]);
      const o = Number((item.o[i] * mult).toFixed(2));
      const h = Number((item.h[i] * mult).toFixed(2));
      const l = Number((item.l[i] * mult).toFixed(2));
      const c = Number((item.c[i] * mult).toFixed(2));
      const v = Number(item.v[i] || 0);

      candles.push({
        time: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    }

    return candles;
  } catch {
    return null;
  }
}

/**
 * Fetch today's live candle from SSI iBoard for stocks
 */
async function fetchTodayFromSsi(symbol: string): Promise<CandleItem | null> {
  try {
    for (const ex of ['hose', 'hnx', 'upcom']) {
      const board = await getSsiBoard(ex);
      const stock = board.get(symbol);
      if (stock) {
        const matched = Number(stock.matchedPrice || 0);
        const ref = Number(stock.refPrice || 0);
        const price = matched > 0 ? matched : ref;
        if (price <= 0) return null;

        const open = Number(stock.openPrice || 0) || price;
        const high = Number(stock.highest || 0) || price;
        const low = Number(stock.lowest || 0) || price;
        const volume = Number(stock.nmTotalTradedQty || stock.stockVol || 0);

        const todayVnStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const timeSec = Math.floor(new Date(`${todayVnStr}T09:00:00+07:00`).getTime() / 1000);

        return {
          time: timeSec,
          open: Number((open / 1000).toFixed(2)),
          high: Number((high / 1000).toFixed(2)),
          low: Number((low / 1000).toFixed(2)),
          close: Number((price / 1000).toFixed(2)),
          volume,
        };
      }
    }
  } catch {
    // Ssi failed
  }
  return null;
}

/**
 * GET /api/market/history?symbol=HPG&resolution=1D&days=365
 * Fetches real historical OHLC candles with live intraday candle stitching
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();
  const rawRes = searchParams.get('resolution') || '1D';
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 1825; // Default 5 years

  // Map resolution format
  let dnseRes = '1D';
  let isAggregated = false;
  let aggregateType: '1M' | '3M' | '6M' | null = null;

  switch (rawRes) {
    case '1m': dnseRes = '1'; break;
    case '5m': dnseRes = '5'; break;
    case '15m': dnseRes = '15'; break;
    case '1h': dnseRes = '1H'; break;
    case '1W': dnseRes = '1W'; break;
    case '1M':
      dnseRes = '1D';
      isAggregated = true;
      aggregateType = '1M';
      break;
    case '3M':
      dnseRes = '1D';
      isAggregated = true;
      aggregateType = '3M';
      break;
    case '6M':
      dnseRes = '1D';
      isAggregated = true;
      aggregateType = '6M';
      break;
    case '1D':
    default:
      dnseRes = '1D';
      break;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  let fromSec = 0;
  if (isAggregated || daysParam === 'all' || daysParam === '0' || days === 0 || rawRes === 'ALL') {
    fromSec = 0;
  } else {
    fromSec = Math.max(0, nowSec - days * 24 * 3600);
  }

  const isIndex = ['VNINDEX', 'VN30', 'HNX', 'HNX30', 'UPCOM'].includes(symbol);
  const endpointType = isIndex ? 'index' : 'stock';

  try {
    let candles: CandleItem[] = [];

    // 1. PRIMARY SOURCE: Fetch from Entrade Lightspeed API (Fast & comprehensive)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/${endpointType}?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
        symbol
      )}&resolution=${dnseRes}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.t && Array.isArray(data.t) && data.t.length > 0) {
          for (let i = 0; i < data.t.length; i++) {
            candles.push({
              time: data.t[i],
              open: data.o[i],
              high: data.h[i],
              low: data.l[i],
              close: data.c[i],
              volume: data.v[i] || 0,
            });
          }
        }
      }
    } catch {
      // Entrade request failed, will use fallback
    }

    // 2. FALLBACK: If Entrade returned no candles, query Vietcap gap-chart
    if (candles.length === 0) {
      const vciTimeframe = dnseRes === '1' ? 'ONE_MINUTE' : 'ONE_DAY';
      const countBack = days > 0 ? Math.min(days, 1000) : 1000;
      const vciCandles = await fetchVietcapGapChart(symbol, isIndex, countBack, vciTimeframe);
      if (vciCandles && vciCandles.length > 0) {
        candles = vciCandles;
      }
    }

    if (candles.length === 0) {
      return NextResponse.json({
        success: false,
        symbol,
        message: 'No candle data available',
        data: [],
      });
    }

    // 3. INTRADAY STITCHING FOR DAILY CANDLES:
    // If resolution is 1D (or aggregated), check whether today's trading candle is present.
    // Entrade daily batch runs after market hours, so during the trading day (or before EOD run)
    // Entrade does NOT contain today's candle. We stitch today's real live candle from Vietcap/SSI.
    if (dnseRes === '1D' && candles.length > 0) {
      const todayDateVn = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const lastCandle = candles[candles.length - 1];
      const lastCandleDateVn = new Date(lastCandle.time * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      if (lastCandleDateVn < todayDateVn) {
        // Fetch today's live daily candle
        let todayCandle: CandleItem | null = null;

        // Try Vietcap live daily candle first
        const vcLive = await fetchVietcapGapChart(symbol, isIndex, 1, 'ONE_DAY');
        if (vcLive && vcLive.length > 0) {
          const vcCandle = vcLive[vcLive.length - 1];
          const vcDateVn = new Date(vcCandle.time * 1000).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });
          if (vcDateVn === todayDateVn && (vcCandle.volume > 0 || vcCandle.close > 0)) {
            todayCandle = vcCandle;
          }
        }

        // Secondary fallback for stock: SSI iBoard
        if (!todayCandle && !isIndex) {
          todayCandle = await fetchTodayFromSsi(symbol);
        }

        if (todayCandle) {
          candles.push(todayCandle);
        }
      }
    }

    // 4. Handle Aggregation (1M, 3M, 6M)
    if (isAggregated && aggregateType) {
      const groups = new Map<string, CandleItem>();

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const d = new Date(c.time * 1000);
        let key = '';
        if (aggregateType === '1M') {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (aggregateType === '3M') {
          const q = Math.floor(d.getMonth() / 3) + 1;
          key = `${d.getFullYear()}-Q${q}`;
        } else if (aggregateType === '6M') {
          const h = Math.floor(d.getMonth() / 6) + 1;
          key = `${d.getFullYear()}-H${h}`;
        }

        if (!groups.has(key)) {
          groups.set(key, { ...c });
        } else {
          const cur = groups.get(key)!;
          cur.high = Math.max(cur.high, c.high);
          cur.low = Math.min(cur.low, c.low);
          cur.close = c.close;
          cur.volume += c.volume;
        }
      }

      const aggCandles = Array.from(groups.values());
      const response = NextResponse.json({
        success: true,
        symbol,
        resolution: rawRes,
        count: aggCandles.length,
        data: aggCandles,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
      return response;
    }

    const response = NextResponse.json({
      success: true,
      symbol,
      resolution: rawRes,
      count: candles.length,
      data: candles,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        symbol,
        error: err.message,
        data: [],
      },
      { status: 500 }
    );
  }
}
