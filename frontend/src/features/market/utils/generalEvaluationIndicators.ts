import { CandlestickData, LineData, HistogramData, Time } from 'lightweight-charts';

export interface GeneralEvaluationConfluence {
  bullishCount: number;
  totalCount: number;
  verdict: 'MUA MẠNH' | 'TÍCH CỰC' | 'TRUNG LẬP' | 'THẬN TRỌNG' | 'ÁP LỰC BÁN';
  summaryText: string;
  factors: {
    kamaBull: boolean;
    vortexBull: boolean;
    macdBull: boolean;
    aoBull: boolean;
    rsiBull: boolean;
  };
}

export interface GeneralEvaluationDataset {
  kamaPoints: LineData<Time>[];
  volumeMAPoints: LineData<Time>[];
  viPlusPoints: LineData<Time>[];
  viMinusPoints: LineData<Time>[];
  macdPoints: LineData<Time>[];
  signalPoints: LineData<Time>[];
  histPoints: HistogramData<Time>[];
  aoPoints: HistogramData<Time>[];
  rsiPoints: LineData<Time>[];
  // Telemetry latest values
  currentClose?: number;
  currentKAMA?: number;
  currentVIPlus?: number;
  currentVIMinus?: number;
  currentMACD?: number;
  currentSignal?: number;
  currentHist?: number;
  currentAO?: number;
  currentAORising?: boolean;
  currentRSI?: number;
  currentVolumeMA?: number;
  confluence?: GeneralEvaluationConfluence;
}

export function evaluateConfluenceState(params: {
  close?: number;
  kama?: number;
  viPlus?: number;
  viMinus?: number;
  macd?: number;
  signal?: number;
  hist?: number;
  ao?: number;
  aoRising?: boolean;
  rsi?: number;
}): GeneralEvaluationConfluence {
  const kamaBull =
    params.close !== undefined && params.kama !== undefined ? params.close >= params.kama : false;
  const vortexBull =
    params.viPlus !== undefined && params.viMinus !== undefined ? params.viPlus > params.viMinus : false;
  const macdBull =
    params.macd !== undefined && params.signal !== undefined ? params.macd > params.signal : false;
  const aoBull =
    params.ao !== undefined ? params.ao > 0 || Boolean(params.aoRising && params.ao > -0.5) : false;
  const rsiBull = params.rsi !== undefined ? params.rsi >= 50 && params.rsi < 78 : false;

  const factors = { kamaBull, vortexBull, macdBull, aoBull, rsiBull };
  const bullishCount = [kamaBull, vortexBull, macdBull, aoBull, rsiBull].filter(Boolean).length;
  const totalCount = 5;

  let verdict: GeneralEvaluationConfluence['verdict'] = 'TRUNG LẬP';
  let summaryText = 'Tín hiệu phân hóa, ưu tiên quan sát';

  if (bullishCount === 5) {
    verdict = 'MUA MẠNH';
    summaryText = 'Đồng thuận tăng 5/5 chỉ báo';
  } else if (bullishCount === 4) {
    verdict = 'TÍCH CỰC';
    summaryText = 'Xu hướng & động lượng ủng hộ chiều tăng (4/5)';
  } else if (bullishCount === 3) {
    verdict = 'TRUNG LẬP';
    summaryText = 'Nghiêng tích cực (3/5), chờ xác nhận đồng thuận';
  } else if (bullishCount === 2) {
    verdict = 'THẬN TRỌNG';
    summaryText = 'Động lượng suy yếu (2/5), hạn chế mua đuổi';
  } else {
    verdict = 'ÁP LỰC BÁN';
    summaryText = `Áp lực giảm chiếm ưu thế (${bullishCount}/5 tăng)`;
  }

  return {
    bullishCount,
    totalCount,
    verdict,
    summaryText,
    factors,
  };
}

/**
 * 1. KAMA - Kaufman's Adaptive Moving Average (Perry Kaufman)
 * Parameters: period = 30, fast = 2, slow = 60
 * - Automatically adapts: slows down in sideways markets, accelerates in trending markets.
 */
export function calculateKAMA(
  candles: CandlestickData<Time>[],
  period = 30,
  fast = 2,
  slow = 60
): LineData<Time>[] {
  if (!candles || candles.length < period + 1) return [];

  const results: LineData<Time>[] = [];
  const closes = candles.map((c) => c.close);
  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);

  // Initialize first KAMA with SMA of the first `period` closes
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += closes[i];
  }
  let prevKAMA = initialSum / period;
  results.push({
    time: candles[period - 1].time,
    value: Math.round(prevKAMA * 100) / 100,
  });

  for (let i = period; i < candles.length; i++) {
    const change = Math.abs(closes[i] - closes[i - period]);
    let volatility = 0;
    for (let j = 0; j < period; j++) {
      volatility += Math.abs(closes[i - j] - closes[i - j - 1]);
    }

    const er = volatility === 0 ? 0 : change / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    const kama = prevKAMA + sc * (closes[i] - prevKAMA);

    prevKAMA = kama;
    results.push({
      time: candles[i].time,
      value: Math.round(kama * 100) / 100,
    });
  }

  return results;
}

