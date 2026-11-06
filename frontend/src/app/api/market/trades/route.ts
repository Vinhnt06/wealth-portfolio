import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

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
    megaWhaleMin?: number;
    description: string;
  };
  summary: {
    netVolume: number;
    sharkNetVol: number;
    wolfNetVol: number;
    sheepNetVol: number;
    sharkBuyVal?: number;
    sharkSellVal?: number;
    sharkNetVal?: number;
    sharkBuyCount?: number;
    sharkSellCount?: number;
    wolfBuyVal?: number;
    wolfSellVal?: number;
    wolfNetVal?: number;
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

// In-Memory Persistent Store for Full Trading Day Log (No Trade Loss)
interface DailyTapeSession {
  dateKey: string;
  tradesMap: Map<string, RealTradeItem>;
  dbLoaded?: boolean;
}
const intradayTapeStore = new Map<string, DailyTapeSession>();

const memoryCache = new Map<string, { data: TradesResponseData; expiry: number }>();
const CACHE_TTL_MS = 3 * 1000; // 3s cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();
  const limitParam = Math.max(100, Number(searchParams.get('limit') || 1000));

  // Determine current VN trading date (YYYY-MM-DD)
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

  let dailySession = intradayTapeStore.get(symbol);
  if (!dailySession || dailySession.dateKey !== todayKey) {
    dailySession = {
      dateKey: todayKey,
      tradesMap: new Map<string, RealTradeItem>(),
      dbLoaded: false,
    };
    intradayTapeStore.set(symbol, dailySession);
  }

  // 1. Tự động nạp dữ liệu từ Database Supabase nếu phiên RAM vừa khởi tạo
  if (!dailySession.dbLoaded) {
    dailySession.dbLoaded = true;
    try {
      const { data: dbTrades, error: dbErr } = await supabase
        .from('intraday_trades')
        .select('id, trade_time, price, volume, value, investor_type, match_type')
        .eq('symbol', symbol)
        .eq('trading_date', todayKey)
        .order('trade_time', { ascending: false });

      if (!dbErr && Array.isArray(dbTrades) && dbTrades.length > 0) {
        for (const r of dbTrades) {
          dailySession.tradesMap.set(r.id, {
            id: r.id,
            time: r.trade_time,
            price: Number(r.price),
            volume: Number(r.volume),
            value: Number(r.value),
            investorType: r.investor_type as any,
            type: r.match_type as any,
          });
        }
      }
    } catch {
      // Bỏ qua nếu bảng chưa được tạo trên Supabase, fallback sang In-memory
    }
  }

  // 2. Check short-lived cache
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
      next: { revalidate: 3 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Vietcap LEData HTTP ${res.status}`);
    }

    const list = await res.json();
    if (Array.isArray(list) && list.length > 0) {
      const newRowsToUpsert: any[] = [];

      // Ingest & merge all incoming ticks into the persistent day store
      for (const item of list) {
        const rawPrice = Number(item.matchPrice || 0);
        const rawVol = Number(item.matchVol || item.volume || 0);
        if (rawPrice <= 0 || rawVol <= 0) continue;

        const priceInVnd = rawPrice < 500 ? Math.round(rawPrice * 1000) : Math.round(rawPrice);
        const orderValue = priceInVnd * rawVol;

        let investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
        if (orderValue >= 1_000_000_000) {
          investorType = 'Cá mập';
        } else if (orderValue >= 500_000_000) {
          investorType = 'Sói già';
        } else {
          investorType = 'Cừu non';
        }

        const sideRaw = String(item.matchType || '').toLowerCase();
        const isBuy = sideRaw === 'b' || sideRaw === 'buy';
        const isSell = sideRaw === 's' || sideRaw === 'sell';
        const type: 'M' | 'B' = isBuy ? 'M' : isSell ? 'B' : 'M';

        let timeStr = '14:30:00';
        let rawTimestamp = Date.now();
        if (item.createdAt) {
          const d = new Date(item.createdAt);
          rawTimestamp = d.getTime();
          timeStr = d.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        } else if (item.truncTime) {
          const d = new Date(Number(item.truncTime) * 1000);
          rawTimestamp = d.getTime();
          timeStr = d.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        }

        const tradeItem: RealTradeItem = {
          id: item.id ? String(item.id) : `${timeStr}_${rawVol}_${rawPrice}_${type}`,
          time: timeStr,
          price: Number((priceInVnd / 1000).toFixed(2)),
          volume: rawVol,
          value: orderValue,
          investorType,
          type,
        };

        const uniqueKey = item.id ? String(item.id) : `${timeStr}_${rawVol}_${priceInVnd}_${type}`;
        
        // CHỈ LƯU VÀO DATABASE CÁC LỆNH TAY TO (CÁ MẬP >= 1 TỶ & SÓI GIÀ >= 500TR)
        // LOẠI BỎ 100% LỆNH NHỎ LẺ CỪU NON (< 500TR) ĐỂ DATABASE SIÊU NHẸ
        const isWhaleTrade = investorType === 'Cá mập' || investorType === 'Sói già';
        if (isWhaleTrade && !dailySession.tradesMap.has(uniqueKey)) {
          newRowsToUpsert.push({
            id: uniqueKey,
            symbol,
            trading_date: todayKey,
            trade_time: timeStr,
            price: tradeItem.price,
            volume: tradeItem.volume,
            value: tradeItem.value,
            investor_type: tradeItem.investorType,
            match_type: tradeItem.type,
          });
        }
        dailySession.tradesMap.set(uniqueKey, tradeItem);
      }

      // Batch persist vào Supabase trong nền (non-blocking)
      if (newRowsToUpsert.length > 0) {
        Promise.resolve(
          supabase.from('intraday_trades').upsert(newRowsToUpsert, { onConflict: 'id', ignoreDuplicates: true })
        )
          .then(({ error }: any) => {
            if (error && error.code !== 'PGRST205') {
              console.warn('[Supabase intraday_trades sync]', error.message);
            }
          })
          .catch(() => {});
      }
    }

    // THRESHOLDS DEFINED BY USER:
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

    // Retrieve ALL accumulated trades for this trading day (No trade is deleted or sliced)
    const allTrades: RealTradeItem[] = Array.from(dailySession.tradesMap.values()).sort((a, b) => {
      // Sort newest trades first
      return b.time.localeCompare(a.time);
    });

    for (const trade of allTrades) {
      if (trade.type === 'M') {
        totalBuyVolume += trade.volume;
        totalBuyValue += trade.value;
        if (trade.investorType === 'Cá mập') {
          sharkBuyVol += trade.volume;
          sharkBuyVal += trade.value;
          sharkBuyCount += 1;
        } else if (trade.investorType === 'Sói già') {
          wolfBuyVol += trade.volume;
          wolfBuyVal += trade.value;
          wolfBuyCount += 1;
        } else {
          sheepBuyVol += trade.volume;
          sheepBuyVal += trade.value;
          sheepBuyCount += 1;
        }
      } else {
        totalSellVolume += trade.volume;
        totalSellValue += trade.value;
        if (trade.investorType === 'Cá mập') {
          sharkSellVol += trade.volume;
          sharkSellVal += trade.value;
          sharkSellCount += 1;
        } else if (trade.investorType === 'Sói già') {
          wolfSellVol += trade.volume;
          wolfSellVal += trade.value;
          wolfSellCount += 1;
        } else {
          sheepSellVol += trade.volume;
          sheepSellVal += trade.value;
          sheepSellCount += 1;
        }
      }
    }

    const buyBase = totalBuyVolume || 1;
    const sellBase = totalSellVolume || 1;

    const sharkNetVol = sharkBuyVol - sharkSellVol;
    const wolfNetVol = wolfBuyVol - wolfSellVol;
    const sheepNetVol = sheepBuyVol - sheepSellVol;
    const netVolume = totalBuyVolume - totalSellVolume;

    const responsePayload: TradesResponseData = {
      symbol,
      totalTrades: allTrades.length,
      totalVolume: totalBuyVolume + totalSellVolume,
      totalValue: totalBuyValue + totalSellValue,
      netVolume,
      thresholds: {
        sharkMin: SHARK_MIN_VALUE,
        wolfMin: WOLF_MIN_VALUE,
        megaWhaleMin: 3_000_000_000,
        description: 'Cá mập >= 1 Tỷ | Sói già >= 500Tr | Cừu non < 500Tr',
      },
      summary: {
        netVolume,
        sharkNetVol,
        wolfNetVol,
        sheepNetVol,
        sharkBuyVal,
        sharkSellVal,
        sharkNetVal: sharkBuyVal - sharkSellVal,
        sharkBuyCount,
        sharkSellCount,
        wolfBuyVal,
        wolfSellVal,
        wolfNetVal: wolfBuyVal - wolfSellVal,
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
      trades: allTrades, // 100% full intraday session trades (Không xoá hay cắt bớt)
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
