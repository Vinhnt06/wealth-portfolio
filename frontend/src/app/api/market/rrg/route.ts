import { NextResponse } from 'next/server';
import {
  RRG_SECTOR_CONFIGS,
  calculateRRGSeries,
  getQuadrant,
  RRGSectorData,
  RRGDataset,
} from '@/features/market/utils/rrgCalculator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CandlePoint {
  date: string;
  close: number;
}

// In-memory cache to guarantee sub-millisecond response on repeated hits
interface RRGCacheItem {
  timestamp: number;
  data: RRGDataset;
}

const cacheStore: Record<string, RRGCacheItem> = {};
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

async function fetchEntradeCandles(symbol: string, isIndex: boolean, resolution: string = '1D'): Promise<CandlePoint[]> {
  const type = isIndex ? 'index' : 'stock';
  const now = Math.floor(Date.now() / 1000);
  // Fetch ~180 days for 1D (~120 sessions) or 2 years for 1W (~104 weeks)
  const daysBack = resolution === '1W' ? 730 : 180;
  const from = now - daysBack * 24 * 3600;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/${type}?from=${from}&to=${now}&symbol=${encodeURIComponent(
        symbol
      )}&resolution=${resolution}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const json = await res.json();
    if (!json.t || !json.c || !Array.isArray(json.t)) return [];

    return json.t.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString().split('T')[0],
      close: json.c[i],
    }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') || '1D').toUpperCase() === '1W' ? '1W' : '1D';
  const tailLength = Math.max(2, Math.min(16, parseInt(searchParams.get('tail') || '4', 10)));
  const benchmark = (searchParams.get('benchmark') || 'VNINDEX').toUpperCase();

  const cacheKey = `${timeframe}_${tailLength}_${benchmark}`;
  const now = Date.now();

  if (cacheStore[cacheKey] && now - cacheStore[cacheKey].timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: cacheStore[cacheKey].data,
      source: 'cache',
    });
  }

  try {
    // 1. Fetch Benchmark (VNINDEX) candles
    const benchCandles = await fetchEntradeCandles(benchmark, true, timeframe);
    if (!benchCandles.length) {
      return NextResponse.json(
        { success: false, error: 'Không thể tải dữ liệu nến chuẩn cho ' + benchmark },
        { status: 502 }
      );
    }

    // 2. Collect unique representative symbols for the 16 sectors (top 3 per sector)
    const symbolsToFetch = new Set<string>();
    RRG_SECTOR_CONFIGS.forEach((sector) => {
      sector.symbols.slice(0, 3).forEach((s) => symbolsToFetch.add(s));
    });

    const symbolArray = Array.from(symbolsToFetch);

    // Fetch stock candles in batches
    const symbolCandleMap = new Map<string, CandlePoint[]>();
    const batchSize = 10;
    for (let i = 0; i < symbolArray.length; i += batchSize) {
      const batch = symbolArray.slice(i, i + batchSize);
      const batchPromises = batch.map(async (sym) => {
        const candles = await fetchEntradeCandles(sym, false, timeframe);
        return { sym, candles };
      });
      const batchRes = await Promise.all(batchPromises);
      batchRes.forEach(({ sym, candles }) => {
        if (candles.length) {
          symbolCandleMap.set(sym, candles);
        }
      });
    }

    // 3. Synthesize sector composite prices
    const dateList = benchCandles.map((c) => c.date);

    const sectorsData: RRGSectorData[] = [];
    let leadingCount = 0;
    let weakeningCount = 0;
    let laggingCount = 0;
    let improvingCount = 0;

    for (const config of RRG_SECTOR_CONFIGS) {
      // Find valid stocks in this sector
      const validStockCandles = config.symbols
        .slice(0, 3)
        .map((s) => symbolCandleMap.get(s))
        .filter((c): c is CandlePoint[] => !!c && c.length >= 20);

      if (!validStockCandles.length) continue;

      // Map stock close prices by date
      const stockPriceMaps = validStockCandles.map((candles) => {
        const map = new Map<string, number>();
        candles.forEach((c) => map.set(c.date, c.close));
        return {
          basePrice: candles[0]?.close || 1,
          map,
        };
      });

      // Construct normalized composite sector price
      const sectorPrices: CandlePoint[] = [];
      for (const d of dateList) {
        let normalizedSum = 0;
        let count = 0;
        for (const item of stockPriceMaps) {
          const price = item.map.get(d);
          if (price !== undefined && price > 0) {
            // Normalize relative to base price * 100
            normalizedSum += (price / item.basePrice) * 100;
            count++;
          }
        }
        if (count > 0) {
          sectorPrices.push({
            date: d,
            close: normalizedSum / count,
          });
        }
      }

      if (sectorPrices.length < 28) continue;

      // Calculate RRG series (points with tail)
      const points = calculateRRGSeries(sectorPrices, benchCandles, 14, 1.8, tailLength);
      if (!points.length) continue;

      const currentPoint = points[points.length - 1];
      const prevPoint = points.length >= 2 ? points[points.length - 2] : currentPoint;

      const quadrant = getQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);
      if (quadrant === 'leading') leadingCount++;
      else if (quadrant === 'weakening') weakeningCount++;
      else if (quadrant === 'lagging') laggingCount++;
      else if (quadrant === 'improving') improvingCount++;

      const dx = currentPoint.rsRatio - 100;
      const dy = currentPoint.rsMomentum - 100;
      const distanceFromCenter = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
      const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const angle = Number(((rawAngle + 360) % 360).toFixed(1));

      const vdx = currentPoint.rsRatio - prevPoint.rsRatio;
      const vdy = currentPoint.rsMomentum - prevPoint.rsMomentum;
      const velocity = Number(Math.sqrt(vdx * vdx + vdy * vdy).toFixed(2));

      // 1-day/week change percent of sector
      const lastClose = sectorPrices[sectorPrices.length - 1]?.close || 1;
      const prevClose = sectorPrices[sectorPrices.length - 2]?.close || lastClose;
      const changePercent = Number((((lastClose - prevClose) / prevClose) * 100).toFixed(2));

      sectorsData.push({
        id: config.id,
        name: config.name,
        shortName: config.shortName,
        color: config.color,
        symbols: config.symbols,
        points,
        currentPoint,
        quadrant,
        distanceFromCenter,
        angle,
        velocity,
        changePercent,
      });
    }

    // Sort sectors by distance from center or velocity
    sectorsData.sort((a, b) => b.distanceFromCenter - a.distanceFromCenter);

    const dataset: RRGDataset = {
      sectors: sectorsData,
      benchmark,
      dateRange: {
        start: dateList[0] || '',
        end: dateList[dateList.length - 1] || '',
      },
      summary: {
        leading: leadingCount,
        weakening: weakeningCount,
        lagging: laggingCount,
        improving: improvingCount,
        total: sectorsData.length,
      },
    };

    cacheStore[cacheKey] = {
      timestamp: now,
      data: dataset,
    };

    return NextResponse.json({
      success: true,
      data: dataset,
      source: 'live',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi xử lý đồ thị RRG' },
      { status: 500 }
    );
  }
}
