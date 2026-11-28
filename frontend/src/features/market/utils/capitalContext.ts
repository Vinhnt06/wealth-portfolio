/**
 * Bối cảnh "Lợi nhuận × Vốn" (khung của Dragon Capital, DNSE 11/2026):
 *   Giá cổ phiếu = lợi nhuận × định giá; định giá đi theo ĐIỀU KIỆN VỐN, không theo GDP.
 *   Câu hỏi 1 — Lợi nhuận đang cải thiện hay suy yếu?
 *   Câu hỏi 2 — Vốn đang nới lỏng hay thắt chặt? (lợi suất TPCP 10 năm trong 6 tháng, utils/buyTiming.ts)
 *   Đi ngang hoặc chưa rõ thì giữ mức gốc 50/35/15.
 * Tỷ trọng là số minh hoạ của Dragon Capital (họ ghi rõ chưa kiểm định ngoài mẫu).
 */

import { yieldTrend, YIELD_BAND, type YieldPoint, type YieldTrend } from './buyTiming';

export type Direction = 'UP' | 'DOWN' | 'UNCLEAR';
export type ContextKey = 'IMPROVE_EASY' | 'WEAK_EASY' | 'BASE' | 'IMPROVE_TIGHT' | 'WEAK_TIGHT';

export interface Allocation {
  equity: number;
  bonds: number;
  cash: number;
  label: string;
  how: string;
}

export const CONTEXT_ALLOCATION: Record<ContextKey, Allocation> = {
  IMPROVE_EASY: { equity: 65, bonds: 25, cash: 10, label: 'Lợi nhuận cải thiện · Vốn nới lỏng', how: 'Tăng dần rổ cổ phiếu đa dạng khi thị trường xác nhận.' },
  WEAK_EASY: { equity: 55, bonds: 35, cash: 10, label: 'Lợi nhuận suy yếu · Vốn nới lỏng', how: 'Thăm dò khi đà hồi lan rộng; cân nhắc kéo dài kỳ hạn trái phiếu.' },
  BASE: { equity: 50, bonds: 35, cash: 15, label: 'Mức gốc (chưa đủ kết luận)', how: 'Giữ nguyên khi điều kiện vốn hoặc lợi nhuận chưa có kết luận.' },
  IMPROVE_TIGHT: { equity: 45, bonds: 35, cash: 20, label: 'Lợi nhuận cải thiện · Vốn thắt chặt', how: 'Ưu tiên doanh nghiệp dòng tiền tốt, ít vay nợ; giữ kỳ hạn trái phiếu ngắn.' },
  WEAK_TIGHT: { equity: 35, bonds: 35, cash: 30, label: 'Lợi nhuận suy yếu · Vốn thắt chặt', how: 'Tăng tiền và trái phiếu ngắn hạn; hạn chế tín dụng yếu.' },
};

export function contextOf(earnings: Direction, capital: Direction): ContextKey {
  if (earnings === 'UNCLEAR' || capital === 'UNCLEAR') return 'BASE';
  if (earnings === 'UP') return capital === 'UP' ? 'IMPROVE_EASY' : 'IMPROVE_TIGHT';
  return capital === 'UP' ? 'WEAK_EASY' : 'WEAK_TIGHT';
}

// ─── Câu hỏi 1: Lợi nhuận (từ báo cáo tài chính thật, tổng lợi nhuận 12 tháng gần nhất) ───
export interface QuarterRow {
  periodLabel: string; // "Q3/2026"
  netProfit: number;
}

export interface EarningsAnswer {
  direction: Direction;
  latestPeriod: string | null;
  /** Tổng LNST 12 tháng (TTM) của rổ: % thay đổi so với quý trước, cho 2 quý gần nhất */
  ttmChanges: { period: string; pct: number }[];
  /** % doanh nghiệp có LNST 12 tháng tăng so với quý trước (quý gần nhất) */
  breadthUp: number | null;
  companies: number;
  note: string;
}

