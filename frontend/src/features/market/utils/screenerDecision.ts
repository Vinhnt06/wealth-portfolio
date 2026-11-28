/**
 * Trạng thái hiển thị trong Bộ lọc, lấy từ CÙNG quyết định hợp nhất của trang chi tiết mã
 * (api/market/minervini/analysis → utils/decisionEngine.ts). Bộ lọc không tự đặt quy tắc mua riêng,
 * để một mã không bao giờ bị báo "mua" ở chỗ này và "chờ" ở chỗ khác.
 *
 * Quyết định MUA luôn cần đủ 8/8 Trend Template, nên chỉ cần hỏi quyết định cho các mã từ 7/8 trở lên
 * (7/8 để bắt các mã sát ngưỡng). Mã dưới 7/8 là "Chưa đạt chuẩn", không cần gọi thêm.
 */
import type { EntryAction, Trigger } from './decisionEngine';

export type ScreenerStatus =
  | 'BUY' // Có thể mua
  | 'WAIT_MARKET' // Đạt chuẩn nhưng thị trường Bất lợi
  | 'WAIT_PIVOT' // Đạt chuẩn, chờ điểm vào
  | 'NO_CHASE' // Đã chạy xa
  | 'NEAR' // Gần đạt chuẩn
  | 'AVOID' // Không mua
  | 'NOT_YET' // Chưa đạt chuẩn
  | 'CHECKING' // Đang hỏi quyết định
  | 'UNKNOWN'; // Không lấy được quyết định

/** Phần cần thiết của quyết định từ api/market/minervini/analysis */
export interface FetchedDecision {
  headline: string;
  entry: EntryAction;
  size: 'FULL' | 'HALF' | 'NONE';
  /** Pivot (nghìn đồng) nếu đang chờ điểm vào */
  pivotK: number | null;
  /** false = thị trường đang Bất lợi, chưa mở vị thế mới dù mã tới điểm vào */
  marketUp?: boolean | null;
}

export interface ScreenerDecision {
  status: ScreenerStatus;
  label: string;
  detail: string;
  /** Lớn hơn = ưu tiên hiển thị trước */
  priority: number;
}

/** Mã từ ngưỡng này trở lên mới cần hỏi quyết định đầy đủ */
export const DECISION_MIN_CRITERIA = 7;

const fmtVnd = (priceK: number) => Math.round(priceK * 1000).toLocaleString('vi-VN');

/** Rút gọn phản hồi của API phân tích; trả null nếu thiếu dữ liệu quyết định */
export function pickDecision(data: unknown): FetchedDecision | null {
  const d = (data as { decision?: { headline?: string; newBuyer?: { action?: EntryAction; size?: FetchedDecision['size'] }; triggersUp?: Trigger[]; marketUp?: boolean | null } })?.decision;
  if (!d?.headline || !d.newBuyer?.action) return null;
  const pivot = d.triggersUp?.find((t) => t.code === 'BREAK_PIVOT_WITH_VOLUME')?.value;
  return {
    headline: d.headline,
    entry: d.newBuyer.action,
    size: d.newBuyer.size ?? 'NONE',
    pivotK: typeof pivot === 'number' && pivot > 0 ? pivot : null,
    marketUp: d.marketUp ?? null,
  };
}

export function toScreenerDecision(
  criteriaPassed: number,
  fetched: FetchedDecision | 'error' | undefined
): ScreenerDecision {
  const needsDecision = criteriaPassed >= DECISION_MIN_CRITERIA;

  if (!needsDecision || fetched === undefined || fetched === 'error') {
    if (!needsDecision) {
      return { status: 'NOT_YET', label: 'Chưa đạt chuẩn', detail: `${criteriaPassed}/8 tiêu chí`, priority: criteriaPassed };
    }
    return fetched === 'error'
      ? { status: 'UNKNOWN', label: 'Chưa có quyết định', detail: 'Bấm để xem chi tiết', priority: 40 }
      : { status: 'CHECKING', label: 'Đang kiểm tra…', detail: '', priority: 45 };
  }

  switch (fetched.headline) {
    case 'BUY_ALIGNED':
      return {
        status: 'BUY',
        label: 'Có thể mua',
        detail: fetched.size === 'HALF' ? 'Mua nửa tỷ trọng (có dấu hiệu bán ra)' : 'Xu hướng và điểm vào đều đạt',
        priority: 100,
      };
    case 'WAIT_MARKET':
      return { status: 'WAIT_MARKET', label: 'Chờ thị trường', detail: 'Mã đạt chuẩn, thị trường đang Bất lợi', priority: 90 };
    case 'WAIT_PIVOT':
      return {
        status: 'WAIT_PIVOT',
        label: 'Chờ điểm vào',
        detail: !fetched.pivotK
          ? 'Chưa tới điểm vào'
          : fetched.marketUp === false
          ? `Chờ thị trường mở, rồi mua khi vượt ${fmtVnd(fetched.pivotK)} kèm khối lượng lớn`
          : `Mua khi vượt ${fmtVnd(fetched.pivotK)} kèm khối lượng lớn`,
        priority: 80,
      };
    case 'WAIT_NO_CHASE':
      return { status: 'NO_CHASE', label: 'Đã chạy xa', detail: 'Không mua đuổi, chờ nhịp chỉnh', priority: 70 };
    case 'WAIT_STAGE_CONFIRM':
    case 'WAIT_BASE_FORMING':
      return {
        status: 'NEAR',
        label: 'Gần đạt chuẩn',
        detail: fetched.headline === 'WAIT_STAGE_CONFIRM' ? 'Chờ xu hướng xác nhận' : 'Chờ nền giá hình thành',
        priority: 60,
      };
    default:
      return {
        status: 'AVOID',
        label: 'Không mua',
        detail:
          fetched.headline === 'AVOID_MARKDOWN'
            ? 'Đang trong xu hướng giảm'
            : fetched.headline === 'AVOID_DISTRIBUTION'
            ? 'Đang ở vùng đỉnh'
            : 'Có dấu hiệu bán ra mạnh',
        priority: 20,
      };
  }
}
