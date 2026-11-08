import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import stockDatabase from '../../../../../features/market/data/stockDatabase.json';
import { MinerviniScreenerItem } from '../../../../../features/market/types/minervini.types';
import {
  SECTOR_MAPPING,
  SECTOR_LEADER_UNIVERSE,
  getSymbolsBySector,
} from '../../../../../features/market/data/sectorMapping';
import financialsData from '../../../../../features/market/data/financialsDatabase.json';
import {
  analyzeRawStockCandles,
  assignCrossSectionalRsAndEvaluate,
  calcMarketCapT,
  computePercentileRsAgainstUniverse,
  evaluateMinerviniCriteria,
} from '../../../../../features/market/utils/minerviniEvaluator';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALL_MARKET_SYMBOLS = Array.from(
  new Set([
    ...SECTOR_LEADER_UNIVERSE,
    ...(stockDatabase as any[])
      .map((s) => (s.symbol || '').trim().toUpperCase())
      .filter((sym) => /^[A-Z0-9]{3}$/.test(sym)),
  ])
);
const DEFAULT_UNIVERSE = ALL_MARKET_SYMBOLS;

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

function loadExistingScanData(): { meta: any; items: MinerviniScreenerItem[] } {
  const candidates: any[] = [];

  // Tầng 1: Global Memory Cache (giữa các lần gọi Serverless trên Cloud)
  const memPayload = (globalThis as any).__YOURFIN_MINERVINI_SCAN__;
  if (memPayload && Array.isArray(memPayload.data) && memPayload.data.length > 0) {
    candidates.push(memPayload);
  }

  // Tầng 2: /tmp/lastMinerviniScan.json (Writable trên Vercel / Cloud Serverless khi Cron chạy)
  if (fs.existsSync('/tmp/lastMinerviniScan.json')) {
    try {
      const tmpParsed = JSON.parse(fs.readFileSync('/tmp/lastMinerviniScan.json', 'utf8'));
      if (Array.isArray(tmpParsed.data) && tmpParsed.data.length > 0) {
        candidates.push(tmpParsed);
      }
    } catch {}
  }

  // Tầng 3: Bundled lastMinerviniScan.json (Cập nhật tự động bởi GitHub Actions Cron & Local)
  const scanFile = getScanFilePath();
  if (fs.existsSync(scanFile)) {
    try {
      const raw = fs.readFileSync(scanFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.data) && parsed.data.length > 0) {
        candidates.push(parsed);
      }
    } catch {}
  }

  if (candidates.length > 0) {
    // Chọn bản quét mới nhất theo timestamp scannedAt
    candidates.sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0));
    const newest = candidates[0];
    return { meta: newest, items: newest.data };
  }

  return { meta: null, items: [] };
}

// In-memory cache for screener results (60 seconds TTL)
let cachedUniverseData: { timestamp: number; items: MinerviniScreenerItem[]; meta?: any } | null = null;
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
          signal: AbortSignal.timeout(2500),
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
        const price = matched > 0 ? matched : expected > 0 ? expected : ref;
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

/**
 * Cập nhật giá khớp lệnh realtime từ SSI iBoard và tính toán lại chính xác 8/8 tiêu chí Trend Template
 */
