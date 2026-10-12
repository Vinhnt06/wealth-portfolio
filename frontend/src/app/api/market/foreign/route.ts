import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

interface ForeignTradingData {
  symbol: string;
  foreignBuyVolume: number;
  foreignSellVolume: number;
  foreignNetVolume: number;
  foreignBuyValue: number;
  foreignSellValue: number;
  foreignNetValue: number;
  currentRoom: number;
  totalRoom: number;
  roomRemainingPercent: number;
  roomUsedPercent: number;
  tradingSession: string;
  source: string;
  timestamp: number;
}

// In-memory cache for foreign trading data (10 seconds)
const foreignCache = new Map<string, { data: ForeignTradingData; expiry: number }>();
const CACHE_TTL_MS = 10 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  // 1. Check cache
  const cached = foreignCache.get(symbol);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      data: cached.data,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://trading.vietcap.com.vn/api/price/symbols/getList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://trading.vietcap.com.vn',
        'Referer': 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ symbols: [symbol] }),
      signal: controller.signal,
      next: { revalidate: 10 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Vietcap HTTP ${res.status}`);
    }

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`No data returned for symbol ${symbol}`);
    }

    const match = list[0].matchPrice || {};
    const buyVol = Number(match.foreignBuyVolume || 0);
    const sellVol = Number(match.foreignSellVolume || 0);
    const netVol = buyVol - sellVol;

    const buyVal = Number(match.foreignBuyValue || 0);
    const sellVal = Number(match.foreignSellValue || 0);
    const netVal = buyVal - sellVal;

    const curRoom = Number(match.currentRoom || 0);
    const totRoom = Number(match.totalRoom || 0);

    const roomRemainingPercent = totRoom > 0 ? Number(((curRoom / totRoom) * 100).toFixed(2)) : 0;
    const roomUsedPercent = totRoom > 0 ? Number((((totRoom - curRoom) / totRoom) * 100).toFixed(2)) : 0;

    const payload: ForeignTradingData = {
      symbol,
      foreignBuyVolume: buyVol,
      foreignSellVolume: sellVol,
      foreignNetVolume: netVol,
      foreignBuyValue: buyVal,
      foreignSellValue: sellVal,
      foreignNetValue: netVal,
      currentRoom: curRoom,
      totalRoom: totRoom,
      roomRemainingPercent,
      roomUsedPercent,
      tradingSession: match.session || 'ENDED',
      source: 'vietcap_live',
      timestamp: Date.now(),
    };

    foreignCache.set(symbol, {
      data: payload,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      source: 'vietcap_live',
      data: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to fetch foreign trading data',
      },
      { status: 502 }
    );
  }
}
