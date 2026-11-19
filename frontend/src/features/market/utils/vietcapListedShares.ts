/**
 * Số cổ phiếu niêm yết thật (triệu CP) từ bảng giá Vietcap, dùng tính vốn hoá cho bộ lọc Minervini.
 * Lỗi mạng → Map rỗng; nơi gọi tự quay về bảng số CP ghi cứng (OUTSTANDING_SHARES_M).
 * Chỉ dùng phía server (API route / cron).
 */
export async function fetchVietcapListedSharesM(symbols: string[], timeoutMs = 8000): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (symbols.length === 0) return out;
  try {
    const res = await fetch('https://trading.vietcap.com.vn/api/price/symbols/getList', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        Origin: 'https://trading.vietcap.com.vn',
        Referer: 'https://trading.vietcap.com.vn/',
      },
      body: JSON.stringify({ symbols }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return out;
    const list = await res.json();
    if (!Array.isArray(list)) return out;
    for (const it of list) {
      const sym = String(it?.listingInfo?.symbol || '').toUpperCase();
      const listed = Number(it?.listingInfo?.listedShare || 0);
      if (sym && listed > 0) out.set(sym, listed / 1_000_000);
    }
  } catch {
    // giữ Map rỗng
  }
  return out;
}
