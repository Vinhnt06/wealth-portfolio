/**
 * Trạng thái thị trường theo 3 phép đo (khung của Dragon Capital, trình bày tại DNSE 11/2026):
 *  - Xu hướng: VN-Index so với MA200.
 *  - Độ rộng: tỷ lệ 100 mã vốn hoá lớn nhất HOSE đóng cửa trên MA50 của từng mã.
 *  - Biến động: độ lệch chuẩn lợi suất ngày 20 phiên so với trung vị của chính nó trong 1 năm (252 phiên).
 *
 * THUẬN LỢI: VN-Index > MA200 VÀ độ rộng > 50% hai cuối tuần liên tiếp, tuần sau cao hơn tuần trước.
 * BẤT LỢI : VN-Index < MA200 VÀ biến động 20 phiên > trung vị 1 năm.
 * TRUNG TÍNH: còn lại. Trạng thái xác định ở giá đóng cửa cuối tuần.
 *
 * Kiểm chứng (Entrade, 485 tuần 06/2017 → 11/2026, 100 mã lớn hiện tại): tuần kế tiếp giảm > 3% ở 5% / 8% / 18%
 * số tuần (Thuận lợi / Trung tính / Bất lợi); Trung tính ≈ mức chung của thị trường (8,3%).
 * Tỷ trọng mua 100% / 100% / 0% (mua & giữ VN-Index theo trạng thái, tiền mặt 4,5%/năm): +13,2%/năm, sụt tối đa −20%,
 * so với mua & giữ +8,7%/năm, sụt −42%; bản 100/50/0 kém hơn ở cả 2017–2022 lẫn 2023–2026 nên đã bỏ.
 * Hạn chế: ngoài mẫu 2023–2026 trạng thái Bất lợi chỉ có 18 tuần và chưa báo đúng (thị trường hồi nhanh).
 */

export type MarketStateKey = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE';

export interface Series {
  dates: string[]; // YYYY-MM-DD theo giờ VN, tăng dần
  closes: number[];
}

export interface WeeklyState {
  date: string;
  state: MarketStateKey;
  vniClose: number;
  ma200: number;
  breadth: number | null; // 0..1
  vol20: number;
  vol20Median: number;
}

const sma = (a: number[], i: number, n: number) => {
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += a[k];
  return s / n;
};
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Khoá tuần = ngày thứ Hai của tuần chứa ngày d */
const isoWeekKey = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

/** Tính trạng thái cho từng cuối tuần (tuần cuối cùng có thể là tuần đang diễn ra → "tạm tính"). */
export function computeWeeklyStates(vni: Series, stocks: Series[]): WeeklyState[] {
  const { dates, closes } = vni;
  const rets = closes.map((c, i) => (i === 0 ? 0 : c / closes[i - 1] - 1));
  const vol20 = closes.map((_, i) => {
    if (i < 20) return NaN;
    const w = rets.slice(i - 19, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length);
  });
  const stockIdx = stocks.map((s) => new Map(s.dates.map((d, i) => [d, i])));
  const breadthAt = (d: string): number | null => {
    let up = 0;
    let n = 0;
    stocks.forEach((s, k) => {
      const j = stockIdx[k].get(d);
      if (j === undefined || j < 49) return;
      n++;
      if (s.closes[j] > sma(s.closes, j, 50)) up++;
    });
    return n >= 30 ? up / n : null;
  };

  // chỉ số phiên cuối của mỗi tuần
  const weekEnds: number[] = [];
  dates.forEach((d, i) => {
    if (i === dates.length - 1 || isoWeekKey(dates[i + 1]) !== isoWeekKey(d)) weekEnds.push(i);
  });

  const out: WeeklyState[] = [];
  let prevBreadth: number | null = null;
  for (const i of weekEnds) {
    const b = breadthAt(dates[i]);
    if (i < 252 + 20 || !Number.isFinite(vol20[i])) {
      prevBreadth = b;
      continue;
    }
    const ma200 = sma(closes, i, 200);
    const volMed = median(vol20.slice(i - 251, i + 1).filter((v) => Number.isFinite(v)));
    const favorable = closes[i] > ma200 && b !== null && prevBreadth !== null && b > 0.5 && prevBreadth > 0.5 && b > prevBreadth;
    const unfavorable = closes[i] < ma200 && vol20[i] > volMed;
    out.push({
      date: dates[i],
      state: favorable ? 'FAVORABLE' : unfavorable ? 'UNFAVORABLE' : 'NEUTRAL',
      vniClose: closes[i],
      ma200: Number(ma200.toFixed(2)),
      breadth: b === null ? null : Number(b.toFixed(3)),
      vol20: Number((vol20[i] * 100).toFixed(2)),
      vol20Median: Number((volMed * 100).toFixed(2)),
    });
    prevBreadth = b;
  }
  return out;
}

/** Bằng chứng lịch sử (kiểm chứng trên dữ liệu app, xem chú thích đầu file) để hiển thị kèm trạng thái */
export const MARKET_STATE_EVIDENCE: Record<MarketStateKey, { drop3Pct: number; sd: number; ttReturn20d: number; ttStopHit: number; buySize: number }> = {
  FAVORABLE: { drop3Pct: 5, sd: 2.1, ttReturn20d: 3.7, ttStopHit: 41, buySize: 1 },
  NEUTRAL: { drop3Pct: 8, sd: 2.4, ttReturn20d: 2.0, ttStopHit: 44, buySize: 1 },
  UNFAVORABLE: { drop3Pct: 18, sd: 3.7, ttReturn20d: 1.0, ttStopHit: 49, buySize: 0 },
};

export const MARKET_STATE_TEXT: Record<MarketStateKey, { vi: string; en: string; action: string }> = {
  FAVORABLE: { vi: 'Thuận lợi', en: 'Favorable', action: 'Mua đủ tỷ trọng khi có điểm mua' },
  NEUTRAL: { vi: 'Trung tính', en: 'Neutral', action: 'Mua theo điểm mua' },
  UNFAVORABLE: { vi: 'Bất lợi', en: 'Unfavorable', action: 'Không mở vị thế mới, chỉ theo dõi' },
};
