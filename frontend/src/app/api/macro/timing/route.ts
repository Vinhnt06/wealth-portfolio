import { NextResponse } from 'next/server';
import bondDb from '../../../../features/market/data/bondYield10Y.json';
import {
  carryCostPct,
  mergeYield,
  timingVerdict,
  TYPICAL_HOLD_SESSIONS,
  valuationVsCapital,
  yieldTrend,
  YieldPoint,
} from '../../../../features/market/utils/buyTiming';

/**
 * "Khi nào được mua mới" — xem utils/buyTiming.ts.
 *  - Thị trường: /api/market/state (cùng cổng với bộ lọc).
 *  - Chi phí vốn: lịch sử TPCP 10N đã lưu + số sống hôm nay (/api/macro/vn).
 *  - Định giá: P/E VN-Index theo ngày (VNDirect). Lãi gửi 12T: /api/macro/vn.
 * Nguồn nào lỗi thì phần đó là null, không thay bằng số giả.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';
export const maxDuration = 60;

let peCache: { at: number; data: YieldPoint[] } | null = null;
const PE_TTL_MS = 6 * 3600_000;

async function fetchPeHistory(): Promise<YieldPoint[]> {
  if (peCache && Date.now() - peCache.at < PE_TTL_MS) return peCache.data;
  try {
    const res = await fetch(
      'https://api-finfo.vndirect.com.vn/v4/ratios?q=ratioCode:PRICE_TO_EARNINGS~code:VNINDEX~reportDate:gte:2017-01-01&sort=reportDate:asc&size=5000',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const data: YieldPoint[] = (j?.data ?? [])
      .map((x: { reportDate: string; value: number }) => [x.reportDate, Number(x.value)] as YieldPoint)
      .filter((p: YieldPoint) => p[1] > 0);
    if (!data.length) throw new Error('empty');
    peCache = { at: Date.now(), data };
    return data;
  } catch {
    return peCache?.data ?? [];
  }
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const get = (path: string) =>
    fetch(`${origin}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(55_000) })
      .then((r) => r.json())
      .catch(() => null);

  const [state, vn, peHistory] = await Promise.all([get('/api/market/state'), get('/api/macro/vn'), fetchPeHistory()]);

  const cur = state?.success ? state.data?.current : null;
  const market = cur
    ? {
        open: cur.state !== 'UNFAVORABLE',
        state: cur.state as string,
        date: cur.date as string,
        provisional: Boolean(cur.provisional),
        close: Number(cur.vniClose),
        ma200: Number(cur.ma200),
        vol20: Number(cur.vol20),
        vol20Median: Number(cur.vol20Median),
      }
    : null;

  const b = vn?.data?.bond10Y;
  const live: YieldPoint | null =
    b && Number.isFinite(b.value) && b.updatedAt
      ? [new Date(Date.parse(b.updatedAt) + 7 * 3600_000).toISOString().slice(0, 10), Number(b.value)]
      : null;
  const bonds = mergeYield(bondDb.points as YieldPoint[], live);
  const capital = yieldTrend(bonds);

  const deposit: number | null = Number.isFinite(vn?.data?.deposit12M?.value) ? Number(vn.data.deposit12M.value) : null;
  const valuation = valuationVsCapital({ peHistory, bonds, deposit });

  return NextResponse.json({
    success: true,
    data: {
      verdict: timingVerdict(market ? market.open : null, capital ? capital.trend !== 'RISING' : null),
      market,
      capital,
      valuation,
      carry: deposit === null ? null : { depositRate: deposit, sessions: TYPICAL_HOLD_SESSIONS, pct: carryCostPct(deposit) },
    },
  });
}
