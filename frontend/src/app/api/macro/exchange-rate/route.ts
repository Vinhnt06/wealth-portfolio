import { NextResponse } from 'next/server';

export interface ExchangeRateItem {
  pair: string;
  name: string;
  rate: number;
  buy: number;
  sell: number;
  change: number;
  changePercent: number;
  updatedAt: string;
  sourceNote?: string;
}

interface CacheData {
  timestamp: number;
  data: ExchangeRateItem[];
  updateTime: string;
}

let cacheRates: CacheData | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

export async function GET() {
  const now = Date.now();
  if (cacheRates && now - cacheRates.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      cached: true,
      data: cacheRates.data,
      updateTime: cacheRates.updateTime,
    });
  }

  const results: ExchangeRateItem[] = [];
  const updateTime = new Date().toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });

  // Giá hiện tại & đóng cửa phiên trước của một cặp Yahoo (nến ngày 5 phiên)
  type Quote = { price: number; prev: number; time: number };
  const quote = async (symbol: string): Promise<Quote | null> => {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)', Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const r = (await res.json())?.chart?.result?.[0];
      const closes: number[] = (r?.indicators?.quote?.[0]?.close || []).filter((v: unknown) => typeof v === 'number' && v > 0);
      const price = r?.meta?.regularMarketPrice ?? closes[closes.length - 1];
      const prev = closes.length >= 2 ? closes[closes.length - 2] : r?.meta?.chartPreviousClose;
      if (!(price > 0) || !(prev > 0)) return null;
      return { price, prev, time: r?.meta?.regularMarketTime ?? 0 };
    } catch {
      return null;
    }
  };

  // USD/VND lấy trực tiếp; các đồng khác tính CHÉO qua cặp USD thanh khoản cao
  // (chuỗi lịch sử EURVND/GBPVND... của Yahoo có phiên sai lệch vài %, không dùng trực tiếp được).
  const [usd, eur, jpy, gbp, cny] = await Promise.all(['USDVND=X', 'EURUSD=X', 'USDJPY=X', 'GBPUSD=X', 'USDCNY=X'].map(quote));
  if (usd) {
    const fmtTime = (t: number) =>
      t ? new Date(t * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : updateTime;
    const push = (pair: string, name: string, price: number, prev: number, time: number, note: string) => {
      const rate = Math.round(price * 10) / 10;
      results.push({
        pair,
        name,
        rate,
        buy: rate,
        sell: rate,
        change: Math.round((price - prev) * 10) / 10,
        changePercent: Math.round(((price - prev) / prev) * 10000) / 100,
        updatedAt: fmtTime(time),
        sourceNote: note,
      });
    };
    push('USD/VND', 'Đô la Mỹ', usd.price, usd.prev, usd.time, 'Yahoo Finance USDVND');
    const t = (q: Quote) => Math.min(usd.time || q.time, q.time || usd.time);
    if (eur) push('EUR/VND', 'Euro', eur.price * usd.price, eur.prev * usd.prev, t(eur), 'Tính chéo EUR/USD × USD/VND');
    if (jpy) push('JPY/VND', 'Yên Nhật', usd.price / jpy.price, usd.prev / jpy.prev, t(jpy), 'Tính chéo USD/VND ÷ USD/JPY');
    if (gbp) push('GBP/VND', 'Bảng Anh', gbp.price * usd.price, gbp.prev * usd.prev, t(gbp), 'Tính chéo GBP/USD × USD/VND');
    if (cny) push('CNY/VND', 'Nhân dân tệ', usd.price / cny.price, usd.prev / cny.prev, t(cny), 'Tính chéo USD/VND ÷ USD/CNY');
  }

  // Không có tỷ giá thực -> báo lỗi, tuyệt đối không trả số liệu dựng sẵn
  if (results.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Không lấy được tỷ giá từ nguồn thị trường.' },
      { status: 502 }
    );
  }

  // Ensure deterministic pair order
  const orderMap: Record<string, number> = {
    'USD/VND': 1,
    'EUR/VND': 2,
    'JPY/VND': 3,
    'GBP/VND': 4,
    'CNY/VND': 5,
  };
  results.sort((a, b) => (orderMap[a.pair] || 99) - (orderMap[b.pair] || 99));

  cacheRates = {
    timestamp: now,
    data: results,
    updateTime,
  };

  return NextResponse.json({
    success: true,
    cached: false,
    data: results,
    updateTime,
  });
}
