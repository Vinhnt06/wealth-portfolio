import { NextRequest, NextResponse } from 'next/server';
import {
  RRGDataset,
  RRGSectorData,
  RRG_SECTOR_CONFIGS,
  getQuadrant,
  calculateRRGSeries,
} from '@/features/market/utils/rrgCalculator';

export const dynamic = 'force-dynamic';

interface CandleData {
  [timestamp: number]: number;
}

// In-memory cache
interface CacheEntry {
  data: RRGDataset;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60s cache

async function fetchOHLC(
  symbol: string,
  isIndex: boolean,
  fromSec: number,
  toSec: number,
  resolution: string
): Promise<CandleData> {
  const endpoint = isIndex ? 'index' : 'stock';
  const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/${endpoint}?from=${fromSec}&to=${toSec}&symbol=${encodeURIComponent(
    symbol
  )}&resolution=${resolution}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeout);

    if (!res.ok) return {};

    const data = await res.json();
    if (!data.t || !Array.isArray(data.t) || !data.c || !Array.isArray(data.c)) {
      return {};
    }

    const candleMap: CandleData = {};
    for (let i = 0; i < data.t.length; i++) {
      candleMap[data.t[i]] = data.c[i];
    }
    return candleMap;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '1D'; // '1D' or '1W'
  const tailLength = parseInt(searchParams.get('tail') || '4', 10);
  const benchmark = searchParams.get('benchmark') || 'VNINDEX';

  const cacheKey = `${timeframe}_${tailLength}_${benchmark}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Fetch at least 150 days for daily (to cover 80+ trading bars for SMA14 and SMA10), or 400 days for weekly
  const daysBack = timeframe === '1W' ? 450 : 150;
  const fromSec = nowSec - daysBack * 86400;

  // Extract all unique symbols
  const allSymbols = new Set<string>();
  RRG_SECTOR_CONFIGS.forEach((sector) => {
    // Take top 5 symbols per sector to optimize speed and balance
    sector.symbols.slice(0, 5).forEach((sym) => allSymbols.add(sym));
  });

  const symbolList = Array.from(allSymbols);

  // Fetch benchmark & stocks concurrently
  const [benchCandles, ...stockCandlesList] = await Promise.all([
    fetchOHLC(benchmark, true, fromSec, nowSec, timeframe),
    ...symbolList.map((sym) => fetchOHLC(sym, false, fromSec, nowSec, timeframe)),
  ]);

  const stockMap = new Map<string, CandleData>();
  symbolList.forEach((sym, idx) => {
    stockMap.set(sym, stockCandlesList[idx]);
  });

  const benchTimestamps = Object.keys(benchCandles)
    .map(Number)
    .sort((a, b) => a - b);

  if (benchTimestamps.length < 30) {
    return NextResponse.json(
      { error: 'Insufficient benchmark data from exchange' },
      { status: 502 }
    );
  }

  const formatDate = (ts: number): string => {
    const d = new Date(ts * 1000);
    return d.toISOString().split('T')[0];
  };

  const benchmarkPrices = benchTimestamps.map((ts) => ({
    date: formatDate(ts),
    close: benchCandles[ts],
  }));

  const sectors: RRGSectorData[] = [];
  const summary = {
    leading: 0,
    weakening: 0,
    lagging: 0,
    improving: 0,
    total: 0,
  };

  for (const config of RRG_SECTOR_CONFIGS) {
    const targetSymbols = config.symbols.slice(0, 5);
    const validSymbols = targetSymbols.filter((sym) => {
      const cMap = stockMap.get(sym);
      return cMap && Object.keys(cMap).length > 20;
    });

    if (validSymbols.length === 0) continue;

    // Xây dựng chỉ số ngành theo phương pháp Lợi suất ghép hàng ngày (Daily Compound Returns) chuẩn quốc tế
    let currentIdxVal = 100.0;
    const sectorPrices: { date: string; close: number }[] = [
      {
        date: formatDate(benchTimestamps[0]),
        close: currentIdxVal,
      },
    ];

    for (let i = 1; i < benchTimestamps.length; i++) {
      const prevTs = benchTimestamps[i - 1];
      const currTs = benchTimestamps[i];

      const returns: number[] = [];
      for (const sym of validSymbols) {
        const cMap = stockMap.get(sym);
        if (cMap) {
          const pPrev = cMap[prevTs];
          const pCurr = cMap[currTs];
          if (pPrev && pCurr && pPrev > 0) {
            returns.push((pCurr - pPrev) / pPrev);
          }
        }
      }

      const avgRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      currentIdxVal *= (1.0 + avgRet);

      sectorPrices.push({
        date: formatDate(currTs),
        close: currentIdxVal,
      });
    }

    // Tính toán RRG theo thuật toán chuẩn Julius de Kempenaer (WMA Double-Smoothing)
    const points = calculateRRGSeries(
      sectorPrices,
      benchmarkPrices,
      10,
      4,
      tailLength
    );

    if (points.length === 0) continue;

    const currentPoint = points[points.length - 1];
    const quadrant = getQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);

    summary[quadrant]++;
    summary.total++;

    const dx = currentPoint.rsRatio - 100;
    const dy = currentPoint.rsMomentum - 100;
    const distanceFromCenter = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
    const angle = Number(
      (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360).toFixed(1)
    );

    let velocity = 0;
    if (points.length >= 2) {
      const prev = points[points.length - 2];
      const pdx = currentPoint.rsRatio - prev.rsRatio;
      const pdy = currentPoint.rsMomentum - prev.rsMomentum;
      velocity = Number(Math.sqrt(pdx * pdx + pdy * pdy).toFixed(2));
    }

    // Recent change %
    let changePercent = 0;
    if (sectorPrices.length >= 2) {
      const lastP = sectorPrices[sectorPrices.length - 1].close;
      const prevP = sectorPrices[sectorPrices.length - 2].close;
      changePercent = Number((((lastP - prevP) / prevP) * 100).toFixed(2));
    }

    sectors.push({
      id: config.id,
      name: config.name,
      shortName: config.shortName,
      color: config.color,
      symbols: validSymbols,
      points,
      currentPoint,
      quadrant,
      distanceFromCenter,
      angle,
      velocity,
      changePercent,
    });
  }

  const startDate = benchmarkPrices[0]?.date || '';
  const endDate = benchmarkPrices[benchmarkPrices.length - 1]?.date || '';

  const dataset: RRGDataset = {
    sectors,
    benchmark,
    dateRange: {
      start: startDate,
      end: endDate,
    },
    summary,
  };

  cache.set(cacheKey, { data: dataset, timestamp: Date.now() });

  return NextResponse.json(dataset);
}
