/**
 * "Khi nào được mua mới" — hai điều kiện đã kiểm chứng, cộng phần định giá & chi phí vốn để tham khảo.
 *   1) Thị trường: cổng utils/marketState.ts không ở trạng thái Bất lợi (cùng cổng với bộ lọc).
 *   2) Chi phí vốn: lợi suất TPCP Việt Nam 10 năm KHÔNG tăng từ 0,25 điểm trở lên trong 6 tháng.
 *
 * Kiểm chứng 28/11/2026 (VN-Index, TPCP 10N, tín hiệu tại cuối tháng, không nhìn trước):
 *  - Lợi suất VN-Index 6 tháng sau: +2,3% khi lợi suất tăng, +8,1% khi không tăng (2015–2026).
 *    Cùng chiều ở cả 27 cách đặt tham số đã thử (TPCP 10N / 2N / liên ngân hàng × cửa sổ 3, 6, 12 tháng × 3 ngưỡng).
 *  - Lệnh MUA của app: −1,5%/lệnh (thắng 22%) khi lợi suất đang tăng, +3,6% đến +10,2% khi không tăng;
 *    2023–2026 chênh lệch nhỏ hơn nhiều (−0,3% so với +2,6%).
 *  - Nắm VN-Index chỉ khi cổng mở VÀ lợi suất không tăng, còn lại giữ tiền: +12,0%/năm, sụt −23%
 *    (chỉ cổng: +8,3%, −30%; luôn nắm: +9,3%, −45%).
 * Hạn chế: lợi thế đến chủ yếu từ 2018 và 2022; giai đoạn 2023–2026 thua nắm giữ (+4,9% so với +10,9%/năm).
 * Chỉ có vài chu kỳ lãi suất nên đây là bộ lọc rủi ro, không phải dự báo.
 *
 * Định giá (lợi suất lợi nhuận E/P trừ lãi) chỉ hiển thị: mẫu "đắt" mới có khoảng 14 tháng và thứ hạng
 * lịch sử đổi nhiều theo độ trễ công bố lợi nhuận, nên không dùng làm đèn mua.
 * Lãi suất điều hành không dùng: 95% thời gian 2015–2026 ở trạng thái "lần đổi gần nhất là giảm".
 */

export const YIELD_WINDOW_DAYS = 182;
export const YIELD_BAND = 0.25;
/** Số phiên giữ trung bình một lệnh theo quy tắc bán hiện tại (phép thử 2019–2026) */
export const TYPICAL_HOLD_SESSIONS = 27;
const SESSIONS_PER_YEAR = 250;
/** Số liệu lợi suất cũ hơn mức này thì không kết luận */
const MAX_STALE_DAYS = 10;

export type YieldPoint = [date: string, value: number];
export type CapitalTrend = 'FALLING' | 'FLAT' | 'RISING';

export interface YieldTrend {
  trend: CapitalTrend;
  date: string;
  value: number;
  pastDate: string;
  past: number;
  change: number;
  /** Lợi suất từ mức này trở lên (so với mốc 6 tháng trước hiện tại) bị coi là đang tăng */
  tightFrom: number;
}

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Chiều của lợi suất trong 6 tháng; null nếu thiếu lịch sử hoặc số liệu quá cũ. `points` tăng dần theo ngày. */
export function yieldTrend(points: YieldPoint[], nowMs = Date.now()): YieldTrend | null {
  const last = points[points.length - 1];
  if (!last || nowMs - toMs(last[0]) > MAX_STALE_DAYS * DAY) return null;
  const cutoff = toMs(last[0]) - YIELD_WINDOW_DAYS * DAY;
  let past: YieldPoint | null = null;
  for (const p of points) {
    if (toMs(p[0]) > cutoff) break;
    past = p;
  }
  if (!past || cutoff - toMs(past[0]) > MAX_STALE_DAYS * DAY) return null;
  const change = r2(last[1] - past[1]);
  return {
    trend: change >= YIELD_BAND ? 'RISING' : change <= -YIELD_BAND ? 'FALLING' : 'FLAT',
    date: last[0],
    value: r2(last[1]),
    pastDate: past[0],
    past: r2(past[1]),
    change,
    tightFrom: r2(past[1] + YIELD_BAND),
  };
}

/** Gộp lịch sử đã lưu với số sống mới nhất (số sống ghi đè cùng ngày) */
export function mergeYield(history: YieldPoint[], live: YieldPoint | null): YieldPoint[] {
  if (!live || !Number.isFinite(live[1])) return history;
  return [...history.filter((p) => p[0] !== live[0]), live].sort((a, b) => a[0].localeCompare(b[0]));
}

export interface Valuation {
  pe: number;
  peDate: string;
  /** Lợi suất lợi nhuận E/P, %/năm */
  earningsYield: number;
  /** E/P trừ lãi gửi 12 tháng */
  overDeposit: number | null;
  /** E/P trừ lợi suất TPCP 10 năm */
  overBond: number | null;
  /** Trung vị lịch sử của (E/P − TPCP 10N) */
  typicalOverBond: number | null;
}

export function valuationVsCapital(p: {
  peHistory: YieldPoint[];
  bonds: YieldPoint[];
  deposit: number | null;
}): Valuation | null {
  const last = p.peHistory[p.peHistory.length - 1];
  if (!last || !(last[1] > 0)) return null;
  const gaps: number[] = [];
  let j = -1;
  for (const [date, pe] of p.peHistory) {
    while (j + 1 < p.bonds.length && p.bonds[j + 1][0] <= date) j++;
    if (j >= 0 && pe > 0) gaps.push(100 / pe - p.bonds[j][1]);
  }
  gaps.sort((a, b) => a - b);
  const bond = p.bonds[p.bonds.length - 1]?.[1] ?? null;
  const ey = 100 / last[1];
  return {
    pe: r2(last[1]),
    peDate: last[0],
    earningsYield: r2(ey),
    overDeposit: p.deposit === null ? null : r2(ey - p.deposit),
    overBond: bond === null ? null : r2(ey - bond),
    typicalOverBond: gaps.length >= 250 ? r2(gaps[gaps.length >> 1]) : null,
  };
}

/** Chi phí vốn cho một lệnh, % giá trị lệnh (lãi %/năm × số phiên giữ) */
export const carryCostPct = (annualRatePct: number, sessions = TYPICAL_HOLD_SESSIONS): number =>
  r2((annualRatePct * sessions) / SESSIONS_PER_YEAR);

export type TimingVerdict = 'OK' | 'WAIT_MARKET' | 'WAIT_CAPITAL' | 'WAIT_BOTH' | 'UNKNOWN';

/** `null` = chưa đủ số liệu cho điều kiện đó */
export function timingVerdict(marketOpen: boolean | null, capitalOk: boolean | null): TimingVerdict {
  if (marketOpen === false && capitalOk === false) return 'WAIT_BOTH';
  if (marketOpen === false) return 'WAIT_MARKET';
  if (capitalOk === false) return 'WAIT_CAPITAL';
  if (marketOpen === null || capitalOk === null) return 'UNKNOWN';
  return 'OK';
}
