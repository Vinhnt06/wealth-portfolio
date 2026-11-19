/**
 * Chống "nhảy giá": nhận diện snapshot cũ / cập nhật sai thứ tự trước khi chúng được hiển thị.
 *
 * Vì sao cần: nguồn giá (Vietcap getList) thỉnh thoảng trả về snapshot của PHIÊN TRƯỚC xen giữa các
 * phản hồi mới (đã đo: HPG ref 21.050 / KL 12,6 triệu thay vì ref 20.450 / KL 8,2 triệu). Mỗi snapshot cũ
 * ghi đè giá hiện tại rồi lượt sau ghi đè lại → giá "nhảy lên nhảy xuống".
 *
 * Snapshot cũ có thể có KL CAO HƠN (phiên trước đã khớp đủ ngày) nên không thể chỉ dựa vào khối lượng.
 * Ba lớp kiểm tra, không lớp nào bắt buộc nguồn phải có mốc thời gian:
 *   1. Thời điểm khớp (eventTime) CŨ HƠN dữ liệu đã có            → 'stale'.
 *   2. Trong cùng phiên, KL tích luỹ tụt xuống (chỉ xét khi dữ liệu đang có còn "tươi", tránh bị kẹt nếu
 *      bản đầu tiên chính là bản cũ)                                → 'stale'.
 *   3. Giá tham chiếu đổi giữa phiên (thực tế cố định cả phiên)    → 'ref_changed': chỉ chấp nhận khi
 *      được xác nhận 2 lần liên tiếp, một lần lẻ là snapshot cũ.
 *
 * Module thuần hàm, dùng chung cho API route (server) và marketStore (client).
 */

export type TickSource = 'mqtt' | 'rest' | 'derived' | 'seed';

const VN_OFFSET_MS = 7 * 3600_000;
const DAY_START_SHIFT_MS = 8.5 * 3600_000; // phiên mới bắt đầu 08:30 giờ VN (khớp isMarketTradingSession)
const DAY_MS = 86_400_000;
/** Luật "KL không giảm" chỉ áp dụng khi bản đang có được xác nhận trong khoảng này */
export const VOLUME_RULE_WINDOW_MS = 30_000;

/** Khoá "phiên giao dịch": ngày bắt đầu lúc 08:30 giờ VN; Thứ 7/Chủ nhật quy về Thứ 6. */
export function tradingDayKey(ms: number): string {
  let t = ms + VN_OFFSET_MS - DAY_START_SHIFT_MS;
  const dow = new Date(t).getUTCDay();
  if (dow === 6) t -= DAY_MS;
  else if (dow === 0) t -= 2 * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export interface GuardSnapshot {
  totalVolume: number;
  /** Giá tham chiếu của phiên (0/undefined = chưa biết) */
  refPrice?: number;
  /** Thời điểm khớp do nguồn cung cấp (ms) — nếu có */
  eventTime?: number;
  /** Lúc mình nhận và chấp nhận snapshot này (ms) */
  seenAt: number;
}

export interface GuardCandidate {
  totalVolume: number;
  refPrice?: number;
  eventTime?: number;
}

export type SnapshotVerdict = 'ok' | 'stale' | 'ref_changed';

export interface JudgeOptions {
  /** false = bỏ qua luật KL (nguồn mới có độ tin cậy cao hơn bản đang có) */
  volumeRule?: boolean;
}

/** Đánh giá `next` so với `prev` đang được chấp nhận. */
export function judgeSnapshot(
  prev: GuardSnapshot | undefined,
  next: GuardCandidate,
  now: number,
  opts: JudgeOptions = {}
): SnapshotVerdict {
  if (!prev) return 'ok';

  // 1. Có thời điểm khớp ở cả hai phía: cũ hơn là cũ.
  if (prev.eventTime !== undefined && next.eventTime !== undefined && next.eventTime < prev.eventTime) {
    return 'stale';
  }

  const sameSession = tradingDayKey(prev.eventTime ?? prev.seenAt) === tradingDayKey(next.eventTime ?? now);

  // 2. Cùng một phiên mà KL tích luỹ tụt xuống → không thể là dữ liệu mới
  //    (khác phiên = sang ngày mới, được phép reset về 0; quá cửa sổ = không dám tin bản đang có).
  if (
    opts.volumeRule !== false &&
    sameSession &&
    now - prev.seenAt < VOLUME_RULE_WINDOW_MS &&
    prev.totalVolume > 0 &&
    next.totalVolume < prev.totalVolume
  ) {
    return 'stale';
  }

  // 3. Giá tham chiếu cố định suốt phiên; đổi giữa phiên = một trong hai bản đang sai.
  if (sameSession && (prev.refPrice ?? 0) > 0 && (next.refPrice ?? 0) > 0 && prev.refPrice !== next.refPrice) {
    return 'ref_changed';
  }

  return 'ok';
}

/** "2026-11-19T04:29:59.953Z" → ms; không hợp lệ → undefined */
export function parseEventTime(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Bộ nhớ "bản tốt gần nhất" theo khoá (mã CP) cho API route: nếu nguồn trả snapshot cũ thì dùng lại bản tốt
 * thay vì chuyển tiếp dữ liệu cũ cho trình duyệt. Giá tham chiếu đổi giữa phiên chỉ được nhận khi thấy
 * cùng giá trị mới ở 2 lần đọc liên tiếp (một lần lẻ = snapshot cũ).
 */
export function createSnapshotMemory<T>() {
  const good = new Map<string, { value: T; snap: GuardSnapshot }>();
  const pendingRef = new Map<string, number>();

  return {
    /** Trả về giá trị nên dùng: bản mới nếu hợp lệ, ngược lại bản tốt gần nhất (nếu chưa có thì dùng bản mới). */
    resolve(key: string, value: T, probe: GuardCandidate, now = Date.now()): { value: T; usedLastGood: boolean } {
      const prev = good.get(key);
      const verdict = judgeSnapshot(prev?.snap, probe, now);

      if (verdict === 'ref_changed') {
        if (pendingRef.get(key) === probe.refPrice) {
          pendingRef.delete(key); // thấy cùng giá tham chiếu mới 2 lần liên tiếp → bản cũ mới là lỗi thời
        } else {
          if (probe.refPrice !== undefined) pendingRef.set(key, probe.refPrice);
          return prev ? { value: prev.value, usedLastGood: true } : { value, usedLastGood: false };
        }
      } else if (verdict === 'stale') {
        return prev ? { value: prev.value, usedLastGood: true } : { value, usedLastGood: false };
      } else {
        pendingRef.delete(key);
      }

      good.set(key, { value, snap: { ...probe, seenAt: now } });
      return { value, usedLastGood: false };
    },
  };
}

/**
 * Chuyển nhãn `source` mà /api/market/quote trả về thành mức tin cậy ở client.
 *  - 'fallback' là giá bịa 25.000 khi mọi nguồn lỗi → KHÔNG được ghi vào store.
 *  - snapshot dựng sẵn chỉ để lấp chỗ trống, không được đè dữ liệu sống.
 */
export function tickSourceFromApi(apiSource?: string): TickSource | null {
  if (apiSource === 'fallback') return null;
  if (apiSource === 'vnstock_snapshot' || apiSource === 'snapshot') return 'seed';
  return 'rest';
}
