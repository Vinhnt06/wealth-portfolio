import { NextRequest, NextResponse } from 'next/server';

export interface RealTradeItem {
  id: string | number;
  time: string;
  price: number; // in thousand VND (e.g. 20.10)
  volume: number;
  value: number; // order value in VND
  investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
  type: 'M' | 'B';
}

export interface InvestorStats {
  volume: number;
  value: number;
  count: number;
  pct: number;
}

export interface TradesResponseData {
  symbol: string;
  totalTrades: number;
  totalVolume: number;
  totalValue: number;
  netVolume: number;
  thresholds: {
    sharkMin: number;
    wolfMin: number;
    description: string;
  };
  summary: {
    netVolume: number;
    sharkNetVol: number;
    wolfNetVol: number;
    sheepNetVol: number;
  };
  buy: {
    totalVolume: number;
    totalValue: number;
    shark: InvestorStats;
    wolf: InvestorStats;
    sheep: InvestorStats;
  };
  sell: {
    totalVolume: number;
    totalValue: number;
    shark: InvestorStats;
    wolf: InvestorStats;
    sheep: InvestorStats;
  };
  trades: RealTradeItem[];
  timestamp: number;
}

const memoryCache = new Map<string, { data: TradesResponseData; expiry: number }>();
const CACHE_TTL_MS = 5 * 1000; // 5s cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();
  const limitParam = Math.min(500, Math.max(50, Number(searchParams.get('limit') || 300)));

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
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://trading.vietcap.com.vn/api/market-watch/LEData/getAll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://trading.vietcap.com.vn',
        'Referer': 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        symbol,
        limit: limitParam,
      }),
      signal: controller.signal,
      next: { revalidate: 5 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Vietcap LEData HTTP ${res.status}`);
    }

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`No trades returned for symbol ${symbol}`);
    }

    // THRESHOLDS DEFINED BY USER:
    // Cá mập: >= 1 Tỷ VNĐ (1,000,000,000 VND)
    // Sói già: >= 500 Triệu VNĐ & < 1 Tỷ VNĐ (500,000,000 - 1,000,000,000 VND)
    // Cừu non: < 500 Triệu VNĐ (< 500,000,000 VND)
    const SHARK_MIN_VALUE = 1_000_000_000;
    const WOLF_MIN_VALUE = 500_000_000;

    let totalBuyVolume = 0;
    let totalBuyValue = 0;
    let totalSellVolume = 0;
    let totalSellValue = 0;

    let sharkBuyVol = 0;
    let sharkBuyVal = 0;
    let sharkBuyCount = 0;

    let wolfBuyVol = 0;
    let wolfBuyVal = 0;
    let wolfBuyCount = 0;

    let sheepBuyVol = 0;
    let sheepBuyVal = 0;
    let sheepBuyCount = 0;

    let sharkSellVol = 0;
    let sharkSellVal = 0;
    let sharkSellCount = 0;

    let wolfSellVol = 0;
    let wolfSellVal = 0;
    let wolfSellCount = 0;

    let sheepSellVol = 0;
    let sheepSellVal = 0;
    let sheepSellCount = 0;

    const trades: RealTradeItem[] = [];

    for (const item of list) {
      const rawPrice = Number(item.matchPrice || 0);
      const rawVol = Number(item.matchVol || item.volume || 0);
      if (rawPrice <= 0 || rawVol <= 0) continue;

      // Price in VND
      const priceInVnd = rawPrice < 500 ? Math.round(rawPrice * 1000) : Math.round(rawPrice);
      // Order value in VND
      const orderValue = priceInVnd * rawVol;

      // Investor classification by exact user thresholds
      let investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
      if (orderValue >= SHARK_MIN_VALUE) {
        investorType = 'Cá mập';
      } else if (orderValue >= WOLF_MIN_VALUE) {
        investorType = 'Sói già';
      } else {
        investorType = 'Cừu non';
      }

      // Match side
      const sideRaw = String(item.matchType || '').toLowerCase();
      const isBuy = sideRaw === 'b' || sideRaw === 'buy';
      const isSell = sideRaw === 's' || sideRaw === 'sell';
      const type: 'M' | 'B' = isBuy ? 'M' : isSell ? 'B' : 'M';

      // Format time in VN timezone (HH:mm:ss)
      let timeStr = '14:30:00';
      if (item.createdAt) {
        const d = new Date(item.createdAt);
        timeStr = d.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } else if (item.truncTime) {
        const d = new Date(Number(item.truncTime) * 1000);
        timeStr = d.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }

      if (type === 'M') {
        totalBuyVolume += rawVol;
        totalBuyValue += orderValue;
        if (investorType === 'Cá mập') {
          sharkBuyVol += rawVol;
          sharkBuyVal += orderValue;
          sharkBuyCount += 1;
        } else if (investorType === 'Sói già') {
          wolfBuyVol += rawVol;
          wolfBuyVal += orderValue;
          wolfBuyCount += 1;
        } else {
          sheepBuyVol += rawVol;
          sheepBuyVal += orderValue;
          sheepBuyCount += 1;
        }
      } else {
        totalSellVolume += rawVol;
        totalSellValue += orderValue;
        if (investorType === 'Cá mập') {
          sharkSellVol += rawVol;
          sharkSellVal += orderValue;
          sharkSellCount += 1;
        } else if (investorType === 'Sói già') {
          wolfSellVol += rawVol;
          wolfSellVal += orderValue;
          wolfSellCount += 1;
        } else {
          sheepSellVol += rawVol;
          sheepSellVal += orderValue;
          sheepSellCount += 1;
        }
      }

      trades.push({
        id: item.id || `${timeStr}_${rawVol}_${rawPrice}`,
        time: timeStr,
        price: Number((priceInVnd / 1000).toFixed(2)),
        volume: rawVol,
        value: orderValue,
        investorType,
        type,
      });
    }

    const buyBase = totalBuyVolume || 1;
    const sellBase = totalSellVolume || 1;

    const sharkNetVol = sharkBuyVol - sharkSellVol;
    const wolfNetVol = wolfBuyVol - wolfSellVol;
    const sheepNetVol = sheepBuyVol - sheepSellVol;
    const netVolume = totalBuyVolume - totalSellVolume;

    const responsePayload: TradesResponseData = {
      symbol,
      totalTrades: trades.length,
      totalVolume: totalBuyVolume + totalSellVolume,
      totalValue: totalBuyValue + totalSellValue,
      netVolume,
      thresholds: {
        sharkMin: SHARK_MIN_VALUE,
        wolfMin: WOLF_MIN_VALUE,
        description: 'Cá mập >= 1 Tỷ | Sói già >= 500Tr | Cừu non < 500Tr',
      },
      summary: {
        netVolume,
        sharkNetVol,
        wolfNetVol,
        sheepNetVol,
      },
      buy: {
        totalVolume: totalBuyVolume,
        totalValue: totalBuyValue,
        shark: {
          volume: sharkBuyVol,
          value: sharkBuyVal,
          count: sharkBuyCount,
          pct: Number(((sharkBuyVol / buyBase) * 100).toFixed(2)),
        },
        wolf: {
          volume: wolfBuyVol,
          value: wolfBuyVal,
          count: wolfBuyCount,
          pct: Number(((wolfBuyVol / buyBase) * 100).toFixed(2)),
        },
        sheep: {
          volume: sheepBuyVol,
          value: sheepBuyVal,
          count: sheepBuyCount,
          pct: Number(((sheepBuyVol / buyBase) * 100).toFixed(2)),
        },
      },
      sell: {
        totalVolume: totalSellVolume,
        totalValue: totalSellValue,
        shark: {
          volume: sharkSellVol,
          value: sharkSellVal,
          count: sharkSellCount,
          pct: Number(((sharkSellVol / sellBase) * 100).toFixed(2)),
        },
        wolf: {
          volume: wolfSellVol,
          value: wolfSellVal,
          count: wolfSellCount,
          pct: Number(((wolfSellVol / sellBase) * 100).toFixed(2)),
        },
        sheep: {
          volume: sheepSellVol,
          value: sheepSellVal,
          count: sheepSellCount,
          pct: Number(((sheepSellVol / sellBase) * 100).toFixed(2)),
        },
      },
      trades: trades.slice(0, 100), // top 100 most recent trades
      timestamp: Date.now(),
    };

    memoryCache.set(symbol, {
      data: responsePayload,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      source: 'vietcap_real',
      data: responsePayload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to fetch intraday trades',
      },
      { status: 502 }
    );
  }
}
