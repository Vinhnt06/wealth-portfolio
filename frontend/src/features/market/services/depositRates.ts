/**
 * Lãi suất huy động 12 tháng (tại quầy, cá nhân) — trung vị các ngân hàng.
 *  - Nguồn chính: CafeF (bảng ~28 ngân hàng, dữ liệu JSON nhúng trong trang).
 *  - Đối chiếu: Vietcombank công bố chính thức kèm thời điểm cập nhật; nếu CafeF lệch số của VCB > 0,3 điểm
 *    thì coi bảng CafeF là cũ và không dùng.
 *  - Dự phòng: 24hMoney (chỉ khi CafeF lỗi), kèm ngày cập nhật của chính trang đó.
 * Đã kiểm tra 20/11/2026: VCB chính thức 5,4% = CafeF 5,4%; 24hMoney 5,5% (trang ngừng cập nhật từ 29/10).
 * scripts/cron_update_macro.js dùng cùng cách tính (bản JS) để ghi lịch sử điều kiện vốn.
 */

export interface Deposit12M {
  value: number;
  banks: number;
  updatedAt: string | null;
  source: string;
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)' };

/** Giờ VN dạng "10:01 20/11/2026" (cùng định dạng ngày với các nguồn khác trên vòng tròn) */
const vnTime = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  const v = new Date(d.getTime() + 7 * 3600_000).toISOString();
  return `${v.slice(11, 16)} ${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Lãi 12T theo ngân hàng từ CafeF */
export async function fetchCafefDeposit12M(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch('https://cafef.vn/du-lieu/lai-suat-ngan-hang.chn', { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const html = await res.text();
    const out: Record<string, number> = {};
    const re = /"name":"([^"]+)","symbol":"([^"]*)","icon":"[^"]*","interestRates":\[(.*?)\]\}/g;
    for (const m of html.matchAll(re)) {
      const v = /"time":"12T","deposit":12,"value":([0-9.]+)/.exec(m[3]);
      const rate = v ? Number(v[1]) : NaN;
      if (Number.isFinite(rate) && rate > 0 && rate < 20) out[m[2] || m[1]] = rate;
    }
    return Object.keys(out).length >= 15 ? out : null;
  } catch {
    return null;
  }
}

/** Lãi 12T chính thức của Vietcombank (cá nhân, VND) và thời điểm cập nhật */
export async function fetchVcbDeposit12M(): Promise<{ value: number; updatedAt: string } | null> {
  try {
    const res = await fetch('https://www.vietcombank.com.vn/vi-VN/api/interestrates?accountType=Personal', {
      headers: { ...UA, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const row = (j?.Data || []).find((r: { tenor?: string; currencyCode?: string }) => r.tenor === '12-months' && r.currencyCode === 'VND');
    const value = row ? Number((row.rates * 100).toFixed(2)) : NaN;
    return Number.isFinite(value) && value > 0 ? { value, updatedAt: String(j.UpdatedDate || '') } : null;
  } catch {
    return null;
  }
}

/** Trung vị lãi 12T: CafeF (đối chiếu VCB), dự phòng 24hMoney qua /api/macro/bank-rates */
export async function fetchDeposit12M(origin?: string): Promise<Deposit12M | null> {
  const [cafef, vcb] = await Promise.all([fetchCafefDeposit12M(), fetchVcbDeposit12M()]);
  if (cafef) {
    const cafefVcb = cafef.VCB;
    const stale = vcb && typeof cafefVcb === 'number' && Math.abs(cafefVcb - vcb.value) > 0.3;
    if (!stale) {
      const rates = Object.values(cafef);
      return {
        value: Number(median(rates).toFixed(2)),
        banks: rates.length,
        updatedAt: vnTime(vcb?.updatedAt),
        source: vcb ? `CafeF, trung vị ${rates.length} ngân hàng (khớp Vietcombank chính thức ${vcb.value}%)` : `CafeF, trung vị ${rates.length} ngân hàng`,
      };
    }
  }
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/api/macro/bank-rates`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const j = await res.json();
    const rows: { rate12M?: string }[] = Array.isArray(j?.data?.counter) ? j.data.counter : [];
    const rates = rows.map((r) => Number(r.rate12M)).filter((v) => Number.isFinite(v) && v > 0 && v < 20);
    if (rates.length < 5) return null;
    return {
      value: Number(median(rates).toFixed(2)),
      banks: rates.length,
      updatedAt: j?.data?.updateTime ? String(j.data.updateTime) : null,
      source: `24hMoney (dự phòng), trung vị ${rates.length} ngân hàng — trang cập nhật lúc ${j?.data?.updateTime ?? '?'}`,
    };
  } catch {
    return null;
  }
}
