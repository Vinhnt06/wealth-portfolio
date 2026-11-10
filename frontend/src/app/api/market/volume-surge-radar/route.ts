import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StockBaseline {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  avgVol20: number;
  avgVal20B?: number;
  rsRating?: number;
  mktCapT?: number;
  price?: number;
  changePct?: number;
  volume?: number;
}

let cachedBaselineMap: Map<string, StockBaseline> | null = null;
let lastBaselineLoad = 0;

function loadBaselines(): Map<string, StockBaseline> {
  const now = Date.now();
  if (cachedBaselineMap && now - lastBaselineLoad < 60000) {
    return cachedBaselineMap;
  }

  const map = new Map<string, StockBaseline>();
  const scanPaths = [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ];

  let rawData: any[] = [];
  for (const p of scanPaths) {
    if (fs.existsSync(p)) {
      try {
        const json = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(json.data) && json.data.length > 0) {
          rawData = json.data;
          break;
        }
      } catch {}
    }
  }

  rawData.forEach((item) => {
    if (!item.symbol) return;
    map.set(item.symbol.toUpperCase(), {
      symbol: item.symbol.toUpperCase(),
      name: item.name || item.symbol,
      sector: item.sector || 'Khác',
      exchange: item.exchange || 'HOSE',
      avgVol20: item.avgVol20 || item.volume || 0,
      avgVal20B: item.avgVal20B || 0,
      rsRating: item.rsRating || 50,
      mktCapT: item.mktCapT || 0,
      price: item.price || 0,
      changePct: item.changePct || 0,
      volume: item.volume || 0,
    });
  });

  cachedBaselineMap = map;
  lastBaselineLoad = now;
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minRVol = parseFloat(searchParams.get('minRVol') || '1.1');
    const filterType = searchParams.get('type') || 'all'; // all, buy, sell, monster
    const sectorFilter = (searchParams.get('sector') || 'all').toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const baselineMap = loadBaselines();

    // Fetch live market data across exchanges from SSI iBoard
    const exchanges = ['hose', 'hnx', 'upcom'];
    const results = await Promise.all(
      exchanges.map((ex) =>
        fetch(`https://iboard-query.ssi.com.vn/stock/exchange/${ex}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        })
          .then((r) => r.json())
          .catch(() => ({ data: [] }))
      )
    );

    const allLiveStocks = results.flatMap((r) => r?.data || []);

    // Calculate elapsed fraction of the trading session (Vietnam time)
    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const hours = vnDate.getHours();
    const minutes = vnDate.getMinutes();
    const currentMins = hours * 60 + minutes;

    const dayOfWeek = vnDate.getDay(); // 0 = Sun, 6 = Sat
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMorning = currentMins >= 540 && currentMins <= 690;
    const isAfternoon = currentMins >= 780 && currentMins <= 900;
    const isTradingSession = isWeekday && (isMorning || isAfternoon);

    // Trading minutes count:
    // Morning: 09:00 - 11:30 (150 mins)
    // Afternoon: 13:00 - 14:45 (105 mins) -> Total: 255 mins
    let elapsedTradingMins = 255; // default full day if after 15:00
    if (currentMins >= 540 && currentMins <= 690) {
      elapsedTradingMins = currentMins - 540; // in morning session
    } else if (currentMins > 690 && currentMins < 780) {
      elapsedTradingMins = 150; // lunch break
    } else if (currentMins >= 780 && currentMins <= 885) {
      elapsedTradingMins = 150 + (currentMins - 780); // in afternoon session
    }
    elapsedTradingMins = Math.max(15, Math.min(255, elapsedTradingMins));
    const sessionProgressRatio = elapsedTradingMins / 255;

    const surges: any[] = [];
    const seenSymbols = new Set<string>();

    for (const item of allLiveStocks) {
      const sym = item.stockSymbol ? item.stockSymbol.toUpperCase() : '';
      if (!sym || seenSymbols.has(sym)) continue;
      seenSymbols.add(sym);

      const base = baselineMap.get(sym);
      if (!base || !base.avgVol20 || base.avgVol20 < 80000) continue;

      const matchedPrice = Number(item.matchedPrice || 0);
      const expectedPrice = Number(item.expectedMatchedPrice || 0);
      const refPrice = Number(item.refPrice || 0);
      const livePrice = matchedPrice > 0 ? matchedPrice : expectedPrice > 0 ? expectedPrice : refPrice || base.price || 0;

      // STRICTLY use today's live traded volume. NEVER fall back to base.volume (which is yesterday's volume)!
      const liveVol = Number(item.nmTotalTradedQty || item.stockVol || 0);
      // Require at least 25,000 shares traded TODAY to prevent false breakouts from illiquid early ticks
      if (liveVol < 25000) continue;

      const changePct =
        item.priceChangePercent !== undefined && item.priceChangePercent !== null
          ? Number(item.priceChangePercent)
          : 0;

      const rVol = Number((liveVol / base.avgVol20).toFixed(2));
      const projectedTotal = Math.round(liveVol / sessionProgressRatio);
      const projectedRVol = Number((projectedTotal / base.avgVol20).toFixed(2));

      // Calculate effective surge ratio (uses projected during trading hours, actual otherwise)
      const effectiveRVol = sessionProgressRatio < 0.9 ? projectedRVol : rVol;

      if (effectiveRVol < minRVol) continue;

      if (sectorFilter !== 'all' && !base.sector.toLowerCase().includes(sectorFilter)) {
        continue;
      }

      // Classify surge type
      let surgeCategory: 'BUY_BREAKOUT' | 'SELL_SURGE' | 'ACCUMULATION' = 'ACCUMULATION';
      let signalTag = 'DÒNG TIỀN GOM';
      let signalColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

      if (changePct >= 1.5) {
        surgeCategory = 'BUY_BREAKOUT';
        signalTag = 'BÙNG NỔ MUA';
        signalColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      } else if (changePct <= -1.5) {
        surgeCategory = 'SELL_SURGE';
        signalTag = 'CẢNH BÁO BÁN XẢ';
        signalColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      }

      const isMonster = effectiveRVol >= 2.0;

      // Filter by type if requested
      if (filterType === 'buy' && surgeCategory !== 'BUY_BREAKOUT') continue;
      if (filterType === 'sell' && surgeCategory !== 'SELL_SURGE') continue;
      if (filterType === 'monster' && !isMonster) continue;

      const totalValBillion = Number(((liveVol * livePrice) / 1e9).toFixed(1));

      surges.push({
        symbol: sym,
        name: base.name,
        sector: base.sector,
        exchange: base.exchange,
        price: livePrice,
        changePct,
        liveVol,
        avgVol20: base.avgVol20,
        rVol,
        projectedTotal,
        projectedRVol,
        effectiveRVol,
        totalValBillion,
        rsRating: base.rsRating,
        surgeCategory,
        isMonster,
        signalTag,
        signalColor,
      });
    }

    // Sort by highest effective surge ratio first
    surges.sort((a, b) => b.effectiveRVol - a.effectiveRVol || b.totalValBillion - a.totalValBillion);

    const limitedSurges = surges.slice(0, limit);

    const stats = {
      total: surges.length,
      buyBreakouts: surges.filter((s) => s.surgeCategory === 'BUY_BREAKOUT').length,
      sellSurges: surges.filter((s) => s.surgeCategory === 'SELL_SURGE').length,
      accumulations: surges.filter((s) => s.surgeCategory === 'ACCUMULATION').length,
      monsterSurges: surges.filter((s) => s.isMonster).length,
    };

    const vnTimeText = new Date().toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return NextResponse.json({
      success: true,
      updatedAt: vnTimeText,
      isTradingSession,
      sessionProgressPct: Number((sessionProgressRatio * 100).toFixed(0)),
      stats,
      data: limitedSurges,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to scan volume surge radar' },
      { status: 500 }
    );
  }
}
