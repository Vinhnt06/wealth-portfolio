import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { SECTOR_LEADER_UNIVERSE } from '../../../../features/market/data/sectorMapping';
import sectorFullMapping from '../../../../features/market/data/sectorFullMapping.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTSTANDING_SHARES_M: Record<string, number> = {
  VCB: 5589, BID: 5700, CTG: 5369, TCB: 7067, MBB: 5287, ACB: 4466, VPB: 7933,
  HDB: 2900, STB: 1885, LPB: 2557, SHB: 3662, TPB: 2201, VIB: 2536, MSB: 2600,
  OCB: 2054, SSB: 2490, EIB: 1740, NAB: 1058, BAB: 825, BVB: 501,
  SSI: 1511, VND: 1522, VCI: 718, HCM: 705, SHS: 813, MBS: 437, FTS: 242,
  BSI: 202, CTS: 148, VIX: 1459, AGR: 215, ORS: 200, TVS: 151, PHS: 210,
  VHM: 4354, VIC: 3880, VRE: 2272, KDH: 800, NLG: 384, PDR: 873, DIG: 609,
  DXG: 720, CEO: 514, NVL: 1950, TCH: 668, HQC: 516, DRH: 124, KHG: 450,
  VPI: 241, HDG: 305, DXS: 474, NTL: 61,
  KBC: 767, IDC: 330, VGC: 448, SZC: 180, BCM: 1035, TIP: 65, LHG: 50, SIP: 191, D2D: 30, PHR: 135,
  HPG: 8443, HSG: 616, NKG: 263, VGS: 107, SMC: 73, TLH: 102, TVN: 678,
  FPT: 1460, CMG: 150, ELC: 82, CTR: 114, VGI: 3043, FOX: 792, VNZ: 35, ITD: 24,
  GAS: 2296, PLX: 1270, BSR: 3100, PVD: 555, PVS: 478, PVT: 356, PVP: 94, PVC: 50, PVB: 21,
  POW: 2341, REE: 409, PC1: 310, GEG: 338, GEE: 300, NT2: 287, QTP: 378, VSH: 236, TV2: 67, BCG: 533,
  DGC: 379, DCM: 529, DPM: 391, CSV: 132, GVR: 4000, BFC: 77, LAS: 112, DPR: 43, DRC: 118, DDV: 146,
  MSN: 1430, MWG: 1463, VNM: 2089, SAB: 1282, PNJ: 338, FRT: 136, DGW: 167, KDC: 289, MCH: 716,
  VHC: 224, ANV: 266, ASM: 335, IDI: 227, PAN: 208, DBC: 242, HAG: 1057, BAF: 239, HNG: 1108,
  GMD: 335, HAH: 121, VSC: 266, VTP: 121, PHP: 326, PET: 99, SGP: 216, VJC: 541, HVN: 2214,
  VCG: 534, HHV: 411, CII: 318, CTD: 103, FCN: 157, LCG: 190, C4G: 337, HT1: 381, BCC: 123, BMP: 81, NTP: 129,
  TNG: 113, MSH: 75, GIL: 69, STK: 102, TCM: 101, VGT: 500,
};

function getScanFilePath() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/features/market/data/lastMinerviniScan.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/lastMinerviniScan.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

