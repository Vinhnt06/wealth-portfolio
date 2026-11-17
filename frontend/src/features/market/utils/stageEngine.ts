/**
 * Xét Stage 1→4 (Stan Weinstein / Mark Minervini) — module thuần, không phụ thuộc mạng, dùng chung cho API và script kiểm chứng.
 *
 * Chu kỳ luôn đi theo thứ tự:  Stage 1 (đáy nền) → Stage 2 (tăng trưởng) → Stage 3 (đỉnh / phân phối) → Stage 4 (giảm giá) → Stage 1 …
 * Stage KHÔNG được quyết định chỉ bằng "đạt bao nhiêu tiêu chí Trend Template". Hai yếu tố quyết định:
 *   1) Giá so với MA150 (tương đương MA 30 tuần của Weinstein) và hướng đi của MA150
 *   2) Xu hướng TRƯỚC ĐÓ của MA150 — phân biệt "đáy nền sau nhịp giảm" (Stage 1) với "đỉnh sau nhịp tăng" (Stage 3):
 *      cả hai đều có MA đi ngang, chỉ khác nhau ở chỗ cổ phiếu vừa đi từ đâu tới.
 */

export type StageNumber = 1 | 2 | 3 | 4;

export type StageSub =
  | 'CONFIRMED' // Stage 2, đủ 8/8 Trend Template
  | 'QUALIFYING' // Stage 2, giá trên MA150 & MA200, MA150 dốc lên nhưng chưa đủ 8/8
  | 'EARLY' // Stage 2 sớm: MA150 đã dốc lên, giá vượt MA150 nhưng chưa vượt MA200
  | 'PULLBACK' // Stage 2, nhịp chỉnh nông xuống dưới MA150 đang dốc lên
  | 'BASING' // Stage 1, MA150 đi ngang sau nhịp giảm
  | 'LATE_BASE' // Stage 1, MA150 vừa quay lên nhưng giá còn dưới
  | 'TOPPING' // Stage 3, MA150 đi ngang / vừa quay xuống sau nhịp tăng
  | 'BREAKDOWN' // Stage 3, giá thủng MA150 đang dốc lên (nguy cơ gãy xu hướng)
  | 'DECLINING' // Stage 4, giá dưới MA150 đang dốc xuống
  | 'BEAR_RALLY' // Stage 4, nhịp hồi lên trên MA150 vẫn đang dốc xuống
  | 'INSUFFICIENT'; // chưa đủ dữ liệu (< 200 phiên)

export interface StageEvidence {
  price: number;
  ma50: number;
  ma150: number;
  ma200: number;
  /** % thay đổi của MA150 trong `slopeWindow` phiên gần nhất */
  slope150Pct: number;
  slope200Pct: number;
  /** % thay đổi của MA150 trong giai đoạn TRƯỚC cửa sổ độ dốc (xu hướng đi tới) */
  priorTrendPct: number | null;
  distFromMa150Pct: number;
  distFromMa200Pct: number;
  /** Vị trí của giá trong biên độ 52 tuần (0 = đáy, 100 = đỉnh) */
  posIn52wPct: number;
}

export interface StageResult {
  stage: StageNumber;
  sub: StageSub;
  /** Stage 2 và đủ 8/8 Trend Template: điều kiện cần để xét mua theo Minervini */
  confirmed: boolean;
  evidence: StageEvidence | null;
  /** Mã quy tắc đã kích hoạt (để hiển thị lý do & kiểm thử) */
  rule: string;
}

export interface StageOptions {
  slopeWindow: number;
  flatPct: number;
  priorWindow: number;
  priorPct: number;
  pullbackDepth: number;
  breakdownDepth: number;
  /** Vùng đệm quanh MA150 (tỷ lệ). Giá nằm trong ±band coi như "đang ở MA" để tránh đổi Stage liên tục khi giá cắt qua lại MA */
  bandPct: number;
  /** Lấy Stage chiếm đa số trong N phiên gần nhất để lọc nhiễu (1 = tắt) */
  smoothWindow: number;
}

export const DEFAULT_STAGE_OPTIONS: StageOptions = {
  slopeWindow: 30,
  flatPct: 1.5,
  priorWindow: 120,
  priorPct: 3,
  pullbackDepth: 0.08,
  breakdownDepth: 0.1,
  bandPct: 3,
  smoothWindow: 10,
};

const smaAt = (closes: number[], period: number, idx: number): number | null => {
  if (idx < period - 1) return null;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += closes[i];
  return sum / period;
};

const pct = (now: number, then: number | null): number | null =>
  then && then > 0 ? ((now - then) / then) * 100 : null;

