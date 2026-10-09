import { NextRequest, NextResponse } from 'next/server';

interface OrderBookLevel {
  price: number;
  volume: number;
}

interface OrderBookResponse {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  totalBidVol: number;
  totalAskVol: number;
  price: number;
  referencePrice: number;
  ceilingPrice: number;
  floorPrice: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  totalVolume: number;
  timestamp: number;
  source: string;
}

const memoryCache = new Map<string, { data: OrderBookResponse; expiry: number }>();
const CACHE_TTL_MS = 5 * 1000; // 5 seconds cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  // 1. Check cache
  const cached = memoryCache.get(symbol);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      data: cached.data,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

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
      next: { revalidate: 5 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Vietcap HTTP ${res.status}`);
    }

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`No data returned for symbol ${symbol}`);
    }

    const item = list[0];
    const listing = item.listingInfo || {};
    const bidAsk = item.bidAsk || {};
    const match = item.matchPrice || {};

    const rawBids: Array<{ price: number; volume: number }> = bidAsk.bidPrices || [];
    const rawAsks: Array<{ price: number; volume: number }> = bidAsk.askPrices || [];

    // Filter valid bids & asks
    const bids: OrderBookLevel[] = rawBids
      .filter((b) => b && typeof b.price === 'number' && b.price > 0)
      .map((b) => ({
        price: b.price,
        volume: Number(b.volume || 0),
      }))
      .slice(0, 3);

    const asks: OrderBookLevel[] = rawAsks
      .filter((a) => a && typeof a.price === 'number' && a.price > 0)
      .map((a) => ({
        price: a.price,
        volume: Number(a.volume || 0),
      }))
      .slice(0, 3);

    const totalBidVol = bids.reduce((acc, b) => acc + b.volume, 0);
    const totalAskVol = asks.reduce((acc, a) => acc + a.volume, 0);

    const refPrice = Number(listing.refPrice || listing.referencePrice || 0);
    const price = Number(match.matchPrice || refPrice);
    const change = refPrice > 0 ? price - refPrice : 0;
    const changePercent = refPrice > 0 ? (change / refPrice) * 100 : 0;

    const payload: OrderBookResponse = {
      symbol,
      bids,
      asks,
      totalBidVol,
      totalAskVol,
      price,
      referencePrice: refPrice,
      ceilingPrice: Number(listing.ceiling || listing.ceilingPrice || 0),
      floorPrice: Number(listing.floor || listing.floorPrice || 0),
      open: Number(match.openPrice || price),
      high: Number(match.highest || price),
      low: Number(match.lowest || price),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      totalVolume: Number(match.accumulatedVolume || 0),
      timestamp: Date.now(),
      source: 'vietcap_real',
    };

    memoryCache.set(symbol, {
      data: payload,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      source: 'vietcap_real',
      data: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to fetch order book depth',
      },
      { status: 502 }
    );
  }
}
