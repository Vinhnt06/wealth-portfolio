/**
 * Sức khỏe doanh nghiệp theo tinh thần SEPA của Minervini — module thuần (kiểm chứng được theo thời điểm).
 *
 * Minervini chỉ chọn cổ phiếu có lợi nhuận và doanh thu tăng trưởng rõ ràng so cùng kỳ. Dữ liệu trong ứng dụng là 8 quý
 * gần nhất (cột EPS đang trống) nên dùng LỢI NHUẬN SAU THUẾ và DOANH THU so cùng kỳ năm trước.
 *
 * Điểm quan trọng khi kiểm chứng lịch sử: báo cáo chỉ được biết SAU ngày kết thúc quý (REPORT_LAG_DAYS), nếu không sẽ nhìn trước tương lai.
 */
export interface QuarterRec {
  quarter: number;
  year: number;
  periodLabel?: string;
  revenue: number;
  netProfit: number;
  netMargin?: number;
}

export type FundState = 'STRONG' | 'OK' | 'WEAK' | 'NO_DATA';

export interface FundamentalsResult {
  state: FundState;
  /** Quý báo cáo mới nhất đã công bố tại thời điểm xét */
  period: string | null;
  netProfitYoY: number | null;
  revenueYoY: number | null;
  /** Tăng trưởng 4 quý gần nhất so với 4 quý cùng kỳ năm trước (cần 8 quý) */
  ttmProfitYoY: number | null;
  netMarginChangePp: number | null;
  accelerating: boolean | null;
  turnaround: boolean;
  /** Tăng trưởng quá lớn do nền so sánh quá thấp (không phản ánh tăng trưởng thật) */
  lowBase: boolean;
  lossMaking: boolean;
  /** Mã lý do để giao diện dịch */
  reasons: string[];
}

/** Ngày công bố ước tính: sau ngày kết thúc quý 45 ngày (báo cáo quý phải công bố trong vòng 30–45 ngày) */
export const REPORT_LAG_DAYS = 45;
/** Ngưỡng tăng trưởng "mạnh" (Minervini thường dùng ≥ 25% lợi nhuận) */
export const STRONG_PROFIT_YOY = 25;
export const STRONG_TTM_YOY = 10;
export const WEAK_PROFIT_YOY = -10;
/** Trên ngưỡng này coi là "nền thấp": con số tăng trưởng không còn ý nghĩa */
export const LOW_BASE_YOY = 300;

const quarterEnd = (year: number, quarter: number) => new Date(Date.UTC(year, quarter * 3, 0)); // ngày cuối của quý
const availableOn = (q: QuarterRec) => new Date(quarterEnd(q.year, q.quarter).getTime() + REPORT_LAG_DAYS * 86400000);
const yoyPct = (cur: number, base: number): number | null => (base > 0 ? ((cur - base) / base) * 100 : null);
const r1 = (v: number | null) => (v === null ? null : Number(v.toFixed(1)));

export function assessFundamentals(quarters: QuarterRec[] | undefined, asOf?: string): FundamentalsResult {
  const empty: FundamentalsResult = {
    state: 'NO_DATA', period: null, netProfitYoY: null, revenueYoY: null, ttmProfitYoY: null,
    netMarginChangePp: null, accelerating: null, turnaround: false, lowBase: false, lossMaking: false, reasons: ['NO_FUNDAMENTAL_DATA'],
  };
  if (!quarters || quarters.length < 5) return empty;

  const cutoff = asOf ? new Date(`${asOf}T00:00:00Z`) : null;
  const known = [...quarters]
    .filter((q) => !cutoff || availableOn(q) <= cutoff)
    .sort((a, b) => a.year * 4 + a.quarter - (b.year * 4 + b.quarter));
  if (known.length < 5) return empty;

  const byKey = new Map(known.map((q) => [q.year * 4 + q.quarter, q]));
  const L = known[known.length - 1];
  const key = L.year * 4 + L.quarter;
  const prevYear = byKey.get(key - 4);
  if (!prevYear) return empty;

  const np = yoyPct(L.netProfit, prevYear.netProfit);
  const rev = yoyPct(L.revenue, prevYear.revenue);
  const turnaround = L.netProfit > 0 && prevYear.netProfit <= 0;

  // Quý liền trước (để xét tăng tốc)
  const Lm1 = byKey.get(key - 1);
  const Lm5 = byKey.get(key - 5);
  const npPrev = Lm1 && Lm5 ? yoyPct(Lm1.netProfit, Lm5.netProfit) : null;
  const accelerating = np !== null && npPrev !== null ? np > npPrev : null;

  // 4 quý gần nhất so với 4 quý cùng kỳ
  const last4 = [0, 1, 2, 3].map((k) => byKey.get(key - k));
  const prior4 = [4, 5, 6, 7].map((k) => byKey.get(key - k));
  let ttm: number | null = null;
  let ttmSum: number | null = null;
  if (last4.every(Boolean)) {
    ttmSum = last4.reduce((s, q) => s + (q as QuarterRec).netProfit, 0);
    if (prior4.every(Boolean)) ttm = yoyPct(ttmSum, prior4.reduce((s, q) => s + (q as QuarterRec).netProfit, 0));
  }

  const marginCur = L.netMargin ?? (L.revenue > 0 ? (L.netProfit / L.revenue) * 100 : null);
  const marginPrev = prevYear.netMargin ?? (prevYear.revenue > 0 ? (prevYear.netProfit / prevYear.revenue) * 100 : null);
  const marginChange = marginCur !== null && marginPrev !== null ? marginCur - marginPrev : null;

  const lossMaking = (ttmSum !== null ? ttmSum <= 0 : L.netProfit <= 0);
  const lowBase = (np !== null && np > LOW_BASE_YOY) || (rev !== null && rev > LOW_BASE_YOY);
  const reasons: string[] = [];
  let state: FundState;
  if (lossMaking) {
    state = 'WEAK';
    reasons.push('FUND_LOSS_MAKING');
  } else if (np !== null && np <= WEAK_PROFIT_YOY) {
    state = 'WEAK';
    reasons.push('FUND_PROFIT_FALLING');
  } else if (lowBase && !(ttm !== null && ttm >= STRONG_TTM_YOY && ttm <= LOW_BASE_YOY)) {
    // Tăng vọt từ nền rất thấp: chưa đủ để kết luận tăng trưởng bền vững
    state = 'OK';
    reasons.push('FUND_LOW_BASE');
  } else if (np !== null && np >= STRONG_PROFIT_YOY && (ttm === null || ttm >= STRONG_TTM_YOY)) {
    state = 'STRONG';
    reasons.push('FUND_PROFIT_STRONG');
  } else {
    state = 'OK';
    reasons.push(turnaround ? 'FUND_TURNAROUND' : 'FUND_PROFIT_STABLE');
  }
  if (rev !== null && rev < 0) reasons.push('FUND_REVENUE_FALLING');
  if (accelerating === true && state !== 'WEAK') reasons.push('FUND_ACCELERATING');
  if (marginChange !== null && marginChange < -2 && state !== 'WEAK') reasons.push('FUND_MARGIN_SHRINKING');

  return {
    state,
    period: L.periodLabel ?? `Q${L.quarter}/${L.year}`,
    netProfitYoY: r1(np),
    revenueYoY: r1(rev),
    ttmProfitYoY: r1(ttm),
    netMarginChangePp: r1(marginChange),
    accelerating,
    turnaround,
    lowBase,
    lossMaking,
    reasons,
  };
}
