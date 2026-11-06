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

  const pairs = [
    { symbol: 'USDVND=X', pair: 'USD/VND', name: 'Đô la Mỹ' },
    { symbol: 'EURVND=X', pair: 'EUR/VND', name: 'Euro' },
    { symbol: 'JPYVND=X', pair: 'JPY/VND', name: 'Yên Nhật' },
    { symbol: 'GBPVND=X', pair: 'GBP/VND', name: 'Bảng Anh' },
    { symbol: 'CNYVND=X', pair: 'CNY/VND', name: 'Nhân dân tệ' },
  ];

  const results: ExchangeRateItem[] = [];
  const updateTime = new Date().toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });

  await Promise.all(
    pairs.map(async (p) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(p.symbol)}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
              Accept: 'application/json',
            },
            next: { revalidate: 60 },
          }
        );

        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta) {
            const rawPrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
            const change = meta.fulldayChange ?? meta.regularMarketChange ?? 0;
            const changePercent = meta.regularMarketChangePercent ?? meta.fulldayChangePercent ?? 0;

            if (rawPrice > 0) {
              const roundedPrice = Math.round(rawPrice * 10) / 10;

              results.push({
                pair: p.pair,
                name: p.name,
                rate: roundedPrice,
                buy: roundedPrice,
                sell: roundedPrice,
                change: Math.round(change * 10) / 10,
                changePercent: Math.round(changePercent * 100) / 100,
                updatedAt: updateTime,
                sourceNote: 'Tỷ giá liên ngân hàng (Interbank Spot Rate)',
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching exchange rate for ${p.symbol}:`, err);
      }
    })
  );

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
