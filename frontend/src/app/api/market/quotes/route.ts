import { NextResponse } from 'next/server';
import { isMarketTradingSession, isPreMarketResetWindow } from '../../../../features/market/utils/marketHours';
import { fetchEntradeSnapshot } from '../../../../features/market/utils/entradeSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

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

        const isPreMarket = isPreMarketResetWindow(cfg.exchange || cfg.symbol);

        // Trong khung giờ Pre-market (08:30 - 09:00, HOSE đến 09:15):
        // Giá đóng cửa hôm trước (currentClose) trở thành Giá tham chiếu cho phiên hôm nay.
        // Biến động điểm và % phải được reset về 0.00%, khối lượng = 0.
        const chg = isPreMarket ? 0 : currentClose - prevClose;
        const pct = isPreMarket ? 0 : (prevClose ? (chg / prevClose) * 100 : 0);
        const vol = isPreMarket ? 0 : (item.v?.[len - 1] || 0);
        const rawVal = isPreMarket ? 0 : (item.accumulatedValue?.[len - 1] || 0);
        const totalValue = isPreMarket ? 0 : rawVal * 1_000_000;

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
          isPreMarket,
        };
      }
    }
  } catch {
    // Vietcap fallback to Entrade
  }
  return null;
}

async function fetchEntradeIndex(cfg: IndexMeta): Promise<any | null> {
  const snap = await fetchEntradeSnapshot(cfg.symbol, 'index', isMarketTradingSession());
  if (!snap) return null;

  const isPreMarket = isPreMarketResetWindow(cfg.exchange || cfg.symbol);

  const value = isPreMarket ? snap.previousClose : snap.price;
  const ref = isPreMarket ? snap.previousClose : snap.referencePrice;
  const chg = value - ref;
  const pct = ref ? (chg / ref) * 100 : 0;
  const vol = isPreMarket ? 0 : snap.volume;

  return {
    symbol: cfg.symbol,
    name: cfg.name,
    exchange: cfg.exchange,
    value: Number(value.toFixed(2)),
    change: Number(chg.toFixed(2)),
    percentChange: Number(pct.toFixed(2)),
    open: Number((isPreMarket ? value : snap.open).toFixed(2)),
    high: Number((isPreMarket ? value : snap.high).toFixed(2)),
    low: Number((isPreMarket ? value : snap.low).toFixed(2)),
    volume: vol,
    matchedVolume: vol,
    totalVolume: vol,
    totalValue: 0,
    sparkline: snap.closes.slice(-15),
    isPreMarket,
  };
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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