function enrichWithLiveTicks(
  items: MinerviniScreenerItem[],
  liveMap: Map<string, LiveTick>,
  finMap: Record<string, any>
): MinerviniScreenerItem[] {
  return items.map((item) => {
    const sym = item.symbol.toUpperCase();
    const live = liveMap.get(sym);
    const fin = finMap[sym];

    const effectivePriceVnd = live && live.price > 0 ? Math.round(live.price) : Math.round(item.price || 0);
    const priceK = effectivePriceVnd / 1000;
    const changePct =
      live && live.price > 0 && live.changePct !== undefined && live.changePct !== null
        ? live.changePct
        : item.changePct;
    const volume = live && live.volume > 0 ? live.volume : item.volume;
    const mktCapT = calcMarketCapT(sym, priceK);

    // Đánh giá lại cả 8 tiêu chí hoàn toàn xác định (deterministic) dựa trên giá thực tế hiện tại
    const evalResult = evaluateMinerviniCriteria({
      priceK,
      sma50: item.sma50,
      sma150: item.sma150,
      sma200: item.sma200,
      sma200SlopeUp:
        item.sma200SlopeUp !== undefined
          ? item.sma200SlopeUp
          : Boolean(item.sma200 && item.sma200Past && item.sma200 > item.sma200Past),
      high52W: item.high52W,
      low52W: item.low52W,
      distHigh: item.distHigh,
      distLow: item.distLow,
      rsRating: item.rsRating,
    });

    return {
      ...item,
      sector: SECTOR_MAPPING[sym] || item.sector || 'Khác',
      price: effectivePriceVnd,
      changePct,
      volume,
      mktCapT,
      pe: item.pe ?? fin?.pe ?? null,
      epsGrowthYoY: item.epsGrowthYoY ?? fin?.earningsGrowthYoY ?? null,
      score: evalResult.score,
      criteriaPassed: evalResult.criteriaPassed,
      isStage2: evalResult.isStage2,
      isStage2Eligible: evalResult.isStage2Eligible,
      distHigh: evalResult.distHigh,
      distLow: evalResult.distLow,
      pctFrom52WHigh: evalResult.pctFrom52WHigh,
      pctAbove52WLow: evalResult.pctAbove52WLow,
      failedCriteria: evalResult.failedCriteria,
    };
  });
}

/**
 * Upsert danh sách cổ phiếu mới quét vào tệp lastMinerviniScan.json
 * và tái chuẩn hóa RS Rating (Percentile 1-99) trên toàn bộ rổ cổ phiếu.
 */
function upsertScanFile(itemsToUpsert: MinerviniScreenerItem[]): {
  fileJson: any;
  mergedItems: MinerviniScreenerItem[];
} | null {
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
      source: '100% REAL DNSE ENTRADE API (730D IBD PERCENTILE)',
      data: [],
    };
    if (fs.existsSync(scanFile)) {
      try {
        fileJson = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
      } catch {}
    }
    const existingList: MinerviniScreenerItem[] = Array.isArray(fileJson.data) ? fileJson.data : [];
    const itemMap = new Map<string, MinerviniScreenerItem>();
    existingList.forEach((it) => {
      const sym = it.symbol.toUpperCase();
      const realMktCap = calcMarketCapT(sym, (it.price || 0) / 1000);
      const avgVol = it.avgVol20 ?? it.volume ?? 0;
      if (avgVol >= 100000 && realMktCap >= 1000) {
        itemMap.set(sym, { ...it, mktCapT: realMktCap });
      }
    });
    itemsToUpsert.forEach((it) => {
      const sym = it.symbol.toUpperCase();
      const realMktCap = calcMarketCapT(sym, (it.price || 0) / 1000);
      if (it.isVnLiquidStandard && (it.avgVol20 ?? 0) >= 100000 && realMktCap >= 1000) {
        itemMap.set(sym, { ...it, mktCapT: realMktCap });
      }
    });

    // Tái chuẩn hóa RS Percentile 1-99 trên toàn bộ rổ sau khi merge
    const mergedItems = assignCrossSectionalRsAndEvaluate(Array.from(itemMap.values()));

    fileJson.data = mergedItems;
    fileJson.totalScanned = mergedItems.length;
    fileJson.stage2Count = mergedItems.filter((s) => s.isStage2).length;
    fileJson.nearStage2Count = mergedItems.filter((s) => s.score === 7).length;
    fileJson.leadersCount = mergedItems.filter((s) => s.rsRating >= 90).length;
    fileJson.scannedAt = Date.now();
    fileJson.scannedAtText = vnTime;
    fileJson.source = '100% REAL DNSE ENTRADE API (730D IBD PERCENTILE)';

    (globalThis as any).__YOURFIN_MINERVINI_SCAN__ = fileJson;
    try {
      fs.writeFileSync('/tmp/lastMinerviniScan.json', JSON.stringify(fileJson), 'utf8');
    } catch {}
    try {
      fs.writeFileSync(scanFile, JSON.stringify(fileJson, null, 2), 'utf8');
    } catch {}

    cachedUniverseData = { timestamp: Date.now(), items: mergedItems, meta: fileJson };
    return { fileJson, mergedItems };
  } catch (err: any) {
    console.error('Lỗi upsert scan file:', err.message);
    return null;
  }
}