/**
 * 2. Vortex Indicator (VI+, VI-) - Etienne Botes & Douglas Siepman
 * Parameter: period = 14
 * Measures positive & negative vortex movement against true range.
 */
export function calculateVortex(
  candles: CandlestickData<Time>[],
  period = 14
): { viPlus: LineData<Time>[]; viMinus: LineData<Time>[] } {
  if (!candles || candles.length <= period) return { viPlus: [], viMinus: [] };

  const tr: number[] = [];
  const vmPlus: number[] = [];
  const vmMinus: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    const hl = current.high - current.low;
    const hc = Math.abs(current.high - prev.close);
    const lc = Math.abs(current.low - prev.close);
    const trueRange = Math.max(hl, hc, lc);

    const vmp = Math.abs(current.high - prev.low);
    const vmm = Math.abs(current.low - prev.high);

    tr.push(trueRange);
    vmPlus.push(vmp);
    vmMinus.push(vmm);
  }

  const viPlus: LineData<Time>[] = [];
  const viMinus: LineData<Time>[] = [];

  for (let i = period - 1; i < tr.length; i++) {
    let sumTR = 0;
    let sumVMP = 0;
    let sumVMM = 0;

    for (let j = i - period + 1; j <= i; j++) {
      sumTR += tr[j];
      sumVMP += vmPlus[j];
      sumVMM += vmMinus[j];
    }

    const vp = sumTR === 0 ? 0 : sumVMP / sumTR;
    const vm = sumTR === 0 ? 0 : sumVMM / sumTR;
    // index in candles is i + 1
    const candleTime = candles[i + 1].time;

    viPlus.push({ time: candleTime, value: Math.round(vp * 10000) / 10000 });
    viMinus.push({ time: candleTime, value: Math.round(vm * 10000) / 10000 });
  }

  return { viPlus, viMinus };
}

/**
 * 3. Awesome Oscillator (AO) - Bill Williams
 * Parameters: fast = 5, slow = 34
 * AO = SMA(Median Price, 5) - SMA(Median Price, 34)
 */
export function calculateAwesomeOscillator(
  candles: CandlestickData<Time>[],
  fast = 5,
  slow = 34
): HistogramData<Time>[] {
  if (!candles || candles.length < slow) return [];

  const medianPrices = candles.map((c) => (c.high + c.low) / 2);
  const aoPoints: HistogramData<Time>[] = [];
  let prevAO: number | null = null;

  for (let i = slow - 1; i < candles.length; i++) {
    let sumFast = 0;
    for (let j = i - fast + 1; j <= i; j++) {
      sumFast += medianPrices[j];
    }
    const smaFast = sumFast / fast;

    let sumSlow = 0;
    for (let j = i - slow + 1; j <= i; j++) {
      sumSlow += medianPrices[j];
    }
    const smaSlow = sumSlow / slow;

    const rawAO = smaFast - smaSlow;
    const ao = Math.round(rawAO * 1000) / 1000;
    // Green if current AO >= prev AO, red if current AO < prev AO
    const isIncreasing = prevAO === null ? rawAO >= 0 : rawAO >= prevAO;
    prevAO = rawAO;

    aoPoints.push({
      time: candles[i].time,
      value: ao,
      color: isIncreasing ? 'rgba(16, 185, 129, 0.88)' : 'rgba(244, 63, 94, 0.88)',
    });
  }

  return aoPoints;
}

/**
 * 4. MACD - Moving Average Convergence Divergence
 * Parameters: fast = 12, slow = 26, signal = 9
 */
export function calculateMACDData(
  candles: CandlestickData<Time>[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: LineData<Time>[]; signal: LineData<Time>[]; hist: HistogramData<Time>[] } {
  if (!candles || candles.length < slow + signal) return { macd: [], signal: [], hist: [] };

  const closes = candles.map((c) => c.close);
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signal + 1);

  let emaFast = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
  // Advance fast EMA up to index slow-1 so both EMAs are aligned at index slow-1
  for (let i = fast; i < slow; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
  }
  let emaSlow = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow;

  const macdValues: number[] = [emaFast - emaSlow];
  const times: Time[] = [candles[slow - 1].time];

  for (let i = slow; i < candles.length; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
    emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
    macdValues.push(emaFast - emaSlow);
    times.push(candles[i].time);
  }

  let signalEma = macdValues.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  const macdSeries: LineData<Time>[] = [];
  const signalSeries: LineData<Time>[] = [];
  const histSeries: HistogramData<Time>[] = [];
  let prevHist: number | null = null;

  for (let i = signal - 1; i < macdValues.length; i++) {
    if (i >= signal) {
      signalEma = macdValues[i] * kSignal + signalEma * (1 - kSignal);
    }
    const rawM = macdValues[i];
    const rawS = signalEma;
    const rawH = rawM - rawS;

    const m = Math.round(rawM * 1000) / 1000;
    const s = Math.round(rawS * 1000) / 1000;
    const h = Math.round(rawH * 1000) / 1000;
    const t = times[i];

    // 4-phase TradingView Histogram coloring (Growing vs Fading Momentum)
    let histColor = 'rgba(16, 185, 129, 0.88)';
    if (rawH >= 0) {
      histColor =
        prevHist === null || rawH >= prevHist
          ? 'rgba(16, 185, 129, 0.90)'
          : 'rgba(16, 185, 129, 0.42)';
    } else {
      histColor =
        prevHist === null || rawH <= prevHist
          ? 'rgba(244, 63, 94, 0.90)'
          : 'rgba(244, 63, 94, 0.42)';
    }
    prevHist = rawH;

    macdSeries.push({ time: t, value: m });
    signalSeries.push({ time: t, value: s });
    histSeries.push({
      time: t,
      value: h,
      color: histColor,
    });
  }

  return { macd: macdSeries, signal: signalSeries, hist: histSeries };
}

