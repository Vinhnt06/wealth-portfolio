/**
 * Chấm pha chu kỳ cho vòng tròn vĩ mô, và tính "khi nào chuyển pha".
 *
 * Sáu trụ cột, trọng số: tăng trưởng 10% · lạm phát 15% · điều kiện vốn 25% · tỷ giá 12% · đường cong VN 20% ·
 * Fed & thế giới 18%. Pha có điểm cao nhất là pha hiện tại (bằng điểm thì theo thứ tự phục hồi → suy thoái).
 *
 * "Khi nào chuyển pha": giữ nguyên mọi số liệu, đổi từng yếu tố trên một lưới giá trị rồi chấm lại; khoảng giá trị
 * làm pha dẫn đầu đổi chính là điều kiện chuyển pha. Không yếu tố đơn lẻ nào đủ thì xét từng cặp.
 * Đây là quy tắc do ứng dụng đặt (đồng hồ đầu tư + ngưỡng chọn tay), CHƯA kiểm chứng là dự báo thị trường.
 */

export type CyclePhaseKey = 'recovery' | 'expansion' | 'late' | 'recession';
export type FedStance = 'tightening' | 'easing' | 'hold' | 'unknown';
export type CapitalDirection = 'UP' | 'DOWN' | 'UNCLEAR' | null;

export interface CycleInputs {
  gdp: number;
  /** Chênh lệch so với kỳ công bố trước (điểm %) */
  gdpTrend: number | null;
  gdpTarget: number;
  cpi: number;
  cpiTrend: number | null;
  cpiTarget: number;
  /** Điều kiện vốn theo lợi suất TPCP 10 năm: UP = nới lỏng, DOWN = thắt chặt */
  capital: CapitalDirection;
  /** % thay đổi USD/VND trong 1 tháng (dương = VND mất giá) */
  usdVnd1MPct: number | null;
  /** Lãi dài hạn VN (TPCP 10 năm, thiếu thì huy động 12T) và lãi liên ngân hàng ngắn hạn */
  longRate: number;
  shortRate: number;
  fedStance: FedStance;
  /** Lãi suất Fed hiệu lực */
  effr: number | null;
  dxy: number;
}

export interface PillarScores {
  gdp: number;
  cpi: number;
  rate: number;
  fx: number;
  yield: number;
  global: number;
  composite: number;
}

export const PHASE_ORDER: CyclePhaseKey[] = ['recovery', 'expansion', 'late', 'recession'];
const CAPITAL_BAND = 0.25;
const r2 = (v: number) => Math.round(v * 100) / 100;
const dirOf = (trend: number | null, band: number): -1 | 0 | 1 => (trend === null ? 0 : r2(trend) >= band ? 1 : r2(trend) <= -band ? -1 : 0);
const levelOf = (v: number, target: number): -1 | 0 | 1 => (!Number.isFinite(v) || !Number.isFinite(target) ? 0 : v >= target ? 1 : -1);
const flat = (v: number): Record<CyclePhaseKey, number> => ({ recovery: v, expansion: v, late: v, recession: v });

