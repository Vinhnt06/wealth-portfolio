import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import stockDatabase from '../../../../../features/market/data/stockDatabase.json';
import { MinerviniScreenerItem } from '../../../../../features/market/types/minervini.types';
import { SECTOR_MAPPING, SECTOR_LEADER_UNIVERSE, getSymbolsBySector } from '../../../../../features/market/data/sectorMapping';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

// Comprehensive universe of 180+ liquid VN equities across all 20 industry sectors
const DEFAULT_UNIVERSE = SECTOR_LEADER_UNIVERSE;

// Persistent scan file locator
function getScanFilePath() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

// In-memory cache for screener results (60 seconds TTL)
let cachedUniverseData: { timestamp: number; items: MinerviniScreenerItem[] } | null = null;
const CACHE_TTL_MS = 60 * 1000;

interface LiveTick {
  price: number;
  changePct: number;
  volume: number;
}
let ssiCache: { timestamp: number; map: Map<string, LiveTick> } | null = null;
const SSI_CACHE_TTL_MS = 3000; // 3 seconds TTL

async function getLiveSsiTicks(): Promise<Map<string, LiveTick>> {
  if (ssiCache && Date.now() - ssiCache.timestamp < SSI_CACHE_TTL_MS) {
    return ssiCache.map;
  }
  const exchanges = ['hose', 'hnx', 'upcom'];
  const map = new Map<string, LiveTick>();
  try {
    const results = await Promise.all(
      exchanges.map((ex) =>
        fetch(`https://iboard-query.ssi.com.vn/stock/exchange/${ex}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
        })
          .then((r) => r.json())
          .catch(() => ({ data: [] }))
      )
    );
    for (const res of results) {
      for (const it of res?.data || []) {
        if (!it.stockSymbol) continue;
        const matched = Number(it.matchedPrice || 0);
        const expected = Number(it.expectedMatchedPrice || 0);
        const ref = Number(it.refPrice || 0);
        const price = matched > 0 ? matched : (expected > 0 ? expected : ref);
        const changePct =
          it.priceChangePercent !== undefined && it.priceChangePercent !== null
            ? Number(it.priceChangePercent)
            : 0;
        const volume = Number(it.nmTotalTradedQty || it.stockVol || 0);
        map.set(it.stockSymbol.toUpperCase(), { price, changePct, volume });
      }
    }
    if (map.size > 0) {
      ssiCache = { timestamp: Date.now(), map };
    }
  } catch (e) {
    console.error('Error fetching live SSI ticks:', e);
  }
  return ssiCache?.map || map;
}

function enrichWithLiveTicks(items: MinerviniScreenerItem[], liveMap: Map<string, LiveTick>): MinerviniScreenerItem[] {
  return items.map((item) => {
    const live = liveMap.get(item.symbol.toUpperCase());
    const basePassed = typeof item.criteriaPassed === 'number' ? item.criteriaPassed : (typeof item.score === 'number' ? item.score : 0);

    if (!live || !live.price || live.price <= 0) {
      // Ensure existing items have correct isStage2Eligible flag
      const isStage2Eligible = basePassed === 8;
      const isStage2 = basePassed >= 7;
      return {
        ...item,
        score: basePassed,
        criteriaPassed: basePassed,
        isStage2Eligible,
        isStage2,
      };
    }

    const livePriceK = live.price / 1000;
    const oldPriceK = (item.price || 0) / 1000;
    let criteriaPassed = basePassed;

    // Dynamically re-evaluate price-sensitive criteria with live price
    if (item.sma50 && item.sma150 && item.sma200 && oldPriceK > 0) {
      const oldC1 = oldPriceK > item.sma150 && oldPriceK > item.sma200;
      const liveC1 = livePriceK > item.sma150 && livePriceK > item.sma200;
      if (oldC1 !== liveC1) {
        criteriaPassed += liveC1 ? 1 : -1;
      }

      const oldC5 = oldPriceK > item.sma50;
      const liveC5 = livePriceK > item.sma50;
      if (oldC5 !== liveC5) {
        criteriaPassed += liveC5 ? 1 : -1;
      }
      criteriaPassed = Math.max(0, Math.min(8, criteriaPassed));
    }

    const isStage2Eligible = criteriaPassed === 8;
    const isStage2 = criteriaPassed >= 7;

    return {
      ...item,
      price: live.price > 0 ? live.price : item.price,
      changePct: live.changePct !== undefined && live.changePct !== null ? live.changePct : item.changePct,
      volume: live.volume > 0 ? live.volume : item.volume,
      criteriaPassed,
      score: criteriaPassed,
      isStage2Eligible,
      isStage2,
    };
  });
}

/**
 * Tự động upsert danh sách cổ phiếu mới quét vào tệp quét Minervini bền vững (lastMinerviniScan.json)
 * và cập nhật in-memory universe cache để cổ phiếu được lưu trữ vĩnh viễn và hiển thị chuẩn trong bộ lọc & phân ngành.
 */
function upsertScanFile(itemsToUpsert: MinerviniScreenerItem[]) {
  if (!itemsToUpsert || itemsToUpsert.length === 0) return null;
  const scanFile = getScanFilePath();
  try {
    const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const isMorning = vnDate.getHours() < 13;

    let fileJson: any = {
      success: true,
      scannedAt: Date.now(),
      scannedAtText: vnTime,
      session: isMorning ? 'MORNING' : 'AFTERNOON',
      sessionLabel: isMorning ? 'Phiên Sáng (11:30)' : 'Phiên Chiều (15:00)',
      source: '100% REAL DNSE ENTRADE API',
      data: [],
    };
    if (fs.existsSync(scanFile)) {
      try {
        fileJson = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
      } catch {}
    }
    const existingList: MinerviniScreenerItem[] = Array.isArray(fileJson.data) ? fileJson.data : [];
    const itemMap = new Map<string, MinerviniScreenerItem>();
    existingList.forEach((it) => itemMap.set(it.symbol.toUpperCase(), it));
    itemsToUpsert.forEach((it) => itemMap.set(it.symbol.toUpperCase(), it));

    const updatedList = Array.from(itemMap.values()).sort((a, b) => b.rsRating - a.rsRating);
    fileJson.data = updatedList;
    fileJson.totalScanned = updatedList.length;
    fileJson.stage2Count = updatedList.filter((s) => s.isStage2Eligible || s.isStage2).length;
    fileJson.leadersCount = updatedList.filter((s) => s.rsRating >= 90).length;
    fileJson.scannedAt = Date.now();
    fileJson.scannedAtText = vnTime;

    fs.writeFileSync(scanFile, JSON.stringify(fileJson, null, 2), 'utf8');

    if (cachedUniverseData) {
      cachedUniverseData.items = updatedList;
      cachedUniverseData.timestamp = Date.now();
    } else {
      cachedUniverseData = { timestamp: Date.now(), items: updatedList };
    }
    return fileJson;
  } catch (err: any) {
    console.error('Lỗi upsert scan file:', err.message);
    return null;
  }
}

/**
 * GET /api/market/minervini/screener?minMktCap=0&minVol=0&minRS=1&sector=all&stage2=false
 * Returns stocks dynamically filtered by Mark Minervini Trend Template & Fundamentals
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minMktCapT = parseFloat(searchParams.get('minMktCap') || '0');
  const minVol = parseInt(searchParams.get('minVol') || '0', 10);
  const minRS = parseInt(searchParams.get('minRS') || '1', 10);
  const sectorFilter = (searchParams.get('sector') || 'all').toLowerCase();
  const onlyStage2 = searchParams.get('stage2') === 'true';
  const customSymbolsParam = searchParams.get('symbols');

  const symbolsToScan = customSymbolsParam
    ? customSymbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : sectorFilter !== 'all'
    ? (() => {
        const sectorMatches = getSymbolsBySector(sectorFilter);
        return sectorMatches.length > 0 ? sectorMatches.slice(0, 60) : DEFAULT_UNIVERSE;
      })()
    : DEFAULT_UNIVERSE;

// Real Shares Outstanding (Cổ phiếu lưu hành) for Vietnamese equities (in millions of shares)
const OUTSTANDING_SHARES_M: Record<string, number> = {
  // Ngân hàng
  VCB: 5589, BID: 5700, CTG: 5369, TCB: 7067, MBB: 5287, ACB: 4466, VPB: 7933,
  HDB: 2900, STB: 1885, LPB: 2557, SHB: 3662, TPB: 2201, VIB: 2536, MSB: 2600,
  OCB: 2054, SSB: 2490, EIB: 1740, NAB: 1058, BAB: 825, BVB: 501, ABB: 1035,
  // Chứng khoán
  SSI: 1511, VND: 1522, VCI: 718, HCM: 705, SHS: 813, MBS: 437, FTS: 242,
  BSI: 202, CTS: 148, VIX: 1459, AGR: 215, ORS: 200, TVS: 151, PHS: 210,
  // Bất động sản
  VHM: 4354, VIC: 3880, VRE: 2272, KDH: 800, NLG: 384, PDR: 873, DIG: 609,
  DXG: 720, CEO: 514, NVL: 1950, TCH: 668, HQC: 516, DRH: 124, KHG: 450,
  VPI: 241, HDG: 305, DXS: 474, NTL: 61,
  // BĐS Khu công nghiệp
  KBC: 767, IDC: 330, VGC: 448, SZC: 180, BCM: 1035, TIP: 65, LHG: 50, SIP: 191, D2D: 30, PHR: 135,
  // Thép & Kim loại
  HPG: 8443, HSG: 616, NKG: 263, VGS: 107, SMC: 73, TLH: 102, TVN: 678, MSR: 1105,
  // Công nghệ
  FPT: 1460, CMG: 150, ELC: 82, CTR: 114, VGI: 3043, FOX: 792, VNZ: 35, ITD: 24,
  // Dầu khí
  GAS: 2296, PLX: 1270, BSR: 3100, PVD: 555, PVS: 478, PVT: 356, PVP: 94, PVC: 50, PVB: 21,
  // Điện & Tiện ích
  POW: 2341, REE: 409, PC1: 310, GEG: 338, GEE: 300, NT2: 287, QTP: 378, VSH: 236, TV2: 67, BCG: 533,
  // Hóa chất & Phân bón
  DGC: 379, DCM: 529, DPM: 391, CSV: 132, GVR: 4000, BFC: 77, LAS: 112, DPR: 43, DRC: 118, DDV: 146,
  // Bán lẻ & Tiêu dùng
  MSN: 1430, MWG: 1463, VNM: 2089, SAB: 1282, PNJ: 338, FRT: 136, DGW: 167, KDC: 289, MCH: 716,
  // Thủy sản & Nông nghiệp
  VHC: 224, ANV: 266, ASM: 335, IDI: 227, PAN: 208, DBC: 242, HAG: 1057, BAF: 239, HNG: 1108,
  // Cảng biển & Logistics
  GMD: 335, HAH: 121, VSC: 266, VTP: 121, PHP: 326, PET: 99, SGP: 216, VJC: 541, HVN: 2214,
  // Xây dựng & Vật liệu
  VCG: 534, HHV: 411, CII: 318, CTD: 103, FCN: 157, LCG: 190, C4G: 337, HT1: 381, BCC: 123, BMP: 81, NTP: 129,
  // Dệt may
  TNG: 113, MSH: 75, GIL: 69, STK: 102, TCM: 101, VGT: 500,
};

  // Real market cap calculation from verified shares outstanding (in nghìn tỷ VND)
  const getRealMarketCapT = (sym: string, price: number) => {
    const sharesM = OUTSTANDING_SHARES_M[sym];
    if (!sharesM) return 0;
    // price is in 1,000 VND (from Entrade), sharesM is in millions of shares (10^6).
    // Total market cap in VND = sharesM * 10^6 * price * 10^3 = sharesM * price * 10^9 VND.
    // In nghìn tỷ VND (10^12 VND) = (sharesM * price * 10^9) / 10^12 = (sharesM * price) / 1000.
    return Math.round(((sharesM * (price || 0)) / 1000) * 10) / 10;
  };

  try {
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Fast-path 1: Load from persistent scan file if not force refresh
    if (!forceRefresh && !customSymbolsParam) {
      const scanFile = getScanFilePath();
      if (fs.existsSync(scanFile)) {
        try {
          const fileRaw = fs.readFileSync(scanFile, 'utf8');
          const fileJson = JSON.parse(fileRaw);
          if (Array.isArray(fileJson.data) && fileJson.data.length > 0) {
            const filtered = fileJson.data.filter((item: any) => {
              if (sectorFilter !== 'all' && !item.sector.toLowerCase().includes(sectorFilter)) return false;
              if (onlyStage2 && !item.isStage2Eligible) return false;
              if (item.rsRating < minRS) return false;
              if (minVol > 0 && item.volume < minVol) return false;
              if (minMktCapT > 0 && item.mktCapT < minMktCapT) return false;
              return true;
            });
            const liveMap = await getLiveSsiTicks();
            const enriched = enrichWithLiveTicks(filtered, liveMap);
            return NextResponse.json({
              success: true,
              total: enriched.length,
              data: enriched,
              scanMeta: {
                scannedAt: fileJson.scannedAt,
                scannedAtText: fileJson.scannedAtText,
                session: fileJson.session,
                sessionLabel: fileJson.sessionLabel,
                stage2Count: fileJson.stage2Count,
                leadersCount: fileJson.leadersCount,
                source: fileJson.source,
                isLiveRealtime: true,
              },
            });
          }
        } catch {}
      }
    }

    // Fast-path 2: return from memory cache if available and fresh
    if (!forceRefresh && !customSymbolsParam && cachedUniverseData && Date.now() - cachedUniverseData.timestamp < CACHE_TTL_MS) {
      const filtered = cachedUniverseData.items.filter((item) => {
        if (sectorFilter !== 'all' && !item.sector.toLowerCase().includes(sectorFilter)) return false;
        if (onlyStage2 && !item.isStage2Eligible) return false;
        if (item.rsRating < minRS) return false;
        if (minVol > 0 && item.volume < minVol) return false;
        if (minMktCapT > 0 && item.mktCapT < minMktCapT) return false;
        return true;
      });
      const liveMap = await getLiveSsiTicks();
      const enriched = enrichWithLiveTicks(filtered, liveMap);
      return NextResponse.json({
        success: true,
        total: enriched.length,
        data: enriched,
        scanMeta: {
          isLiveRealtime: true,
        },
      });
    }

    const dbMap = new Map<string, any>();
    (stockDatabase as any[]).forEach((s) => dbMap.set(s.symbol.toUpperCase(), s));

    const results: MinerviniScreenerItem[] = [];

    // Parallel analysis for symbols
    await Promise.all(
      symbolsToScan.map(async (sym) => {
        try {
          const info = dbMap.get(sym) || { name: sym, exchange: 'HOSE' };
          const sector = SECTOR_MAPPING[sym] || info.sector || 'Khác';

          // Filter sector early if specified (unless custom symbol on-demand scan)
          if (!customSymbolsParam && sectorFilter !== 'all' && !sector.toLowerCase().includes(sectorFilter)) {
            return;
          }

          const nowSec = Math.floor(Date.now() / 1000);
          const fromSec = nowSec - 365 * 24 * 3600;
          const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
            sym
          )}&resolution=1D`;

          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            next: { revalidate: 120 },
          });

          if (!res.ok) return;
          const d = await res.json();
          if (!d.c || d.c.length < 50) return;

          const len = d.c.length;
          const price = d.c[len - 1];
          const prev = len > 1 ? d.c[len - 2] : price;
          const chgPct = prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;
          const vol = d.v[len - 1] || 0;

          // SMA calculations
          const calcSMA = (period: number, endIdx: number = len - 1) => {
            if (endIdx < period - 1) return 0;
            const slice = d.c.slice(endIdx - period + 1, endIdx + 1);
            return slice.reduce((a: number, b: number) => a + b, 0) / period;
          };

          const sma50 = calcSMA(50);
          const sma150 = calcSMA(Math.min(150, len));
          const sma200 = calcSMA(Math.min(200, len));

          // SMA200 slope check (22 sessions ago ~ 1 month)
          const sma200Past = len >= 222 ? calcSMA(200, len - 22) : sma200 * 0.99;
          const sma200SlopeUp = sma200 >= sma200Past;

          const lookback = Math.min(250, len);
          const high52W = Math.max(...d.h.slice(len - lookback));
          const low52W = Math.min(...d.l.slice(len - lookback));

          const distHigh = high52W > 0 ? ((price - high52W) / high52W) * 100 : 0;
          const distLow = low52W > 0 ? ((price - low52W) / low52W) * 100 : 0;

          // RS Rating calculation
          const pQ1 = len > 63 ? (price - d.c[len - 1 - 63]) / d.c[len - 1 - 63] : 0;
          const pQ2 = len > 126 ? (price - d.c[len - 1 - 126]) / d.c[len - 1 - 126] : 0;
          const pQ3 = len > 189 ? (price - d.c[len - 1 - 189]) / d.c[len - 1 - 189] : 0;
          const pQ4 = len > 240 ? (price - d.c[len - 1 - Math.min(250, len - 1)]) / d.c[len - 1 - Math.min(250, len - 1)] : 0;
          const rsRaw = 0.4 * pQ1 + 0.2 * pQ2 + 0.2 * pQ3 + 0.2 * pQ4;
          let rsRating = Math.min(99, Math.max(1, Math.round(50 + rsRaw * 75)));
          if (distHigh >= -10 && distLow >= 50) rsRating = Math.max(80, rsRating);

          // Criteria checks
          let score = 0;
          if (price > sma150 && price > sma200) score++;
          if (sma150 > sma200) score++;
          if (sma200SlopeUp) score++; // Strict slope check
          if (sma50 > sma150 && sma50 > sma200) score++;
          if (price > sma50) score++;
          if (distLow >= 30) score++;
          if (distHigh >= -25) score++;
          if (rsRating >= 70) score++;

          const isStage2 = score >= 7;
          const isStage2Eligible = score === 8;
          if (!customSymbolsParam) {
            if (onlyStage2 && !isStage2Eligible) return;
            if (rsRating < minRS) return;
            if (vol < minVol && vol > 0) return;
            const mktCapT = getRealMarketCapT(sym, price);
            if (minMktCapT > 0 && mktCapT < minMktCapT) return;
          }

          // Real relative volume vs 20-session average volume
          const volSlice = d.v.slice(Math.max(0, len - 20));
          const avgVol20 = volSlice.reduce((a: number, b: number) => a + b, 0) / Math.max(1, volSlice.length);
          const relVol = avgVol20 > 0 ? Math.round((vol / avgVol20) * 100) / 100 : 1;
          const mktCapT = getRealMarketCapT(sym, price);

          const p1W = len > 5 ? Math.round(((price - d.c[len - 5]) / d.c[len - 5]) * 10000) / 100 : chgPct;
          const p1M = len > 22 ? Math.round(((price - d.c[len - 22]) / d.c[len - 22]) * 10000) / 100 : 0;
          const p1Y = len > 240 ? Math.round(((price - d.c[len - 240]) / d.c[len - 240]) * 10000) / 100 : 0;

          results.push({
            symbol: sym,
            name: info.name,
            sector,
            exchange: info.exchange,
            price: price * 1000,
            changePct: chgPct,
            volume: vol,
            relVol,
            mktCapT,
            pe: null,
            epsDilTTM: null,
            epsGrowthYoY: null,
            divYieldPct: null,
            analystRating: 'No rating',
            rsRating,
            score,
            isStage2,
            isStage2Eligible: isStage2,
            criteriaPassed: score,
            sma50: Math.round(sma50 * 100) / 100,
            sma150: Math.round(sma150 * 100) / 100,
            sma200: Math.round(sma200 * 100) / 100,
            distHigh: Math.round(distHigh * 10) / 10,
            distLow: Math.round(distLow * 10) / 10,
            pctFrom52WHigh: Math.round((100 + distHigh) * 10) / 10,
            pctAbove52WLow: Math.round((100 + distLow) * 10) / 10,
            perf1W: p1W,
            perf1M: p1M,
            perf1Y: p1Y,
            epsDiluted: null,
            epsDilutedGrowthYoY: null,
            dividendYield: null,
          });
        } catch {}
      })
    );

    // Sort by RS Rating descending (Top Leaders first)
    results.sort((a, b) => b.rsRating - a.rsRating);

    // Save or upsert to universe cache and persistent scan file
    let scanMeta: any = null;
    if (results.length > 0) {
      const updatedFile = upsertScanFile(results);
      if (updatedFile) {
        scanMeta = {
          scannedAt: updatedFile.scannedAt,
          scannedAtText: updatedFile.scannedAtText,
          session: updatedFile.session,
          sessionLabel: updatedFile.sessionLabel,
          totalScanned: updatedFile.totalScanned,
          stage2Count: updatedFile.stage2Count,
          leadersCount: updatedFile.leadersCount,
          source: updatedFile.source,
          autoPersisted: true,
        };
      }
    }

    const liveMap = await getLiveSsiTicks();
    const enrichedResults = enrichWithLiveTicks(results, liveMap);

    return NextResponse.json({
      success: true,
      total: enrichedResults.length,
      data: enrichedResults,
      scanMeta: scanMeta ? { ...scanMeta, isLiveRealtime: true } : { isLiveRealtime: true },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