/**
 * 5. RSI - Relative Strength Index (J. Welles Wilder)
 * Parameter: period = 14
 */
export function calculateRSIData(candles: CandlestickData<Time>[], period = 14): LineData<Time>[] {
  if (!candles || candles.length <= period) return [];

  const closes = candles.map((c) => c.close);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const results: LineData<Time>[] = [];
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS);
  results.push({ time: candles[period].time, value: Math.round(firstRSI * 100) / 100 });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    results.push({
      time: candles[i].time,
      value: Math.round(rsi * 100) / 100,
    });
  }

  return results;
}

/**
 * 6. Volume MA20 (MA20KL)
 */
export function calculateVolumeMA(
  volumes: HistogramData<Time>[],
  period = 20
): LineData<Time>[] {
  if (!volumes || volumes.length < period) return [];

  const results: LineData<Time>[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += volumes[i].value;
  }
  results.push({ time: volumes[period - 1].time, value: Math.round(sum / period) });

  for (let i = period; i < volumes.length; i++) {
    sum += volumes[i].value - volumes[i - period].value;
    results.push({ time: volumes[i].time, value: Math.round(sum / period) });
  }

  return results;
}

/**
 * Aggregates all indicators for General Technical Evaluation Suite in one pass.
 */
export function calculateGeneralEvaluationDataset(
  candles: CandlestickData<Time>[],
  volumes: HistogramData<Time>[] = []
): GeneralEvaluationDataset {
  if (!candles || candles.length === 0) {
    return {
      kamaPoints: [],
      volumeMAPoints: [],
      viPlusPoints: [],
      viMinusPoints: [],
      macdPoints: [],
      signalPoints: [],
      histPoints: [],
      aoPoints: [],
      rsiPoints: [],
    };
  }

  const kamaPoints = calculateKAMA(candles, 30, 2, 60);
  const vortexRes = calculateVortex(candles, 14);
  const aoPoints = calculateAwesomeOscillator(candles, 5, 34);
  const macdRes = calculateMACDData(candles, 12, 26, 9);
  const rsiPoints = calculateRSIData(candles, 14);
  const volumeMAPoints = volumes.length >= 20 ? calculateVolumeMA(volumes, 20) : [];

  const lastClose = candles[candles.length - 1]?.close;
  const lastKama = kamaPoints[kamaPoints.length - 1]?.value;
  const lastVIPlus = vortexRes.viPlus[vortexRes.viPlus.length - 1]?.value;
  const lastVIMinus = vortexRes.viMinus[vortexRes.viMinus.length - 1]?.value;
  const lastMACD = macdRes.macd[macdRes.macd.length - 1]?.value;
  const lastSignal = macdRes.signal[macdRes.signal.length - 1]?.value;
  const lastHist = macdRes.hist[macdRes.hist.length - 1]?.value;
  const lastAO = aoPoints[aoPoints.length - 1]?.value;
  const prevAO = aoPoints.length >= 2 ? aoPoints[aoPoints.length - 2]?.value : undefined;
  const lastAORising = lastAO !== undefined && (prevAO === undefined || lastAO >= prevAO);
  const lastRSI = rsiPoints[rsiPoints.length - 1]?.value;
  const lastVolMA = volumeMAPoints[volumeMAPoints.length - 1]?.value;

  const confluence = evaluateConfluenceState({
    close: lastClose,
    kama: lastKama,
    viPlus: lastVIPlus,
    viMinus: lastVIMinus,
    macd: lastMACD,
    signal: lastSignal,
    hist: lastHist,
    ao: lastAO,
    aoRising: lastAORising,
    rsi: lastRSI,
  });

  return {
    kamaPoints,
    volumeMAPoints,
    viPlusPoints: vortexRes.viPlus,
    viMinusPoints: vortexRes.viMinus,
    macdPoints: macdRes.macd,
    signalPoints: macdRes.signal,
    histPoints: macdRes.hist,
    aoPoints,
    rsiPoints,
    currentClose: lastClose,
    currentKAMA: lastKama,
    currentVIPlus: lastVIPlus,
    currentVIMinus: lastVIMinus,
    currentMACD: lastMACD,
    currentSignal: lastSignal,
    currentHist: lastHist,
    currentAO: lastAO,
    currentAORising: lastAORising,
    currentRSI: lastRSI,
    currentVolumeMA: lastVolMA,
    confluence,
  };
}
