/**
 * Đặt chẩn đoán Wyckoff vào BỐI CẢNH chu kỳ lớn (Stage) — module thuần.
 *
 * Vì sao cần: máy Wyckoff (wyckoffEngine.ts) chỉ nhìn 40 phiên gần nhất và chỉ biết các pha tích lũy A→E.
 * Nếu không đặt vào bối cảnh, nó gọi "Phase D — điểm mua" cho cổ phiếu đang ở Stage 4, và gọi "Phase B — gom hàng"
 * cho cổ phiếu đang phân phối ở Stage 3. Hai khung phân tích nhìn cùng một chu kỳ ở hai độ phân giải khác nhau:
 *
 *    Weinstein / Minervini (độ phân giải thấp, dựa trên MA)      Wyckoff (độ phân giải cao, dựa trên giá & khối lượng)
 *    ───────────────────────────────────────────────────────     ────────────────────────────────────────────────────
 *    Stage 1  đáy nền                                            Tích lũy (Accumulation) Phase A → D
 *    Stage 2  tăng trưởng                                        Markup; các nền giữa đường = Tái tích lũy (Re-accumulation)
 *    Stage 3  đỉnh                                               Phân phối (Distribution) Phase A → D
 *    Stage 4  giảm giá                                           Markdown
 *
 * Stage đến SAU (đường MA là chỉ báo trễ); Wyckoff thường báo TRƯỚC. Vì vậy khi hai bên lệch nhau, đó thường là
 * vấn đề thời điểm (ai đi trước), không phải hai khung nói ngược hẳn — xem decisionEngine.ts.
 */
import type { StageResult } from './stageEngine';
import type { WyckoffAnalysis } from './wyckoffEngine';

/* ───────────────────────── Nhận diện dấu hiệu phân phối ───────────────────────── */

export type DistributionLevel = 'NONE' | 'WATCH' | 'WARNING' | 'CONFIRMED';

