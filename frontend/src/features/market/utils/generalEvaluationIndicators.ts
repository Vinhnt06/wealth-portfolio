import { CandlestickData, LineData, HistogramData, Time } from 'lightweight-charts';

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
  currentKAMA?: number;
  currentVIPlus?: number;
  currentVIMinus?: number;
  currentMACD?: number;
  currentSignal?: number;
  currentHist?: number;
  currentAO?: number;
  currentRSI?: number;
  currentVolumeMA?: number;
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

    viPlus.push({ time: candleTime, value: Math.round(vp * 100) / 100 });
    viMinus.push({ time: candleTime, value: Math.round(vm * 100) / 100 });
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
  if (!candles || candles.length <= slow) return [];

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

    const ao = Math.round((smaFast - smaSlow) * 100) / 100;
    // Green if current AO >= prev AO, red if current AO < prev AO
    const isIncreasing = prevAO === null ? ao >= 0 : ao >= prevAO;
    prevAO = ao;

    aoPoints.push({
      time: candles[i].time,
      value: ao,
      color: isIncreasing ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)',
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
  if (!candles || candles.length <= slow + signal) return { macd: [], signal: [], hist: [] };

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

  const macdValues: number[] = [];
  const times: Time[] = [];

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

  for (let i = signal - 1; i < macdValues.length; i++) {
    if (i >= signal) {
      signalEma = macdValues[i] * kSignal + signalEma * (1 - kSignal);
    }
    const m = Math.round(macdValues[i] * 100) / 100;
    const s = Math.round(signalEma * 100) / 100;
    const h = Math.round((m - s) * 100) / 100;
    const t = times[i];

    macdSeries.push({ time: t, value: m });
    signalSeries.push({ time: t, value: s });
    histSeries.push({
      time: t,
      value: h,
      color: h >= 0 ? 'rgba(59, 130, 246, 0.85)' : 'rgba(239, 68, 68, 0.85)',
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

  const lastKama = kamaPoints[kamaPoints.length - 1]?.value;
  const lastVIPlus = vortexRes.viPlus[vortexRes.viPlus.length - 1]?.value;
  const lastVIMinus = vortexRes.viMinus[vortexRes.viMinus.length - 1]?.value;
  const lastMACD = macdRes.macd[macdRes.macd.length - 1]?.value;
  const lastSignal = macdRes.signal[macdRes.signal.length - 1]?.value;
  const lastHist = macdRes.hist[macdRes.hist.length - 1]?.value;
  const lastAO = aoPoints[aoPoints.length - 1]?.value;
  const lastRSI = rsiPoints[rsiPoints.length - 1]?.value;
  const lastVolMA = volumeMAPoints[volumeMAPoints.length - 1]?.value;

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
    currentKAMA: lastKama,
    currentVIPlus: lastVIPlus,
    currentVIMinus: lastVIMinus,
    currentMACD: lastMACD,
    currentSignal: lastSignal,
    currentHist: lastHist,
    currentAO: lastAO,
    currentRSI: lastRSI,
    currentVolumeMA: lastVolMA,
  };
}