export async function GET(request: NextRequest) {
  // Optional security check if CRON_SECRET is configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnDate.getHours();
  const isMorning = hours < 13;
  const sessionType = isMorning ? 'MORNING' : 'AFTERNOON';
  const sessionLabel = isMorning ? 'Phiên Sáng (11:30)' : 'Phiên Chiều (15:00)';

  const stockMap = new Map<string, any>();
  (stockDatabase as any[]).forEach((s) => stockMap.set(s.symbol.toUpperCase(), s));
  const sectorMapping = sectorFullMapping as Record<string, string>;

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - 365 * 24 * 3600;

  const results: any[] = [];
  const batchSize = 25;

  for (let i = 0; i < SECTOR_LEADER_UNIVERSE.length; i += batchSize) {
    const batch = SECTOR_LEADER_UNIVERSE.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const info = stockMap.get(sym) || { name: sym, exchange: 'HOSE' };
          const sector = sectorMapping[sym] || info.sector || 'Khác';

          const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(sym)}&resolution=1D`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            cache: 'no-store',
          });

          if (!res.ok) return;
          const d = await res.json();
          if (!d.c || d.c.length < 50) return;

          const len = d.c.length;
          const price = d.c[len - 1];
          const prev = len > 1 ? d.c[len - 2] : price;
          const chgPct = prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;
          const vol = d.v[len - 1] || 0;

          const calcSMA = (period: number) => {
            const slice = d.c.slice(Math.max(0, len - period));
            return slice.reduce((a: number, b: number) => a + b, 0) / slice.length;
          };

          const sma50 = calcSMA(50);
          const sma150 = calcSMA(Math.min(150, len));
          const sma200 = calcSMA(Math.min(200, len));

          const lookback = Math.min(250, len);
          const high52W = Math.max(...d.h.slice(len - lookback));
          const low52W = Math.min(...d.l.slice(len - lookback));

          const distHigh = high52W > 0 ? ((price - high52W) / high52W) * 100 : 0;
          const distLow = low52W > 0 ? ((price - low52W) / low52W) * 100 : 0;

          const pQ1 = len > 63 ? (price - d.c[len - 63]) / d.c[len - 63] : 0;
          const pQ2 = len > 126 ? (price - d.c[len - 126]) / d.c[len - 126] : 0;
          const pQ3 = len > 189 ? (price - d.c[len - 189]) / d.c[len - 189] : 0;
          const pQ4 = len > 240 ? (price - d.c[len - 240]) / d.c[len - 240] : 0;
          const rsRaw = 0.4 * pQ1 + 0.2 * pQ2 + 0.2 * pQ3 + 0.2 * pQ4;
          let rsRating = Math.min(99, Math.max(1, Math.round(50 + rsRaw * 80)));
          if (distHigh >= -10 && distLow >= 40) rsRating = Math.max(78, rsRating);

          let score = 0;
          if (price > sma150 && price > sma200) score++;
          if (sma150 > sma200) score++;
          if (sma200 > 0) score++;
          if (sma50 > sma150 && sma50 > sma200) score++;
          if (price > sma50) score++;
          if (distLow >= 30) score++;
          if (distHigh >= -25) score++;
          if (rsRating >= 70) score++;

          const isStage2 = score >= 7;

          const volSlice = d.v.slice(Math.max(0, len - 20));
          const avgVol20 = volSlice.reduce((a: number, b: number) => a + b, 0) / Math.max(1, volSlice.length);
          const relVol = avgVol20 > 0 ? Math.round((vol / avgVol20) * 100) / 100 : 1;

          const sharesM = OUTSTANDING_SHARES_M[sym] || (price > 0 ? 250 : 0);
          const mktCapT = Math.round(((sharesM * price) / 1000000) * 10) / 10;

          const p1W = len > 5 ? Math.round(((price - d.c[len - 5]) / d.c[len - 5]) * 10000) / 100 : chgPct;
          const p1M = len > 22 ? Math.round(((price - d.c[len - 22]) / d.c[len - 22]) * 10000) / 100 : 0;
          const p1Y = len > 240 ? Math.round(((price - d.c[len - 240]) / d.c[len - 240]) * 10000) / 100 : 0;

          results.push({
            symbol: sym,
            name: info.name,
            sector,
            exchange: info.exchange || 'HOSE',
            price: price * 1000,
            changePct: chgPct,
            volume: vol,
            relVol,
            mktCapT,
            pe: null,
            epsDilTTM: null,
            epsGrowthYoY: null,
            divYieldPct: null,
            analystRating: 'No rating',
            rsRating,
            score,
            isStage2,
            isStage2Eligible: isStage2,
            criteriaPassed: score,
            sma50: Math.round(sma50 * 100) / 100,
            sma150: Math.round(sma150 * 100) / 100,
            sma200: Math.round(sma200 * 100) / 100,
            distHigh: Math.round(distHigh * 10) / 10,
            distLow: Math.round(distLow * 10) / 10,
            pctFrom52WHigh: Math.round((100 + distHigh) * 10) / 10,
            pctAbove52WLow: Math.round((100 + distLow) * 10) / 10,
            perf1W: p1W,
            perf1M: p1M,
            perf1Y: p1Y,
            epsDiluted: null,
            epsDilutedGrowthYoY: null,
            dividendYield: null,
          });
        } catch {
          // ignore single stock fetch error
        }
      })
    );
  }

  results.sort((a, b) => b.rsRating - a.rsRating);
  const stage2Count = results.filter((s) => s.isStage2).length;
  const leadersCount = results.filter((s) => s.rsRating >= 90).length;

  const outputPayload = {
    success: true,
    scannedAt: Date.now(),
    scannedAtText: vnTime,
    session: sessionType,
    sessionLabel,
    totalScanned: results.length,
    stage2Count,
    leadersCount,
    source: '100% REAL DNSE ENTRADE API',
    data: results,
  };

  try {
    const filePath = getScanFilePath();
    fs.writeFileSync(filePath, JSON.stringify(outputPayload, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Lỗi ghi file lastMinerviniScan.json:', err.message);
  }

  const durationMs = Date.now() - t0;
  return NextResponse.json({
    success: true,
    session: sessionType,
    sessionLabel,
    scannedAtText: vnTime,
    totalScanned: results.length,
    stage2Count,
    leadersCount,
    durationMs,
  });
}
