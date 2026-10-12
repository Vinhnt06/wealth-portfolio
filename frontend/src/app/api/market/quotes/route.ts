import { NextResponse } from 'next/server';
import realTicks from '../../../../features/market/data/realTicks.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IndexMeta {
  symbol: string;
  name: string;
  exchange: string;
  vciSymbol: string;
}

const INDEX_CONFIGS: IndexMeta[] = [
  { symbol: 'VNINDEX', name: 'VN-Index', exchange: 'HOSE', vciSymbol: 'VNINDEX' },
  { symbol: 'VN30', name: 'VN30-Index', exchange: 'HOSE', vciSymbol: 'VN30' },
  { symbol: 'HNX', name: 'HNX-Index', exchange: 'HNX', vciSymbol: 'HNXIndex' },
  { symbol: 'UPCOM', name: 'UPCOM-Index', exchange: 'UPCOM', vciSymbol: 'UpcomIndex' },
];

async function fetchVietcapIndex(cfg: IndexMeta): Promise<any | null> {
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
        symbols: [cfg.vciSymbol],
        to: Math.floor(Date.now() / 1000) + 86400,
        countBack: 15,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.c?.length > 0) {
        const item = data[0];
        const len = item.c.length;
        const currentClose = item.c[len - 1];
        const prevClose = len > 1 ? item.c[len - 2] : currentClose;
        const chg = currentClose - prevClose;
        const pct = prevClose ? (chg / prevClose) * 100 : 0;
        const vol = item.v?.[len - 1] || 0;
        const rawVal = item.accumulatedValue?.[len - 1] || 0;
        const totalValue = rawVal * 1_000_000; // Vietcap accumulatedValue is in thousand VND -> convert to VND

        return {
          symbol: cfg.symbol,
          name: cfg.name,
          exchange: cfg.exchange,
          value: Number(currentClose.toFixed(2)),
          change: Number(chg.toFixed(2)),
          percentChange: Number(pct.toFixed(2)),
          open: Number((item.o?.[len - 1] ?? currentClose).toFixed(2)),
          high: Number((item.h?.[len - 1] ?? currentClose).toFixed(2)),
          low: Number((item.l?.[len - 1] ?? currentClose).toFixed(2)),
          volume: vol,
          matchedVolume: vol,
          totalVolume: vol,
          totalValue: totalValue > 0 ? totalValue : 0,
          sparkline: item.c.slice(-15),
        };
      }
    }
  } catch {
    // Vietcap fallback to Entrade
  }
  return null;
}

async function fetchEntradeIndex(cfg: IndexMeta): Promise<any | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 86400;

    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${from}&to=${now}&resolution=1D&symbol=${cfg.symbol}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );

    if (!res.ok) return null;
    const j = await res.json();
    const len = j.c ? j.c.length : 0;
    if (len === 0) return null;
    const last = len - 1;
    const prev = last > 0 ? last - 1 : last;
    const close = j.c[last];
    const ref = j.c[prev];
    const chg = close - ref;
    const pct = ref ? (chg / ref) * 100 : 0;
    const vol = j.v[last] || 0;

    return {
      symbol: cfg.symbol,
      name: cfg.name,
      exchange: cfg.exchange,
      value: Number(close.toFixed(2)),
      change: Number(chg.toFixed(2)),
      percentChange: Number(pct.toFixed(2)),
      open: j.o[last],
      high: j.h[last],
      low: j.l[last],
      volume: vol,
      matchedVolume: vol,
      totalVolume: vol,
      totalValue: 0,
      sparkline: j.c.slice(-15),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const indexes = await Promise.all(
      INDEX_CONFIGS.map(async (cfg) => {
        const vciData = await fetchVietcapIndex(cfg);
        if (vciData) return vciData;
        return fetchEntradeIndex(cfg);
      })
    );

    const validIndexes = indexes.filter(Boolean);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      source: 'live_vietcap_entrade',
      indexes: validIndexes,
      data: realTicks,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
