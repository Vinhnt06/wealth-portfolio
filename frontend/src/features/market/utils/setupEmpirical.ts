import backtest from '../data/setupBacktest.json';
import decisionBacktest from '../data/decisionBacktest.json';

/**
 * Tra cứu kết quả backtest thực nghiệm (xem scripts/backtest_setups.py) cho một thiết lập
 * (số tiêu chí Trend Template, chế độ thị trường, mức cắt lỗ, R:R).
 */
type Block = {
  winRate: number;
  winRateCI: [number, number];
  avgWinPct: number;
  avgLossPct: number;
  expectancyPct: number;
  expectancyCI: [number, number];
};
type Cell = {
  n: number;
  net: Block;
  gross: Block;
  hitTargetPct: number;
  hitStopPct: number;
  timeExitPct: number;
  avgHoldBars: number;
};
type Results = Record<string, Record<string, Record<string, Cell | null>>>;

const BT = backtest as unknown as {
  meta: {
    generatedAt: string;
    universe: number;
    periodStart: string;
    periodEnd: string;
    signals: number;
    costRoundTripPct: number;
    maxHoldBars: number;
    stops: number[];
    rrs: number[];
    rules: Record<string, string>;
    caveats: string[];
  };
  results: Results;
  stability: Record<string, Record<string, Cell | null>>;
};

/** Backtest trên ĐÚNG tín hiệu MUA của ứng dụng (xem scripts/backtest_decision_signals.mjs) */
const DB = decisionBacktest as unknown as {
  meta: { generatedAt: string; universe: number; signals: number; periodStart: string; periodEnd: string; costRoundTripPct: number; maxHoldBars: number; rule: string };
  results: Results;
};

export const MIN_SAMPLE = 100;
/**
 * Backtest thử nhiều tổ hợp (3 nhóm × 2 chế độ × 6 mức cắt lỗ × 4 R:R = 144 ô). Nếu chỉ dùng ngưỡng 95% (z≈2)
 * thì vài ô sẽ "có ý nghĩa" do may rủi. Dùng ngưỡng khắt khe hơn (z ≥ 3, xấp xỉ hiệu chỉnh Bonferroni).
 */
export const SIGNIFICANCE_Z = 3;

export type SetupClass = 'S2' | 'NEAR' | 'WEAK';
export const classOf = (passedCount: number): SetupClass =>
  passedCount >= 8 ? 'S2' : passedCount >= 6 ? 'NEAR' : 'WEAK';

const nearest = (arr: number[], v: number) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), arr[0]);

type Source = 'DECISION_BUY' | 'TT_CLASS';
const cellFrom = (store: Results, cls: string, regime: string, stop: number, rr: number): Cell | null =>
  store?.[cls]?.[regime]?.[`${stop}|${rr}`] ?? null;
const cell = (cls: string, regime: string, stop: number, rr: number): Cell | null => cellFrom(BT.results, cls, regime, stop, rr);

