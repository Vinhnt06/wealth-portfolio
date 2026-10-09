import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/market/history?symbol=HPG&resolution=1D&days=365
 * Fetches real historical OHLC candles from DNSE Lightspeed API
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();
  const rawRes = searchParams.get('resolution') || '1D';
  const days = parseInt(searchParams.get('days') || '365', 10);

  // Map resolution format to DNSE acceptable parameter
  let dnseRes = '1D';
  switch (rawRes) {
    case '1m': dnseRes = '1'; break;
    case '5m': dnseRes = '5'; break;
    case '15m': dnseRes = '15'; break;
    case '1h': dnseRes = '1H'; break;
    case '1D':
    default:
      dnseRes = '1D';
      break;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - (days > 0 ? days : 365) * 24 * 3600;

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
