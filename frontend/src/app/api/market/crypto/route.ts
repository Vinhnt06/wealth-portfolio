import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

/**
 * Giá crypto 24h. Ưu tiên backend; backend không chạy/lỗi thì lấy thẳng Binance (API công khai).
 * Không trả số giả: mọi nguồn đều lỗi → 502.
 */
async function fromBinance(symbol: string) {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const t = await res.json();
  const price = Number(t?.lastPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    price,
    change24h: Number(t.priceChange),
    changePercent: Number(t.priceChangePercent),
    high24h: Number(t.highPrice),
    low24h: Number(t.lowPrice),
    volume24h: Number(t.quoteVolume),
    source: 'binance',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') || '').toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(symbols)) {
    return NextResponse.json({ success: false, error: 'Mã không hợp lệ' }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}/api/market/crypto?symbols=${symbols}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4_000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.success) return NextResponse.json(data);
    }
  } catch {
    // backend không chạy → thử Binance
  }

  try {
    const data = await fromBinance(symbols);
    if (data) return NextResponse.json({ success: true, data });
  } catch {
    // rơi xuống báo lỗi
  }
  return NextResponse.json({ success: false, error: 'Không lấy được giá crypto' }, { status: 502 });
}
