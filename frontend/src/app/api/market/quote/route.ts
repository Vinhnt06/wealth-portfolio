import { NextRequest, NextResponse } from 'next/server';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { calculateExchangeCeilFloor } from '../../../../features/market/utils/priceColors';
import { isMarketTradingSession, isPreMarketResetWindow } from '../../../../features/market/utils/marketHours';
import { fetchEntradeSnapshot } from '../../../../features/market/utils/entradeSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

import { VN_MARKET_INDEXES, isMarketIndex, getMarketIndexMeta } from '../../../../features/market/constants/marketIndexes';

interface StockMeta {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}

const STOCK_LOOKUP = new Map<string, StockMeta>();
(stockDatabase as StockMeta[]).forEach((item) => {
  STOCK_LOOKUP.set(item.symbol.toUpperCase(), item);
});
VN_MARKET_INDEXES.forEach((idx) => {
  STOCK_LOOKUP.set(idx.symbol.toUpperCase(), {
    symbol: idx.symbol,
    name: idx.name,
    exchange: idx.exchange,
    sector: idx.sector,
  });
});

// Cache for SSI board data (3 seconds TTL)
interface BoardCache {
  timestamp: number;
  data: Map<string, any>;
}

const ssiBoardsCache: Record<string, BoardCache> = {
  hose: { timestamp: 0, data: new Map() },
  hnx: { timestamp: 0, data: new Map() },
  upcom: { timestamp: 0, data: new Map() },
};

const BOARD_CACHE_TTL_MS = 3000;

async function getSsiBoard(exchange: string): Promise<Map<string, any>> {
  const ex = exchange.toLowerCase();
  const cacheKey = ex === 'hnx' ? 'hnx' : ex === 'upcom' ? 'upcom' : 'hose';
  const now = Date.now();
  const cached = ssiBoardsCache[cacheKey];

  if (cached && now - cached.timestamp < BOARD_CACHE_TTL_MS && cached.data.size > 0) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://iboard-query.ssi.com.vn/stock/exchange/${cacheKey}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const map = new Map<string, any>();
        json.data.forEach((item: any) => {
          if (item && item.stockSymbol) {
            map.set(item.stockSymbol.toUpperCase(), item);
          }
        });
        ssiBoardsCache[cacheKey] = {
          timestamp: now,
          data: map,
        };
        return map;
      }
    }
  } catch {
    // If fetch failed, return existing cached data if any
  }

  return cached ? cached.data : new Map();
}

// Fetch live index from Vietcap gap-chart (has today's live intraday daily candle)
async function fetchIndexFromVietcap(symbol: string): Promise<any | null> {
  const vciMap: Record<string, string> = {
    VNINDEX: 'VNINDEX',
    VN30: 'VN30',
    HNX: 'HNXIndex',
    HNX30: 'HNX30',
    UPCOM: 'UpcomIndex',
  };

  const vciSymbol = vciMap[symbol] || symbol;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        timeFrame: 'ONE_DAY',
        symbols: [vciSymbol],
        to: Math.floor(Date.now() / 1000) + 86400,
        countBack: 2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json[0]?.c?.length > 0) {
        const item = json[0];
        const len = item.c.length;
        const currentClose = item.c[len - 1];
        const refClose = len > 1 ? item.c[len - 2] : currentClose;
        const isPreMarket = isPreMarketResetWindow(symbol);

        const currentOpen = isPreMarket ? currentClose : (item.o?.[len - 1] ?? currentClose);
        const currentHigh = isPreMarket ? currentClose : (item.h?.[len - 1] ?? currentClose);
        const currentLow = isPreMarket ? currentClose : (item.l?.[len - 1] ?? currentClose);
        const currentVol = isPreMarket ? 0 : (item.v?.[len - 1] || 0);
        const chg = isPreMarket ? 0 : currentClose - refClose;
        const chgPct = isPreMarket ? 0 : (refClose > 0 ? (chg / refClose) * 100 : 0);
        const totalValue = isPreMarket ? 0 : (item.accumulatedValue?.[len - 1] || 0) * 1_000_000;

        return {
          price: Number(currentClose.toFixed(2)),
          referencePrice: Number(refClose.toFixed(2)),
          ceilingPrice: Number((refClose * 1.07).toFixed(2)),
          floorPrice: Number((refClose * 0.93).toFixed(2)),
          open: Number(currentOpen.toFixed(2)),
          high: Number(currentHigh.toFixed(2)),
          low: Number(currentLow.toFixed(2)),
          change: Number(chg.toFixed(2)),
          changePercent: Number(chgPct.toFixed(2)),
          volume: currentVol,
          totalVolume: currentVol,
          totalValue: totalValue,
          dataSource: 'vietcap_live',
        };
      }
    }
  } catch {
    // Vietcap failed
  }
  return null;
}

