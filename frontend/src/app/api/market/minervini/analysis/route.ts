import { NextResponse } from 'next/server';
import { EXIT_RULE_TEXT, exitStopPrice } from '../../../../../features/market/utils/exitPlan';
import { analyzeWyckoff } from '../../../../../features/market/utils/wyckoffEngine';
import { classifyStage, STAGE_NAME_VI, STAGE_NAME_CONFIRMED_VI } from '../../../../../features/market/utils/stageEngine';
import { detectDistribution, buildCycleContext } from '../../../../../features/market/utils/wyckoffContext';
import { buildDecision } from '../../../../../features/market/utils/decisionEngine';
import { lookupEvidence } from '../../../../../features/market/utils/decisionEvidence';
import { assessFundamentals, type QuarterRec, type FundamentalsResult } from '../../../../../features/market/utils/fundamentalsEngine';
import { MARKET_STATE_EVIDENCE, MarketStateKey } from '../../../../../features/market/utils/marketState';
import { getSectorStrengthTable } from '../../../../../features/market/utils/sectorStrengthServer';
import { SECTOR_MAPPING } from '../../../../../features/market/data/sectorMapping';
import { readFinancialsDatabase, fetchStockValuationLive } from '../../../../../features/market/services/financialsSyncService';
import fs from 'fs';
import path from 'path';
import stockDatabase from '../../../../../features/market/data/stockDatabase.json';
import {
  MinerviniAnalysisResult,
  MinerviniCriterion,
  MinerviniStrategySignal,
  AIRecommendation,
  HeatAnalysis,
  CapitalAllocationPlan,
  CapitalTranche,
  HeatCriterion,
  BottomFishingAdvice,
} from '../../../../../features/market/types/minervini.types';

import { isMarketIndex, getMarketIndexMeta, VN_MARKET_INDEXES } from '../../../../../features/market/constants/marketIndexes';
import { getLiveRRGDataset, findMatchingRRGSector } from '@/features/market/services/rrgDataService';
import {
  calcRawIbdRs,
  calcStrictSMA,
  computePercentileRsAgainstUniverse,
} from '../../../../../features/market/utils/minerviniEvaluator';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STOCK_MAP = new Map<string, { name: string; exchange: string; sector: string }>();
(stockDatabase as any[]).forEach((item) => {
  STOCK_MAP.set(item.symbol.toUpperCase(), {
    name: item.name,
    exchange: item.exchange,
    sector: item.sector || 'Chung',
  });
});
VN_MARKET_INDEXES.forEach((idx) => {
  STOCK_MAP.set(idx.symbol.toUpperCase(), {
    name: idx.name,
    exchange: idx.exchange,
    sector: idx.sector,
  });
});

/**
 * GET /api/market/minervini/analysis?symbol=PVP
 * Computes Mark Minervini Trend Template (8/8 Criteria) & RS Rating
 * Primary data sourced from DNSE Entrade API.
 */