function classifyRaw(params: {
  closes: number[];
  highs: number[];
  lows: number[];
  /** Số tiêu chí Trend Template đạt (nếu có). Đủ 8/8 thì chắc chắn là Stage 2 */
  passedCount?: number;
  /** Chỉ số phiên cần xét (mặc định: phiên cuối) — dùng cho kiểm chứng lịch sử */
  idx?: number;
  options?: Partial<StageOptions>;
}): StageResult {
  const { closes, highs, lows, passedCount } = params;
  const o = { ...DEFAULT_STAGE_OPTIONS, ...(params.options || {}) };
  const idx = params.idx ?? closes.length - 1;
  const price = closes[idx];

  const ma50 = smaAt(closes, 50, idx);
  const ma150 = smaAt(closes, 150, idx);
  const ma200 = smaAt(closes, 200, idx);
  const ma150Then = smaAt(closes, 150, idx - o.slopeWindow);
  const ma200Then = smaAt(closes, 200, idx - o.slopeWindow);
  const ma150Prior = smaAt(closes, 150, idx - o.slopeWindow - o.priorWindow);

  if (ma50 === null || ma150 === null || ma200 === null || ma150Then === null || ma200Then === null) {
    return { stage: 1, sub: 'INSUFFICIENT', confirmed: false, evidence: null, rule: 'INSUFFICIENT_DATA' };
  }

  const lo = Math.max(0, idx - 251);
  let hi52 = -Infinity;
  let lo52 = Infinity;
  for (let i = lo; i <= idx; i++) {
    if (highs[i] > hi52) hi52 = highs[i];
    if (lows[i] < lo52) lo52 = lows[i];
  }
  const range = hi52 - lo52;
  const posIn52wPct = range > 0 ? ((price - lo52) / range) * 100 : 50;

  const slope150 = pct(ma150, ma150Then) ?? 0;
  const slope200 = pct(ma200, ma200Then) ?? 0;
  const prior = pct(ma150Then, ma150Prior); // null nếu thiếu dữ liệu

  const evidence: StageEvidence = {
    price,
    ma50,
    ma150,
    ma200,
    slope150Pct: Number(slope150.toFixed(2)),
    slope200Pct: Number(slope200.toFixed(2)),
    priorTrendPct: prior === null ? null : Number(prior.toFixed(2)),
    distFromMa150Pct: Number((((price - ma150) / ma150) * 100).toFixed(2)),
    distFromMa200Pct: Number((((price - ma200) / ma200) * 100).toFixed(2)),
    posIn52wPct: Number(posIn52wPct.toFixed(1)),
  };

  const band = o.bandPct / 100;
  const above150 = price > ma150 * (1 + band);
  const below150 = price < ma150 * (1 - band);
  const above200 = price > ma200;
  const rising = slope150 > o.flatPct;
  const falling = slope150 < -o.flatPct;
  const priorUp = prior !== null && prior > o.priorPct;
  const priorDown = prior !== null && prior < -o.priorPct;
  const make = (stage: StageNumber, sub: StageSub, rule: string): StageResult => ({
    stage,
    sub,
    confirmed: stage === 2 && passedCount === 8,
    evidence,
    rule,
  });

  // 0) Đủ 8/8 Trend Template ⇒ Stage 2 đã xác nhận (định nghĩa của Minervini)
  if (passedCount === 8) return make(2, 'CONFIRMED', 'TT_8_OF_8');

  // 1) Gãy mạnh: giá thủng sâu cả MA150 lẫn MA200 và MA50 nằm dưới MA150 ⇒ Stage 4 dù MA dài còn chưa kịp quay xuống
  if (!above200 && price < ma150 * (1 - o.breakdownDepth) && ma50 < ma150) {
    return make(4, 'DECLINING', 'SEVERE_BREAKDOWN');
  }

  // 2) MA150 dốc lên
  if (rising) {
    if (above150 && above200) return make(2, 'QUALIFYING', 'RISING_ABOVE_BOTH');
    if (above150) return make(2, 'EARLY', 'RISING_ABOVE_150_BELOW_200');
    // Giá quanh MA150 đang dốc lên (trong vùng đệm): chưa thủng thật sự
    if (!below150) return priorDown && !above200 ? make(1, 'LATE_BASE', 'RISING_AT_150_AFTER_DECLINE') : make(2, 'PULLBACK', 'RISING_AT_150');
    if (priorDown) return make(1, 'LATE_BASE', 'RISING_BELOW_150_AFTER_DECLINE');
    if (price >= ma150 * (1 - o.pullbackDepth) && ma150 > ma200) return make(2, 'PULLBACK', 'RISING_SHALLOW_PULLBACK');
    return make(3, 'BREAKDOWN', 'RISING_BELOW_150_BREAKDOWN');
  }

  // 3) MA150 dốc xuống
  if (falling) {
    if (!above150) return priorUp && !below150 ? make(3, 'TOPPING', 'FALLING_AT_150_AFTER_ADVANCE') : make(4, 'DECLINING', 'FALLING_BELOW_150');
    return priorUp ? make(3, 'TOPPING', 'FALLING_ABOVE_150_AFTER_ADVANCE') : make(4, 'BEAR_RALLY', 'FALLING_ABOVE_150_BEAR_RALLY');
  }

  // 4) MA150 đi ngang: phân biệt đáy nền (Stage 1) và đỉnh (Stage 3) bằng xu hướng đi tới
  if (priorDown) return make(1, 'BASING', 'FLAT_AFTER_DECLINE');
  if (priorUp) return make(3, 'TOPPING', 'FLAT_AFTER_ADVANCE');
  // Đi ngang rất lâu, không rõ hướng trước đó: nửa dưới biên độ 52 tuần → đáy nền, nửa trên → đỉnh
  return posIn52wPct >= 50 ? make(3, 'TOPPING', 'FLAT_LONG_UPPER_RANGE') : make(1, 'BASING', 'FLAT_LONG_LOWER_RANGE');
}

