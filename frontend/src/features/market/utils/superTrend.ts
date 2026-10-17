import { CandlestickData, Time, LineData } from 'lightweight-charts';

export interface SuperTrendSettings {
  period: number; // ATR Period (default 10)
  multiplier: number; // ATR Multiplier (default 3.0)
  kamaPeriod: number; // KAMA Period (default 10)
  kamaFast: number; // KAMA Fast Period (default 2)
  kamaSlow: number; // KAMA Slow Period (default 30)
}

export const DEFAULT_SUPERTREND_SETTINGS: SuperTrendSettings = {
  period: 10,
  multiplier: 3.0,
  kamaPeriod: 10,
  kamaFast: 2,
  kamaSlow: 30,
};

export interface SuperTrendSignal {
  type: 'BUY' | 'SELL';
  candleIndex: number;
  time: Time;
  entryPrice: number;
  stopLossPrice: number;
  riskAmount: number;
  riskPercent: number;
  target1_5R: number;
  target3R: number;
}

export interface SuperTrendPoint {
  time: Time;
  value: number;
  trend: 1 | -1; // 1 = Uptrend, -1 = Downtrend
  upperBand: number;
  lowerBand: number;
}

export interface TradeBacktestRecord {
  id: number;
  entryDate: string | Time;
  entryPrice: number;
  stopLossPrice: number;
  target1_5R: number;
  target3R: number;
  riskPercent: number;
  exitDate?: string | Time;
  exitPrice?: number;
  exitReason: 'TARGET_3R' | 'TARGET_1_5R' | 'STOP_LOSS' | 'TREND_REVERSAL' | 'HOLDING';
  pnlR: number; // Return in terms of R multiple (+3R, +1.5R, -1R, etc.)
  pnlPercent: number; // % Profit / Loss
  holdingCandles: number;
  status: 'WIN' | 'LOSS' | 'HOLDING';
}

export interface SuperTrendBacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  openTrades: number;
  winRate: number; // In % (e.g. 66.7)
  profitFactor: number; // Gross Wins / Gross Losses
  totalReturnR: number; // Cumulative R
  totalReturnPct: number; // Cumulative %
  avgReturnPerTrade: number; // % per trade
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  strengthScore: number; // 0 - 100
  strengthRating: 'RẤT MẠNH' | 'MẠNH' | 'TRUNG BÌNH' | 'YẾU';
  strengthSummary: string;
  trades: TradeBacktestRecord[];
}

export interface SuperTrendBandPoint {
  time: Time;
  candleIndex: number;
  trend: 1 | -1;
  stValue: number;
  kamaValue: number;
  isReversal: boolean;
}

export interface SuperTrendResult {
  stUpLine: LineData<Time>[]; // Green line points (Uptrend)
  stDownLine: LineData<Time>[]; // Red line points (Downtrend)
  kamaLine: LineData<Time>[]; // Kaufman Adaptive Moving Average
  bands: SuperTrendBandPoint[]; // Full band points for shaded cloud rendering
  currentTrend: 1 | -1; // 1: Uptrend, -1: Downtrend
  currentValue: number; // Current active band price
  currentKama?: number;
  latestSignal: SuperTrendSignal | null;
  allSignals: SuperTrendSignal[];
  backtest: SuperTrendBacktestResult;
}

/**
 * Calculates True Range (TR) and Average True Range (Wilder's ATR)
 */
function calculateATR(candles: CandlestickData<Time>[], period: number): number[] {
  const n = candles.length;
  if (n === 0) return [];
  const tr: number[] = new Array(n).fill(0);

  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  const atr: number[] = new Array(n).fill(0);
  if (n < period) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += tr[i];
      atr[i] = sum / (i + 1);
    }
    return atr;
  }

  // Initial SMA for first ATR
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr[period - 1] = sum / period;

  // Wilder's Smoothing for subsequent values
  for (let i = period; i < n; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  // Backfill first period items with initial average
  for (let i = 0; i < period - 1; i++) {
    atr[i] = atr[period - 1];
  }

  return atr;
}

/**
 * Calculates Kaufman Adaptive Moving Average (KAMA)
 * As seen in pro TradingView SuperTrend templates
 */
function calculateKAMA(
  candles: CandlestickData<Time>[],
  period: number = 10,
  fast: number = 2,
  slow: number = 30
): LineData<Time>[] {
  const n = candles.length;
  if (n === 0) return [];
  const result: LineData<Time>[] = [];

  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);

  let prevKama = candles[0].close;

  for (let i = 0; i < n; i++) {
    if (i < period) {
      prevKama = candles[i].close;
      result.push({ time: candles[i].time, value: Number(prevKama.toFixed(2)) });
      continue;
    }

    const direction = Math.abs(candles[i].close - candles[i - period].close);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) {
      volatility += Math.abs(candles[j].close - candles[j - 1].close);
    }

    const er = volatility === 0 ? 0 : direction / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    const kama = prevKama + sc * (candles[i].close - prevKama);
    prevKama = kama;

    result.push({ time: candles[i].time, value: Number(kama.toFixed(2)) });
  }

  return result;
}