export interface EmpiricalResult {
  available: boolean;
  /** Ô dữ liệu được dùng (đã chọn nhóm có đủ mẫu) */
  basis?: {
    setupClass: SetupClass;
    regime: 'up' | 'down' | 'all';
    /** Ghi chú khi phải gộp nhóm vì thiếu mẫu */
    fallback?: string;
    stopPct: number;
    rr: number;
    outsideGrid: boolean;
    /** DECISION_BUY: thống kê trên đúng tín hiệu MUA của ứng dụng · TT_CLASS: theo nhóm số tiêu chí (phá đỉnh có khối lượng) */
    source: Source;
  };
  n?: number;
  net?: Block;
  gross?: Block;
  hitTargetPct?: number;
  hitStopPct?: number;
  timeExitPct?: number;
  avgHoldBars?: number;
  /** Hệ số hiệu chỉnh danh nghĩa → thực tế: lỗ thực / mức cắt lỗ đặt, lãi thực / mục tiêu đặt */
  lossFactor?: number;
  winFactor?: number;
  costPct?: number;
  currentRegime?: 'up' | 'down' | 'unknown';
  significance?: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  /** z-score của kỳ vọng so với 0 */
  zScore?: number;
  confidence?: 'CAO' | 'TRUNG BÌNH' | 'THẤP';
  byRr?: Array<{ rr: number; n: number; winRate: number; expectancyPct: number; expectancyCI: [number, number] }>;
  /** Cùng R:R, đổi mức cắt lỗ: cho thấy cắt lỗ quá chặt bị quét ra thế nào */
  byStop?: Array<{ stop: number; n: number; winRate: number; expectancyPct: number; expectancyCI: [number, number] }>;
  baseline?: { n: number; net: Block } | null;
  regimeSplit?: { up: { n: number; net: Block } | null; down: { n: number; net: Block } | null };
  stability?: Record<string, { n: number; net: Block } | null> | null;
  meta: {
    generatedAt: string;
    universe: number;
    periodStart: string;
    periodEnd: string;
    signals: number;
    maxHoldBars: number;
    rules: Record<string, string>;
    caveats: string[];
  };
}

