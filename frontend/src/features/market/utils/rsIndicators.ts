import { CandlestickData, Time } from 'lightweight-charts';

export interface RSLinePoint {
  time: Time;
  rs: number;
  ma50?: number;
}

export interface MansfieldPoint {
  time: Time;
  value: number;
  color: string;
}

export interface OneilRSPoint {
  time: Time;
  score: number;
}

export interface RSTemplateDataset {
  rsPoints: RSLinePoint[];
  mansfieldPoints: MansfieldPoint[];
  oneilPoints: OneilRSPoint[];
  currentRS: number;
  currentMA50: number;
  currentMansfield: number;
  currentOneilScore: number;
}

/**
 * Helper to normalize Time object or timestamp to comparable string YYYY-MM-DD
 */
function normalizeTime(t: Time): string {
  if (typeof t === 'string') return t;
  if (typeof t === 'number') {
    return new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
  if (typeof t === 'object' && t !== null && 'year' in t) {
    const y = (t as any).year;
    const m = String((t as any).month).padStart(2, '0');
    const d = String((t as any).day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(t);
}

/**
 * Calculates the complete 3-in-1 RS Template dataset:
 * 1. RS Line vs VNINDEX with 50-period Moving Average
 * 2. Mansfield RS (Stan Weinstein's Relative Strength Histogram)
 * 3. Daily Historical William O'Neil RS Score (1-99 Percentile)
 */
export function calculateRSTemplate(
  stockCandles: CandlestickData<Time>[],
  vnindexCandles: CandlestickData<Time>[]
): RSTemplateDataset {
  if (!stockCandles || stockCandles.length === 0 || !vnindexCandles || vnindexCandles.length === 0) {
    return {
      rsPoints: [],
      mansfieldPoints: [],
      oneilPoints: [],
      currentRS: 0,
      currentMA50: 0,
      currentMansfield: 0,
      currentOneilScore: 50,
    };
  }

  // 1. Map VN-INDEX candles by normalized date
  const vniMap = new Map<string, number>();
  vnindexCandles.forEach((c) => {
    vniMap.set(normalizeTime(c.time), c.close);
  });

  // 2. Align Stock and VN-INDEX candles on matching dates
  const aligned: { time: Time; stockClose: number; vniClose: number }[] = [];
  let lastKnownVni = vnindexCandles[0]?.close || 1200;

  stockCandles.forEach((s) => {
    const key = normalizeTime(s.time);
    const vni = vniMap.get(key) || lastKnownVni;
    if (vni) lastKnownVni = vni;

    if (s.close > 0 && vni > 0) {
      aligned.push({
        time: s.time,
        stockClose: s.close,
        vniClose: vni,
      });
    }
  });

  if (aligned.length === 0) {
    return {
      rsPoints: [],
      mansfieldPoints: [],
      oneilPoints: [],
      currentRS: 0,
      currentMA50: 0,
      currentMansfield: 0,
      currentOneilScore: 50,
    };
  }

  // 3. Compute Raw RS Ratio (Normalized with base 1000 so numbers look clean and comparable)
  // Base normalization factor = 1000 / (Stock[0] / VNI[0])
  const baseRatio = aligned[0].stockClose / aligned[0].vniClose;
  const scaleMultiplier = baseRatio > 0 ? 100 / baseRatio : 1000;

  const rawRSValues: number[] = [];
  const rsPoints: RSLinePoint[] = [];

  for (let i = 0; i < aligned.length; i++) {
    const item = aligned[i];
    const rawRatio = (item.stockClose / item.vniClose) * scaleMultiplier;
    const roundedRS = Math.round(rawRatio * 100) / 100;
    rawRSValues.push(roundedRS);

    // Compute SMA50 of RS Line
    let ma50: number | undefined = undefined;
    if (i >= 49) {
      const slice = rawRSValues.slice(i - 49, i + 1);
      const sum = slice.reduce((acc, val) => acc + val, 0);
      ma50 = Math.round((sum / 50) * 100) / 100;
    }

    rsPoints.push({
      time: item.time,
      rs: roundedRS,
      ma50,
    });
  }

  // 4. Compute Mansfield Relative Strength (Stan Weinstein Formula)
  // Mansfield RS = ((RS_t / SMA50(RS)) - 1) * 100
  const mansfieldPoints: MansfieldPoint[] = [];
  for (let i = 0; i < rsPoints.length; i++) {
    const pt = rsPoints[i];
    if (pt.ma50 && pt.ma50 > 0) {
      const val = Number((((pt.rs / pt.ma50) - 1) * 100).toFixed(2));
      // Color coding as shown in reference TradingView template:
      // Above 0: Cyan / Emerald highlight (#2dd4bf)
      // Below 0: Dark Cyan / Teal bar (#0d9488)
      const color = val >= 0 ? '#2dd4bf' : '#0d9488';
      mansfieldPoints.push({
        time: pt.time,
        value: val,
        color,
      });
    } else {
      mansfieldPoints.push({
        time: pt.time,
        value: 0,
        color: '#71717a',
      });
    }
  }

  // 5. Compute Historical Daily William O'Neil RS Score (1 - 99)
  // O'Neil 4-Quarter weighted formula: 40% Q1 (63) + 20% Q2 (126) + 20% Q3 (189) + 20% Q4 (252)
  const oneilPoints: OneilRSPoint[] = [];
  for (let i = 0; i < aligned.length; i++) {
    const currentStock = aligned[i].stockClose;
    const currentVni = aligned[i].vniClose;

    const pQ1Stock = i >= 63 ? (currentStock - aligned[i - 63].stockClose) / aligned[i - 63].stockClose : 0;
    const pQ2Stock = i >= 126 ? (currentStock - aligned[i - 126].stockClose) / aligned[i - 126].stockClose : pQ1Stock;
    const pQ3Stock = i >= 189 ? (currentStock - aligned[i - 189].stockClose) / aligned[i - 189].stockClose : pQ2Stock;
    const pQ4Stock = i >= 252 ? (currentStock - aligned[i - 252].stockClose) / aligned[i - 252].stockClose : pQ3Stock;

    const pQ1Vni = i >= 63 ? (currentVni - aligned[i - 63].vniClose) / aligned[i - 63].vniClose : 0;
    const pQ2Vni = i >= 126 ? (currentVni - aligned[i - 126].vniClose) / aligned[i - 126].vniClose : pQ1Vni;
    const pQ3Vni = i >= 189 ? (currentVni - aligned[i - 189].vniClose) / aligned[i - 189].vniClose : pQ2Vni;
    const pQ4Vni = i >= 252 ? (currentVni - aligned[i - 252].vniClose) / aligned[i - 252].vniClose : pQ3Vni;

    const rawStock = 0.4 * pQ1Stock + 0.2 * pQ2Stock + 0.2 * pQ3Stock + 0.2 * pQ4Stock;
    const rawVni = 0.4 * pQ1Vni + 0.2 * pQ2Vni + 0.2 * pQ3Vni + 0.2 * pQ4Vni;

    const relativeDiff = rawStock - rawVni;

    // Map to realistic 1-99 percentile scale where 50 represents benchmark performance
    let score = Math.round(50 + relativeDiff * 75);
    score = Math.max(1, Math.min(99, score));

    oneilPoints.push({
      time: aligned[i].time,
      score,
    });
  }

  const lastRSPoint = rsPoints[rsPoints.length - 1];
  const lastMansfield = mansfieldPoints[mansfieldPoints.length - 1]?.value || 0;
  const lastOneil = oneilPoints[oneilPoints.length - 1]?.score || 50;

  return {
    rsPoints,
    mansfieldPoints,
    oneilPoints,
    currentRS: lastRSPoint?.rs || 0,
    currentMA50: lastRSPoint?.ma50 || 0,
    currentMansfield: lastMansfield,
    currentOneilScore: lastOneil,
  };
}
