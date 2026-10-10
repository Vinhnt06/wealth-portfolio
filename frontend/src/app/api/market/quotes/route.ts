import { NextResponse } from 'next/server';
import realTicks from '../../../../features/market/data/realTicks.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const syms = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 86400;

    const indexes = await Promise.all(
      syms.map(async (s) => {
        try {
          const res = await fetch(
            `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${from}&to=${now}&resolution=1D&symbol=${s}`,
            {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              next: { revalidate: 15 },
            }
          );
          if (!res.ok) return null;
          const j = await res.json();
          const len = j.c ? j.c.length : 0;
          if (len === 0) return null;
          const last = len - 1;
          const prev = last > 0 ? last - 1 : last;
          const close = j.c[last];
          const ref = j.c[prev];
          const chg = close - ref;
          const pct = ref ? (chg / ref) * 100 : 0;
          return {
            symbol: s,
            name: s === 'VNINDEX' ? 'VN-Index' : s === 'VN30' ? 'VN30-Index' : s === 'HNX' ? 'HNX-Index' : 'UPCOM-Index',
            exchange: s === 'HNX' ? 'HNX' : s === 'UPCOM' ? 'UPCOM' : 'HOSE',
            value: Number(close.toFixed(2)),
            change: Number(chg.toFixed(2)),
            percentChange: Number(pct.toFixed(2)),
            open: j.o[last],
            high: j.h[last],
            low: j.l[last],
            volume: j.v[last] || 0,
            sparkline: j.c.slice(-15),
          };
        } catch {
          return null;
        }
      })
    );

    const validIndexes = indexes.filter(Boolean);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      source: 'dnse_lightspeed',
      indexes: validIndexes,
      data: realTicks,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
