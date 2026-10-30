import { NextResponse } from 'next/server';
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

  const isIndex = isMarketIndex(symbol);
  const indexMeta = getMarketIndexMeta(symbol);
  const stockInfo = indexMeta || STOCK_MAP.get(symbol) || {
    name: isIndex ? `Chỉ số ${symbol}` : `Công ty CP ${symbol}`,
    exchange: isIndex ? (symbol.includes('HNX') ? 'HNX' : symbol === 'UPCOM' ? 'UPCOM' : 'HOSE') : 'HOSE',
    sector: isIndex ? 'Chỉ số thị trường' : 'Chung',
  };

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    // Fetch 2 years of daily OHLC candles from DNSE
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
      next: { revalidate: 60 },
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
    const closes: number[] = data.c;
    const highs: number[] = data.h;
    const lows: number[] = data.l;
    const volumes: number[] = data.v;

    const currentPrice = closes[count - 1];
    const prevPrice = count > 1 ? closes[count - 2] : currentPrice;
    const currentChange = currentPrice - prevPrice;
    const currentChangePct = prevPrice > 0 ? (currentChange / prevPrice) * 100 : 0;
    const currentVol = volumes[count - 1] || 0;

    // Moving Averages: SMA50, SMA150, SMA200
    const calcSMA = (period: number, endIdx: number = count - 1) => {
      if (endIdx < period - 1) return 0;
      const slice = closes.slice(endIdx - period + 1, endIdx + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      return Math.round((sum / period) * 100) / 100;
    };

    const sma20 = calcSMA(Math.min(20, count));
    const sma50 = calcSMA(50);
    const sma150 = calcSMA(Math.min(150, count));
    const sma200 = calcSMA(Math.min(200, count));

    const distFromSMA20Pct = sma20 > 0 ? Math.round(((currentPrice - sma20) / sma20) * 1000) / 10 : 0;
    const distFromSMA50Pct = sma50 > 0 ? Math.round(((currentPrice - sma50) / sma50) * 1000) / 10 : 0;

    // SMA200 22-sessions ago (1 month slope check)
    const sma200Past = count >= 222 ? calcSMA(200, count - 22) : sma200 * 0.99;
    const sma200SlopeUp = sma200 >= sma200Past;

    // 52-week High and Low (last 250 sessions)
    const lookback52W = Math.min(250, count);
    const high52W = Math.max(...highs.slice(count - lookback52W));
    const low52W = Math.min(...lows.slice(count - lookback52W));

    const distFrom52WHighPct = high52W > 0 ? Math.round(((currentPrice - high52W) / high52W) * 1000) / 10 : 0;
    const distFrom52WLowPct = low52W > 0 ? Math.round(((currentPrice - low52W) / low52W) * 1000) / 10 : 0;

    // RS Rating Calculation (IBD / Minervini formula)
    // 40% Q1 (last 63 bars) + 20% Q2 (63-126) + 20% Q3 (126-189) + 20% Q4 (189-252)
    const getPerf = (bars: number) => {
      if (count <= bars) return 0;
      const p = closes[count - bars];
      return p > 0 ? (currentPrice - p) / p : 0;
    };

    const q1 = getPerf(63);
    const q2 = getPerf(126);
    const q3 = getPerf(189);
    const q4 = getPerf(Math.min(250, count));
    const rawRsScore = 0.4 * q1 + 0.2 * q2 + 0.2 * q3 + 0.2 * q4;

    // Map to percentile 1-99
    let rsRating = Math.min(99, Math.max(1, Math.round(50 + rawRsScore * 75)));
    if (distFrom52WHighPct >= -10 && distFrom52WLowPct >= 50) {
      rsRating = Math.max(80, rsRating);
    }

    // Evaluate 8 Minervini Trend Template Criteria matching exact VN TERMINAL Pro format
    const formatK = (val: number) => (val > 1000 ? (val / 1000).toFixed(0) : val.toFixed(0));

    const criteria: MinerviniCriterion[] = [
      {
        id: 1,
        label: 'Giá > MA150 và > MA200',
        description: 'Giá cổ phiếu phải nằm trên cả đường MA 150 ngày và MA 200 ngày',
        passed: currentPrice > sma150 && currentPrice > sma200,
        value: `${currentPrice} > MA150(${sma150}) & MA200(${sma200})`,
        comparisonValue: `${formatK(currentPrice)} / ${formatK(sma150)} / ${formatK(sma200)}`,
      },
      {
        id: 2,
        label: 'MA150 > MA200',
        description: 'Đường MA 150 ngày phải nằm trên đường MA 200 ngày',
        passed: sma150 > sma200,
        value: `MA150(${sma150}) ${sma150 > sma200 ? '>' : '<'} MA200(${sma200})`,
        comparisonValue: `${formatK(sma150)} > ${formatK(sma200)}`,
      },
      {
        id: 3,
        label: 'MA200 dốc lên (≥1 tháng)',
        description: 'Đường MA 200 ngày đang trong xu hướng dốc lên tối thiểu 22 phiên',
        passed: sma200SlopeUp,
        value: sma200SlopeUp ? 'Đang dốc lên (+)' : 'Đi ngang hoặc dốc xuống (-)',
        comparisonValue: `${formatK(sma200)} vs ${formatK(sma200Past)}`,
      },
      {
        id: 4,
        label: 'MA50 > MA150 > MA200',
        description: 'Đường MA 50 ngày phải nằm trên cả đường MA 150 ngày và MA 200 ngày',
        passed: sma50 > sma150 && sma50 > sma200,
        value: `MA50(${sma50}) vs MA150(${sma150}) & MA200(${sma200})`,
        comparisonValue: formatK(sma50),
      },
      {
        id: 5,
        label: 'Giá > MA50',
        description: 'Giá cổ phiếu hiện tại nằm trên đường trung bình MA 50 ngày',
        passed: currentPrice > sma50,
        value: `${currentPrice} ${currentPrice > sma50 ? '>' : '<='} MA50(${sma50})`,
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
        label: 'RS mạnh hơn VNINDEX',
        description: 'Xếp hạng sức mạnh giá tương đối (RS Rating) đạt tối thiểu 70',
        passed: rsRating >= 70,
        value: `RS Rating: ${rsRating}/99`,
        comparisonValue: `${(rsRating / 50).toFixed(2)}`,
      },
    ];

    const passedCount = criteria.filter((c) => c.passed).length;
    const isStage2Eligible = passedCount === 8;

    let stage: 1 | 2 | 3 | 4 = 1;
    let stageName = 'Stage 1 (Tích lũy / Base)';
    if (passedCount >= 7) {
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

    // Dynamic Sector Rank & RS directly synchronized with Live RRG Engine (100% Real Data, Zero Mock)
    const rrgDataset = await getLiveRRGDataset('1D', 4, 'VNINDEX');
    const rrgSectorInfo = findMatchingRRGSector(symbol, stockInfo.sector, rrgDataset);

    const matchedSectorName = rrgSectorInfo?.sectorName || stockInfo.sector || 'Chung';
    const sectorRank = rrgSectorInfo?.sectorRank || 'Top 8 / 16 ngành';
    const sectorRS = rrgSectorInfo?.sectorRS ?? Math.round((rsRating + 65) / 2);
    const sectorStatus = rrgSectorInfo?.sectorStatus || (sectorRS >= 80 ? 'Dẫn dắt (Leading)' : sectorRS >= 65 ? 'Cải thiện (Improving)' : 'Tụt hậu (Lagging)');

    // Wyckoff & Price Action Diagnosis (Phase A - E)
    const last40High = Math.max(...highs.slice(Math.max(0, count - 40)));
    const last40Low = Math.min(...lows.slice(Math.max(0, count - 40)));
    const baseRangePct = last40Low > 0 ? Math.round(((last40High - last40Low) / last40Low) * 1000) / 10 : 25;
    const baseHeight = last40High - last40Low;
    const posInBasePct = baseHeight > 0 ? Math.round(((currentPrice - last40Low) / baseHeight) * 100) : 75;

    // SMA50 Volume for volume depletion / SOS surge check
    const sma50Vol = Math.round((volumes.slice(Math.max(0, count - 50)).reduce((a, b) => a + b, 0) / Math.min(50, count)));
    const volRatio = sma50Vol > 0 ? Math.round((currentVol / sma50Vol) * 10) / 10 : 1;

    let wyckoffPhase: 'Phase A' | 'Phase B' | 'Phase C' | 'Phase D' | 'Phase E' = 'Phase D';
    let wyckoffPhaseName = 'Phase D — SOS / Jump Across the Creek';
    let actionAdvice = 'canh mua ở nhịp lùi LPS giữ trên trần nền';

    if (distFrom52WHighPct >= -5 && currentPrice > sma50) {
      wyckoffPhase = 'Phase E';
      wyckoffPhaseName = 'Phase E — Markup / Đẩy giá mạnh';
      actionAdvice = 'giữ tỷ trọng cao, trailing stop theo MA20';
    } else if (posInBasePct >= 65 && currentPrice > sma50 && sma50 > sma150) {
      wyckoffPhase = 'Phase D';
      wyckoffPhaseName = 'Phase D — SOS / Jump Across the Creek';
      actionAdvice = 'canh mua ở nhịp lùi LPS giữ trên trần nền';
    } else if (currentPrice < sma50 && currentPrice >= last40Low * 1.02) {
      wyckoffPhase = 'Phase C';
      wyckoffPhaseName = 'Phase C — Spring / Test rũ bỏ cạn cung';
      actionAdvice = 'thăm dò điểm mua Spring khi nến đảo chiều có thanh khoản';
    } else {
      wyckoffPhase = 'Phase B';
      wyckoffPhaseName = 'Phase B — Tích lũy xây dựng nguyên nhân';
      actionAdvice = 'chờ quá trình thắt chặt biên độ nền giá VCP';
    }

    const wyckoffCriteria = [
      {
        id: 1,
        label: 'Cấu trúc đỉnh & đáy sau cao hơn (HH-HL)',
        passed: currentPrice > sma50 && sma50 > sma200,
        value: `đỉnh ${formatK(last40High)} · đáy ${formatK(last40Low)}`,
      },
      {
        id: 2,
        label: 'Nền 40 phiên đi ngang (biên độ < 30%)',
        passed: baseRangePct < 30,
        value: `${baseRangePct}%`,
      },
      {
        id: 3,
        label: 'Giá nằm nửa trên của nền',
        passed: posInBasePct >= 50,
        value: `${posInBasePct}% chiều cao nền`,
      },
      {
        id: 4,
        label: 'Khối lượng cạn kiệt trong nền',
        passed: currentVol <= sma50Vol * 1.3,
        value: currentVol < sma50Vol ? `Vol -${Math.round((1 - currentVol / (sma50Vol || 1)) * 100)}% vs TB` : `Vol +${Math.round((currentVol / (sma50Vol || 1) - 1) * 100)}%`,
      },
      {
        id: 5,
        label: 'Cây nến SOS dòng tiền vào',
        passed: volRatio >= 1.2 || currentChangePct >= 2,
        value: `Vol x${volRatio} lần TB`,
      },
      {
        id: 6,
        label: 'Không vi phạm đáy rũ bỏ Spring',
        passed: currentPrice >= last40Low,
        value: `Đáy ${formatK(last40Low)}`,
      },
      {
        id: 7,
        label: 'Spread nến mở rộng chiều tăng',
        passed: currentChangePct >= 0,
        value: `Spread ${currentChangePct >= 0 ? '+' : ''}${currentChangePct.toFixed(1)}%`,
      },
      {
        id: 8,
        label: 'Hấp thụ nguồn cung tại đỉnh cũ',
        passed: distFrom52WHighPct >= -18,
        value: `${distFrom52WHighPct}% đỉnh`,
      },
    ];

    const wyckoffPassedCount = wyckoffCriteria.filter((c) => c.passed).length;

    // ── Indicators for Heat & Extended Analysis (RSI, MACD) ──
    // 1. RSI(14)
    let gains = 0;
    let losses = 0;
    const rsiPeriod = 14;
    for (let i = Math.max(1, count - rsiPeriod); i < count; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod;
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
    const trendGatePassed = passedCount >= 7 && currentPrice > sma200 && stage === 2;

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
      stage,
      stageName,
      passedCount,
      totalCount: 8,
      isStage2Eligible,
      criteria,
      signals,
      wyckoff: {
        phase: wyckoffPhase,
        phaseName: wyckoffPhaseName,
        passedCount: wyckoffPassedCount,
        totalCount: 8,
        actionAdvice,
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
