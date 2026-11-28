/**
 * Quy tắc BÁN của ứng dụng (dùng chung cho trang chi tiết mã và tab Kỳ vọng R:R).
 *
 *   1) Cắt lỗ cố định −7% tính từ giá mua.
 *   2) Bán HẾT khi quyết định "người đang giữ" (utils/decisionEngine.ts) chuyển sang Giảm tỷ trọng hoặc Thoát;
 *      đặt lệnh ở giá mở cửa phiên kế tiếp.
 *   3) Không đặt chốt lời ở mức cố định.
 *
 * Kiểm chứng 11/2026 (giá ngày Entrade, 185 mã thanh khoản hiện tại, tín hiệu MUA của app, T+2, phí 0,4%):
 *  - Từng lệnh, 2019–12/2023: +5,39%/lệnh so với +2,39% của cắt lỗ 7% / chốt lời 21% / tối đa 60 phiên
 *    (chênh +3,01, khoảng 95% +0,83 → +5,54); 12/2023–11/2026: +1,58% so với +1,05% (chưa có ý nghĩa thống kê).
 *  - Danh mục 10 mã, 2019–11/2026: +16,9%/năm, sụt tối đa −44,9% (cắt lỗ/chốt lời cố định +10,7%/năm, −46,1%;
 *    VN-Index +7,9%/năm, −40,3%); hơn chọn mã ngẫu nhiên cùng cách bán 19/20 lần.
 *  - Bán 1/2 khi Giảm tỷ trọng kém hơn bán hết (+11,8%/năm). Chốt lời bậc thang chưa từng được kiểm chứng.
 *  - Tính thêm phiên trắng bên (không khớp ở trần/sàn), đo ngày 28/11/2026: danh mục có cổng thị trường còn
 *    +14,8%/năm, sụt −43% (trước đó +16,8%, −37%); chọn ngẫu nhiên trong tín hiệu: trung vị +12,2%/năm.
 *  - Lỗ xấu: dù cắt lỗ −7%, 9% số lệnh lỗ quá 8,4% và 5% lỗ quá 10% (nhảy giá, T+2, trắng bên mua);
 *    lệnh xấu nhất −34,9%. Vì vậy khối lượng mua được đối chiếu thêm với mức dự phòng EXIT_BAD_LOSS_PCT.
 * Hạn chế: rổ mã là danh sách hiện nay (thiên lệch sống sót); 12/2023–11/2026 chỉ ngang VN-Index (+19,2% so với
 * +15,2%/năm với 10 mã, nhưng +7,9% với 20 mã).
 */
import type { HolderAction } from './decisionEngine';

export const EXIT_STOP_PCT = 7;
/** Mức lỗ dự phòng khi giá nhảy qua điểm cắt lỗ: khoảng 1/20 số lệnh trong phép thử lỗ quá mức này */
export const EXIT_BAD_LOSS_PCT = 10;
const BOARD_LOT = 100;

/**
 * Đối chiếu khối lượng đã tính (theo điểm cắt lỗ) với trường hợp lỗ xấu.
 * `maxShares` là khối lượng (lô 100) để lỗ xấu vẫn nằm trong mức rủi ro đã chọn, không lớn hơn `shares`.
 */
export function badCaseSizing(p: { entry: number; shares: number; capital: number; riskPct: number }) {
  const lossPerShare = (p.entry * EXIT_BAD_LOSS_PCT) / 100;
  const loss = p.shares * lossPerShare;
  const lossPctOfCapital = p.capital > 0 ? (loss / p.capital) * 100 : 0;
  const budget = (p.capital * p.riskPct) / 100;
  const fit = lossPerShare > 0 ? Math.floor(budget / lossPerShare / BOARD_LOT) * BOARD_LOT : 0;
  const maxShares = Math.max(0, Math.min(p.shares, fit));
  return { loss, lossPctOfCapital, maxShares, overBudget: maxShares < p.shares };
}

/** Tín hiệu "người đang giữ" khiến quy tắc bán hết vị thế */
export const isSellSignal = (a: HolderAction | undefined | null): boolean => a === 'REDUCE' || a === 'EXIT';

export const EXIT_RULE_TEXT = {
  short: {
    vi: `Cắt lỗ −${EXIT_STOP_PCT}%; bán hết khi app chuyển sang "Bán". Không chốt lời cố định.`,
    en: `Stop at −${EXIT_STOP_PCT}%; sell everything when the app turns to "Sell". No fixed profit target.`,
  },
  takeProfit: {
    vi: 'Không đặt chốt lời cố định: giữ tới khi app báo Bán (xu hướng yếu đi hoặc gãy).',
    en: 'No fixed profit target: hold until the app signals Sell (trend weakens or breaks).',
  },
} as const;

/** Giá cắt lỗ theo quy tắc, cùng đơn vị với giá vào */
export const exitStopPrice = (entry: number): number => entry * (1 - EXIT_STOP_PCT / 100);