// Sức khỏe doanh nghiệp: ưu tiên bản chụp trong cơ sở dữ liệu, thiếu thì gọi trực tiếp Vietcap IQ (có giới hạn thời gian); cache để không gọi lặp
const fundamentalsCache = new Map<string, { ts: number; value: FundamentalsResult }>();
async function getFundamentals(symbol: string): Promise<FundamentalsResult> {
  const hit = fundamentalsCache.get(symbol);
  const ttl = hit?.value.state === 'NO_DATA' ? 30 * 60 * 1000 : 6 * 3600 * 1000;
  if (hit && Date.now() - hit.ts < ttl) return hit.value;
  let quarters: QuarterRec[] | undefined;
  try {
    quarters = readFinancialsDatabase()?.data?.[symbol]?.quarterlyHistory;
    if (!quarters || quarters.length < 5) {
      const live = await Promise.race([
        fetchStockValuationLive(symbol),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      quarters = live?.quarterlyHistory;
    }
  } catch {
    quarters = undefined;
  }
  const value = assessFundamentals(quarters);
  fundamentalsCache.set(symbol, { ts: Date.now(), value });
  return value;
}

// Chế độ thị trường (VN-Index trên cả MA50 & MA200) — cache 5 phút để không gọi DNSE cho mỗi mã
let marketRegimeCache: { ts: number; up: boolean | null } | null = null;
async function getMarketUp(): Promise<boolean | null> {
  const now = Date.now();
  if (marketRegimeCache && now - marketRegimeCache.ts < 5 * 60 * 1000) return marketRegimeCache.up;
  try {
    const to = Math.floor(now / 1000);
    const from = to - 500 * 24 * 3600;
    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${from}&to=${to}&symbol=VNINDEX&resolution=1D`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', Accept: 'application/json' }, cache: 'no-store' }
    );
    const j = await res.json();
    const c: number[] = j?.c || [];
    if (c.length < 200) throw new Error('not enough index candles');
    const avg = (n: number) => c.slice(-n).reduce((a, b) => a + b, 0) / n;
    const up = c[c.length - 1] > avg(50) && c[c.length - 1] > avg(200);
    marketRegimeCache = { ts: now, up };
    return up;
  } catch {
    marketRegimeCache = { ts: now, up: null };
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'PVP').toUpperCase().trim();
  const livePriceParam = parseFloat(searchParams.get('livePrice') || '0');
  const liveVolParam = parseInt(searchParams.get('liveVol') || '0', 10);

  const isIndex = isMarketIndex(symbol);
  const indexMeta = getMarketIndexMeta(symbol);
  const stockInfo = indexMeta || STOCK_MAP.get(symbol) || {
    name: isIndex ? `Chỉ số ${symbol}` : `Công ty CP ${symbol}`,
    exchange: isIndex ? (symbol.includes('HNX') ? 'HNX' : symbol === 'UPCOM' ? 'UPCOM' : 'HOSE') : 'HOSE',
    sector: isIndex ? 'Chỉ số thị trường' : 'Chung',
  };

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    // Fetch 2 years of daily OHLC candles from DNSE (no-store for realtime accuracy)
    const fromSec = nowSec - 730 * 24 * 3600;
    const endpointType = isIndex ? 'index' : 'stock';
    const dnseUrl = `https://services.entrade.com.vn/chart-api/v2/ohlcs/${endpointType}?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(
      symbol
    )}&resolution=1D`;

    const res = await fetch(dnseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`DNSE status ${res.status}`);
    }

    const data = await res.json();
    if (!data.t || !Array.isArray(data.t) || data.t.length < 50) {
      return NextResponse.json({
        success: false,
        symbol,
        message: 'Dữ liệu nến không đủ để phân tích Minervini (yêu cầu tối thiểu 50 phiên)',
      });
    }

    const count = data.t.length;
    const closes: number[] = [...data.c];
    const highs: number[] = [...data.h];
    const lows: number[] = [...data.l];
    const volumes: number[] = [...data.v];

    // Đồng bộ giá & khối lượng khớp lệnh Realtime (nếu truyền từ WebSocket tick trên Frontend)
    if (livePriceParam > 0) {
      const normalizedLivePrice =
        !isIndex && closes[count - 1] < 500 && livePriceParam >= 1000
          ? Math.round((livePriceParam / 1000) * 100) / 100
          : livePriceParam;
      closes[count - 1] = normalizedLivePrice;
      if (normalizedLivePrice > highs[count - 1]) highs[count - 1] = normalizedLivePrice;
      if (normalizedLivePrice < lows[count - 1]) lows[count - 1] = normalizedLivePrice;
    }
    if (liveVolParam > 0 && liveVolParam > (volumes[count - 1] || 0)) {
      volumes[count - 1] = liveVolParam;
    }

    const currentPrice = closes[count - 1];
    const prevPrice = count > 1 ? closes[count - 2] : currentPrice;
    const currentChange = currentPrice - prevPrice;
    const currentChangePct = prevPrice > 0 ? (currentChange / prevPrice) * 100 : 0;
    const currentVol = volumes[count - 1] || 0;

    // Moving Averages: SMA50, SMA150, SMA200 (Strict period requirement)
    const rawSma20 = count >= 20 ? calcStrictSMA(closes, 20, count - 1) : 0;
    const rawSma50 = count >= 50 ? calcStrictSMA(closes, 50, count - 1) : 0;
    const rawSma150 = count >= 150 ? calcStrictSMA(closes, 150, count - 1) : 0;
    const rawSma200 = count >= 200 ? calcStrictSMA(closes, 200, count - 1) : 0;

    const sma20 = Math.round(rawSma20 * 100) / 100;
    const sma50 = Math.round(rawSma50 * 100) / 100;
    const sma150 = Math.round(rawSma150 * 100) / 100;
    const sma200 = Math.round(rawSma200 * 100) / 100;

    const distFromSMA20Pct = sma20 > 0 ? Math.round(((currentPrice - sma20) / sma20) * 1000) / 10 : 0;
    const distFromSMA50Pct = sma50 > 0 ? Math.round(((currentPrice - sma50) / sma50) * 1000) / 10 : 0;

    // SMA200 22-sessions ago (1 month slope check) & 11-sessions ago (2 weeks check)
    const hasEnoughDataForSMA200Slope = count >= 222 && rawSma200 > 0;
    const rawSma200Past = hasEnoughDataForSMA200Slope ? calcStrictSMA(closes, 200, count - 1 - 22) : 0;
    const rawSma200Mid = count >= 211 && rawSma200 > 0 ? calcStrictSMA(closes, 200, count - 1 - 11) : 0;
    const sma200Past = Math.round(rawSma200Past * 100) / 100;
    const sma200SlopeUp =
      hasEnoughDataForSMA200Slope &&
      rawSma200Past > 0 &&
      rawSma200 > rawSma200Past &&
      (rawSma200Mid === 0 || rawSma200 >= rawSma200Mid * 0.999);

    // 52-week High and Low (last 252 trading sessions)
    const lookback52W = Math.min(252, count);
    const high52W = Math.round(Math.max(...highs.slice(count - lookback52W)) * 100) / 100;
    const low52W = Math.round(Math.min(...lows.slice(count - lookback52W)) * 100) / 100;

    const distFrom52WHighPct = high52W > 0 ? Math.round(((currentPrice - high52W) / high52W) * 1000) / 10 : 0;
    const distFrom52WLowPct = low52W > 0 ? Math.round(((currentPrice - low52W) / low52W) * 1000) / 10 : 0;

    // RS Rating Calculation (IBD / Minervini formula: 40% Q1 + 20% Q2 + 20% Q3 + 20% Q4)
    const { rawRsScore } = calcRawIbdRs(closes);

    let rsRating = Math.min(99, Math.max(1, Math.round(55 + rawRsScore * 90)));
    let rsRank: number | undefined;
    let rsUniverseTotal: number | undefined;

    // 1. First priority: Rank directly against the full 206+ stock universe in lastMinerviniScan.json
    const scanPaths = [
      path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
      path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
    ];
    let resolvedFromScan = false;
    for (const p of scanPaths) {
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(parsed.data) && parsed.data.length > 0) {
            const matched = parsed.data.find((it: any) => it.symbol?.toUpperCase() === symbol);
            if (matched && typeof matched.rsRating === 'number' && typeof matched.rsRank === 'number') {
              rsRating = matched.rsRating;
              rsRank = matched.rsRank;
              rsUniverseTotal = matched.rsUniverseTotal || parsed.data.length;
              resolvedFromScan = true;
              break;
            }
            const universeScores = parsed.data
              .map((it: any) => it.rawRsScore)
              .filter((v: any): v is number => typeof v === 'number');
            if (universeScores.length > 0) {
              const pctRes = computePercentileRsAgainstUniverse(rawRsScore, universeScores);
              rsRating = pctRes.rsRating;
              rsRank = pctRes.rank;
              rsUniverseTotal = pctRes.total;
              resolvedFromScan = true;
              break;
            }
          }
        } catch {}
      }
    }

    // 2. Fallback: Fetch True Percentile RS Rating from Spring Boot Backend Service
    if (!resolvedFromScan) {
      try {
        const backendRsRes = await fetch(`http://localhost:8080/api/market/rs-rating/${symbol}`, {
          signal: AbortSignal.timeout(1500),
          next: { revalidate: 300 },
        });
        if (backendRsRes.ok) {
          const rsJson = await backendRsRes.json();
          if (rsJson.success && rsJson.data?.rsRating) {
            rsRating = rsJson.data.rsRating;
            rsRank = rsJson.data.rank;
            rsUniverseTotal = rsJson.data.totalStocks;
          }
        }
      } catch {
        // Backend offline -> use formula-based fallback
      }
    }

    // Evaluate 8 Minervini Trend Template Criteria matching exact VN TERMINAL Pro format
    // Giá tính theo nghìn đồng. Luôn cố định số lẻ để cột số trong panel thẳng hàng (9.80 / 10.70 / 11.00)
    const formatK = (val: number) => {
      const k = val > 1000 ? val / 1000 : val;
      return k >= 100 ? k.toFixed(1) : k.toFixed(2);
    };

    const criteria: MinerviniCriterion[] = [
      {
        id: 1,
        label: 'Giá > MA150 và > MA200',
        description: 'Giá cổ phiếu phải nằm trên cả đường MA 150 ngày và MA 200 ngày',
        passed: sma150 > 0 && sma200 > 0 && currentPrice > sma150 && currentPrice > sma200,
        value: sma150 > 0 && sma200 > 0
          ? `${currentPrice} > MA150(${sma150}) & MA200(${sma200})`
          : 'Chưa đủ dữ liệu nến (cần ≥ 200 phiên)',
        comparisonValue: sma150 > 0 && sma200 > 0 ? `${formatK(currentPrice)} / ${formatK(sma150)} / ${formatK(sma200)}` : 'N/A',
      },
      {
        id: 2,
        label: 'MA150 > MA200',
        description: 'Đường MA 150 ngày phải nằm trên đường MA 200 ngày',
        passed: sma150 > 0 && sma200 > 0 && sma150 > sma200,
        value: sma150 > 0 && sma200 > 0
          ? `MA150(${sma150}) ${sma150 > sma200 ? '>' : '<='} MA200(${sma200})`
          : 'Chưa đủ dữ liệu nến (cần ≥ 200 phiên)',
        comparisonValue: sma150 > 0 && sma200 > 0 ? `${formatK(sma150)} > ${formatK(sma200)}` : 'N/A',
      },
      {
        id: 3,
        label: 'MA200 dốc lên (≥1 tháng)',
        description: 'Đường MA 200 ngày đang trong xu hướng dốc lên tối thiểu 22 phiên',
        passed: sma200SlopeUp,
        value: !hasEnoughDataForSMA200Slope
          ? 'Chưa đủ dữ liệu (cần ≥ 222 phiên)'
          : sma200SlopeUp
          ? 'Đang dốc lên (+)'
          : 'Đi ngang hoặc dốc xuống (-)',
        comparisonValue: hasEnoughDataForSMA200Slope ? `${formatK(sma200)} vs ${formatK(sma200Past)}` : 'N/A',
      },
      {
        id: 4,
        label: 'MA50 > MA150 & MA200',
        description: 'Đường MA 50 ngày phải nằm trên cả đường MA 150 ngày và MA 200 ngày',
        passed: sma50 > 0 && sma150 > 0 && sma200 > 0 && sma50 > sma150 && sma50 > sma200,
        value: sma50 > 0 && sma150 > 0 && sma200 > 0
          ? `MA50(${sma50}) vs MA150(${sma150}) & MA200(${sma200})`
          : 'Chưa đủ dữ liệu nến (cần ≥ 200 phiên)',
        comparisonValue: sma50 > 0 && sma150 > 0 && sma200 > 0 ? `${formatK(sma50)} / ${formatK(sma150)} / ${formatK(sma200)}` : 'N/A',
      },
      {
        id: 5,
        label: 'Giá > MA50',
        description: 'Giá cổ phiếu hiện tại nằm trên đường trung bình MA 50 ngày',
        passed: sma50 > 0 && currentPrice > sma50,
        value: `${currentPrice} ${sma50 > 0 && currentPrice > sma50 ? '>' : '<='} MA50(${sma50})`,
        comparisonValue: sma50 > 0 ? `${formatK(currentPrice)} / ${formatK(sma50)}` : 'N/A',
      },
      {
        id: 6,
        label: 'Giá ≥ 30% trên đáy 52 tuần',
        description: 'Giá hiện tại cao hơn tối thiểu 30% so với mức đáy 52 tuần',
        passed: distFrom52WLowPct >= 30,
        value: `+${distFrom52WLowPct}% so với đáy 52T (${low52W})`,
        comparisonValue: `${distFrom52WLowPct > 0 ? '+' : ''}${distFrom52WLowPct}%`,
      },
      {
        id: 7,
        label: 'Giá trong 25% dưới đỉnh 52 tuần',
        description: 'Giá hiện tại không được cách xa quá 25% so với mức đỉnh 52 tuần',
        passed: distFrom52WHighPct >= -25,
        value: `${distFrom52WHighPct}% so với đỉnh 52T (${high52W})`,
        comparisonValue: `${distFrom52WHighPct}%`,
      },
      {
        id: 8,
        label: 'Sức mạnh giá RS Rating (≥ 70)',
        description: 'Điểm sức mạnh giá tương đối theo trọng số IBD Minervini đạt tối thiểu 70 điểm',
        passed: rsRating >= 70,
        value: rsRank && rsUniverseTotal
          ? `RS Rating: ${rsRating}/99 điểm (Top ${rsRank}/${rsUniverseTotal} thị trường)`
          : `RS Rating: ${rsRating}/99 điểm`,
        comparisonValue: `${rsRating}`,
      },
    ];

    const passedCount = criteria.filter((c) => c.passed).length;
    const isStage2Eligible = passedCount === 8;

    // Stage 1→4 theo thứ tự chu kỳ (Weinstein / Minervini) — logic trong utils/stageEngine.ts, đã kiểm chứng trên lịch sử.
    // Stage KHÔNG còn suy từ số tiêu chí đạt: nó dựa vào MA150 (độ dốc + xu hướng trước đó) và vị trí của giá.
    const stageResult = classifyStage({ closes, highs, lows, passedCount });
    const stage: 1 | 2 | 3 | 4 = stageResult.stage;
    const stageName = stage === 2 && passedCount === 8 ? STAGE_NAME_CONFIRMED_VI : STAGE_NAME_VI[stage];

    // Zero Mock Data: Không bịa đặt số liệu thống kê winRate hay profitPct giả
    const signals: MinerviniStrategySignal[] = [];

    // Dynamic Sector Rank & RS directly synchronized with Live RRG Engine (1W Weekly Frame - JdK Standard)
    const rrgDataset = await getLiveRRGDataset('1W', 4, 'VNINDEX');
    const rrgSectorInfo = findMatchingRRGSector(symbol, stockInfo.sector, rrgDataset);

    // Sức mạnh ngành: xếp hạng 20 ngành ICB theo trung vị lợi suất 3 tháng của MỌI mã đủ thanh khoản trong ngành
    // (utils/sectorStrength.ts). Pha luân chuyển RRG (sectorStatus) là thước đo khác — ngắn hạn, 16 nhóm đại diện.
    const icbSector = SECTOR_MAPPING[symbol] || stockInfo.sector || '';
    const sectorStrength = isIndex ? undefined : getSectorStrengthTable().find((s) => s.sector === icbSector);
    const matchedSectorName = sectorStrength?.sector || rrgSectorInfo?.sectorName || stockInfo.sector || 'Chung';
    const sectorRank = sectorStrength?.rank ? `Top ${sectorStrength.rank} / ${sectorStrength.total} ngành` : undefined;
    const sectorRS =
      sectorStrength?.rank && sectorStrength.total > 1
        ? Math.round(99 - ((sectorStrength.rank - 1) / (sectorStrength.total - 1)) * 98)
        : undefined;
    // Pha RRG chỉ giữ khi mã THỰC SỰ nằm trong nhóm đại diện của RRG; nhóm đoán qua tên ngành dễ lệch
    // (vd. dệt may bị ghép vào "Thực phẩm & Đồ uống") nên không hiển thị.
    const rrgGroupHasSymbol = Boolean(
      rrgSectorInfo && rrgDataset?.sectors.some((s) => s.id === rrgSectorInfo.sectorId && s.symbols.includes(symbol))
    );
    const sectorStatus = rrgGroupHasSymbol ? rrgSectorInfo?.sectorStatus : undefined;

    // Wyckoff & VSA (Volume Spread Analysis) — logic nằm trong utils/wyckoffEngine.ts (module thuần, kiểm thử được)
    const opens: number[] = Array.isArray(data.o) && data.o.length === count ? data.o : closes;
    const wy = analyzeWyckoff({
      opens,
      highs,
      lows,
      closes,
      volumes,
      isIndex,
      sma20,
      sma50,
      sma150,
      sma200,
      distFrom52WHighPct,
    });
    const { wyckoffCriteria, wyckoffPassedCount, wyckoffPhase, phaseIndex, wyckoffPhaseName, buyPointCode, buyPointLabel, buyPointDetail, wyckoffBuyZone, wyckoffStopLoss, completedPhases, nextMilestone, phaseProgressPct } = wy;
    let { actionAdvice, isBuyPhase } = wy;

    // ── BỐI CẢNH & QUYẾT ĐỊNH HỢP NHẤT (Stage × Wyckoff) ──
    // Máy Wyckoff chỉ biết các pha tích lũy trong 40 phiên gần nhất; ở đây đặt nó vào bối cảnh Stage (và nhận diện phân phối)
    // rồi hợp nhất với Trend Template thành MỘT quyết định, xem utils/decisionEngine.ts để biết quy tắc ưu tiên khi hai khung lệch nhau.
    const dist = detectDistribution({ opens, highs, lows, closes, volumes });
    const cycleContext = buildCycleContext({ stage: stageResult, wy, dist });
    // ── Trạng thái thị trường (MA200 · độ rộng · biến động) — cổng tỷ trọng mua, đã kiểm chứng (utils/marketState.ts) ──
    // Một cổng duy nhất: Bất lợi → không mở vị thế mới; Thuận lợi/Trung tính → mua theo điểm mua.
    let marketState: { state: MarketStateKey; date: string; provisional: boolean; buySize: number } | null = null;
    try {
      const ms = await fetch(`${new URL(request.url).origin}/api/market/state`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) }).then((r) => r.json());
      const cur = ms?.data?.current;
      if (ms?.success && cur?.state) {
        marketState = { state: cur.state, date: cur.date, provisional: Boolean(cur.provisional), buySize: MARKET_STATE_EVIDENCE[cur.state as MarketStateKey].buySize };
      }
    } catch {
      // không có trạng thái thì không gắn cờ
    }
    // Nguồn trạng thái lỗi thì dùng tạm quy tắc đơn giản: VN-Index dưới MA50/MA200 coi như bất lợi
    const marketUp = isIndex ? null : marketState ? marketState.state !== 'UNFAVORABLE' : await getMarketUp();
    const decision = buildDecision({
      stage: stageResult,
      ttPassed: passedCount,
      ttFailedIds: criteria.filter((c) => !c.passed).map((c) => c.id),
      ctx: cycleContext,
      rsRating,
      price: currentPrice,
      ma20: sma20,
      ma50: sma50,
      ma150: sma150,
      ma200: sma200,
      pivot: wy.diagnostics.last20High,
      baseLow: wy.diagnostics.priorBaseLow,
      distFromSMA20Pct: wy.diagnostics.posInBasePct,
      marketUp,
    });

    // Điểm mua của Wyckoff chỉ được coi là LỆNH MUA khi quyết định hợp nhất cho phép mua (Stage 2 đủ 8/8 + Wyckoff đúng thời điểm).
    // Giữ nguyên chẩn đoán pha & nhãn tín hiệu để người dùng vẫn thấy, nhưng không để hai nơi nói hai điều khác nhau.
    const buyBlocked = isBuyPhase && decision.newBuyer.action !== 'BUY';
    const buyBlockedReason = buyBlocked
      ? decision.headline === 'WAIT_MARKET'
        ? 'Cổ phiếu đạt chuẩn nhưng thị trường đang Bất lợi. Chưa mở vị thế mới.'
        : decision.drivers.stage !== 'OK'
        ? `Chưa đạt Trend Template (${passedCount}/8 · Stage ${stage}). Chỉ theo dõi, chưa giải ngân.`
        : 'Stage 2 đủ chuẩn nhưng Wyckoff chưa tới điểm vào hoặc đang có dấu hiệu phân phối. Chỉ theo dõi, chưa giải ngân.'
      : undefined;
    if (buyBlocked) {
      isBuyPhase = false;
      actionAdvice =
        decision.headline === 'WAIT_MARKET'
          ? 'Chỉ theo dõi — chờ thị trường thoát trạng thái Bất lợi'
          : decision.drivers.stage !== 'OK'
          ? 'Chỉ theo dõi — chờ đủ 8/8 Trend Template (Stage 2) trước khi giải ngân'
          : 'Chỉ theo dõi — chờ Wyckoff xác nhận điểm vào (Phase D/E) và hết dấu hiệu phân phối';
    }
    const decisionEvidence = lookupEvidence(decision.headline, decision.holder.action);

    // ── Yếu tố bổ sung (THÔNG TIN, không đổi quyết định): sức khỏe doanh nghiệp & vị thế ngành ──
    // Kiểm chứng lịch sử CHƯA kết luận được tác động của hai yếu tố này (xem scripts/validate_quality_factors.mjs),
    // nên chỉ hiển thị và cảnh báo, không dùng làm điều kiện mua/bán.
    const fundamentals = isIndex ? null : await getFundamentals(symbol);
    const sectorInfo = {
      name: matchedSectorName,
      rank: sectorStrength?.rank ?? null,
      total: sectorStrength?.rank ? sectorStrength.total : null,
      tone: sectorStrength?.tone ?? ('UNKNOWN' as const),
      status: sectorStatus ?? null,
    };
    const qualityFlags: string[] = [];
    if (decision.newBuyer.action === 'BUY' || decision.drivers.stage === 'OK') {
      if (fundamentals?.state === 'WEAK') qualityFlags.push(fundamentals.lossMaking ? 'FUND_LOSS_MAKING' : 'FUND_PROFIT_FALLING');
      if (sectorInfo.tone === 'HEADWIND') qualityFlags.push('SECTOR_HEADWIND');
    }

    if (marketState?.state === 'UNFAVORABLE' && decision.drivers.stage === 'OK') qualityFlags.unshift('MARKET_UNFAVORABLE');

    // ── Indicators for Heat & Extended Analysis (RSI, MACD) ──
    // 1. RSI(14) - Wilder smoothing (khớp với RSI trên chart)
    const rsiPeriod = 14;
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= rsiPeriod && i < count; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= rsiPeriod;
    avgLoss /= rsiPeriod;
    for (let i = rsiPeriod + 1; i < count; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (rsiPeriod - 1) + (diff > 0 ? diff : 0)) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + (diff < 0 ? -diff : 0)) / rsiPeriod;
    }
    const rsVal = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi14 = Number((100 - (100 / (1 + rsVal))).toFixed(1));

    // 2. MACD (12, 26, 9)
    let ema12 = closes[0];
    let ema26 = closes[0];
    const k12 = 2 / (12 + 1);
    const k26 = 2 / (26 + 1);
    const k9 = 2 / (9 + 1);
    const macdLineSeries: number[] = [];
    for (let i = 0; i < count; i++) {
      ema12 = i === 0 ? closes[0] : closes[i] * k12 + ema12 * (1 - k12);
      ema26 = i === 0 ? closes[0] : closes[i] * k26 + ema26 * (1 - k26);
      macdLineSeries.push(ema12 - ema26);
    }
    let signalEMA = macdLineSeries[0];
    for (let i = 0; i < count; i++) {
      signalEMA = i === 0 ? macdLineSeries[0] : macdLineSeries[i] * k9 + signalEMA * (1 - k9);
    }
    const macdValue = Number(macdLineSeries[count - 1].toFixed(2));
    const macdSignalValue = Number(signalEMA.toFixed(2));
    const macdHist = Number((macdValue - macdSignalValue).toFixed(2));
    const macdStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      macdHist >= 0.05 ? 'BULLISH' : macdHist <= -0.05 ? 'BEARISH' : 'NEUTRAL';

    // 3. ATR(14) - Average True Range (Đo lường biến động giá chuẩn Mark Minervini)
    let sumTR = 0;
    const atrPeriod = 14;
    for (let i = Math.max(1, count - atrPeriod); i < count; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      sumTR += tr;
    }
    const atr14 = Number((sumTR / atrPeriod).toFixed(2));
    const atrPct = Number(((atr14 / (currentPrice || 1)) * 100).toFixed(1));

    // 4. Swing High Resistance Pivot & Swing Low Support (30 phiên gần nhất)
    const swingLookback = Math.min(30, count);
    const recentHighs = highs.slice(count - swingLookback);
    const recentLows = lows.slice(count - swingLookback);
    const swingHigh = Number(Math.max(...recentHighs).toFixed(1));
    const swingLow = Number(Math.min(...recentLows).toFixed(1));

    // Khối lượng trung bình 20 phiên & Ngưỡng Volume Bùng nổ (Vol Breakout)
    const sma20Vol = Math.round(
      volumes.slice(Math.max(0, count - 20)).reduce((a, b) => a + b, 0) / Math.min(20, count)
    );
    const breakoutVolTrigger = Math.round(sma20Vol * 1.3);

    // ── 3. Heat & Extended Analysis Checklist ──
    let heatScore = 15;
    let isOverextended = false;
    let climaxWarning = false;

    // Check 1: Khoảng cách MA20 (Ngưỡng Minervini: > 7% là bắt đầu quá đà, > 10% là cấm mua đuổi)
    let ma20Status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (distFromSMA20Pct > 8.0) {
      ma20Status = 'DANGER';
      heatScore += 35;
      isOverextended = true;
    } else if (distFromSMA20Pct > 5.0) {
      ma20Status = 'WARNING';
      heatScore += 18;
    } else if (distFromSMA20Pct < -5.0) {
      // Đang rơi sâu dưới MA20
      ma20Status = 'WARNING';
    }

    // Check 2: Khoảng cách MA50 (> 20% là quá nóng)
    let ma50Status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (distFromSMA50Pct > 20.0) {
      ma50Status = 'DANGER';
      heatScore += 30;
      isOverextended = true;
    } else if (distFromSMA50Pct > 14.0) {
      ma50Status = 'WARNING';
      heatScore += 12;
    }

    // Check 3: RSI 14
    let rsiStatus: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (rsi14 >= 72) {
      rsiStatus = 'DANGER';
      heatScore += 25;
      isOverextended = true;
    } else if (rsi14 >= 62) {
      rsiStatus = 'WARNING';
      heatScore += 10;
    }

    // Check 4: MACD Momentum
    let macdCheckStatus: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (macdStatus === 'BEARISH') {
      macdCheckStatus = 'WARNING';
      heatScore += 10;
    }

    // Check 5: Tăng từ đáy 52 tuần
    let baseRunStatus: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    if (distFrom52WLowPct >= 120) {
      baseRunStatus = 'WARNING';
      heatScore += 10;
    }

    if (distFromSMA20Pct > 10 && rsi14 > 70 && distFrom52WHighPct >= -5) {
      climaxWarning = true;
      isOverextended = true;
      heatScore = Math.max(85, heatScore);
    }

    heatScore = Math.min(100, Math.max(10, heatScore));
    let heatLevel: 'COOL' | 'WARM' | 'HOT' | 'OVERHEATED' = 'COOL';
    let heatLabel = 'Hạ nhiệt an toàn (Cool)';

    if (isOverextended || heatScore >= 75) {
      heatLevel = heatScore >= 80 ? 'OVERHEATED' : 'HOT';
      heatLabel = heatScore >= 80 ? 'Cực kỳ quá nóng (Overheated) 🚨' : 'Tăng nóng / Extended ⚠️';
    } else if (heatScore >= 40 || Math.abs(distFromSMA20Pct) > 4) {
      heatLevel = 'WARM';
      heatLabel = 'Ấm vừa phải (Đang hạ nhiệt)';
    }

    const heatCriteria: HeatCriterion[] = [
      {
        id: 'ma20_dist',
        label: 'Khoảng cách tới MA20',
        currentValue: `${distFromSMA20Pct > 0 ? '+' : ''}${distFromSMA20Pct}%`,
        threshold: 'An toàn: ≤ +5.0% | Nóng: > +8.0%',
        status: ma20Status,
        note:
          ma20Status === 'DANGER'
            ? 'Dãn quá xa MA20, rủi ro điều chỉnh cao'
            : ma20Status === 'WARNING'
            ? 'Đang mở rộng biên độ hoặc rướn'
            : 'Sát đường hỗ trợ MA20 (An toàn)',
      },
      {
        id: 'ma50_dist',
        label: 'Khoảng cách tới MA50',
        currentValue: `${distFromSMA50Pct > 0 ? '+' : ''}${distFromSMA50Pct}%`,
        threshold: 'An toàn: ≤ +15.0% | Nóng: > +20.0%',
        status: ma50Status,
        note:
          ma50Status === 'DANGER'
            ? 'Tăng dốc đứng so với xu hướng trung hạn'
            : ma50Status === 'WARNING'
            ? 'Tăng tốt trên MA50'
            : 'Gần nền hỗ trợ MA50',
      },
      {
        id: 'rsi14',
        label: 'Chỉ báo Quá Mua RSI(14)',
        currentValue: `${rsi14}`,
        threshold: 'Lý tưởng: 45 - 65 | Quá mua: > 70',
        status: rsiStatus,
        note:
          rsiStatus === 'DANGER'
            ? 'Vùng quá mua cực đại (RSI > 72)'
            : rsiStatus === 'WARNING'
            ? 'Động lượng mua mạnh'
            : 'Vùng động lượng cân bằng',
      },
      {
        id: 'macd_momentum',
        label: 'Xung lượng MACD (12,26,9)',
        currentValue: `${macdValue} vs ${macdSignalValue} (Hist: ${macdHist})`,
        threshold: 'Tích cực: Hist ≥ 0 | Tiêu cực: Hist < 0',
        status: macdCheckStatus,
        note:
          macdStatus === 'BEARISH'
            ? 'MACD cắt dưới Signal — Đang suy yếu/điều chỉnh ngắn hạn'
            : 'MACD trên Signal — Xung lượng tăng duy trì',
      },
      {
        id: 'low52w_run',
        label: 'Biên độ tăng từ đáy 52T',
        currentValue: `+${distFrom52WLowPct}%`,
        threshold: 'Đầu sóng: < 60% | Cuối sóng: > 120%',
        status: baseRunStatus,
        note:
          distFrom52WLowPct >= 120
            ? 'Sóng tăng đã kéo dài (Late Stage Base)'
            : 'Biên độ tăng trong tầm kiểm soát',
      },
    ];

    const heatAnalysis: HeatAnalysis = {
      isOverextended,
      heatLevel,
      heatScore,
      heatLabel,
      distFromSMA20Pct,
      distFromSMA50Pct,
      rsi14,
      macdStatus,
      macdHist,
      climaxWarning,
      criteria: heatCriteria,
    };

    // ── 4. AI Recommendation & Action Classification ──
    // QUY TẮC BẮT BUỘC SỐ 1: BỘ LỌC XU HƯỚNG MARK MINERVINI (TREND TEMPLATE GATEKEEPER)
    const failedCriteria = criteria.filter((c) => !c.passed).map((c) => c.label);
    const trendGatePassed = passedCount === 8 && currentPrice > sma200 && stage === 2;

    let action: AIRecommendation['action'] = 'CHỜ KÉO NGƯỢC (PULLBACK)';
    let actionType: AIRecommendation['actionType'] = 'WAIT_PULLBACK';
    let actionColor: AIRecommendation['actionColor'] = 'amber';
    let shouldBuyNow = false;
    let headline = '';
    let summary = '';
    let buySuitabilityScore = 50;
    let decisionVerdict: AIRecommendation['decisionVerdict'] = 'WAIT';
    let decisionVerdictText = 'KHUYẾN NGHỊ: CHƯA NÊN MUA NGAY (CHỜ TEST MA20)';
    let trendGateMessage = '';

    let bottomFishing: BottomFishingAdvice | undefined = undefined;

    if (!trendGatePassed) {
      // 🛑 CỔNG SỐ 1 KHÔNG QUA: Không đạt chuẩn Mark Minervini
      // Thiết lập dứt khoát: KHÔNG KHUYẾN NGHỊ MUA, KHÔNG DÀI DÒNG
      trendGateMessage = `VI PHẠM BỘ LỌC XU HƯỚNG (${passedCount}/8 tiêu chí đạt)`;
      action = 'KHÔNG KHUYẾN NGHỊ MUA';
      actionType = 'NO_BUY_TREND_FAIL';
      actionColor = 'rose';
      shouldBuyNow = false;
      buySuitabilityScore = Math.min(20, Math.round((passedCount / 8) * 25));
      decisionVerdict = 'DO_NOT_BUY';
      decisionVerdictText = 'KHÔNG KHUYẾN NGHỊ MUA (KHÔNG ĐẠT MARK MINERVINI)';
      headline = `Không đạt chuẩn Mark Minervini (${passedCount}/8 Tiêu chí) — KHÔNG MUA`;
      summary = `Cổ phiếu không bảo toàn được xu hướng tăng trưởng (Chưa vào Stage 2 hoặc gãy trend). Theo kỷ luật Mark Minervini: Đứng ngoài quan sát, KHÔNG GIẢI NGÂN mua mới.`;

      // Vùng hỗ trợ bắt đáy tham khảo (Dành cho nhà đầu tư mạo hiểm, CỰC KỲ RỦI RO)
      const supportLevel = swingLow > 0 ? swingLow : low52W;
      const bottomFishStopLoss = Number((supportLevel * 0.95).toFixed(1));
      bottomFishing = {
        isAvailable: true,
        supportZone: `Vùng ${supportLevel} (Đáy hỗ trợ gần nhất)`,
        supportPrice: supportLevel,
        stopLossPrice: bottomFishStopLoss,
        maxNavPct: 10,
        riskLevel: 'CỰC KỲ RỦI RO (BẮT DAO RƠI)',
        warning: `Cổ phiếu đang rơi ngược xu hướng chính. Nếu vẫn muốn bắt đáy mạo hiểm, chỉ giải ngân thăm dò tối đa 5% – 10% NAV tại vùng hỗ trợ và BẮT BUỘC cắt lỗ ngay nếu thủng mốc ${bottomFishStopLoss} (-5%).`,
      };
    } else {
      // ✅ CỔNG SỐ 1 ĐÃ ĐẠT: Stage 2 Uptrend xác nhận -> Tiến hành xét Cổng số 2: Độ Nóng & Điểm Mua
      trendGateMessage = '✓ ĐẠT CHUẨN XU HƯỚNG MARK MINERVINI (Stage 2 Uptrend confirmed)';

      if (isOverextended) {
        action = 'CẤM MUA ĐUỔI (QUÁ NÓNG)';
        actionType = 'NO_BUY_EXTENDED';
        actionColor = 'rose';
        shouldBuyNow = false;
        buySuitabilityScore = 30;
        decisionVerdict = 'DO_NOT_BUY';
        decisionVerdictText = 'CẢNH BÁO: TUYỆT ĐỐI KHÔNG MUA ĐUỔI (RỦI RO ĐỈNH NGẮN HẠN)';
        headline = `Đạt Stage 2 nhưng QUÁ NÓNG — Extended (Cách MA20 ${distFromSMA20Pct}% · MA50 ${distFromSMA50Pct}%)`;
        summary =
          'Cổ phiếu thỏa mãn xu hướng tăng nhưng đã tăng dốc quá xa các mốc hỗ trợ và có rủi ro tạo đỉnh ngắn hạn hoặc rung lắc điều chỉnh 8% – 15%. Tuyệt đối không mua đuổi FOMO, hãy kiên nhẫn đợi nhịp kéo ngược (pullback) về MA20/MA50 cạn cung.';
      } else if (distFromSMA20Pct <= 3.5 && distFromSMA20Pct >= -2.5 && macdStatus !== 'BEARISH') {
        action = 'MUA THĂM DÒ (LẦN 1)';
        actionType = 'BUY_PILOT';
        actionColor = 'emerald';
        shouldBuyNow = true;
        buySuitabilityScore = 88;
        decisionVerdict = 'BUY_NOW';
        decisionVerdictText = 'KHUYẾN NGHỊ: NÊN MUA (VÙNG MUA THĂM DÒ ĐẠT CHUẨN)';
        headline = 'Đủ chuẩn Stage 2 & Vùng mua an toàn quanh MA20';
        summary =
          'Cổ phiếu thỏa mãn toàn bộ tiêu chí xu hướng và độ nóng đã hạ nhiệt an toàn về gần hỗ trợ MA20. Đủ điều kiện kích hoạt lệnh giải ngân Thăm dò Lần 1 (30% tổng vốn vị thế).';
      } else {
        action = 'CHỜ KÉO NGƯỢC (PULLBACK)';
        actionType = 'WAIT_PULLBACK';
        actionColor = 'amber';
        shouldBuyNow = false;
        buySuitabilityScore = 65;
        decisionVerdict = 'WAIT';
        decisionVerdictText = 'KHUYẾN NGHỊ: TẠM THỜI CHƯA MUA (CHỜ PULLBACK VỀ MA20)';
        headline = 'Stage 2 Tăng trưởng — Chờ nến kiểm định MA20 cạn cung';
        summary = `Cổ phiếu giữ được xu hướng tăng tốt (RS ${rsRating}/99), nhưng xung lượng ngắn hạn đang trong nhịp thoái lui hạ nhiệt (MACD Hist ${macdHist}). Chờ giá test lại MA20 (${sma20}) giữ vững trần nền trước khi mở vị thế.`;
      }
    }

    // ── 5. Capital Allocation Plan (Scale-in Tranches & Dynamic Stoploss) ──
    // Cắt lỗ theo quy tắc bán đã kiểm chứng: cố định −7% từ giá mua (utils/exitPlan.ts)
    const stopLossPrice = Number(exitStopPrice(currentPrice).toFixed(1));
    const stopLossPct = Number((((stopLossPrice - currentPrice) / currentPrice) * 100).toFixed(1));

    // Mục tiêu giá 1 (+12% đến +15% hoặc vượt đỉnh pivot) & Mục tiêu 2 (+25%)
    const pivotTriggerPrice = swingHigh > currentPrice ? swingHigh : Number((currentPrice * 1.03).toFixed(1));
    const targetPrice1 = Number(
      Math.max(currentPrice * 1.12, swingHigh > currentPrice ? swingHigh * 1.03 : currentPrice * 1.15).toFixed(1)
    );
    const targetPrice2 = Number((currentPrice * 1.25).toFixed(1));
    const riskRewardRatio = Number(
      ((targetPrice1 - currentPrice) / Math.max(0.1, currentPrice - stopLossPrice)).toFixed(1)
    );

    // Dynamic Range Tranche 1
    const t1Low = Math.round(Math.min(currentPrice, sma20) * 0.995 * 10) / 10;
    const t1High = Math.round(Math.max(currentPrice, sma20) * 1.005 * 10) / 10;
    const t1RangeStr = trendGatePassed ? `Vùng ${t1Low} – ${t1High} (Quanh MA20)` : 'KHÔNG CÓ ĐIỂM MUA';
    const volMilStr = (breakoutVolTrigger / 1_000_000).toFixed(1);

    const tranches: CapitalTranche[] = [
      {
        step: 1,
        name: 'Lần 1: Vị thế Thăm dò (Pilot Position)',
        pct: 30,
        targetPrice: t1RangeStr,
        priceRange: trendGatePassed ? `${t1Low} - ${t1High}` : undefined,
        condition: trendGatePassed
          ? `Giải ngân 30% khi giá kéo ngược chạm hỗ trợ MA20 (${sma20}) hoặc nền giá, nến rút chân thanh khoản cạn kiệt.`
          : `Lệnh bị khóa: Cổ phiếu chưa đạt chuẩn xu hướng Stage 2 (${passedCount}/8 tiêu chí). Mark Minervini nghiêm cấm mua khi trend không bảo toàn.`,
        status: !trendGatePassed
          ? 'BLOCKED'
          : shouldBuyNow
          ? 'ACTIVE'
          : actionType === 'NO_BUY_EXTENDED'
          ? 'BLOCKED'
          : 'PENDING',
        statusLabel: !trendGatePassed
          ? 'KHÓA BỞI TREND TEMPLATE'
          : shouldBuyNow
          ? 'KÍCH HOẠT VÙNG MUA'
          : actionType === 'NO_BUY_EXTENDED'
          ? 'TẠM KHÓA (QUÁ NÓNG)'
          : 'CHỜ GIÁ VỀ HỖ TRỢ',
      },
      {
        step: 2,
        name: 'Lần 2: Gia tăng Bứt phá (Add on Strength)',
        pct: 40,
        targetPrice: trendGatePassed ? `Vượt ${formatK(pivotTriggerPrice)} kèm Vol ≥ ${volMilStr}M cp` : 'KHÓA - CHƯA ĐẠT CHUẨN',
        condition: trendGatePassed
          ? `Chỉ giải ngân 40% KHI VÀ CHỈ KHI Lần 1 đang CÓ LÃI (+2% ~ +4%), giá bứt phá vượt kháng cự ${formatK(pivotTriggerPrice)} với Volume bùng nổ.`
          : 'Lệnh bị khóa: Chỉ mở khi Lần 1 được kích hoạt và đạt chuẩn siêu cổ phiếu Stage 2.',
        status: !trendGatePassed ? 'BLOCKED' : 'LOCKED',
        statusLabel: !trendGatePassed ? 'KHÓA BỞI TREND TEMPLATE' : 'CHỜ ĐIỀU KIỆN LẦN 1',
      },
      {
        step: 3,
        name: 'Lần 3: Hoàn tất Kim tự tháp (Full Position)',
        pct: 30,
        targetPrice: trendGatePassed
          ? `Retest trần nền ${formatK(pivotTriggerPrice * 0.995)} – ${formatK(pivotTriggerPrice * 1.01)}`
          : 'KHÓA - CHƯA ĐẠT CHUẨN',
        condition: trendGatePassed
          ? `Giải ngân 30% cuối cùng khi giá kiểm định lại mốc ${formatK(pivotTriggerPrice)} thành công không bị gãy ngược, xác nhận xu hướng tăng phi mã.`
          : 'Lệnh bị khóa: Chỉ mở khi Lần 1 & 2 đã có lãi và xác nhận mô hình VCP.',
        status: !trendGatePassed ? 'BLOCKED' : 'LOCKED',
        statusLabel: !trendGatePassed ? 'KHÓA BỞI TREND TEMPLATE' : 'KHÓA (CHỜ RETEST)',
      },
    ];

    const capitalAllocation: CapitalAllocationPlan = {
      totalBudgetPct: 100,
      tranches,
      maxLossBudgetPct: 1.5,
      stopLossPrice,
      stopLossPct,
      targetPrice1,
      targetPrice2,
      riskRewardRatio,
      atr14,
      atrPct,
      pivotResistance: pivotTriggerPrice,
      swingLowSupport: swingLow,
      goldenRules: [
        'NGUYÊN TẮC SỐ 1: BẮT BUỘC ĐẠT CHUẨN TREND TEMPLATE (Không bao giờ mua khi trend bị gãy hoặc chưa vào Stage 2).',
        'Tuyệt đối KHÔNG bao giờ bình quân giá xuống (Never average down on losers).',
        `Luôn đặt lệnh Dừng lỗ tự động ${stopLossPct}% (Mốc ${stopLossPrice}) ngay sau khi khớp lệnh để bảo vệ vốn.`,
        'Chỉ gia tăng tỷ trọng (Lần 2, 3) khi các vị thế trước ĐANG CÓ LÃI.',
        EXIT_RULE_TEXT.takeProfit.vi,
      ],
    };

    const aiRecommendation: AIRecommendation = {
      action,
      actionType,
      actionColor,
      headline,
      summary,
      shouldBuyNow,
      buySuitabilityScore,
      trendGatePassed,
      trendGateMessage,
      failedCriteria,
      decisionVerdict,
      decisionVerdictText,
      heat: heatAnalysis,
      allocation: capitalAllocation,
      bottomFishing,
    };

    const result: MinerviniAnalysisResult = {
      symbol,
      name: stockInfo.name,
      exchange: stockInfo.exchange,
      sector: matchedSectorName,
      sectorRank,
      sectorRS,
      sectorStatus,
      price: currentPrice,
      change: currentChange,
      changePct: Math.round(currentChangePct * 100) / 100,
      volume: currentVol,
      sma20,
      sma50,
      sma150,
      sma200,
      distFromSMA20Pct,
      rsi14,
      sma200SlopeUp,
      high52W,
      low52W,
      distFrom52WHighPct,
      distFrom52WLowPct,
      rsRating,
      rsRank,
      rsUniverseTotal,
      stage,
      stageName,
      stageInfo: {
        sub: stageResult.sub,
        rule: stageResult.rule,
        confirmed: stageResult.confirmed,
        evidence: stageResult.evidence,
      },
      cycle: cycleContext,
      fundamentals,
      sectorInfo,
      marketState,
      qualityFlags,
      decision: { ...decision, evidence: decisionEvidence, marketUp },
      passedCount,
      totalCount: 8,
      isStage2Eligible,
      criteria,
      signals,
      wyckoff: {
        phase: wyckoffPhase,
        phaseIndex,
        phaseName: wyckoffPhaseName,
        passedCount: wyckoffPassedCount,
        totalCount: 8,
        actionAdvice,
        isBuyPhase,
        buyBlocked,
        buyBlockedReason,
        buyPointCode,
        buyPointLabel,
        buyPointDetail,
        buyZonePrice: wyckoffBuyZone,
        stopLossPrice: wyckoffStopLoss,
        completedPhases,
        nextMilestone,
        phaseProgressPct,
        criteria: wyckoffCriteria,
      },
      aiRecommendation,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        symbol,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
