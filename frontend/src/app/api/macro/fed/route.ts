import { NextResponse } from 'next/server';

/**
 * Lãi suất Fed (biến số thế giới tác động trực tiếp tới tỷ giá & dòng vốn vào Việt Nam).
 *  - Nguồn chính thức: NY Fed Markets API — EFFR (lãi suất Fed funds hiệu dụng) và khung mục tiêu của FOMC.
 *  - Kỳ vọng thị trường: hợp đồng tương lai Fed funds 30 ngày (ZQ=F, Yahoo): lãi suất ngụ ý = 100 − giá.
 * Cache 6 giờ; nguồn lỗi thì trả bản gần nhất (stale) thay vì báo lỗi.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NyFedRate {
  effectiveDate: string;
  percentRate: number;
  targetRateFrom: number;
  targetRateTo: number;
}

export interface FedRateData {
  effr: number;
  effrDate: string;
  targetLow: number;
  targetHigh: number;
  /** Cận trên khung mục tiêu ~6 tháng trước */
  targetHigh6mAgo: number | null;
  /** Thay đổi cận trên trong ~6 tháng (điểm %) */
  change6m: number | null;
  /** Các lần FOMC đổi khung mục tiêu trong ~6 tháng */
  moves: { date: string; from: number; to: number }[];
  /** Lãi suất ngụ ý từ hợp đồng tương lai Fed funds kỳ gần (100 − giá) */
  futuresImplied: number | null;
  source: string;
}

let cache: { at: number; data: FedRateData } | null = null;
const TTL_MS = 6 * 3600_000;

async function fetchFed(): Promise<FedRateData> {
  const res = await fetch('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/130.json', {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NY Fed HTTP ${res.status}`);
  const json = await res.json();
  const rates: NyFedRate[] = Array.isArray(json?.refRates) ? json.refRates : [];
  if (rates.length === 0) throw new Error('NY Fed: không có dữ liệu');

  // refRates: mới nhất trước
  const latest = rates[0];
  const oldest = rates[rates.length - 1];
  const moves: FedRateData['moves'] = [];
  for (let i = 0; i < rates.length - 1; i++) {
    if (rates[i].targetRateTo !== rates[i + 1].targetRateTo) {
      moves.push({ date: rates[i].effectiveDate, from: rates[i + 1].targetRateTo, to: rates[i].targetRateTo });
    }
  }

  let futuresImplied: number | null = null;
  try {
    const f = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/ZQ%3DF?interval=1d&range=5d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (f.ok) {
      const price = Number((await f.json())?.chart?.result?.[0]?.meta?.regularMarketPrice);
      if (Number.isFinite(price) && price > 80 && price <= 100) futuresImplied = Number((100 - price).toFixed(3));
    }
  } catch {
    // không có kỳ vọng thị trường thì vẫn dùng số chính thức
  }

  return {
    effr: latest.percentRate,
    effrDate: latest.effectiveDate,
    targetLow: latest.targetRateFrom,
    targetHigh: latest.targetRateTo,
    targetHigh6mAgo: oldest?.targetRateTo ?? null,
    change6m: oldest ? Number((latest.targetRateTo - oldest.targetRateTo).toFixed(2)) : null,
    moves,
    futuresImplied,
    source: 'NY Fed (EFFR, khung mục tiêu FOMC) · Fed funds futures ZQ=F',
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ success: true, cached: true, data: cache.data });
  }
  try {
    const data = await fetchFed();
    cache = { at: Date.now(), data };
    return NextResponse.json({ success: true, cached: false, data });
  } catch (err) {
    if (cache) return NextResponse.json({ success: true, stale: true, data: cache.data });
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 });
  }
}
