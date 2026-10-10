import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/market/history?symbol=HPG&resolution=1D&days=365
 * Fetches real historical OHLC candles from DNSE Lightspeed API
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();
  const rawRes = searchParams.get('resolution') || '1D';
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 1825; // Default 5 years (~1,250 trading sessions)

  // Map resolution format to DNSE acceptable parameter
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
    fromSec = 0; // Lấy toàn bộ lịch sử từ ngày giao dịch đầu tiên
  } else {
    fromSec = Math.max(0, nowSec - days * 24 * 3600);
  }

  try {
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
      symbol
    )}&resolution=${dnseRes}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
      next: { revalidate: 30 }, // Cache 30 seconds
    });

    if (!res.ok) {
      throw new Error(`DNSE status ${res.status}`);
    }

    const data = await res.json();

    if (!data.t || !Array.isArray(data.t) || data.t.length === 0) {
      return NextResponse.json({
        success: false,
        symbol,
        message: 'No candle data available',
        data: [],
      });
    }

    if (isAggregated && aggregateType) {
      const groups = new Map<
        string,
        { time: number; open: number; high: number; low: number; close: number; volume: number }
      >();

      for (let i = 0; i < data.t.length; i++) {
        const d = new Date(data.t[i] * 1000);
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
          groups.set(key, {
            time: data.t[i],
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
            volume: data.v[i] || 0,
          });
        } else {
          const c = groups.get(key)!;
          c.high = Math.max(c.high, data.h[i]);
          c.low = Math.min(c.low, data.l[i]);
          c.close = data.c[i];
          c.volume += data.v[i] || 0;
        }
      }

      const aggCandles = Array.from(groups.values());
      return NextResponse.json({
        success: true,
        symbol,
        resolution: rawRes,
        count: aggCandles.length,
        data: aggCandles,
      });
    }

    const candles = [];
    for (let i = 0; i < data.t.length; i++) {
      candles.push({
        time: data.t[i], // Unix timestamp in seconds
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i] || 0,
      });
    }

    return NextResponse.json({
      success: true,
      symbol,
      resolution: rawRes,
      count: candles.length,
      data: candles,
    });
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