/** Tên Stage dùng chung (khớp chuỗi cũ để các màn hình khác không bị ảnh hưởng) */
export const STAGE_NAME_VI: Record<StageNumber, string> = {
  1: 'Stage 1 (Tích lũy / Base)',
  2: 'Stage 2 (Tăng trưởng / Chưa đủ chuẩn mua)',
  3: 'Stage 3 (Phân phối / Rủi ro)',
  4: 'Stage 4 (Giảm giá / Không tham gia)',
};
export const STAGE_NAME_CONFIRMED_VI = 'Stage 2 (Tăng trưởng / Đủ điều kiện xét mua)';

/** Hợp lệ theo chu kỳ: 1→2, 2→3, 3→4, 4→1 là tiến thẳng; 3→2 (thất bại phân phối) và 2→1 (tái tích lũy sâu) chấp nhận được */
export const isCycleStep = (from: StageNumber, to: StageNumber): 'same' | 'forward' | 'back' | 'jump' => {
  if (from === to) return 'same';
  if ((from % 4) + 1 === to) return 'forward';
  if ((to % 4) + 1 === from) return 'back';
  return 'jump';
};

/** Xét Stage tại một phiên; có làm mượt theo đa số của N phiên gần nhất để tránh đổi Stage liên tục khi giá cắt qua lại MA. */
export function classifyStage(params: {
  closes: number[];
  highs: number[];
  lows: number[];
  /** Số tiêu chí Trend Template đạt (nếu có). Đủ 8/8 thì chắc chắn là Stage 2 */
  passedCount?: number;
  /** Chỉ số phiên cần xét (mặc định: phiên cuối) — dùng cho kiểm chứng lịch sử */
  idx?: number;
  options?: Partial<StageOptions>;
}): StageResult {
  const o = { ...DEFAULT_STAGE_OPTIONS, ...(params.options || {}) };
  const idx = params.idx ?? params.closes.length - 1;
  const latest = classifyRaw({ ...params, idx, options: o });
  if (o.smoothWindow <= 1 || latest.sub === 'INSUFFICIENT' || latest.rule === 'TT_8_OF_8') return latest;

  const votes: Record<number, number> = {};
  const lastSeen: Record<number, StageResult> = {};
  for (let j = 0; j < o.smoothWindow; j++) {
    if (idx - j < 0) break;
    const r = j === 0 ? latest : classifyRaw({ closes: params.closes, highs: params.highs, lows: params.lows, idx: idx - j, options: o });
    if (r.sub === 'INSUFFICIENT') continue;
    votes[r.stage] = (votes[r.stage] || 0) + 1;
    if (!lastSeen[r.stage]) lastSeen[r.stage] = r; // phiên gần nhất có Stage này
  }
  let best = latest.stage;
  let bestVotes = votes[best] || 0;
  for (const [k, v] of Object.entries(votes)) {
    if (v > bestVotes) {
      best = Number(k) as StageNumber;
      bestVotes = v;
    }
  }
  if (best === latest.stage) return latest;
  const src = lastSeen[best];
  return { stage: best, sub: src.sub, confirmed: false, evidence: latest.evidence, rule: `SMOOTHED:${src.rule}` };
}