export function scorePhases(i: CycleInputs): Record<CyclePhaseKey, PillarScores> {
  // Đồng hồ đầu tư: Phục hồi = tăng trưởng ↑ & lạm phát ↓ · Mở rộng = cả hai ↑
  //                 Cuối chu kỳ = tăng trưởng ↓ & lạm phát ↑ · Suy thoái = cả hai ↓
  // Xu hướng quyết định chính (±35 điểm), mức so với mục tiêu chỉ điều chỉnh (±15 điểm).
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const wantsGrowthUp: Record<CyclePhaseKey, 1 | -1> = { recovery: 1, expansion: 1, late: -1, recession: -1 };
  const wantsInflationUp: Record<CyclePhaseKey, 1 | -1> = { recovery: -1, expansion: 1, late: 1, recession: -1 };
  const growthDir = dirOf(i.gdpTrend, 0.3);
  const inflDir = dirOf(i.cpiTrend, 0.2);
  const growthLevel = levelOf(i.gdp, i.gdpTarget);
  const inflationLevel = levelOf(i.cpi, i.cpiTarget);

  // Điều kiện vốn: CHIỀU của lợi suất TPCP 10N. Đi ngang hoặc thiếu số → trung tính.
  const rate: Record<CyclePhaseKey, number> =
    i.capital === 'UP'
      ? { recovery: 92, expansion: 75, recession: 60, late: 25 }
      : i.capital === 'DOWN'
        ? { late: 92, expansion: 55, recession: 45, recovery: 20 }
        : flat(50);

  // Tỷ giá: VND mất giá hơn 1%/tháng là căng
  const fx: Record<CyclePhaseKey, number> =
    i.usdVnd1MPct === null
      ? flat(50)
      : i.usdVnd1MPct <= 1.0
        ? { expansion: 90, recovery: 85, late: 30, recession: 30 }
        : { late: 85, recession: 75, expansion: 45, recovery: 40 };

  // Đường cong VN: lãi dài hạn − liên ngân hàng
  const spread = r2(i.longRate - i.shortRate);
  const curve: Record<CyclePhaseKey, number> = !Number.isFinite(spread)
    ? flat(50)
    : spread >= 0.75
      ? { expansion: 96, recovery: 88, late: 35, recession: 15 }
      : spread >= 0.2
        ? { recovery: 92, expansion: 82, late: 55, recession: 25 }
        : spread >= -0.1
          ? { late: 94, recession: 72, expansion: 40, recovery: 30 }
          : { recession: 96, late: 80, expansion: 20, recovery: 20 };

  // Thế giới: Fed thắt/nới + DXY mạnh + lãi VND thấp hơn USD
  const vndUsdGap = i.effr !== null && Number.isFinite(i.shortRate) ? r2(i.shortRate - i.effr) : null;
  const tightness =
    i.fedStance === 'unknown'
      ? null
      : (i.fedStance === 'tightening' ? 1 : i.fedStance === 'easing' ? -1 : 0) + (i.dxy >= 105 ? 1 : 0) + (vndUsdGap !== null && vndUsdGap < 0 ? 1 : 0);
  const world: Record<CyclePhaseKey, number> =
    tightness === null
      ? flat(50)
      : tightness <= 0
        ? { recovery: 90, expansion: 85, late: 30, recession: 35 }
        : tightness === 1
          ? { expansion: 70, recovery: 60, late: 55, recession: 45 }
          : { late: 85, recession: 70, expansion: 40, recovery: 30 };

  const out = {} as Record<CyclePhaseKey, PillarScores>;
  for (const k of PHASE_ORDER) {
    const gdp = clamp(50 + 35 * growthDir * wantsGrowthUp[k] + 15 * growthLevel * wantsGrowthUp[k]);
    const cpi = clamp(50 + 35 * inflDir * wantsInflationUp[k] + 15 * inflationLevel * wantsInflationUp[k]);
    out[k] = {
      gdp,
      cpi,
      rate: rate[k],
      fx: fx[k],
      yield: curve[k],
      global: world[k],
      composite: Math.round(gdp * 0.1 + cpi * 0.15 + rate[k] * 0.25 + fx[k] * 0.12 + curve[k] * 0.2 + world[k] * 0.18),
    };
  }
  return out;
}

export function rankPhases(scores: Record<CyclePhaseKey, PillarScores>): CyclePhaseKey[] {
  return [...PHASE_ORDER].sort((a, b) => scores[b].composite - scores[a].composite);
}

// ─── Khi nào chuyển pha ───
export type ShiftFactor = 'gdp' | 'cpi' | 'bond' | 'short' | 'fx' | 'fed' | 'dxy';

export interface ShiftCondition {
  factor: ShiftFactor;
  /** Khoảng giá trị thoả điều kiện; null = không chặn phía đó. Với 'fed' dùng `stance`. */
  min: number | null;
  max: number | null;
  stance?: FedStance;
}

export interface Shift {
  to: CyclePhaseKey;
  /** Một điều kiện, hoặc hai điều kiện phải xảy ra đồng thời */
  conditions: ShiftCondition[];
}

