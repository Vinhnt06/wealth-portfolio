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
 * Hạn chế: rổ mã là danh sách hiện nay (thiên lệch sống sót); 12/2023–11/2026 chỉ ngang VN-Index (+19,2% so với
 * +15,2%/năm với 10 mã, nhưng +7,9% với 20 mã); chưa tính không khớp lệnh ở giá trần/sàn.
 */
import type { HolderAction } from './decisionEngine';

export const EXIT_STOP_PCT = 7;

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