export interface DistributionSignals {
  /** Số dấu hiệu phân phối đang có (0–5) */
  score: number;
  level: DistributionLevel;
  flags: {
    /** Nến đẩy qua đỉnh nền rồi đóng cửa quay lại bên dưới (UT / UTAD) trong 30 phiên */
    upthrust: boolean;
    /** Nến giảm mạnh, đóng cửa nửa dưới, khối lượng lớn (SOW) trong 15 phiên */
    sow: boolean;
    /** Khối lượng phiên giảm lấn át khối lượng phiên tăng trong 30 phiên */
    supplyDominant: boolean;
    /** Giá dưới MA50 và MA50 đang dốc xuống */
    belowMa50Falling: boolean;
    /** Các đỉnh gần đây thấp hơn đỉnh trước đó */
    lowerHighs: boolean;
  };
  downUpVolRatio: number;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const maxOf = (a: number[]) => a.reduce((m, v) => (v > m ? v : m), -Infinity);

export function detectDistribution(p: {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  idx?: number;
}): DistributionSignals {
  const { opens, highs, lows, closes, volumes } = p;
  const idx = p.idx ?? closes.length - 1;
  const empty: DistributionSignals = {
    score: 0,
    level: 'NONE',
    flags: { upthrust: false, sow: false, supplyDominant: false, belowMa50Falling: false, lowerHighs: false },
    downUpVolRatio: 1,
  };
  if (idx < 70) return empty;

  const volAvg50 = avg(volumes.slice(idx - 49, idx + 1));

  // 1) Upthrust: poke qua đỉnh 40 phiên trước đó rồi đóng cửa quay lại bên dưới, đóng ở nửa dưới nến
  let upthrust = false;
  for (let i = idx - 29; i <= idx; i++) {
    const priorHigh = maxOf(highs.slice(i - 40, i));
    const spread = highs[i] - lows[i];
    const closePos = spread > 0 ? (closes[i] - lows[i]) / spread : 0.5;
    if (highs[i] > priorHigh && closes[i] < priorHigh && closePos <= 0.5) {
      upthrust = true;
      break;
    }
  }

  // 2) SOW: giảm ≥ 2%, đóng ở nửa dưới nến, khối lượng ≥ 1.2x TB50
  let sow = false;
  for (let i = idx - 14; i <= idx; i++) {
    const prev = closes[i - 1];
    const chg = prev > 0 ? ((closes[i] - prev) / prev) * 100 : 0;
    const spread = highs[i] - lows[i];
    const closePos = spread > 0 ? (closes[i] - lows[i]) / spread : 0.5;
    if (chg <= -2 && closePos <= 0.45 && volAvg50 > 0 && volumes[i] >= volAvg50 * 1.2) {
      sow = true;
      break;
    }
  }

  // 3) Cung lấn át cầu: tổng khối lượng phiên giảm / phiên tăng trong 30 phiên
  let upVol = 0;
  let downVol = 0;
  for (let i = idx - 29; i <= idx; i++) {
    if (closes[i] > closes[i - 1]) upVol += volumes[i] || 0;
    else if (closes[i] < closes[i - 1]) downVol += volumes[i] || 0;
  }
  const downUpVolRatio = upVol > 0 ? downVol / upVol : downVol > 0 ? 2 : 1;
  const supplyDominant = downUpVolRatio >= 1.15;

  // 4) Dưới MA50 và MA50 dốc xuống (so với 20 phiên trước)
  const ma50 = avg(closes.slice(idx - 49, idx + 1));
  const ma50Then = avg(closes.slice(idx - 69, idx - 19));
  const belowMa50Falling = closes[idx] < ma50 && ma50 < ma50Then;

  // 5) Đỉnh sau thấp hơn đỉnh trước: đỉnh 15 phiên gần nhất vs đỉnh 30 phiên liền trước đó
  const recentHigh = maxOf(highs.slice(idx - 14, idx + 1));
  const priorHigh = maxOf(highs.slice(idx - 44, idx - 14));
  const lowerHighs = recentHigh < priorHigh * 0.98;

  const flags = { upthrust, sow, supplyDominant, belowMa50Falling, lowerHighs };
  const score = Object.values(flags).filter(Boolean).length;
  const level: DistributionLevel = score >= 4 ? 'CONFIRMED' : score === 3 ? 'WARNING' : score === 2 ? 'WATCH' : 'NONE';
  // opens chưa dùng trong quy tắc hiện tại; giữ trong chữ ký để mở rộng (VD: nến đảo chiều)
  void opens;
  return { score, level, flags, downUpVolRatio: Number(downUpVolRatio.toFixed(2)) };
}

/* ───────────────────────── Bối cảnh chu kỳ ───────────────────────── */

export type Cycle = 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN';

export type CyclePhase =
  | 'MARKDOWN'
  | 'ACCUM_A'
  | 'ACCUM_B'
  | 'ACCUM_C'
  | 'ACCUM_D'
  | 'ACCUM_E' // vượt nền, chờ Stage 2 xác nhận
  | 'REACCUM_B'
  | 'REACCUM_C'
  | 'REACCUM_D'
  | 'MARKUP'
  | 'MARKUP_EXTENDED'
  | 'MARKUP_FAILING'
  | 'DIST_B'
  | 'DIST_C'
  | 'DIST_D';

/** Wyckoff đang nghiêng về hướng nào tại thời điểm này, SAU KHI đã xét bối cảnh Stage */
export type WyckoffBias = 'BULLISH_TIMING' | 'NEUTRAL' | 'BEARISH';

export interface CycleContext {
  cycle: Cycle;
  phase: CyclePhase;
  bias: WyckoffBias;
  /** Cách đọc tích lũy thô của máy Wyckoff có hợp lý trong bối cảnh Stage hiện tại không */
  coherent: boolean;
  /** Cách đọc thô của máy Wyckoff (chỉ có pha tích lũy) */
  rawPhase: string;
  /** Stage 4 nhưng cấu trúc nền đang hình thành (Wyckoff báo sớm Stage 1) */
  earlyBasing: boolean;
  /** Stage 3 nhưng giá đang nỗ lực vượt nền trở lại */
  resumptionAttempt: boolean;
  distribution: DistributionSignals;
}

export function buildCycleContext(p: {
  stage: StageResult;
  wy: Pick<WyckoffAnalysis, 'wyckoffPhase' | 'wyckoffPassedCount' | 'buyPointCode'>;
  dist: DistributionSignals;
}): CycleContext {
  const { stage, wy, dist } = p;
  const raw = wy.wyckoffPhase; // 'Phase A'..'Phase E'
  const letter = raw.slice(-1) as 'A' | 'B' | 'C' | 'D' | 'E';
  const passed = wy.wyckoffPassedCount;
  const buy = wy.buyPointCode;
  const base = { rawPhase: raw, distribution: dist, earlyBasing: false, resumptionAttempt: false };

  // ── Stage 4: Markdown. Cấu trúc tích lũy chưa thể đã hoàn tất khi MA150 còn dốc xuống / giá còn dưới ──
  if (stage.stage === 4) {
    const earlyBasing = (letter === 'C' || letter === 'D' || letter === 'E') && passed >= 5 && dist.score <= 1;
    return { ...base, cycle: 'MARKDOWN', phase: 'MARKDOWN', bias: earlyBasing ? 'NEUTRAL' : 'BEARISH', coherent: letter === 'A', earlyBasing };
  }

  // ── Stage 3: Phân phối. Đọc "tích lũy" ở đây là sai ngữ cảnh cho đến khi giá thoát nền trở lại ──
  if (stage.stage === 3) {
    const phase: CyclePhase = dist.score >= 4 ? 'DIST_D' : dist.score === 3 ? 'DIST_C' : 'DIST_B';
    const resumptionAttempt = letter === 'E' && dist.score <= 1 && passed >= 6;
    return { ...base, cycle: 'DISTRIBUTION', phase, bias: resumptionAttempt ? 'NEUTRAL' : 'BEARISH', coherent: false, resumptionAttempt };
  }

  // ── Stage 1: Tích lũy — đúng "đất" của các pha A→D ──
  if (stage.stage === 1) {
    const phase = (`ACCUM_${letter}` as CyclePhase);
    // Chỉ Phase D/E (có xác nhận sức mạnh) mới là điểm vào. Spring (Phase C) KHÔNG tính là tín hiệu mua:
    // dữ liệu lịch sử cho thấy mua thăm dò Spring có lợi suất kém hơn hẳn mua khi đã có SOS / vượt nền.
    const bullish = (letter === 'D' || letter === 'E') && passed >= 5 && dist.score <= 2;
    return { ...base, cycle: 'ACCUMULATION', phase, bias: dist.score >= 3 ? 'BEARISH' : bullish ? 'BULLISH_TIMING' : 'NEUTRAL', coherent: true };
  }

  // ── Stage 2: Markup; nền giữa đường là Tái tích lũy ──
  // Dấu hiệu phân phối rõ ràng thắng mọi cách đọc khác: đỉnh thường lộ ra ở Wyckoff trước khi MA kịp quay đầu.
  if (dist.score >= 3) {
    return { ...base, cycle: 'MARKUP', phase: 'MARKUP_FAILING', bias: 'BEARISH', coherent: false };
  }
  if (letter === 'E') {
    if (buy === 'HOLD_MARKUP') return { ...base, cycle: 'MARKUP', phase: 'MARKUP_EXTENDED', bias: 'NEUTRAL', coherent: true };
    return { ...base, cycle: 'MARKUP', phase: 'MARKUP', bias: buy === 'BUY_3_BREAKOUT_BU' ? 'BULLISH_TIMING' : 'NEUTRAL', coherent: true };
  }
  if (letter === 'A') {
    // Giá đang gãy mạnh trong khi MA chưa kịp quay: báo hiệu Stage 2 đang hỏng
    return { ...base, cycle: 'MARKUP', phase: 'MARKUP_FAILING', bias: 'BEARISH', coherent: false };
  }
  const phase = (`REACCUM_${letter}` as CyclePhase);
  // Spring trong Stage 2 (REACCUM_C) là nhóm có lợi suất tệ nhất trong dữ liệu lịch sử → chỉ coi LPS/SOS (REACCUM_D) là điểm vào
  const bullish = letter === 'D' && buy === 'BUY_2_LPS';
  return { ...base, cycle: 'MARKUP', phase, bias: bullish ? 'BULLISH_TIMING' : 'NEUTRAL', coherent: true };
}
