import { NextResponse } from 'next/server';
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
    const formatK = (val: number) => (val > 1000 ? (val / 1000).toFixed(1) : Number(val.toFixed(1)).toString());

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
        label: 'MA50 > MA150 > MA200',
        description: 'Đường MA 50 ngày phải nằm trên cả đường MA 150 ngày và MA 200 ngày',
        passed: sma50 > 0 && sma150 > 0 && sma200 > 0 && sma50 > sma150 && sma50 > sma200,
        value: sma50 > 0 && sma150 > 0 && sma200 > 0
          ? `MA50(${sma50}) vs MA150(${sma150}) & MA200(${sma200})`
          : 'Chưa đủ dữ liệu nến (cần ≥ 200 phiên)',
        comparisonValue: sma50 > 0 ? formatK(sma50) : 'N/A',
      },
      {
        id: 5,
        label: 'Giá > MA50',
        description: 'Giá cổ phiếu hiện tại nằm trên đường trung bình MA 50 ngày',
        passed: sma50 > 0 && currentPrice > sma50,
        value: `${currentPrice} ${sma50 > 0 && currentPrice > sma50 ? '>' : '<='} MA50(${sma50})`,
        comparisonValue: `${formatK(currentPrice)} / ${formatK(sma50)}`,
      },
      {
        id: 6,
        label: 'Giá ≥ 30% trên đáy 52 tuần',
        description: 'Giá hiện tại cao hơn tối thiểu 30% so với mức đáy 52 tuần',
        passed: distFrom52WLowPct >= 30,
        value: `+${distFrom52WLowPct}% so với đáy 52T (${low52W})`,
        comparisonValue: `${distFrom52WLowPct}%`,
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

    let stage: 1 | 2 | 3 | 4 = 1;
    let stageName = 'Stage 1 (Tích lũy / Base)';
    if (passedCount === 8) {
      stage = 2;
      stageName = 'Stage 2 (Tăng trưởng / Đủ điều kiện xét mua)';
    } else if (currentPrice < sma200 && sma50 < sma200) {
      stage = 4;
      stageName = 'Stage 4 (Giảm giá / Không tham gia)';
    } else if (distFrom52WHighPct < -20 && sma50 < sma150) {
      stage = 3;
      stageName = 'Stage 3 (Phân phối / Rủi ro)';
    }

    // Zero Mock Data: Không bịa đặt số liệu thống kê winRate hay profitPct giả
    const signals: MinerviniStrategySignal[] = [];

    // Dynamic Sector Rank & RS directly synchronized with Live RRG Engine (1W Weekly Frame - JdK Standard)
    const rrgDataset = await getLiveRRGDataset('1W', 4, 'VNINDEX');
    const rrgSectorInfo = findMatchingRRGSector(symbol, stockInfo.sector, rrgDataset);

    const matchedSectorName = rrgSectorInfo?.sectorName || stockInfo.sector || 'Chung';
    const sectorRank = rrgSectorInfo?.sectorRank;
    const sectorRS = rrgSectorInfo?.sectorRS;
    const sectorStatus = rrgSectorInfo?.sectorStatus;

    // Wyckoff & VSA (Volume Spread Analysis) Diagnosis (Phase A - E)
    const opens: number[] = Array.isArray(data.o) && data.o.length === count ? data.o : closes;
    const formatPrice = (val: number) =>
      !isIndex && val > 2000 ? (val / 1000).toFixed(1) : Number(val.toFixed(2)).toString();

    const baseWindow = Math.min(40, count);
    const halfWindow = Math.max(5, Math.floor(baseWindow / 2));
    const baseStartIdx = count - baseWindow;
    const midBaseIdx = count - halfWindow;

    const last40High = Math.max(...highs.slice(baseStartIdx));
    const last40Low = Math.min(...lows.slice(baseStartIdx));
    const baseRangePct = last40Low > 0 ? Math.round(((last40High - last40Low) / last40Low) * 1000) / 10 : 25;
    const baseHeight = last40High - last40Low;
    const posInBasePct = baseHeight > 0 ? Math.round(((currentPrice - last40Low) / baseHeight) * 100) : 50;

    // 1. Cấu trúc Swing nửa đầu vs nửa sau nền 40 phiên (HH-HL & Độ co hẹp VCP)
    const firstHalfHighs = highs.slice(baseStartIdx, midBaseIdx);
    const firstHalfLows = lows.slice(baseStartIdx, midBaseIdx);
    const secondHalfHighs = highs.slice(midBaseIdx);
    const secondHalfLows = lows.slice(midBaseIdx);

    const first20High = firstHalfHighs.length > 0 ? Math.max(...firstHalfHighs) : last40High;
    const first20Low = firstHalfLows.length > 0 ? Math.min(...firstHalfLows) : last40Low;
    const last20High = secondHalfHighs.length > 0 ? Math.max(...secondHalfHighs) : last40High;
    const last20Low = secondHalfLows.length > 0 ? Math.min(...secondHalfLows) : last40Low;

    const firstHalfRangePct = first20Low > 0 ? ((first20High - first20Low) / first20Low) * 100 : baseRangePct;
    const secondHalfRangePct = last20Low > 0 ? ((last20High - last20Low) / last20Low) * 100 : baseRangePct;

    // Đáy sau cao hơn đáy trước (HL) & Đỉnh sau cao hơn (HH) hoặc thu hẹp VCP giữ trên MA20/MA50
    const isHigherLow = last20Low >= first20Low * 0.99;
    const isHigherHighOrTightVcp =
      last20High >= first20High * 0.985 ||
      (secondHalfRangePct < firstHalfRangePct && currentPrice >= sma20 && posInBasePct >= 55);
    const hhHlPassed =
      isHigherLow && isHigherHighOrTightVcp && currentPrice >= last20Low * 1.015 && currentPrice > sma50;

    // 2. Phân tích VSA (Volume & Spread) trên chuỗi 20 phiên gần nhất
    const sma50Vol = Math.round(
      volumes.slice(Math.max(0, count - 50)).reduce((a, b) => a + b, 0) / Math.min(50, count)
    );
    const volRatio = sma50Vol > 0 ? Math.round((currentVol / sma50Vol) * 10) / 10 : 1;

    const vsaLookback = Math.min(20, count - 1);
    const vsaStartIdx = count - vsaLookback;

    let demandDays = 0;
    let supplyDays = 0;
    let demandVolSum = 0;
    let supplyVolSum = 0;
    let demandSpreadSum = 0;
    let supplySpreadSum = 0;
    let totalSpreadSum = 0;
    let vduCount = 0; // Số phiên cạn cung (Volume Dry-Up < 0.78x SMA50 Vol)
    let recent15DownVolSum = 0;
    let recent15DownDays = 0;
    let sosCount = 0;
    let sowCount = 0;
    let lastSosIdx = -1;
    let lastSosLow = 0;
    let lastSowIdx = -1;
    let recentUpthrust = false;

    for (let i = vsaStartIdx; i < count; i++) {
      const o = opens[i];
      const c = closes[i];
      const prevC = i > 0 ? closes[i - 1] : c;
      const h = highs[i];
      const l = lows[i];
      const v = volumes[i] || 0;
      const spread = Math.max(0, h - l);
      const spreadPct = prevC > 0 ? (spread / prevC) * 100 : 0;
      const closePos = spread > 0 ? (c - l) / spread : 0.5;
      const barChgPct = prevC > 0 ? ((c - prevC) / prevC) * 100 : 0;

      totalSpreadSum += spreadPct;

      // Phân loại Nến Cầu (Demand) vs Nến Cung (Supply) theo chuẩn VSA:
      // - Nến Upthrust (tăng nhẹ nhưng bị xả ngược đóng cửa <= 35% biên độ nến kèm Vol lớn) là Nến Cung ẩn
      // - Nến Shakeout rút chân (đóng cửa >= 65% biên độ nến và c > o) là Nến Cầu hấp thụ
      const isUpthrustBar = sma50Vol > 0 && v >= sma50Vol * 1.25 && closePos <= 0.35 && barChgPct < 1.0;
      const isBullishShakeout = barChgPct >= -0.5 && closePos >= 0.65 && c > o;

      if ((c > prevC && !isUpthrustBar) || isBullishShakeout) {
        demandDays++;
        demandVolSum += v;
        demandSpreadSum += spreadPct;
      } else if (c < prevC || isUpthrustBar) {
        supplyDays++;
        supplyVolSum += v;
        supplySpreadSum += spreadPct;
      }

      // Thống kê 15 phiên gần nhất cho VDU (Cạn cung) & SOS (Sign of Strength)
      if (i >= count - Math.min(15, vsaLookback)) {
        if (c < prevC || (c === prevC && closePos < 0.45)) {
          recent15DownDays++;
          recent15DownVolSum += v;
        }
        // Phiên cạn cung VDU / No Supply: Volume <= 78% TB 50 phiên và không bán tháo
        if (sma50Vol > 0 && v <= sma50Vol * 0.78 && barChgPct > -1.8) {
          vduCount++;
        }

        // Kiểm tra Pocket Pivot (Volume lớn hơn mọi phiên giảm trong 10 phiên trước đó)
        let maxPrior10DownVol = 0;
        for (let j = Math.max(1, i - 10); j < i; j++) {
          if (closes[j] < closes[j - 1] && volumes[j] > maxPrior10DownVol) {
            maxPrior10DownVol = volumes[j];
          }
        }
        const isPocketPivotVol = maxPrior10DownVol > 0 && v > maxPrior10DownVol;

        // Nến SOS / Pocket Pivot: Tăng >= 1.8%, đóng cửa nửa trên nến (>= 55%), thân nến xanh, kèm Vol >= 1.15x TB50 hoặc Pocket Pivot
        if (
          barChgPct >= 1.8 &&
          closePos >= 0.55 &&
          c >= o &&
          ((sma50Vol > 0 && v >= sma50Vol * 1.15) || isPocketPivotVol)
        ) {
          sosCount++;
          lastSosIdx = i;
          lastSosLow = l;
        }

        // Nến SOW (Sign of Weakness): Giảm <= -2.0%, đóng cửa nửa dưới (<= 45%), kèm Vol >= 1.2x TB50
        if (barChgPct <= -2.0 && closePos <= 0.45 && sma50Vol > 0 && v >= sma50Vol * 1.2) {
          sowCount++;
          lastSowIdx = i;
        }
      }

      // Kiểm tra Upthrust (bán cụt đầu khối lượng lớn) trong 3 phiên cuối
      if (i >= count - 3 && sma50Vol > 0 && v >= sma50Vol * 1.3 && closePos <= 0.35 && barChgPct < 1.0) {
        recentUpthrust = true;
      }
    }

    const avgSpread20Pct = vsaLookback > 0 ? totalSpreadSum / vsaLookback : 2.0;
    const avgDemandSpreadPct = demandDays > 0 ? demandSpreadSum / demandDays : avgSpread20Pct;
    const avgSupplySpreadPct = supplyDays > 0 ? supplySpreadSum / supplyDays : avgSpread20Pct;
    const spreadRatio = avgSupplySpreadPct > 0 ? avgDemandSpreadPct / avgSupplySpreadPct : 1.0;

    const avgDemandVol = demandDays > 0 ? demandVolSum / demandDays : sma50Vol;
    const avgSupplyVol = supplyDays > 0 ? supplyVolSum / supplyDays : sma50Vol;
    const upDownVolRatio = avgSupplyVol > 0 ? avgDemandVol / avgSupplyVol : 1.0;

    const avgRecentDownVol = recent15DownDays > 0 ? recent15DownVolSum / recent15DownDays : currentVol * 0.8;
    const downVolAvgRatio = sma50Vol > 0 ? avgRecentDownVol / sma50Vol : 1.0;

    // Đặc tính cây nến hiện tại (Current Bar VSA)
    const currentOpen = opens[count - 1];
    const currentSpread = Math.max(0, highs[count - 1] - lows[count - 1]);
    const currentSpreadPct = prevPrice > 0 ? (currentSpread / prevPrice) * 100 : 0;
    const currentClosePos = currentSpread > 0 ? (currentPrice - lows[count - 1]) / currentSpread : 0.5;
    const lastSosBarsAgo = lastSosIdx >= 0 ? count - 1 - lastSosIdx : null;

    // 3. Hỗ trợ đáy nền & phát hiện hành vi Spring / Shakeout
    const priorLows = lows.slice(baseStartIdx, Math.max(baseStartIdx + 1, count - 10));
    const priorBaseLow = priorLows.length > 0 ? Math.min(...priorLows) : null;
    const recent10Closes = closes.slice(Math.max(0, count - 10));
    const recent10Lows = lows.slice(Math.max(0, count - 10));
    const minCloseLast10 = Math.min(...recent10Closes);
    const minLowLast10 = Math.min(...recent10Lows);

    // Không vi phạm đáy nền: Đóng cửa 10 phiên gần nhất giữ trên vùng hỗ trợ đáy nền (cho phép sai số rũ bỏ rút chân 1%)
    const supportHeldPassed =
      priorBaseLow !== null &&
      minCloseLast10 >= priorBaseLow * 0.99 &&
      currentPrice >= priorBaseLow;

    // Phát hiện Spring / Test thành công trong 10 phiên qua: Giá thấp nhất chạm sát hoặc nhúng nhẹ dưới priorBaseLow rồi rút chân lên
    const hasSpringAction =
      priorBaseLow !== null &&
      minLowLast10 <= priorBaseLow * 1.02 &&
      minLowLast10 >= priorBaseLow * 0.95 &&
      currentPrice >= priorBaseLow * 1.01 &&
      currentClosePos >= 0.45;

    // 4. Đánh giá 8 tiêu chí Wyckoff & VSA chuẩn xác
    const vcpBasePassed = baseRangePct < 30 && secondHalfRangePct <= Math.max(18, firstHalfRangePct * 1.15);
    const upperHalfPassed = posInBasePct >= 50;
    // Cạn cung nhịp chỉnh: Khối lượng TB các phiên giảm KHÔNG ĐƯỢC lớn hơn TB50 (<= 1.0x), kèm < 0.92x hoặc >= 3 phiên VDU
    const vduPassed = downVolAvgRatio <= 1.0 && (downVolAvgRatio <= 0.92 || vduCount >= 3);
    // Tín hiệu SOS hợp lệ: Có SOS, số SOS > SOW (hoặc SOS gần nhất xuất hiện sau SOW cuối cùng), và giá hiện tại không thủng đáy cây nến SOS
    const sosStructureIntact =
      lastSosIdx >= 0 &&
      currentPrice >= lastSosLow * 0.99 &&
      (sosCount > sowCount || lastSosIdx > lastSowIdx);
    const sosPassed = sosCount >= 1 && sosStructureIntact;

    // Spread VSA mở rộng chiều tăng:
    // - Biên độ TB nến Cầu >= nến Cung (spreadRatio >= 0.95)
    // - Phiên hiện tại: Nếu tăng thì đóng cửa >= 48% nến; nếu giảm/đi ngang LPS thì hoặc rút chân (closePos >= 45% hoặc c >= o), hoặc chỉnh nhẹ biên độ hẹp kèm Vol thấp
    const isHealthyCurrentBar =
      (currentChangePct > 0 && currentClosePos >= 0.48) ||
      (currentChangePct <= 0 &&
        currentChangePct >= -1.5 &&
        (currentClosePos >= 0.45 ||
          currentPrice >= currentOpen ||
          (currentChangePct >= -1.2 && currentSpreadPct <= avgSpread20Pct && volRatio <= 0.95)));
    const spreadVsaPassed = spreadRatio >= 0.95 && isHealthyCurrentBar;

    // Hấp thụ nguồn cung tại kháng cự: Khối lượng Cầu > Cung (>= 1.05x), giữ nửa trên nền, không xuất hiện Upthrust xả hàng
    const absorptionPassed =
      upDownVolRatio >= 1.05 && posInBasePct >= 55 && distFrom52WHighPct >= -22 && !recentUpthrust;

    const wyckoffCriteria = [
      {
        id: 1,
        label: 'Cấu trúc đỉnh & đáy sau cao hơn (HH-HL)',
        passed: hhHlPassed,
        value: `Đáy ${formatPrice(first20Low)}→${formatPrice(last20Low)} · Đỉnh ${formatPrice(first20High)}→${formatPrice(last20High)}`,
      },
      {
        id: 2,
        label: 'Nền 40 phiên thu hẹp (biên độ < 30%)',
        passed: vcpBasePassed,
        value: `${baseRangePct}% (Nửa sau ${secondHalfRangePct.toFixed(1)}%)`,
      },
      {
        id: 3,
        label: 'Giá nằm nửa trên của nền (Trading Range)',
        passed: upperHalfPassed,
        value: `${posInBasePct}% chiều cao nền`,
      },
      {
        id: 4,
        label: 'Cạn kiệt cung nhịp chỉnh (No Supply / VDU)',
        passed: vduPassed,
        value: `Vol giảm ${Math.round(downVolAvgRatio * 100)}% TB50 · ${vduCount} phiên VDU`,
      },
      {
        id: 5,
        label: 'Cây nến SOS / Pocket Pivot dòng tiền vào',
        passed: sosPassed,
        value:
          lastSosBarsAgo === 0
            ? `Hôm nay SOS (Vol x${volRatio} TB)`
            : sosCount > 0
            ? `${sosCount} nến SOS / 15p (${lastSosBarsAgo}p trước)`
            : `Chưa có SOS (Vol x${volRatio} TB)`,
      },
      {
        id: 6,
        label: 'Không vi phạm đáy nền (10 phiên gần nhất)',
        passed: supportHeldPassed,
        value:
          priorBaseLow !== null
            ? `Đáy nền ${formatPrice(priorBaseLow)} (Min 10p: ${formatPrice(minCloseLast10)})`
            : 'Chưa đủ dữ liệu',
      },
      {
        id: 7,
        label: 'Spread nến mở rộng chiều tăng (VSA)',
        passed: spreadVsaPassed,
        value: `Spread T/G ${spreadRatio.toFixed(2)}x · Đóng nến ${Math.round(currentClosePos * 100)}%`,
      },
      {
        id: 8,
        label: 'Hấp thụ nguồn cung tại kháng cự',
        passed: absorptionPassed,
        value: `Vol T/G ${upDownVolRatio.toFixed(2)}x · ${distFrom52WHighPct}% đỉnh`,
      },
    ];

    const wyckoffPassedCount = wyckoffCriteria.filter((c) => c.passed).length;

    // 5. CỖ MÁY CHUYỂN TRẠNG THÁI TUẦN TỰ THEO CHU KỲ WYCKOFF (SEQUENTIAL WYCKOFF STATE MACHINE)
    // Nguyên tắc học thuật Wyckoff: Chu kỳ tích lũy diễn ra tuần tự bắt buộc:
    // Phase A (Hãm rơi) ➔ Phase B (Tích lũy gom hàng) ➔ Phase C (Rũ bỏ Spring / Test) ➔ Phase D (SOS / LPS trong nền) ➔ Phase E (Bứt phá Markup)
    // TUYỆT ĐỐI KHÔNG NHẢY CÓC, VÀ KHÔNG BỊ TỤT LÙI BỪA BÃI KHI CHỈ CÓ RUNG LẮC NGẮN HẠN.

    let wyckoffPhase: 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D' | 'Phase E' = 'Phase B';
    let phaseIndex = 1;
    let wyckoffPhaseName = 'Phase B — Tích lũy xây dựng nguyên nhân';
    let actionAdvice = 'Chờ quá trình thắt chặt biên độ nền giá VCP và cạn kiệt nguồn cung';
    let isBuyPhase = false;
    let buyPointCode: 'NONE' | 'BUY_1_SPRING' | 'BUY_2_LPS' | 'BUY_3_BREAKOUT_BU' | 'HOLD_MARKUP' = 'NONE';
    let buyPointLabel = '⏳ CHƯA CÓ ĐIỂM MUA CHUẨN (ĐỨNG NGOÀI / QUAN SÁT)';
    let buyPointDetail =
      'Cổ phiếu đang trong giai đoạn gom hàng đi ngang (Phase B). Tuyệt đối không mua sớm tránh chôn vốn.';
    const supportBaseRef = priorBaseLow !== null ? priorBaseLow : last20Low;
    let wyckoffBuyZone = `Chờ tín hiệu quanh ${formatPrice(sma20)} - ${formatPrice(last20High)}`;
    let wyckoffStopLoss = `${formatPrice(supportBaseRef * 0.97)} (-3% dưới đáy nền)`;
    let completedPhases: string[] = ['Phase A'];
    let nextMilestone =
      'Cạn kiệt nguồn cung và xuất hiện nhịp rũ bỏ Spring (Phase C) hoặc nổ Vol SOS vượt nửa trên nền (Phase D)';
    let phaseProgressPct = 35;

    // A. Kiểm tra vi phạm gãy xu hướng / hoảng loạn thực sự (Active Severe Breakdown)
    // Chỉ xem là Phase A khi giá THỰC SỰ bị bán tháo thủng đáy hỗ trợ hoặc đang trong downtrend rơi tự do
    const isSevereDowntrendOrBreakdown =
      (priorBaseLow !== null && currentPrice < priorBaseLow * 0.96 && minCloseLast10 < priorBaseLow * 0.97) ||
      (distFrom52WHighPct < -32 && currentPrice < sma50 && sma50 < sma200 && posInBasePct < 25 && downVolAvgRatio > 1.15) ||
      (wyckoffPassedCount <= 1 && posInBasePct < 20 && currentPrice < sma20 && currentPrice < sma50);

    // B. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE E (Markup ngoài nền):
    // Phải hoàn tất Phase D (đã có SOS tích lũy nâng đáy), giá bứt phá vượt hoặc áp sát trần nền kháng cự,
    // nằm trên các đường MA chủ chốt (MA20, MA50, MA150, MA200) và tiệm cận đỉnh 52 tuần.
    const isPhaseEEligible =
      !isSevereDowntrendOrBreakdown &&
      wyckoffPassedCount >= 6 &&
      posInBasePct >= 75 &&
      distFrom52WHighPct >= -12 &&
      currentPrice > sma50 &&
      sma50 > sma150 &&
      currentPrice > sma200 &&
      (currentPrice >= last20High * 0.985 || distFrom52WHighPct >= -6);

    // C. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE D (Xu hướng bên trong nền - SOS & LPS):
    // Phải có sự xuất hiện của CÂY NẾN SOS / Pocket Pivot xác nhận dòng tiền lớn đẩy giá lên nửa trên nền (posInBasePct >= 48),
    // giá giữ vững trên MA20 hoặc MA50, và cấu trúc đáy sau cao hơn (Higher Low).
    // ĐẶC BIỆT: Nếu cổ phiếu đang có SOS và giữ trên MA20/MA50, dù có vài phiên đỏ rung lắc với Vol thấp thì ĐÓ LÀ LPS CỦA PHASE D,
    // chứ không được tụt về Phase B hay Phase C!
    const isPhaseDEligible =
      !isSevereDowntrendOrBreakdown &&
      !isPhaseEEligible &&
      wyckoffPassedCount >= 5 &&
      posInBasePct >= 48 &&
      (sosPassed || absorptionPassed || (hhHlPassed && upDownVolRatio >= 1.05)) &&
      currentPrice >= Math.min(sma20, sma50) * 0.985;

    // D. Kiểm tra ĐIỀU KIỆN TIÊN QUYẾT ĐỂ ĐẠT PHASE C (Rũ bỏ Spring / Test đáy cạn cung):
    // Chỉ kích hoạt khi giá thực sự có hành vi nhúng sát/thủng nhẹ đáy nền rồi rút chân lên (hasSpringAction),
    // HOẶC đang kiểm tra lại đáy hỗ trợ nền với thanh khoản cạn kiệt (Volume Dry Up), chưa có cây nến SOS bứt phá.
    const isPhaseCEligible =
      !isSevereDowntrendOrBreakdown &&
      !isPhaseEEligible &&
      !isPhaseDEligible &&
      (hasSpringAction ||
        (supportHeldPassed && vduPassed && posInBasePct <= 35 && minLowLast10 <= supportBaseRef * 1.03 && upDownVolRatio >= 0.95));

    // THỰC HIỆN GÁN TRẠNG THÁI TUẦN TỰ THEO THỨ TỰ LOGIC CHU KỲ
    if (isSevereDowntrendOrBreakdown) {
      wyckoffPhase = 'Phase A';
      phaseIndex = 0;
      wyckoffPhaseName = 'Phase A — Hãm đà giảm (SC / AR)';
      actionAdvice = 'Đứng ngoài quan sát, chưa tạo đáy xong';
      isBuyPhase = false;
      buyPointCode = 'NONE';
      buyPointLabel = '🚫 KHÔNG MUA (Phase A — Đang rơi)';
      buyPointDetail =
        'Cổ phiếu đang chịu áp lực bán tháo hoặc chưa tạo đáy cân bằng. Đứng ngoài chờ thiết lập Trading Range.';
      wyckoffBuyZone = 'Đứng ngoài';
      wyckoffStopLoss = `${formatPrice(last40Low * 0.96)}`;
      completedPhases = [];
      nextMilestone = 'Tạo đáy Selling Climax (SC) và hồi phục Automatic Rally (AR) để xác lập biên độ tích lũy';
      phaseProgressPct = 15;
    } else if (isPhaseEEligible) {
      wyckoffPhase = 'Phase E';
      phaseIndex = 4;
      wyckoffPhaseName = 'Phase E — Đẩy giá thoát nền (Markup)';
      completedPhases = ['Phase A', 'Phase B', 'Phase C', 'Phase D'];
      nextMilestone = 'Duy trì xu hướng tăng giá Markup, chốt lời theo các mốc mục tiêu và chặn lãi theo MA20';
      phaseProgressPct = 95;

      const isEarlyBreakoutOrBu = distFromSMA20Pct <= 6.0 && posInBasePct <= 98;
      if (isEarlyBreakoutOrBu) {
        isBuyPhase = true;
        buyPointCode = 'BUY_3_BREAKOUT_BU';
        buyPointLabel = '🚀 ĐIỂM MUA #3: Vượt đỉnh nền JAC / BU (Gia tăng 20-30%)';
        buyPointDetail = 'Cổ phiếu bứt phá dứt khoát khỏi nền giá tích lũy (JAC) và đang kiểm định trần nền (BU).';
        actionAdvice = 'Mua gia tăng 20–30% quanh đỉnh nền vừa vượt (BU)';
        wyckoffBuyZone = `${formatPrice(Math.min(currentPrice, last20High * 0.985))} – ${formatPrice(currentPrice * 1.01)}`;
        wyckoffStopLoss = `${formatPrice(Math.max(sma20 * 0.97, last20Low))}`;
      } else {
        isBuyPhase = false;
        buyPointCode = 'HOLD_MARKUP';
        buyPointLabel = '🔒 NẮM GIỮ GỒNG LÃI (Phase E đã chạy xa nền — Cấm mua đuổi)';
        buyPointDetail = 'Cổ phiếu đã tăng quá +5% so với điểm pivot bứt phá. Tuyệt đối không mua đuổi, chỉ nắm giữ gồng lãi.';
        actionAdvice = 'Giữ hàng gồng lãi, chặn lãi theo MA20';
        wyckoffBuyZone = `Chờ chỉnh về MA20 (${formatPrice(sma20)})`;
        wyckoffStopLoss = `${formatPrice(sma20 * 0.97)} (MA20)`;
      }
    } else if (isPhaseDEligible) {
      wyckoffPhase = 'Phase D';
      phaseIndex = 3;
      wyckoffPhaseName = 'Phase D — SOS / LPS (Quan trọng nhất ⭐)';
      completedPhases = ['Phase A', 'Phase B', 'Phase C'];
      nextMilestone = 'Bứt phá dứt khoát vượt trần kháng cự của Trading Range (JAC / Breakout) để bước vào Phase E';
      phaseProgressPct = 75;
      isBuyPhase = true;
      buyPointCode = 'BUY_2_LPS';
      buyPointLabel = '⭐ ĐIỂM MUA CHUẨN #2: Phase D — SOS / LPS (Mua chủ lực 40-50%)';
      buyPointDetail =
        'Đã hoàn tất rũ bỏ cạn cung. Xuất hiện nến SOS dòng tiền lớn và đang kiểm định hỗ trợ nâng đáy LPS trên MA20/MA50.';
      actionAdvice = 'Giải ngân chủ lực 40–50% ở nhịp chỉnh cạn cung LPS trên MA20/MA50';
      const lpsLow = Math.min(currentPrice, sma20 > 0 ? sma20 : currentPrice);
      const lpsHigh = Math.max(currentPrice, sma20 > 0 ? sma20 * 1.02 : currentPrice * 1.01);
      wyckoffBuyZone = `${formatPrice(lpsLow * 0.99)} – ${formatPrice(lpsHigh)}`;
      wyckoffStopLoss = `${formatPrice(Math.max(last20Low * 0.98, currentPrice * 0.93))}`;
    } else if (isPhaseCEligible) {
      wyckoffPhase = 'Phase C';
      phaseIndex = 2;
      wyckoffPhaseName = 'Phase C — Spring / Test cạn cung';
      completedPhases = ['Phase A', 'Phase B'];
      nextMilestone = 'Xuất hiện cây nến SOS bứt phá vượt qua nửa trên nền kèm Volume lớn để chuyển sang Phase D';
      phaseProgressPct = 55;
      isBuyPhase = true;
      buyPointCode = 'BUY_1_SPRING';
      buyPointLabel = '🎯 ĐIỂM MUA #1: Phase C — Test Spring cạn cung (Thăm dò 20-30%)';
      buyPointDetail = 'Nhịp rũ bỏ Spring bẫy phe bán dưới đáy nền hoặc kiểm định đáy với thanh khoản cạn kiệt thành công.';
      actionAdvice = 'Mua thăm dò 20–30% khi nến rút chân và Test lại đáy nền Vol thấp';
      wyckoffBuyZone = `${formatPrice(supportBaseRef)} – ${formatPrice(supportBaseRef * 1.03)}`;
      wyckoffStopLoss = `${formatPrice(minLowLast10 * 0.975)}`;
    } else {
      // Mặc định Phase B: Nền tảng tích lũy xây dựng nguyên nhân
      wyckoffPhase = 'Phase B';
      phaseIndex = 1;
      wyckoffPhaseName = 'Phase B — Gom hàng đi ngang';
      completedPhases = ['Phase A'];
      nextMilestone =
        'Xuất hiện nhịp rũ bỏ Spring cạn cung (Phase C) hoặc nổ Vol SOS vượt nửa trên nền (Phase D)';
      phaseProgressPct = 35;
      isBuyPhase = false;
      buyPointCode = 'NONE';
      buyPointLabel = '⏳ CHƯA MUA (Phase B — Đi ngang gom hàng, chờ sang Phase C/D)';
      buyPointDetail =
        'Cổ phiếu đang tích lũy đi ngang hấp thụ nguồn cung trong Trading Range. Kiên nhẫn chờ điểm rũ bỏ hoặc bứt phá.';
      actionAdvice = 'Chờ rũ bỏ Spring (Phase C) hoặc nổ Vol SOS (Phase D)';
      wyckoffBuyZone = `Chờ quanh ${formatPrice(supportBaseRef)}`;
      wyckoffStopLoss = `${formatPrice(supportBaseRef * 0.96)}`;
    }

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
    // Stoploss động: Tuân thủ nghiêm ngặt quy tắc Mark Minervini tối đa -7% đến -8%
    let stopLossPrice = Number((currentPrice * 0.93).toFixed(1));
    if (swingLow < currentPrice && swingLow >= currentPrice * 0.93) {
      stopLossPrice = Number((swingLow * 0.985).toFixed(1));
    }
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
        `Chốt lời chủ động 1/2 vị thế khi đạt Target 1 (${targetPrice1}), phần còn lại trailing stop theo MA20.`,
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
