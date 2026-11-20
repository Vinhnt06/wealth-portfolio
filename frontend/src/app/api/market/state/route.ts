import { NextResponse } from 'next/server';
import { computeWeeklyStates, Series, WeeklyState, MARKET_STATE_EVIDENCE } from '../../../../features/market/utils/marketState';

/**
 * Trạng thái thị trường (Thuận lợi / Trung tính / Bất lợi) — xem utils/marketState.ts.
 * Dữ liệu: nến ngày Entrade cho VN-Index và 100 mã vốn hoá lớn nhất HOSE (lấy từ bảng giá sống).
 * Cache 1 giờ; nguồn lỗi thì trả bản gần nhất (stale).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';
export const maxDuration = 60;

let cache: { at: number; data: unknown } | null = null;
const TTL_MS = 3600_000;

async function candles(symbol: string, kind: 'stock' | 'index', fromSec: number, toSec: number): Promise<Series | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://services.entrade.com.vn/chart-api/v2/ohlcs/${kind}?from=${fromSec}&to=${toSec}&symbol=${encodeURIComponent(symbol)}&resolution=1D`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) continue;
      const d = await res.json();
      if (!Array.isArray(d?.t) || !Array.isArray(d?.c) || d.t.length === 0) continue;
      return {
        dates: d.t.map((t: number) => new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10)),
        closes: d.c.map(Number),
      };
    } catch {
      // thử lại
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ success: true, cached: true, data: cache.data });
  }
  try {
    const origin = new URL(req.url).origin;
    const heat = await fetch(`${origin}/api/market/heatmap`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json());
    const board: { symbol: string; exchange: string; mktCapT: number }[] = Array.isArray(heat?.data) ? heat.data : [];
    const top100 = board
      .filter((s) => s.exchange === 'HOSE' && s.mktCapT > 0)
      .sort((a, b) => b.mktCapT - a.mktCapT)
      .slice(0, 100)
      .map((s) => s.symbol);
    if (top100.length < 50) throw new Error('Không đủ danh sách mã vốn hoá lớn');

    const toSec = Math.floor(Date.now() / 1000);
    const fromSec = toSec - 800 * 86400; // đủ cho MA200 + trung vị biến động 1 năm
    const vni = await candles('VNINDEX', 'index', fromSec, toSec);
    if (!vni) throw new Error('Không tải được VN-Index');

    const stocks: Series[] = [];
    for (let i = 0; i < top100.length; i += 10) {
      const batch = await Promise.all(top100.slice(i, i + 10).map((s) => candles(s, 'stock', toSec - 220 * 86400, toSec)));
      batch.forEach((b) => b && stocks.push(b));
    }

    const weeks: WeeklyState[] = computeWeeklyStates(vni, stocks);
    if (weeks.length === 0) throw new Error('Chưa đủ dữ liệu để xác định trạng thái');
    const latest = weeks[weeks.length - 1];
    const lastDate = vni.dates[vni.dates.length - 1];
    // Tuần cuối là tuần đang diễn ra nếu phiên cuối chưa phải thứ Sáu
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const sessionOpenToday = lastDate === vnNow.toISOString().slice(0, 10) && vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes() < 15 * 60;
    const provisional = new Date(`${lastDate}T00:00:00Z`).getUTCDay() !== 5 || sessionOpenToday;
    const confirmed = provisional ? weeks[weeks.length - 2] ?? null : latest;

    const data = {
      current: { ...latest, provisional },
      confirmed,
      history: weeks.slice(-12),
      evidence: MARKET_STATE_EVIDENCE,
      universe: { stocks: stocks.length, source: 'Entrade (nến ngày), 100 mã vốn hoá lớn nhất HOSE' },
      computedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return NextResponse.json({ success: true, cached: false, data });
  } catch (err) {
    if (cache) return NextResponse.json({ success: true, stale: true, data: cache.data });
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 });
  }
}