/**
 * Main SuperTrend Indicator Calculation with Trailing Bands and Signal Detection
 */
export function calculateSuperTrend(
  candles: CandlestickData<Time>[],
  settings: SuperTrendSettings = DEFAULT_SUPERTREND_SETTINGS
): SuperTrendResult {
  const n = candles.length;
  if (n === 0) {
    return {
      stUpLine: [],
      stDownLine: [],
      kamaLine: [],
      bands: [],
      currentTrend: 1,
      currentValue: 0,
      latestSignal: null,
      allSignals: [],
      backtest: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        openTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalReturnR: 0,
        totalReturnPct: 0,
        avgReturnPerTrade: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        strengthScore: 0,
        strengthRating: 'TRUNG BÌNH',
        strengthSummary: 'Chưa có đủ dữ liệu nến.',
        trades: [],
      },
    };
  }

  const { period, multiplier } = settings;
  const atr = calculateATR(candles, period);
  const kamaLine = calculateKAMA(candles, settings.kamaPeriod, settings.kamaFast, settings.kamaSlow);

  const basicUpper: number[] = new Array(n).fill(0);
  const basicLower: number[] = new Array(n).fill(0);
  const finalUpper: number[] = new Array(n).fill(0);
  const finalLower: number[] = new Array(n).fill(0);
  const trend: (1 | -1)[] = new Array(n).fill(1);
  const superTrendValues: number[] = new Array(n).fill(0);

  const allSignals: SuperTrendSignal[] = [];

  for (let i = 0; i < n; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    basicUpper[i] = hl2 + multiplier * atr[i];
    basicLower[i] = hl2 - multiplier * atr[i];

    if (i === 0) {
      finalUpper[0] = basicUpper[0];
      finalLower[0] = basicLower[0];
      trend[0] = candles[0].close >= hl2 ? 1 : -1;
      superTrendValues[0] = trend[0] === 1 ? finalLower[0] : finalUpper[0];
      continue;
    }

    const prevFinalUpper = finalUpper[i - 1];
    const prevFinalLower = finalLower[i - 1];
    const prevClose = candles[i - 1].close;

    // Trailing Upper Band
    if (basicUpper[i] < prevFinalUpper || prevClose > prevFinalUpper) {
      finalUpper[i] = basicUpper[i];
    } else {
      finalUpper[i] = prevFinalUpper;
    }

    // Trailing Lower Band
    if (basicLower[i] > prevFinalLower || prevClose < prevFinalLower) {
      finalLower[i] = basicLower[i];
    } else {
      finalLower[i] = prevFinalLower;
    }

    // Trend Direction Flip Logic
    const prevTrend = trend[i - 1];
    if (prevTrend === 1) {
      if (candles[i].close < finalLower[i]) {
        trend[i] = -1; // Switch to Downtrend
      } else {
        trend[i] = 1;
      }
    } else {
      if (candles[i].close > finalUpper[i]) {
        trend[i] = 1; // Switch to Uptrend
      } else {
        trend[i] = -1;
      }
    }

    superTrendValues[i] = trend[i] === 1 ? finalLower[i] : finalUpper[i];

    // Detect Reversal Signals
    if (prevTrend === -1 && trend[i] === 1) {
      // BUY SIGNAL (ST chuyển từ đỏ sang xanh)
      const entryPrice = candles[i].close;
      const stopLossPrice = Number(finalLower[i].toFixed(2));
      const riskAmount = Math.max(0.01, entryPrice - stopLossPrice);
      const riskPercent = Number((((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(2));
      const target1_5R = Number((entryPrice + 1.5 * riskAmount).toFixed(2));
      const target3R = Number((entryPrice + 3.0 * riskAmount).toFixed(2));

      allSignals.push({
        type: 'BUY',
        candleIndex: i,
        time: candles[i].time,
        entryPrice: Number(entryPrice.toFixed(2)),
        stopLossPrice,
        riskAmount: Number(riskAmount.toFixed(2)),
        riskPercent,
        target1_5R,
        target3R,
      });
    } else if (prevTrend === 1 && trend[i] === -1) {
      // SELL SIGNAL (ST chuyển từ xanh sang đỏ)
      const exitPrice = candles[i].close;
      allSignals.push({
        type: 'SELL',
        candleIndex: i,
        time: candles[i].time,
        entryPrice: Number(exitPrice.toFixed(2)),
        stopLossPrice: Number(finalUpper[i].toFixed(2)),
        riskAmount: 0,
        riskPercent: 0,
        target1_5R: 0,
        target3R: 0,
      });
    }
  }

  // Tách ra 2 đường stUpLine và stDownLine để hiển thị màu xanh/đỏ mượt mà
  const stUpLine: LineData<Time>[] = [];
  const stDownLine: LineData<Time>[] = [];

  for (let i = 0; i < n; i++) {
    const val = Number(superTrendValues[i].toFixed(2));
    if (trend[i] === 1) {
      stUpLine.push({ time: candles[i].time, value: val });
    } else {
      stDownLine.push({ time: candles[i].time, value: val });
    }
  }

  // Lấy tín hiệu BUY gần nhất (hoặc tín hiệu đang hoạt động)
  let latestSignal: SuperTrendSignal | null = null;
  for (let i = allSignals.length - 1; i >= 0; i--) {
    if (allSignals[i].type === 'BUY') {
      latestSignal = allSignals[i];
      break;
    }
  }

  // Tạo mảng bands đầy đủ để vẽ dải mây (cloud) giữa SuperTrend và KAMA
  const bands: SuperTrendBandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const isReversal = i > 0 && trend[i] !== trend[i - 1];
    const kamaVal = kamaLine[i]?.value ?? candles[i].close;
    bands.push({
      time: candles[i].time,
      candleIndex: i,
      trend: trend[i],
      stValue: Number(superTrendValues[i].toFixed(2)),
      kamaValue: Number(kamaVal.toFixed(2)),
      isReversal,
    });
  }

  // Chạy Backtest mô phỏng trên lịch sử nến
  const backtest = runSuperTrendBacktest(candles, allSignals, trend, superTrendValues);

  const lastIdx = n - 1;
  const currentTrend = trend[lastIdx];
  const currentValue = Number(superTrendValues[lastIdx].toFixed(2));
  const currentKama = kamaLine.length > 0 ? kamaLine[kamaLine.length - 1].value : undefined;

  return {
    stUpLine,
    stDownLine,
    kamaLine,
    bands,
    currentTrend,
    currentValue,
    currentKama,
    latestSignal,
    allSignals,
    backtest,
  };
}

/**
 * Backtest Engine for SuperTrend R:R Trading Strategy
 * Evaluates performance: Win Rate, Profit Factor, R-multiples, and Strength Rating
 */
function runSuperTrendBacktest(
  candles: CandlestickData<Time>[],
  signals: SuperTrendSignal[],
  trend: (1 | -1)[],
  superTrendValues: number[]
): SuperTrendBacktestResult {
  const buySignals = signals.filter((s) => s.type === 'BUY');
  const n = candles.length;
  const trades: TradeBacktestRecord[] = [];

  let winningTrades = 0;
  let losingTrades = 0;
  let openTrades = 0;
  let grossWinsR = 0;
  let grossLossesR = 0;
  let cumulativeR = 0;
  let cumulativePct = 0;

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  buySignals.forEach((sig, tradeIdx) => {
    const startIdx = sig.candleIndex;
    const entryPrice = sig.entryPrice;
    const stopLossPrice = sig.stopLossPrice;
    const target1_5R = sig.target1_5R;
    const target3R = sig.target3R;
    const risk = Math.max(0.01, entryPrice - stopLossPrice);

    let exitReason: TradeBacktestRecord['exitReason'] = 'HOLDING';
    let exitPrice = entryPrice;
    let exitDate: Time = sig.time;
    let holdingCandles = 0;
    let pnlR = 0;
    let pnlPercent = 0;
    let isFinished = false;

    // Scan subsequent candles until trade hits Target 3R, Target 1.5R, Stop Loss, or Reversal
    for (let k = startIdx + 1; k < n; k++) {
      holdingCandles++;
      const high = candles[k].high;
      const low = candles[k].low;
      const close = candles[k].close;

      // 1. Check if Target 3R reached
      if (high >= target3R) {
        exitReason = 'TARGET_3R';
        exitPrice = target3R;
        exitDate = candles[k].time;
        pnlR = 3.0;
        pnlPercent = Number((((target3R - entryPrice) / entryPrice) * 100).toFixed(2));
        isFinished = true;
        break;
      }

      // 2. Check if Stop Loss touched
      if (low <= stopLossPrice) {
        exitReason = 'STOP_LOSS';
        exitPrice = stopLossPrice;
        exitDate = candles[k].time;
        pnlR = -1.0;
        pnlPercent = Number((((stopLossPrice - entryPrice) / entryPrice) * 100).toFixed(2));
        isFinished = true;
        break;
      }

      // 3. Check if Trend flipped to Downtrend
      if (trend[k] === -1) {
        exitReason = 'TREND_REVERSAL';
        exitPrice = close;
        exitDate = candles[k].time;
        pnlR = Number(((close - entryPrice) / risk).toFixed(2));
        pnlPercent = Number((((close - entryPrice) / entryPrice) * 100).toFixed(2));
        isFinished = true;
        break;
      }
    }

    if (!isFinished) {
      // Vẫn đang nắm giữ (Lệnh mở)
      const lastCandle = candles[n - 1];
      exitPrice = lastCandle.close;
      exitDate = lastCandle.time;
      pnlR = Number(((lastCandle.close - entryPrice) / risk).toFixed(2));
      pnlPercent = Number((((lastCandle.close - entryPrice) / entryPrice) * 100).toFixed(2));
      exitReason = 'HOLDING';
      openTrades++;
    }

    // Xác định Trạng thái Thắng / Thua (Đạt từ 1.5R trở lên hoặc kết thúc có lãi > 0)
    let status: TradeBacktestRecord['status'] = 'HOLDING';
    if (isFinished) {
      if (pnlR > 0) {
        status = 'WIN';
        winningTrades++;
        grossWinsR += pnlR;
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else {
        status = 'LOSS';
        losingTrades++;
        grossLossesR += Math.abs(pnlR);
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }
      cumulativeR += pnlR;
      cumulativePct += pnlPercent;
    }

    trades.push({
      id: tradeIdx + 1,
      entryDate: sig.time,
      entryPrice,
      stopLossPrice,
      target1_5R,
      target3R,
      riskPercent: sig.riskPercent,
      exitDate,
      exitPrice: Number(exitPrice.toFixed(2)),
      exitReason,
      pnlR,
      pnlPercent,
      holdingCandles,
      status,
    });
  });

  const totalClosedTrades = winningTrades + losingTrades;
  const winRate = totalClosedTrades > 0 ? Number(((winningTrades / totalClosedTrades) * 100).toFixed(1)) : 0;
  const profitFactor = grossLossesR > 0 ? Number((grossWinsR / grossLossesR).toFixed(2)) : grossWinsR > 0 ? 99 : 0;
  const avgReturnPerTrade = totalClosedTrades > 0 ? Number((cumulativePct / totalClosedTrades).toFixed(2)) : 0;

  // Đánh giá Sức mạnh Chiến lược
  let strengthScore = 50;
  let strengthRating: SuperTrendBacktestResult['strengthRating'] = 'TRUNG BÌNH';
  let strengthSummary = '';

  if (totalClosedTrades === 0) {
    strengthScore = 50;
    strengthRating = 'TRUNG BÌNH';
    strengthSummary = 'Chưa có đủ số lượng lệnh hoàn tất để đánh giá chính xác.';
  } else if (winRate >= 65 && profitFactor >= 2.0) {
    strengthScore = Math.min(98, Math.round(winRate * 0.6 + profitFactor * 10));
    strengthRating = 'RẤT MẠNH';
    strengthSummary = `Chiến lược hoạt động CỰC MẠNH trên mã này: Tỷ lệ thắng ${winRate}% với hệ số lãi/lỗ ${profitFactor}. Xu hướng dòng tiền phản ứng rất chuẩn với dải SuperTrend.`;
  } else if (winRate >= 50 && profitFactor >= 1.3) {
    strengthScore = Math.min(84, Math.round(winRate * 0.7 + profitFactor * 8));
    strengthRating = 'MẠNH';
    strengthSummary = `Chiến lược đạt hiệu quả TỐT: Tỷ lệ thắng ${winRate}%, hệ số lợi nhuận ${profitFactor}. Ưu tiên chốt lời từng phần tại mốc 1.5R.`;
  } else if (winRate >= 40 && profitFactor >= 1.0) {
    strengthScore = 55;
    strengthRating = 'TRUNG BÌNH';
    strengthSummary = `Hiệu quả ở mức TRUNG BÌNH (${winRate}% win). Cổ phiếu có giai đoạn sideway tích lũy gây nhiễu, nên kết hợp thêm bộ lọc KAMA hoặc MA21.`;
  } else {
    strengthScore = 35;
    strengthRating = 'YẾU';
    strengthSummary = `Hiệu quả YẾU (${winRate}% win, PF ${profitFactor}). Cổ phiếu biến động giằng co mạnh (choppy market), khuyến nghị không mua đuổi khi có tín hiệu ST đảo chiều.`;
  }

  return {
    totalTrades: buySignals.length,
    winningTrades,
    losingTrades,
    openTrades,
    winRate,
    profitFactor,
    totalReturnR: Number(cumulativeR.toFixed(1)),
    totalReturnPct: Number(cumulativePct.toFixed(1)),
    avgReturnPerTrade,
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLossStreak,
    strengthScore,
    strengthRating,
    strengthSummary,
    trades: trades.reverse(), // Lệnh mới nhất đưa lên đầu
  };
}
