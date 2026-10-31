import { NextRequest, NextResponse } from 'next/server';
import sectorFlowHistory from '@/features/market/data/sector_flow_history.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface SectorItemData {
  total: number;
  buy: number;
  sell: number;
  ratioPct: number;
  isClimax: boolean;
  isTrough: boolean;
}

export interface SessionSectorFlow {
  date: string;
  displayDate: string;
  totalMarket: number;
  nh: SectorItemData;
  ck: SectorItemData;
  bds: SectorItemData;
  thep: SectorItemData;
  vin: SectorItemData;
  isLive?: boolean;
}

const SECTORS_LIST = {
  banks: new Set(['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB']),
  cks: new Set(['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS', 'TVS', 'PHS']),
  bds: new Set(['VHM', 'NVL', 'PDR', 'DIG', 'DXG', 'CEO', 'KDH', 'NLG', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'SIP', 'HDG', 'NTL']),
  theps: new Set(['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'SMC', 'TVN']),
  vins: new Set(['VIC', 'VHM', 'VRE']),
};

async function fetchLiveFromSsi(): Promise<SessionSectorFlow | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const [hoseRes, hnxRes, upcomRes] = await Promise.all([
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hose', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      }),
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hnx', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      }),
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/upcom', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    if (!hoseRes.ok && !hnxRes.ok && !upcomRes.ok) return null;

    const hose = hoseRes.ok ? await hoseRes.json() : { data: [] };
    const hnx = hnxRes.ok ? await hnxRes.json() : { data: [] };
    const upcom = upcomRes.ok ? await upcomRes.json() : { data: [] };

    let totalMarketVal = 0;
    let bankVal = 0, bankBuy = 0, bankSell = 0;
    let ckVal = 0, ckBuy = 0, ckSell = 0;
    let bdsVal = 0, bdsBuy = 0, bdsSell = 0;
    let thepVal = 0, thepBuy = 0, thepSell = 0;
    let vinVal = 0, vinBuy = 0, vinSell = 0;

    let tradeDateRaw = '';
    const allStocks = [...(hose.data || []), ...(hnx.data || []), ...(upcom.data || [])];
    if (allStocks.length === 0) return null;

    for (const s of allStocks) {
      if (!tradeDateRaw && s.tradingDate) {
        tradeDateRaw = String(s.tradingDate);
      }
      const val = Number(s.nmTotalTradedValue || 0);
      const avgP = Number(s.avgPrice || s.matchedPrice || s.refPrice || 0);
      const buVol = Number(s.stockBUVol || 0);
      const sdVol = Number(s.stockSDVol || 0);
      const buVal = buVol * avgP;
      const sdVal = sdVol * avgP;

      totalMarketVal += val;

      const sym = s.stockSymbol;
      if (SECTORS_LIST.banks.has(sym)) {
        bankVal += val; bankBuy += buVal; bankSell += sdVal;
      }
      if (SECTORS_LIST.cks.has(sym)) {
        ckVal += val; ckBuy += buVal; ckSell += sdVal;
      }
      if (SECTORS_LIST.bds.has(sym)) {
        bdsVal += val; bdsBuy += buVal; bdsSell += sdVal;
      }
      if (SECTORS_LIST.theps.has(sym)) {
        thepVal += val; thepBuy += buVal; thepSell += sdVal;
      }
      if (SECTORS_LIST.vins.has(sym)) {
        vinVal += val; vinBuy += buVal; vinSell += sdVal;
      }
    }

    if (totalMarketVal <= 0) return null;

    // Format tradeDate (YYYYMMDD -> YYYY-MM-DD)
    let dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (tradeDateRaw && tradeDateRaw.length === 8) {
      dateStr = `${tradeDateRaw.slice(0, 4)}-${tradeDateRaw.slice(4, 6)}-${tradeDateRaw.slice(6, 8)}`;
    }
    const displayDate = dateStr.slice(2);

    const toB = (v: number) => Number((v / 1e9).toFixed(2));
    const toPct = (secVal: number) => Number(((secVal / (totalMarketVal || 1)) * 100).toFixed(2));

    const nhRatio = toPct(bankVal);
    const ckRatio = toPct(ckVal);
    const bdsRatio = toPct(bdsVal);
    const thepRatio = toPct(thepVal);
    const vinRatio = toPct(vinVal);

    return {
      date: dateStr,
      displayDate,
      totalMarket: toB(totalMarketVal),
      nh: {
        total: toB(bankVal),
        buy: toB(bankBuy),
        sell: toB(bankSell),
        ratioPct: nhRatio,
        isClimax: nhRatio >= 30,
        isTrough: nhRatio <= 16,
      },
      ck: {
        total: toB(ckVal),
        buy: toB(ckBuy),
        sell: toB(ckSell),
        ratioPct: ckRatio,
        isClimax: ckRatio >= 20,
        isTrough: ckRatio <= 8,
      },
      bds: {
        total: toB(bdsVal),
        buy: toB(bdsBuy),
        sell: toB(bdsSell),
        ratioPct: bdsRatio,
        isClimax: bdsRatio >= 20,
        isTrough: bdsRatio <= 8,
      },
      thep: {
        total: toB(thepVal),
        buy: toB(thepBuy),
        sell: toB(thepSell),
        ratioPct: thepRatio,
        isClimax: thepRatio >= 9,
        isTrough: thepRatio <= 4,
      },
      vin: {
        total: toB(vinVal),
        buy: toB(vinBuy),
        sell: toB(vinSell),
        ratioPct: vinRatio,
        isClimax: vinRatio >= 15,
        isTrough: vinRatio <= 5,
      },
      isLive: true,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const history: SessionSectorFlow[] = JSON.parse(JSON.stringify(sectorFlowHistory));

    // Try fetching today's live session from SSI iBoard
    const liveSession = await fetchLiveFromSsi();
    if (liveSession) {
      const existingIdx = history.findIndex((h) => h.date === liveSession.date);
      if (existingIdx !== -1) {
        // Update existing entry with live tick data
        history[existingIdx] = { ...liveSession, isLive: true };
      } else {
        // Prepend new live session
        history.unshift(liveSession);
      }
    }

    const sliced = limit > 0 ? history.slice(0, limit) : history;

    // Calculate current market warnings/climax
    const latest = sliced[0];
    const warnings: string[] = [];
    if (latest) {
      if (latest.nh.isClimax) warnings.push(`Ngân hàng đạt đỉnh dòng tiền (${latest.nh.ratioPct}%) - Cảnh giác rung lắc`);
      if (latest.ck.isClimax) warnings.push(`Chứng khoán đạt đỉnh dòng tiền (${latest.ck.ratioPct}%) - Quá nhiệt ngắn hạn`);
      if (latest.bds.isClimax) warnings.push(`Bất động sản quá nhiệt (${latest.bds.ratioPct}%)`);
      if (latest.thep.isClimax) warnings.push(`Thép quá nhiệt (${latest.thep.ratioPct}%)`);
      if (latest.vin.isClimax) warnings.push(`Họ Vin kéo xả mạnh (${latest.vin.ratioPct}%)`);

      if (latest.nh.isTrough) warnings.push(`Ngân hàng cạn kiệt thanh khoản (${latest.nh.ratioPct}%) - Vùng trũng tích lũy`);
      if (latest.ck.isTrough) warnings.push(`Chứng khoán cạn kiệt thanh khoản (${latest.ck.ratioPct}%) - Vùng gom`);
      if (latest.thep.isTrough) warnings.push(`Thép cạn kiệt thanh khoản (${latest.thep.ratioPct}%) - Vùng gom`);
    }

    return NextResponse.json({
      success: true,
      count: sliced.length,
      latestDate: latest?.date,
      warnings,
      data: sliced,
      thresholds: {
        nh: { climax: 30, trough: 16 },
        ck: { climax: 20, trough: 8 },
        bds: { climax: 20, trough: 8 },
        thep: { climax: 9, trough: 4 },
        vin: { climax: 15, trough: 5 },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sector money flow',
        data: [],
      },
      { status: 500 }
    );
  }
}
