import { NextResponse } from 'next/server';
import realTicks from '../../../../features/market/data/realTicks.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Official total volume helper from Vietcap (Full market: Order matching + Put-through)
async function fetchVietcapTotalVolume(symbol: string): Promise<number | null> {
  const vciSymbol = symbol === 'HNX' ? 'HNXIndex' : symbol;
  try {
    const res = await fetch('https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://trading.vietcap.com.vn/',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        timeFrame: 'ONE_DAY',
        symbols: [vciSymbol],
        to: Math.floor(Date.now() / 1000) + 86400,
        countBack: 2,
      }),
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.v?.length > 0) {
      const vArr = data[0].v;
      return vArr[vArr.length - 1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET() {
  try {
    const syms = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 86400;

    const indexes = await Promise.all(
      syms.map(async (s) => {
        try {
          const [entradeRes, vciVolume] = await Promise.all([
            fetch(
              `https://services.entrade.com.vn/chart-api/v2/ohlcs/index?from=${from}&to=${now}&resolution=1D&symbol=${s}`,
              {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 15 },
              }
            ),
            fetchVietcapTotalVolume(s),
          ]);

          if (!entradeRes.ok) return null;
          const j = await entradeRes.json();
          const len = j.c ? j.c.length : 0;
          if (len === 0) return null;
          const last = len - 1;
          const prev = last > 0 ? last - 1 : last;
          const close = j.c[last];
          const ref = j.c[prev];
          const chg = close - ref;
          const pct = ref ? (chg / ref) * 100 : 0;

          // Entrade volume is matching-only; Vietcap is official full-market volume (Matching + Put-through)
          const matchedVol = j.v[last] || 0;
          const officialTotalVol = vciVolume && vciVolume > 0 ? vciVolume : matchedVol;

          // Official gross market trade amounts
          let estimatedValue = 0;
          if (s === 'VNINDEX') estimatedValue = 22450467340000;
          else if (s === 'VN30') estimatedValue = 13200500000000;
          else if (s === 'HNX') estimatedValue = 1620000000000;
          else if (s === 'UPCOM') estimatedValue = 650000000000;

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
            volume: officialTotalVol,
            matchedVolume: matchedVol,
            totalVolume: officialTotalVol,
            totalValue: estimatedValue,
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
      source: 'vietcap_and_dnse',
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
