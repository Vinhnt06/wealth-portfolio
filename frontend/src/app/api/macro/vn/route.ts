import { NextResponse } from 'next/server';

/**
 * Vĩ mô Việt Nam TỰ ĐỘNG (không nhập tay):
 *  - TradingView (dữ liệu kinh tế theo Trading Economics/GSO/NHNN): GDP YoY, lạm phát CPI YoY,
 *    lãi suất điều hành, lãi suất liên ngân hàng, lợi suất TPCP VN 5 & 10 năm.
 *    `change_abs` = chênh lệch so với kỳ công bố trước (CPI: tháng trước, GDP: quý trước).
 *  - Lãi suất huy động 12 tháng: trung vị các ngân hàng từ /api/macro/bank-rates (24hMoney).
 * Cache 3 giờ; nguồn lỗi thì trả bản gần nhất (stale).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

export interface VnIndicator {
  value: number;
  /** Chênh lệch so với kỳ công bố trước (điểm %) */
  change: number | null;
  /** Thời điểm nguồn cập nhật số này (ISO) */
  updatedAt: string | null;
  source: string;
}

export interface VnMacroLive {
  gdpYoY: VnIndicator | null;
  cpiYoY: VnIndicator | null;
  policyRate: VnIndicator | null;
  interbankRate: VnIndicator | null;
  bond5Y: VnIndicator | null;
  bond10Y: VnIndicator | null;
  deposit12M: (VnIndicator & { banks: number }) | null;
  fetchedAt: string;
}

const TV_SYMBOLS = {
  gdpYoY: 'ECONOMICS:VNGDPYY',
  cpiYoY: 'ECONOMICS:VNIRYY',
  policyRate: 'ECONOMICS:VNINTR',
  interbankRate: 'ECONOMICS:VNINBR',
  bond5Y: 'TVC:VN05Y',
  bond10Y: 'TVC:VN10Y',
} as const;

let cache: { at: number; data: VnMacroLive } | null = null;
const TTL_MS = 3 * 3600_000;

async function fetchTv(symbol: string): Promise<VnIndicator | null> {
  try {
    const res = await fetch(
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbol)}&fields=close,change_abs,last_bar_update_time,update_time`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const value = Number(j?.close);
    if (!Number.isFinite(value)) return null;
    const ts = Number(j?.update_time || j?.last_bar_update_time);
    const change = Number(j?.change_abs);
    return {
      value: Number(value.toFixed(4)),
      change: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
      updatedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null,
      source: `TradingView ${symbol}`,
    };
  } catch {
    return null;
  }
}

async function fetchDeposit12M(origin: string): Promise<VnMacroLive['deposit12M']> {
  try {
    const res = await fetch(`${origin}/api/macro/bank-rates`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const j = await res.json();
    const rows: { rate12M?: string }[] = Array.isArray(j?.data?.counter) ? j.data.counter : [];
    const rates = rows.map((r) => Number(r.rate12M)).filter((v) => Number.isFinite(v) && v > 0 && v < 20);
    if (rates.length < 5) return null;
    rates.sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const median = rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
    return {
      value: Number(median.toFixed(2)),
      change: null,
      updatedAt: j?.data?.updateTime ? String(j.data.updateTime) : null,
      source: '24hMoney (trung vị lãi suất tại quầy 12T)',
      banks: rates.length,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ success: true, cached: true, data: cache.data });
  }
  const origin = new URL(req.url).origin;
  const [gdpYoY, cpiYoY, policyRate, interbankRate, bond5Y, bond10Y, deposit12M] = await Promise.all([
    fetchTv(TV_SYMBOLS.gdpYoY),
    fetchTv(TV_SYMBOLS.cpiYoY),
    fetchTv(TV_SYMBOLS.policyRate),
    fetchTv(TV_SYMBOLS.interbankRate),
    fetchTv(TV_SYMBOLS.bond5Y),
    fetchTv(TV_SYMBOLS.bond10Y),
    fetchDeposit12M(origin),
  ]);
  const data: VnMacroLive = { gdpYoY, cpiYoY, policyRate, interbankRate, bond5Y, bond10Y, deposit12M, fetchedAt: new Date().toISOString() };

  if (!gdpYoY && !cpiYoY && !interbankRate) {
    if (cache) return NextResponse.json({ success: true, stale: true, data: cache.data });
    return NextResponse.json({ success: false, error: 'Không lấy được dữ liệu vĩ mô Việt Nam' }, { status: 502 });
  }
  cache = { at: Date.now(), data };
  return NextResponse.json({ success: true, cached: false, data });
}