export interface ShiftAnalysis {
  current: CyclePhaseKey;
  currentScore: number;
  runnerUp: CyclePhaseKey;
  runnerUpScore: number;
  singles: Shift[];
  /** Chỉ tính khi không có điều kiện đơn lẻ nào */
  pairs: Shift[];
}

export interface ShiftContext {
  /** Lợi suất TPCP 10N 6 tháng trước (mốc xét thắt/nới) */
  bondPast: number | null;
  /** Lãi dài hạn đang dùng có phải TPCP 10N không */
  longIsBond: boolean;
}

interface NumericFactor {
  id: Exclude<ShiftFactor, 'fed'>;
  now: number;
  lo: number;
  hi: number;
  step: number;
  /** Một "bước đáng kể", để so độ xa giữa các yếu tố khác đơn vị */
  unit: number;
  patch: (x: number) => Partial<CycleInputs>;
}

function numericFactors(i: CycleInputs, ctx: ShiftContext): NumericFactor[] {
  const list: NumericFactor[] = [];
  const add = (f: NumericFactor) => Number.isFinite(f.now) && list.push(f);
  add({ id: 'gdp', now: i.gdp, lo: i.gdp - 4, hi: i.gdp + 4, step: 0.01, unit: 1, patch: (x) => ({ gdp: x, gdpTrend: r2(x - i.gdp) }) });
  add({ id: 'cpi', now: i.cpi, lo: i.cpi - 4, hi: i.cpi + 4, step: 0.01, unit: 0.5, patch: (x) => ({ cpi: x, cpiTrend: r2(x - i.cpi) }) });
  if (ctx.longIsBond && ctx.bondPast !== null) {
    const past = ctx.bondPast;
    add({
      id: 'bond',
      now: i.longRate,
      lo: i.longRate - 1.5,
      hi: i.longRate + 1.5,
      step: 0.01,
      unit: 0.25,
      patch: (x) => {
        const change = r2(x - past);
        return { longRate: x, capital: change >= CAPITAL_BAND ? 'DOWN' : change <= -CAPITAL_BAND ? 'UP' : 'UNCLEAR' };
      },
    });
  }
  add({ id: 'short', now: i.shortRate, lo: 0.5, hi: 12, step: 0.01, unit: 0.5, patch: (x) => ({ shortRate: x }) });
  if (i.usdVnd1MPct !== null) add({ id: 'fx', now: i.usdVnd1MPct, lo: -3, hi: 3, step: 0.01, unit: 1, patch: (x) => ({ usdVnd1MPct: x }) });
  add({ id: 'dxy', now: i.dxy, lo: 85, hi: 125, step: 0.1, unit: 2, patch: (x) => ({ dxy: x }) });
  return list;
}

interface Option {
  condition: ShiftCondition;
  patch: Partial<CycleInputs>;
  distance: number;
}

/** Chia lưới giá trị của một yếu tố thành các đoạn liên tiếp cho cùng bộ điểm */
function optionsOf(i: CycleInputs, f: NumericFactor): Option[] {
  const n = Math.round((f.hi - f.lo) / f.step);
  const out: Option[] = [];
  const key = (x: number) => JSON.stringify(scorePhases({ ...i, ...f.patch(x) }));
  const nowKey = JSON.stringify(scorePhases(i));
  let start = 0;
  let prev = '';
  const close = (a: number, b: number, k: string) => {
    if (k === nowKey) return;
    const from = r2(f.lo + a * f.step);
    const to = r2(f.lo + b * f.step);
    const near = Math.abs(from - f.now) <= Math.abs(to - f.now) ? from : to;
    out.push({
      condition: { factor: f.id, min: a === 0 ? null : from, max: b === n ? null : to },
      patch: f.patch(near),
      distance: Math.abs(near - f.now) / f.unit,
    });
  };
  for (let s = 0; s <= n; s++) {
    const k = key(r2(f.lo + s * f.step));
    if (s === 0) prev = k;
    else if (k !== prev) {
      close(start, s - 1, prev);
      start = s;
      prev = k;
    }
  }
  close(start, n, prev);
  return out;
}