export function lookupEmpirical(params: {
  passedCount: number;
  marketUp: boolean | null;
  stopPct: number;
  targetPct: number;
  /** Quyết định hợp nhất đang là MUA → dùng thống kê trên đúng tín hiệu MUA */
  buySignal?: boolean;
}): EmpiricalResult {
  const { passedCount, marketUp, stopPct, targetPct } = params;
  const m = BT.meta;
  const metaOut = {
    generatedAt: m.generatedAt,
    universe: m.universe,
    periodStart: m.periodStart,
    periodEnd: m.periodEnd,
    signals: m.signals,
    maxHoldBars: m.maxHoldBars,
    rules: m.rules,
    caveats: m.caveats,
  };

  const cls = classOf(passedCount);
  const stop = nearest(m.stops, stopPct);
  const rrWanted = stopPct > 0 ? targetPct / stopPct : 2.5;
  const rr = nearest(m.rrs, rrWanted);
  const outsideGrid = stopPct < m.stops[0] - 0.5 || stopPct > m.stops[m.stops.length - 1] + 0.5 || rrWanted < m.rrs[0] - 0.4 || rrWanted > m.rrs[m.rrs.length - 1] + 0.5;

  // Chế độ thị trường chỉ để THAM KHẢO: tách nhóm theo chế độ làm mẫu nhỏ đi nhiều và cho kết quả dao động
  // (ví dụ cùng một nhóm mà thuận lợi −0.5%, kém thuận lợi +2%) — dễ là nhiễu. Mặc định dùng số liệu gộp.
  const currentRegime: 'up' | 'down' | 'unknown' = marketUp === null ? 'unknown' : marketUp ? 'up' : 'down';
  const candidates: Array<{ store: Results; src: Source; c: string; r: string; note?: string }> = [
    // Ưu tiên thống kê trên đúng tín hiệu MUA của ứng dụng
    ...(params.buySignal ? [{ store: DB.results, src: 'DECISION_BUY' as Source, c: 'BUY', r: 'all' }] : []),
    { store: BT.results, src: 'TT_CLASS', c: cls, r: 'all' },
    { store: BT.results, src: 'TT_CLASS', c: 'ANY', r: 'all', note: 'Nhóm theo số tiêu chí quá ít mẫu → gộp mọi mức Trend Template' },
  ];
  let chosen: { cell: Cell; store: Results; src: Source; c: string; r: string; note?: string } | null = null;
  for (const cand of candidates) {
    const cl = cellFrom(cand.store, cand.c, cand.r, stop, rr);
    if (cl && cl.n >= MIN_SAMPLE) {
      chosen = { cell: cl, store: cand.store, src: cand.src, c: cand.c, r: cand.r, note: cand.note };
      break;
    }
  }
  if (!chosen) return { available: false, meta: metaOut };

  const cl = chosen.cell;
  const nominalWin = stop * rr;
  const lossFactor = stop > 0 ? cl.net.avgLossPct / stop : 1;
  const winFactor = nominalWin > 0 ? cl.net.avgWinPct / nominalWin : 1;

  const [lo, hi] = cl.net.expectancyCI;
  const se = (hi - lo) / (2 * 1.96);
  const zScore = se > 0 ? cl.net.expectancyPct / se : 0;
  const significance = zScore <= -SIGNIFICANCE_Z ? 'NEGATIVE' : zScore >= SIGNIFICANCE_Z ? 'POSITIVE' : 'INCONCLUSIVE';
  const halfW = (cl.net.winRateCI[1] - cl.net.winRateCI[0]) / 2;
  const confidence = cl.n >= 300 && halfW <= 4 ? 'CAO' : cl.n >= 150 ? 'TRUNG BÌNH' : 'THẤP';

  const useCls = chosen.c;
  const useReg = chosen.r;
  const byRr = m.rrs
    .map((r) => ({ r, c: cellFrom(chosen!.store, useCls, useReg, stop, r) }))
    .filter((x): x is { r: number; c: Cell } => !!x.c && x.c.n >= 30)
    .map((x) => ({ rr: x.r, n: x.c.n, winRate: x.c.net.winRate, expectancyPct: x.c.net.expectancyPct, expectancyCI: x.c.net.expectancyCI }));

  const byStop = m.stops
    .map((st) => ({ st, c: cellFrom(chosen!.store, useCls, useReg, st, rr) }))
    .filter((x): x is { st: number; c: Cell } => !!x.c && x.c.n >= 30)
    .map((x) => ({ stop: x.st, n: x.c.n, winRate: x.c.net.winRate, expectancyPct: x.c.net.expectancyPct, expectancyCI: x.c.net.expectancyCI }));

  const pick = (k: string, rg: string) => {
    const x = cellFrom(chosen!.store, k, rg, stop, rr);
    return x && x.n >= 30 ? { n: x.n, net: x.net } : null;
  };
  const stabilityRaw = BT.stability?.[`S2|${stop}|${rr}`];
  const stability = stabilityRaw
    ? Object.fromEntries(Object.entries(stabilityRaw).map(([k, v]) => [k, v ? { n: v.n, net: v.net } : null]))
    : null;

  return {
    available: true,
    basis: {
      setupClass: useCls === 'ANY' || useCls === 'BUY' ? cls : (useCls as SetupClass),
      regime: useReg as 'up' | 'down' | 'all',
      fallback: chosen.note,
      stopPct: stop,
      rr,
      outsideGrid,
      source: chosen.src,
    },
    n: cl.n,
    net: cl.net,
    gross: cl.gross,
    hitTargetPct: cl.hitTargetPct,
    hitStopPct: cl.hitStopPct,
    timeExitPct: cl.timeExitPct,
    avgHoldBars: cl.avgHoldBars,
    lossFactor: Number(lossFactor.toFixed(3)),
    winFactor: Number(winFactor.toFixed(3)),
    costPct: m.costRoundTripPct,
    currentRegime,
    significance,
    zScore: Number(zScore.toFixed(2)),
    confidence,
    byRr,
    byStop,
    baseline: (() => { const x = cell('ANY', 'all', stop, rr); return x && x.n >= 30 ? { n: x.n, net: x.net } : null; })(),
    regimeSplit: { up: pick(useCls, 'up'), down: pick(useCls, 'down') },
    stability,
    meta: chosen.src === 'DECISION_BUY'
      ? { ...metaOut, universe: DB.meta.universe, periodStart: DB.meta.periodStart, periodEnd: DB.meta.periodEnd, signals: DB.meta.signals, rules: { signal: DB.meta.rule } }
      : metaOut,
  };
}
