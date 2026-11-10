import { CandlestickData, Time } from 'lightweight-charts';

export interface MCDXSettings {
  bankerPeriod: number; // Default 50
  bankerBase: number; // Default 50.0
  bankerSens: number; // Default 1.5
  bankerMaPeriod: number; // Default 10
  hotPeriod: number; // Default 40
  hotBase: number; // Default 30.0
  hotSens: number; // Default 0.7
}

export const DEFAULT_MCDX_SETTINGS: MCDXSettings = {
  bankerPeriod: 50,
  bankerBase: 50.0,
  bankerSens: 1.5,
  bankerMaPeriod: 10,
  hotPeriod: 40,
  hotBase: 30.0,
  hotSens: 0.7,
};

export interface MCDXPoint {
  time: Time;
  banker: number; // 0.00 - 20.00 (Red: Tạo lập / Smart Money)
  hotMoney: number; // 0.00 - 20.00 (Yellow: Đầu cơ / Speculators)
  retailer: number; // 20.00 (Green: Nhỏ lẻ / Retailer fixed ceiling)
  bankerMA: number; // 0.00 - 20.00 (SMA of Banker)
  bankerPct: number; // 0 - 100%
  hotMoneyPct: number; // 0 - 100%
  retailerPct: number; // 0 - 100%
  phase: 'dominance' | 'markup' | 'accumulation' | 'speculative' | 'retail';
  phaseLabel: string;
}

export interface MCDXDataset {
  points: MCDXPoint[];
  settings: MCDXSettings;
  latest: MCDXPoint | null;
}

/**
 * Calculate Wilder's Smoothed RSI (identical to PineScript ta.rsi)
 */
function calculateWilderRSI(closes: number[], period: number): number[] {
  const n = closes.length;
  const rsi = new Array<number>(n).fill(50);
  if (n <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  // First period SMA
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    rsi[period] = 100;
  } else if (avgGain === 0) {
    rsi[period] = 0;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - 100 / (1 + rs);
  }

  // Wilder's smoothing
  for (let i = period + 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else if (avgGain === 0) {
      rsi[i] = 0;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}

/**
 * Calculate MCDX (Multi-Color Dragon Extended / Dòng tiền tạo lập)
 * Mathematical model based on 24HMoney & TradingView PineScript implementations:
 *
 * 1. Banker (Red):
 *    raw = bankerSens * (RSI_50 - bankerBase)
 *    banker = clamp(raw, 0, 20)
 *
 * 2. Hot Money (Yellow):
 *    raw = hotSens * (RSI_40 - hotBase)
 *    hotMoney = clamp(raw, 0, 20)
 *
 * 3. Retailer (Green):
 *    Ceiling reference at 20.00
 *
 * 4. Banker MA (Line):
 *    SMA(banker, bankerMaPeriod)
 */
export function calculateMCDX(
  candles: CandlestickData<Time>[],
  customSettings: Partial<MCDXSettings> = {}
): MCDXDataset {
  const settings: MCDXSettings = { ...DEFAULT_MCDX_SETTINGS, ...customSettings };

  if (!candles || candles.length === 0) {
    return { points: [], settings, latest: null };
  }

  const closes = candles.map((c) => c.close);
  const n = closes.length;

  const rsiBanker = calculateWilderRSI(closes, settings.bankerPeriod);
  const rsiHotMoney = calculateWilderRSI(closes, settings.hotPeriod);

  // Compute raw points
  const rawBankerValues = new Float64Array(n);
  const rawHotValues = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const bRaw = settings.bankerSens * (rsiBanker[i] - settings.bankerBase);
    rawBankerValues[i] = Math.max(0, Math.min(20, bRaw));

    const hRaw = settings.hotSens * (rsiHotMoney[i] - settings.hotBase);
    rawHotValues[i] = Math.max(0, Math.min(20, hRaw));
  }

  // Compute Banker SMA
  const bankerMAValues = new Float64Array(n);
  const maPeriod = Math.max(1, settings.bankerMaPeriod);
  let rollingSum = 0;

  for (let i = 0; i < n; i++) {
    rollingSum += rawBankerValues[i];
    if (i >= maPeriod) {
      rollingSum -= rawBankerValues[i - maPeriod];
      bankerMAValues[i] = rollingSum / maPeriod;
    } else {
      bankerMAValues[i] = rollingSum / (i + 1);
    }
  }

  // Construct points
  const points: MCDXPoint[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const banker = Number(rawBankerValues[i].toFixed(2));
    const hotMoney = Number(rawHotValues[i].toFixed(2));
    const retailer = 20.0;
    const bankerMA = Number(bankerMAValues[i].toFixed(2));

    // Calculate percentage breakdown
    const bankerPct = Number(((banker / 20) * 100).toFixed(1));
    const hotMoneyPortion = Math.max(0, hotMoney - banker);
    const hotMoneyPct = Number(((hotMoneyPortion / 20) * 100).toFixed(1));
    const retailerPortion = Math.max(0, 20 - Math.max(banker, hotMoney));
    const retailerPct = Number(((retailerPortion / 20) * 100).toFixed(1));

    let phase: MCDXPoint['phase'] = 'retail';
    let phaseLabel = 'Nhỏ Lẻ Chi Phối';

    if (banker >= 15) {
      phase = 'dominance';
      phaseLabel = 'Tạo Lập Kiểm Soát (>75%)';
    } else if (banker >= 10) {
      phase = 'markup';
      phaseLabel = 'Tạo Lập Đẩy Giá (>50%)';
    } else if (banker >= 5) {
      phase = 'accumulation';
      phaseLabel = 'Tạo Lập Gom Hàng (>25%)';
    } else if (hotMoney >= 10) {
      phase = 'speculative';
      phaseLabel = 'Đầu Cơ Dẫn Dắt';
    }

    points[i] = {
      time: candles[i].time,
      banker,
      hotMoney,
      retailer,
      bankerMA,
      bankerPct,
      hotMoneyPct,
      retailerPct,
      phase,
      phaseLabel,
    };
  }

  return {
    points,
    settings,
    latest: points.length > 0 ? points[points.length - 1] : null,
  };
}