export function analyzeShifts(i: CycleInputs, ctx: ShiftContext): ShiftAnalysis {
  const scores = scorePhases(i);
  const [current, runnerUp] = rankPhases(scores);
  const topOf = (patch: Partial<CycleInputs>) => rankPhases(scorePhases({ ...i, ...patch }))[0];

  const options: Option[] = numericFactors(i, ctx).flatMap((f) => optionsOf(i, f));
  if (i.fedStance !== 'unknown') {
    for (const stance of ['tightening', 'hold', 'easing'] as FedStance[]) {
      if (stance !== i.fedStance) options.push({ condition: { factor: 'fed', min: null, max: null, stance }, patch: { fedStance: stance }, distance: 1 });
    }
  }

  // Đơn lẻ: mỗi (yếu tố, pha đích) chỉ giữ đoạn gần số hiện tại nhất; các đoạn liền nhau cùng pha đích được nối lại
  const singles: Array<Shift & { distance: number }> = [];
  const flips = options.map((o) => ({ o, to: topOf(o.patch) })).filter((x) => x.to !== current);
  for (const { o, to } of [...flips].sort((a, b) => a.o.distance - b.o.distance)) {
    const c = o.condition;
    if (singles.some((s) => s.to === to && s.conditions[0].factor === c.factor)) continue;
    const merged: ShiftCondition = { ...c };
    if (c.factor !== 'fed') {
      const step = c.factor === 'dxy' ? 0.1 : 0.01;
      const same = flips.filter((x) => x.to === to && x.o.condition.factor === c.factor).map((x) => x.o.condition);
      for (let grew = true; grew; ) {
        grew = false;
        for (const s of same) {
          if (merged.min !== null && s.max !== null && Math.abs(r2(merged.min - s.max) - step) < step / 2) {
            merged.min = s.min;
            grew = true;
          }
          if (merged.max !== null && s.min !== null && Math.abs(r2(s.min - merged.max) - step) < step / 2) {
            merged.max = s.max;
            grew = true;
          }
        }
      }
    }
    singles.push({ to, conditions: [merged], distance: o.distance });
  }

  const pairs: Array<Shift & { distance: number }> = [];
  if (singles.length === 0) {
    for (let a = 0; a < options.length; a++) {
      for (let b = a + 1; b < options.length; b++) {
        const x = options[a];
        const y = options[b];
        if (x.condition.factor === y.condition.factor) continue;
        const to = topOf({ ...x.patch, ...y.patch });
        if (to !== current) pairs.push({ to, conditions: [x.condition, y.condition], distance: x.distance + y.distance });
      }
    }
  }
  const strip = (list: Array<Shift & { distance: number }>) => list.sort((a, b) => a.distance - b.distance).map(({ to, conditions }) => ({ to, conditions }));
  // Cặp: lấy tối đa 3 tổ hợp gần nhất, không lặp cùng hai yếu tố
  const seen = new Set<string>();
  const bestPairs = strip(pairs).filter((p) => {
    const k = p.conditions.map((c) => c.factor).sort().join('+');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    current,
    currentScore: scores[current].composite,
    runnerUp,
    runnerUpScore: scores[runnerUp].composite,
    singles: strip(singles),
    pairs: bestPairs.slice(0, 3),
  };
}

/** Ngày công bố GDP/CPI kế tiếp (khoảng ngày 6 sau kỳ); trả 'dd/mm/yyyy' */
export function nextReleaseDate(kind: 'gdp' | 'cpi', nowMs = Date.now()): string {
  const vn = new Date(nowMs + 7 * 3600_000);
  let y = vn.getUTCFullYear();
  let m = vn.getUTCMonth() + 1;
  const day = vn.getUTCDate();
  const isRelease = (month: number) => (kind === 'cpi' ? true : [1, 4, 7, 10].includes(month));
  let passed = day >= 6;
  while (passed || !isRelease(m)) {
    passed = false;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return `06/${String(m).padStart(2, '0')}/${y}`;
}