const qKey = (p: string) => {
  const m = /^Q([1-4])\/(\d{4})$/.exec(p);
  return m ? Number(m[2]) * 4 + Number(m[1]) : NaN;
};

export function answerEarnings(companies: QuarterRow[][]): EarningsAnswer {
  // gom LNST theo quý cho từng công ty
  const maps = companies.map((qs) => new Map(qs.map((q) => [qKey(q.periodLabel), q.netProfit])));
  const all = new Set<number>();
  maps.forEach((m) => m.forEach((_, k) => Number.isFinite(k) && all.add(k)));
  const quarters = [...all].sort((a, b) => a - b);
  const label = (k: number) => `Q${((k - 1) % 4) + 1}/${Math.floor((k - 1) / 4)}`;
  const ttm = (m: Map<number, number>, end: number) => {
    let s = 0;
    for (let k = end - 3; k <= end; k++) {
      const v = m.get(k);
      if (typeof v !== 'number') return null;
      s += v;
    }
    return s;
  };
  const last = quarters[quarters.length - 1];
  if (!Number.isFinite(last)) {
    return { direction: 'UNCLEAR', latestPeriod: null, ttmChanges: [], breadthUp: null, companies: 0, note: 'Chưa có dữ liệu báo cáo tài chính.' };
  }
  const changes: { period: string; pct: number }[] = [];
  let breadthUp: number | null = null;
  let used = 0;
  for (const end of [last, last - 1]) {
    let cur = 0;
    let prev = 0;
    let up = 0;
    let n = 0;
    for (const m of maps) {
      const a = ttm(m, end);
      const b = ttm(m, end - 1);
      if (a === null || b === null) continue;
      cur += a;
      prev += b;
      n++;
      if (a > b) up++;
    }
    if (n >= 20 && prev > 0) {
      changes.push({ period: label(end), pct: Number((((cur - prev) / prev) * 100).toFixed(2)) });
      if (end === last) {
        breadthUp = Number(((up / n) * 100).toFixed(1));
        used = n;
      }
    }
  }
  let direction: Direction = 'UNCLEAR';
  if (changes.length === 2 && breadthUp !== null) {
    const bothUp = changes.every((c) => c.pct > 1);
    const bothDown = changes.every((c) => c.pct < -1);
    if (bothUp && breadthUp > 55) direction = 'UP';
    else if (bothDown && breadthUp < 45) direction = 'DOWN';
  }
  return {
    direction,
    latestPeriod: label(last),
    ttmChanges: changes,
    breadthUp,
    companies: used,
    note: 'Cải thiện khi tổng LNST 12 tháng tăng >1% ở cả 2 quý gần nhất VÀ >55% doanh nghiệp tăng; suy yếu khi ngược lại; còn lại là chưa rõ. Dựa trên lợi nhuận đã công bố (chậm hơn dự báo của giới phân tích khoảng 1 quý).',
  };
}

// ─── Câu hỏi 2: Vốn (cùng quy tắc đã kiểm chứng ở utils/buyTiming.ts) ───
export interface CapitalAnswer {
  /** UP = nới lỏng (lợi suất giảm) · DOWN = thắt chặt (lợi suất tăng) · UNCLEAR = đi ngang hoặc thiếu số */
  direction: Direction;
  yield10Y: YieldTrend | null;
  note: string;
}

export function answerCapital(points: YieldPoint[], nowMs = Date.now()): CapitalAnswer {
  const t = yieldTrend(points, nowMs);
  return {
    direction: t?.trend === 'FALLING' ? 'UP' : t?.trend === 'RISING' ? 'DOWN' : 'UNCLEAR',
    yield10Y: t,
    note: `Nới lỏng khi lợi suất TPCP 10 năm giảm từ ${YIELD_BAND} điểm trong 6 tháng; thắt chặt khi tăng từ ${YIELD_BAND} điểm; còn lại là đi ngang.`,
  };
}