// Fallback: giá từ API biểu đồ Entrade (xem utils/entradeSnapshot.ts)
async function fetchFromEntrade(symbol: string): Promise<any | null> {
  const isIndex = ['VNINDEX', 'VN30', 'HNX', 'HNX30', 'UPCOM'].includes(symbol);
  const snap = await fetchEntradeSnapshot(symbol, isIndex ? 'index' : 'stock', isMarketTradingSession());
  if (!snap) return null;

  const mult = isIndex ? 1 : 1000;
  const px = (v: number) => Number((v * mult).toFixed(2));
  const isPreMarket = isPreMarketResetWindow(symbol);

  // Pre-market: mọi giá về tham chiếu của phiên hôm nay (giá đóng cửa phiên trước)
  const price = px(isPreMarket ? snap.previousClose : snap.price);
  const ref = px(isPreMarket ? snap.previousClose : snap.referencePrice);
  const chg = price - ref;
  const chgPct = ref > 0 ? (chg / ref) * 100 : 0;
  const volume = isPreMarket ? 0 : snap.volume;

  return {
    price,
    referencePrice: ref,
    open: isPreMarket ? price : px(snap.open),
    high: isPreMarket ? price : px(snap.high),
    low: isPreMarket ? price : px(snap.low),
    change: Number(chg.toFixed(2)),
    changePercent: Number(chgPct.toFixed(2)),
    volume,
    totalVolume: volume,
    // Chỉ số tính bằng điểm nên không suy ra giá trị giao dịch từ giá × khối lượng được
    totalValue: isIndex ? 0 : price * volume,
    dataSource: 'entrade',
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'HPG').toUpperCase().trim();

  // 1. Lookup metadata
  const isIndex = isMarketIndex(symbol);
  const indexMeta = getMarketIndexMeta(symbol);
  const meta = indexMeta || STOCK_LOOKUP.get(symbol) || {
    symbol,
    name: isIndex ? `Chỉ số ${symbol}` : `${symbol} Company`,
    exchange: isIndex ? (symbol.includes('HNX') ? 'HNX' : symbol === 'UPCOM' ? 'UPCOM' : 'HOSE') : 'HOSE',
    sector: isIndex ? 'Chỉ số thị trường' : 'Tổng hợp',
  };

  // 2. FOR INDICES: Query Vietcap live gap-chart first
  if (isIndex) {
    const vciIndexData = await fetchIndexFromVietcap(symbol);
    if (vciIndexData) {
      return NextResponse.json({
        success: true,
        source: 'vietcap_live',
        data: {
          symbol,
          name: meta.name,
          exchange: meta.exchange,
          sector: meta.sector,
          ...vciIndexData,
          timestamp: Date.now(),
        },
      });
    }

    const entradeIndex = await fetchFromEntrade(symbol);
    if (entradeIndex) {
      return NextResponse.json({
        success: true,
        source: 'entrade',
        data: {
          symbol,
          name: meta.name,
          exchange: meta.exchange,
          sector: meta.sector,
          ...entradeIndex,
          timestamp: Date.now(),
        },
      });
    }
  }

  // 3. FOR STOCKS: Primary source is SSI iBoard (Live real-time feed from HOSE, HNX, UPCOM)
  try {
    const preferredExchange = meta.exchange.toLowerCase();
    let ssiMap = await getSsiBoard(preferredExchange);
    let ssiItem = ssiMap.get(symbol);

    // If not found in expected exchange, check others
    if (!ssiItem) {
      for (const otherEx of ['hose', 'hnx', 'upcom']) {
        if (otherEx !== preferredExchange) {
          const otherMap = await getSsiBoard(otherEx);
          if (otherMap.has(symbol)) {
            ssiItem = otherMap.get(symbol);
            break;
          }
        }
      }
    }

    if (ssiItem) {
      const refPrice = Number(ssiItem.refPrice || 0);
      const matchedPrice = Number(ssiItem.matchedPrice || 0);
      const expectedMatched = Number(ssiItem.expectedMatchedPrice || 0);
      const price = matchedPrice > 0 ? matchedPrice : expectedMatched > 0 ? expectedMatched : refPrice;

      const ceilPrice = Number(ssiItem.ceiling || 0) || calculateExchangeCeilFloor(refPrice, meta.exchange).ceilingPrice;
      const floorPrice = Number(ssiItem.floor || 0) || calculateExchangeCeilFloor(refPrice, meta.exchange).floorPrice;

      const rawChange = ssiItem.priceChange !== undefined && ssiItem.priceChange !== null
        ? Number(ssiItem.priceChange)
        : (price && refPrice ? price - refPrice : 0);

      const rawChangePct = ssiItem.priceChangePercent !== undefined && ssiItem.priceChangePercent !== null
        ? Number(ssiItem.priceChangePercent)
        : (refPrice > 0 ? (rawChange / refPrice) * 100 : 0);

      const openPrice = Number(ssiItem.openPrice || 0) || (matchedPrice > 0 ? matchedPrice : refPrice);
      const highPrice = Number(ssiItem.highest || 0) || price;
      const lowPrice = Number(ssiItem.lowest || 0) || price;
      const totalVolume = Number(ssiItem.nmTotalTradedQty || ssiItem.stockVol || 0);
      const totalValue = Number(ssiItem.nmTotalTradedValue || 0) || (price * totalVolume);

      // Best 3 bid / offer levels
      const bids = [
        { price: Number(ssiItem.best1Bid || 0), volume: Number(ssiItem.best1BidVol || 0) },
        { price: Number(ssiItem.best2Bid || 0), volume: Number(ssiItem.best2BidVol || 0) },
        { price: Number(ssiItem.best3Bid || 0), volume: Number(ssiItem.best3BidVol || 0) },
      ].filter((b) => b.price > 0);

      const asks = [
        { price: Number(ssiItem.best1Offer || 0), volume: Number(ssiItem.best1OfferVol || 0) },
        { price: Number(ssiItem.best2Offer || 0), volume: Number(ssiItem.best2OfferVol || 0) },
        { price: Number(ssiItem.best3Offer || 0), volume: Number(ssiItem.best3OfferVol || 0) },
      ].filter((a) => a.price > 0);

      const result = {
        symbol,
        name: meta.name,
        exchange: ssiItem.exchange?.toUpperCase() || meta.exchange,
        sector: meta.sector,
        price,
        referencePrice: refPrice,
        ceilingPrice: ceilPrice,
        floorPrice: floorPrice,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        change: Number(rawChange.toFixed(2)),
        changePercent: Number(rawChangePct.toFixed(2)),
        volume: totalVolume,
        totalVolume,
        totalValue,
        bids,
        asks,
        dataSource: 'ssi_iboard',
        timestamp: Date.now(),
      };

      // Nếu ngoài giờ giao dịch (15:05 -> 08:30 sáng hôm sau) mà SSI đã chạy batch sang ngày mới
      // (matchedPrice = 0 hoặc volume = 0 và change = 0%), không lấy kết quả rỗng này mà chuyển sang Entrade
      const isOutsideHours = !isMarketTradingSession();
      const isSsiResetRollover = isOutsideHours && (matchedPrice === 0 || totalVolume === 0) && (rawChange === 0 || rawChangePct === 0);

      if (!isSsiResetRollover) {
        return NextResponse.json({
          success: true,
          source: 'ssi_iboard',
          data: result,
        });
      }
    }
  } catch {
    // Continue to secondary source
  }

  // 4. SECONDARY SOURCE: Entrade Intraday REST API
  const entradeData = await fetchFromEntrade(symbol);
  if (entradeData) {
    const { ceilingPrice, floorPrice } = calculateExchangeCeilFloor(entradeData.referencePrice, meta.exchange);
    const result = {
      symbol,
      name: meta.name,
      exchange: meta.exchange,
      sector: meta.sector,
      ...entradeData,
      ceilingPrice,
      floorPrice,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      source: 'entrade',
      data: result,
    });
  }

  // Không có nguồn sống nào trả số → báo không có dữ liệu (không dùng snapshot cũ hay giá bịa)
  return NextResponse.json(
    { success: false, error: `Không lấy được giá thời gian thực cho ${symbol}` },
    { status: 502 }
  );
}
