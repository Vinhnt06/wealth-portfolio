/**
 * Lãi suất liên ngân hàng VND kỳ hạn 1 TUẦN, bình quân tháng — số THỰC TẾ do VIRA
 * (Hội Nghiên cứu thị trường liên ngân hàng Việt Nam) công bố trong bảng dự báo hằng tháng.
 *  - Trang: https://vira.org.vn/tin/Du-bao.html, dòng "Thực tế Tháng MM/YY": CPI, USD/VND, lãi 1W, TPCP 10Y.
 *  - Dùng thay lãi qua đêm vì NHNN chặn truy cập tự động. Số theo tháng nên trễ 3–4 tuần.
 * Đã kiểm tra 22/11/2026: Thực tế Tháng 10/26 → 1W 4,36%, TPCP 10Y 4,46%.
 */

export interface ViraInterbank {
  /** Lãi liên ngân hàng 1 tuần bình quân tháng (%/năm) */
  value: number;
  /** TPCP 10 năm bình quân cùng tháng (%), nếu có */
  bond10Y: number | null;
  /** Tháng của số liệu, dạng "10/2026" */
  period: string;
  source: string;
}

export async function fetchViraInterbank1W(): Promise<ViraInterbank | null> {
  try {
    const res = await fetch('https://vira.org.vn/tin/Du-bao.html', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const text = (await res.text())
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ');
    // "Thực tế Tháng 10/26 5.09 25,895.18 4.36 4.46"
    const m = /Thực tế Tháng (\d{1,2})\/(\d{2})\s+([\d.]+)\s+([\d,.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
    if (!m) return null;
    const value = Number(m[5]);
    const bond = Number(m[6]);
    if (!Number.isFinite(value) || value <= 0 || value > 20) return null;
    const period = `${m[1].padStart(2, '0')}/20${m[2]}`;
    return {
      value,
      bond10Y: Number.isFinite(bond) && bond > 0 && bond < 20 ? bond : null,
      period,
      source: `VIRA, lãi liên NH 1 tuần bình quân tháng ${period}`,
    };
  } catch {
    return null;
  }
}
