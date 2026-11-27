/**
 * Giá phiên gần nhất từ API biểu đồ Entrade (DNSE) — nguồn dự phòng cho bảng giá và chỉ số.
 *
 * Lưu ý của nguồn này: đang trong phiên, nến ngày (1D) CHƯA có phiên hôm nay.
 * Vì vậy phải xét ngày của từng nến: giá hôm nay ghép từ nến phút của riêng hôm nay,
 * giá tham chiếu là giá đóng cửa của nến ngày liền trước phiên đang hiển thị.
 */

export interface OhlcSeries {
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
}

export interface SessionSnapshot {
  price: number;
  referencePrice: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  /** Giá đóng cửa phiên gần nhất trước hôm nay (tham chiếu cho phiên hôm nay) */
  previousClose: number;
  /** Chuỗi giá đóng cửa theo ngày, kết thúc ở phiên đang hiển thị */
  closes: number[];
}

const VN_OFFSET_SEC = 7 * 3600;

const vnDate = (sec: number) => new Date((sec + VN_OFFSET_SEC) * 1000).toISOString().slice(0, 10);

export const startOfVnDay = (sec: number) =>
  Math.floor((sec + VN_OFFSET_SEC) / 86400) * 86400 - VN_OFFSET_SEC;

/**
 * @param inSession true khi đang trong giờ giao dịch: ưu tiên nến phút hơn nến ngày dở dang.
 * Ngoài giờ, nếu đã có nến ngày hôm nay thì dùng nến đó (số chốt phiên).
 */
export function buildSessionSnapshot(
  daily: OhlcSeries,
  minute: OhlcSeries,
  nowSec: number,
  inSession: boolean
): SessionSnapshot | null {
  const today = vnDate(nowSec);
  const days = (daily.t ?? []).map((t, i) => ({
    date: vnDate(t),
    o: daily.o![i],
    h: daily.h![i],
    l: daily.l![i],
    c: daily.c![i],
    v: daily.v?.[i] ?? 0,
  }));
  const past = days.filter((d) => d.date < today);
  const todayDaily = days.find((d) => d.date === today);
  const bars = (minute.t ?? []).map((t, i) => i).filter((i) => vnDate(minute.t![i]) === today);
  const previous = past[past.length - 1];

  if (bars.length > 0 && !(todayDaily && !inSession)) {
    // Thiếu phiên trước thì không có tham chiếu → báo không có dữ liệu
    if (!previous) return null;
    const price = minute.c![bars[bars.length - 1]];
    return {
      price,
      referencePrice: previous.c,
      open: minute.o![bars[0]],
      high: Math.max(...bars.map((i) => minute.h![i])),
      low: Math.min(...bars.map((i) => minute.l![i])),
      volume: bars.reduce((sum, i) => sum + (minute.v?.[i] ?? 0), 0),
      previousClose: previous.c,
      closes: [...past.map((d) => d.c), price],
    };
  }

  // Chưa có giao dịch hôm nay (trước giờ mở cửa, cuối tuần, ngày lễ) hoặc đã có nến chốt phiên
  const shown = todayDaily ? [...past, todayDaily] : past;
  if (shown.length < 2) return null;
  const last = shown[shown.length - 1];
  const prior = shown[shown.length - 2];
  return {
    price: last.c,
    referencePrice: prior.c,
    open: last.o,
    high: last.h,
    low: last.l,
    volume: last.v,
    previousClose: previous.c,
    closes: shown.map((d) => d.c),
  };
}

/** Tải nến ngày + nến phút hôm nay rồi dựng snapshot. Một trong hai lỗi thì trả null. */
export async function fetchEntradeSnapshot(
  symbol: string,
  kind: 'stock' | 'index',
  inSession: boolean
): Promise<SessionSnapshot | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const load = async (from: number, resolution: '1D' | '1'): Promise<OhlcSeries | null> => {
    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/${kind}?from=${from}&to=${nowSec}&resolution=${resolution}&symbol=${encodeURIComponent(symbol)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(3500) }
    );
    return res.ok ? res.json() : null;
  };

  try {
    const [daily, minute] = await Promise.all([
      load(nowSec - 30 * 86400, '1D'),
      load(startOfVnDay(nowSec), '1'),
    ]);
    if (!daily || !minute) return null;
    return buildSessionSnapshot(daily, minute, nowSec, inSession);
  } catch {
    return null;
  }
}