function applyScreenerFilters(
  items: MinerviniScreenerItem[],
  params: {
    sectorFilter: string;
    onlyStage2: boolean;
    minScore: number;
    minRS: number;
    minVol: number;
    minMktCapT: number;
  }
): MinerviniScreenerItem[] {
  const { sectorFilter, onlyStage2, minScore, minRS, minVol, minMktCapT } = params;
  return items.filter((item) => {
    if (sectorFilter !== 'all' && !(item.sector || '').toLowerCase().includes(sectorFilter)) {
      return false;
    }
    if (onlyStage2 && !item.isStage2) return false;
    if (minScore > 0 && (item.criteriaPassed ?? item.score ?? 0) < minScore) return false;
    if (item.rsRating < minRS) return false;
    if (minVol > 0 && item.volume < minVol) return false;
    if (minMktCapT > 0 && item.mktCapT < minMktCapT) return false;
    return true;
  });
}

/**
 * GET /api/market/minervini/screener?minMktCap=0&minVol=0&minRS=1&sector=all&stage2=false&minScore=0
 * Returns stocks dynamically filtered by Mark Minervini Trend Template & IBD RS Percentile
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minMktCapT = parseFloat(searchParams.get('minMktCap') || '0');
  const minVol = parseInt(searchParams.get('minVol') || '0', 10);
  const minRS = parseInt(searchParams.get('minRS') || '1', 10);
  const minScore = parseInt(searchParams.get('minScore') || '0', 10);
  const sectorFilter = (searchParams.get('sector') || 'all').toLowerCase().trim();
  const onlyStage2 = searchParams.get('stage2') === 'true';
  const customSymbolsParam = searchParams.get('symbols');
  const forceRefresh = searchParams.get('refresh') === 'true';

  const finMap = (financialsData as any)?.data || {};

  try {
    // Fast-path 1: Load from in-memory cache or persistent scan file when not forcing refresh
    if (!forceRefresh && !customSymbolsParam) {
      let universeItems: MinerviniScreenerItem[] = [];
      let metaObj: any = null;

      if (cachedUniverseData && Date.now() - cachedUniverseData.timestamp < CACHE_TTL_MS) {
        universeItems = cachedUniverseData.items;
        metaObj = cachedUniverseData.meta;
      } else {
        const loaded = loadExistingScanData();
        if (loaded.items.length > 0) {
          // Đảm bảo dữ liệu có đầy đủ RS Percentile và điểm tiêu chí chuẩn
          const hasRawScores = loaded.items.some((x) => typeof x.rawRsScore === 'number');
          universeItems = hasRawScores
            ? assignCrossSectionalRsAndEvaluate(loaded.items)
            : loaded.items;
          metaObj = loaded.meta;
          cachedUniverseData = { timestamp: Date.now(), items: universeItems, meta: metaObj };
        }
      }

      if (universeItems.length > 0) {
        const liveMap = await getLiveSsiTicks();
        const enrichedAll = enrichWithLiveTicks(universeItems, liveMap, finMap);
        const stage2Total = enrichedAll.filter((s) => s.isStage2).length;
        const nearStage2Total = enrichedAll.filter((s) => s.score === 7).length;
        const leadersTotal = enrichedAll.filter((s) => s.rsRating >= 90).length;

        const filtered = applyScreenerFilters(enrichedAll, {
          sectorFilter,
          onlyStage2,
          minScore,
          minRS,
          minVol,
          minMktCapT,
        }).sort((a, b) => b.rsRating - a.rsRating || b.score - a.score);

        return NextResponse.json({
          success: true,
          total: filtered.length,
          data: filtered,
          scanMeta: {
            scannedAt: metaObj?.scannedAt || Date.now(),
            scannedAtText: metaObj?.scannedAtText || '',
            session: metaObj?.session || 'AFTERNOON',
            sessionLabel: metaObj?.sessionLabel || 'Phiên Sáng (11:30) & Chiều (15:00)',
            totalScanned: enrichedAll.length,
            stage2Count: stage2Total,
            nearStage2Count: nearStage2Total,
            leadersCount: leadersTotal,
            source: metaObj?.source || '100% REAL DNSE ENTRADE API (730D IBD PERCENTILE)',
            isLiveRealtime: true,
          },
        });
      }
    }

    // Active Live Scan Path (forceRefresh === true OR customSymbolsParam OR empty cache)
    const symbolsToScan = customSymbolsParam
      ? Array.from(
          new Set(
            customSymbolsParam
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          )
        )
      : sectorFilter !== 'all'
      ? (() => {
          const sectorMatches = getSymbolsBySector(sectorFilter);
          return sectorMatches.length > 0 ? sectorMatches.slice(0, 80) : DEFAULT_UNIVERSE;
        })()
      : DEFAULT_UNIVERSE;

    const dbMap = new Map<string, any>();
    (stockDatabase as any[]).forEach((s) => dbMap.set(s.symbol.toUpperCase(), s));

    const nowSec = Math.floor(Date.now() / 1000);
    // Bắt buộc lấy đủ 730 ngày (2 năm = ~500 phiên giao dịch) để tính chính xác MA200 + độ dốc MA200 + 52W High/Low
    const fromSec = nowSec - 730 * 24 * 3600;
    const activeCutoffSec = nowSec - 45 * 24 * 3600;
    const rawScannedItems: MinerviniScreenerItem[] = [];

    // Quét theo từng batch 60 mã song song để quét toàn bộ 1.524 mã trong ~5 giây
    const batchSize = 60;
    for (let i = 0; i < symbolsToScan.length; i += batchSize) {
      const batch = symbolsToScan.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (sym) => {
          try {
            const info = dbMap.get(sym) || { name: `Công ty CP ${sym}`, exchange: 'HOSE' };
            const sector = SECTOR_MAPPING[sym] || info.sector || 'Khác';
            const fin = finMap[sym];

            const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
              sym
            )}&resolution=1D`;

            const res = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
              cache: 'no-store',
              signal: AbortSignal.timeout(6000),
            });

            if (!res.ok) return;
            const d = await res.json();
            if (!d.c || d.c.length < 50) return;
            if (!customSymbolsParam && Array.isArray(d.t) && d.t[d.c.length - 1] && d.t[d.c.length - 1] < activeCutoffSec) {
              return;
            }

            const item = analyzeRawStockCandles({
              symbol: sym,
              name: info.name,
              sector,
              exchange: info.exchange || 'HOSE',
              closes: d.c,
              highs: d.h,
              lows: d.l,
              volumes: d.v,
              pe: fin?.pe ?? null,
              epsGrowthYoY: fin?.earningsGrowthYoY ?? null,
            });

            if (item) {
              // Khi quét toàn thị trường, bắt buộc KL TB 20N & 10N >= 100.000 CP đều nhiều phiên VÀ Vốn hóa thực tế >= 1.000 Tỷ VNĐ
              // Loại bỏ triệt để các mã thanh khoản kém/vốn hóa nhỏ dễ bị thao túng (như SPV, HDA, HIO, CTP) dù RS có 99
              if (customSymbolsParam || item.isVnLiquidStandard) {
                rawScannedItems.push(item);
              }
            }
          } catch {}
        })
      );
    }

    // Lưu & tái xếp hạng RS Percentile 1-99 trên toàn bộ rổ thị trường
    let scanMeta: any = null;
    let finalItems: MinerviniScreenerItem[] = [];

    if (rawScannedItems.length > 0) {
      const upserted = upsertScanFile(rawScannedItems);
      if (upserted) {
        const { fileJson, mergedItems } = upserted;
        scanMeta = {
          scannedAt: fileJson.scannedAt,
          scannedAtText: fileJson.scannedAtText,
          session: fileJson.session,
          sessionLabel: fileJson.sessionLabel,
          totalScanned: fileJson.totalScanned,
          stage2Count: fileJson.stage2Count,
          nearStage2Count: fileJson.nearStage2Count,
          leadersCount: fileJson.leadersCount,
          source: fileJson.source,
          autoPersisted: true,
        };

        if (customSymbolsParam) {
          const requestedSet = new Set(symbolsToScan);
          const inMerged = mergedItems.filter((it) => requestedSet.has(it.symbol.toUpperCase()));
          const universeScores = mergedItems
            .map((x) => x.rawRsScore)
            .filter((v): v is number => typeof v === 'number');
          const unpersistedCustom = rawScannedItems
            .filter((it) => !inMerged.some((m) => m.symbol.toUpperCase() === it.symbol.toUpperCase()))
            .map((it) => {
              const { rsRating, rank, total } = computePercentileRsAgainstUniverse(
                it.rawRsScore ?? 0,
                universeScores
              );
              const evalRes = evaluateMinerviniCriteria({
                priceK: it.price / 1000,
                sma50: it.sma50,
                sma150: it.sma150,
                sma200: it.sma200,
                sma200SlopeUp: it.sma200SlopeUp,
                high52W: it.high52W,
                low52W: it.low52W,
                distHigh: it.distHigh,
                distLow: it.distLow,
                rsRating,
              });
              return {
                ...it,
                rsRating,
                rsRank: rank,
                rsUniverseTotal: total,
                score: evalRes.score,
                criteriaPassed: evalRes.criteriaPassed,
                isStage2: evalRes.isStage2,
                isStage2Eligible: evalRes.isStage2Eligible,
                failedCriteria: evalRes.failedCriteria,
              };
            });
          finalItems = [...inMerged, ...unpersistedCustom];
        } else {
          finalItems = mergedItems;
        }
      } else {
        // Fallback nếu không ghi được file (ví dụ môi trường read-only serverless)
        const existing = loadExistingScanData().items;
        const universeScores = existing
          .map((x) => x.rawRsScore)
          .filter((v): v is number => typeof v === 'number');

        if (customSymbolsParam && universeScores.length > 0) {
          finalItems = rawScannedItems.map((it) => {
            const { rsRating, rank, total } = computePercentileRsAgainstUniverse(
              it.rawRsScore ?? 0,
              universeScores
            );
            const evalRes = evaluateMinerviniCriteria({
              priceK: it.price / 1000,
              sma50: it.sma50,
              sma150: it.sma150,
              sma200: it.sma200,
              sma200SlopeUp: it.sma200SlopeUp,
              high52W: it.high52W,
              low52W: it.low52W,
              distHigh: it.distHigh,
              distLow: it.distLow,
              rsRating,
            });
            return {
              ...it,
              rsRating,
              rsRank: rank,
              rsUniverseTotal: total,
              score: evalRes.score,
              criteriaPassed: evalRes.criteriaPassed,
              isStage2: evalRes.isStage2,
              isStage2Eligible: evalRes.isStage2Eligible,
              failedCriteria: evalRes.failedCriteria,
            };
          });
        } else {
          finalItems = assignCrossSectionalRsAndEvaluate(rawScannedItems);
        }
      }
    }

    const liveMap = await getLiveSsiTicks();
    const enrichedResults = enrichWithLiveTicks(finalItems, liveMap, finMap);

    const filteredResults = customSymbolsParam
      ? enrichedResults
      : applyScreenerFilters(enrichedResults, {
          sectorFilter,
          onlyStage2,
          minScore,
          minRS,
          minVol,
          minMktCapT,
        });

    filteredResults.sort((a, b) => b.rsRating - a.rsRating || b.score - a.score);

    return NextResponse.json({
      success: true,
      total: filteredResults.length,
      data: filteredResults,
      scanMeta: scanMeta ? { ...scanMeta, isLiveRealtime: true } : { isLiveRealtime: true },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
