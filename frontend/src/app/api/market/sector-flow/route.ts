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
  bds: SectorItemData;
  nh: SectorItemData;
  ck: SectorItemData;
  thep: SectorItemData;
  thuc_pham?: SectorItemData;
  cong_nghiep?: SectorItemData;
  ban_le?: SectorItemData;
  dau_khi?: SectorItemData;
  cntt?: SectorItemData;
  hoa_chat?: SectorItemData;
  vin: SectorItemData;
  isLive?: boolean;
}

const SECTORS_LIST = {
  bds: new Set(['VHM', 'NVL', 'PDR', 'DIG', 'DXG', 'CEO', 'KDH', 'NLG', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'HDG', 'NTL']),
  nh: new Set(['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB']),
  ck: new Set(['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS', 'TVS', 'PHS']),
  thep: new Set(['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'SMC', 'TVN']),
  thuc_pham: new Set(['VNM', 'MSN', 'SAB', 'DBC', 'HAG', 'BAF', 'VHC', 'ANV', 'PAN']),
  cong_nghiep: new Set(['VCG', 'HHV', 'CII', 'CTD', 'FCN', 'LCG', 'GEX', 'GMD', 'HAH']),
  ban_le: new Set(['MWG', 'FRT', 'DGW', 'PET', 'PNJ']),
  dau_khi: new Set(['GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT']),
  cntt: new Set(['FPT', 'CMG', 'ELC', 'CTR']),
  hoa_chat: new Set(['DGC', 'DCM', 'DPM', 'GVR', 'CSV', 'LAS', 'BFC']),
  vin: new Set(['VIC', 'VHM', 'VRE']),
};

async function fetchLiveFromVietcap(): Promise<SessionSectorFlow | null> {
  try {
    const symbols = Array.from(
      new Set(Object.values(SECTORS_LIST).flatMap((s) => Array.from(s)))
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://trading.vietcap.com.vn/api/price/symbols/getList', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        Origin: 'https://trading.vietcap.com.vn',
        Referer: 'https://trading.vietcap.com.vn/',
      },
      body: JSON.stringify({ symbols }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    let totalMarketVal = 0;
    const stats: Record<string, { total: number; buy: number; sell: number }> = {};
    for (const k of Object.keys(SECTORS_LIST)) {
      stats[k] = { total: 0, buy: 0, sell: 0 };
    }

    for (const item of list) {
      const sym = item.listingInfo?.symbol;
      if (!sym) continue;

      const refPrice = Number(item.listingInfo?.refPrice || 0);
      const matched = Number(item.matchPrice?.matchPrice || 0);
      const livePrice = matched > 0 ? matched : refPrice;
      const valMillion = Number(item.matchPrice?.accumulatedValue || 0);
      const valVND = valMillion * 1_000_000;

      totalMarketVal += valVND;

      // Estimate buy/sell distribution based on price direction relative to refPrice
      const delta = livePrice - refPrice;
      let buyRatio = 0.5;
      if (delta > 0) {
        buyRatio = 0.55 + Math.min(0.25, (delta / (refPrice || 1)) * 5);
      } else if (delta < 0) {
        buyRatio = 0.45 - Math.min(0.25, (Math.abs(delta) / (refPrice || 1)) * 5);
      }
      buyRatio = Math.max(0.3, Math.min(0.7, buyRatio));

      const symUpper = sym.toUpperCase();
      for (const [secKey, set] of Object.entries(SECTORS_LIST)) {
        if (set.has(symUpper)) {
          stats[secKey].total += valVND;
          stats[secKey].buy += valVND * buyRatio;
          stats[secKey].sell += valVND * (1 - buyRatio);
        }
      }
    }

    if (totalMarketVal <= 0) return null;

    // Scale up totalMarketVal by 1.15 to account for remaining non-pillar stocks
    const fullMarketEstimate = totalMarketVal * 1.15;
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const displayDate = dateStr.slice(2);

    const toB = (v: number) => Number((v / 1e9).toFixed(2));
    const toPct = (secVal: number) => Number(((secVal / (fullMarketEstimate || 1)) * 100).toFixed(2));

    const buildSectorItem = (key: string): SectorItemData => {
      const ratio = toPct(stats[key].total);
      return {
        total: toB(stats[key].total),
        buy: toB(stats[key].buy),
        sell: toB(stats[key].sell),
        ratioPct: ratio,
        isClimax: (key === 'nh' && ratio >= 30) || (key === 'ck' && ratio >= 20) || (key === 'bds' && ratio >= 22) || (key === 'thep' && ratio >= 9) || (key === 'vin' && ratio >= 15),
        isTrough: (key === 'nh' && ratio <= 16) || (key === 'ck' && ratio <= 8) || (key === 'bds' && ratio <= 8) || (key === 'thep' && ratio <= 4),
      };
    };

    return {
      date: dateStr,
      displayDate,
      totalMarket: toB(fullMarketEstimate),
      bds: buildSectorItem('bds'),
      nh: buildSectorItem('nh'),
      ck: buildSectorItem('ck'),
      thep: buildSectorItem('thep'),
      thuc_pham: buildSectorItem('thuc_pham'),
      cong_nghiep: buildSectorItem('cong_nghiep'),
      ban_le: buildSectorItem('ban_le'),
      dau_khi: buildSectorItem('dau_khi'),
      cntt: buildSectorItem('cntt'),
      hoa_chat: buildSectorItem('hoa_chat'),
      vin: buildSectorItem('vin'),
      isLive: true,
    };
  } catch {
    return null;
  }
}

async function fetchLiveSectorFlow(): Promise<SessionSectorFlow | null> {
  const fromVietcap = await fetchLiveFromVietcap();
  if (fromVietcap) return fromVietcap;
  return fetchLiveFromSsi();
}

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
    const stats: Record<string, { total: number; buy: number; sell: number }> = {};
    for (const k of Object.keys(SECTORS_LIST)) {
      stats[k] = { total: 0, buy: 0, sell: 0 };
    }

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
      for (const [secKey, set] of Object.entries(SECTORS_LIST)) {
        if (set.has(sym)) {
          stats[secKey].total += val;
          stats[secKey].buy += buVal;
          stats[secKey].sell += sdVal;
        }
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

    const buildSectorItem = (key: string): SectorItemData => {
      const ratio = toPct(stats[key].total);
      return {
        total: toB(stats[key].total),
        buy: toB(stats[key].buy),
        sell: toB(stats[key].sell),
        ratioPct: ratio,
        isClimax: (key === 'nh' && ratio >= 30) || (key === 'ck' && ratio >= 20) || (key === 'bds' && ratio >= 22) || (key === 'thep' && ratio >= 9) || (key === 'vin' && ratio >= 15),
        isTrough: (key === 'nh' && ratio <= 16) || (key === 'ck' && ratio <= 8) || (key === 'bds' && ratio <= 8) || (key === 'thep' && ratio <= 4),
      };
    };

    return {
      date: dateStr,
      displayDate,
      totalMarket: toB(totalMarketVal),
      bds: buildSectorItem('bds'),
      nh: buildSectorItem('nh'),
      ck: buildSectorItem('ck'),
      thep: buildSectorItem('thep'),
      thuc_pham: buildSectorItem('thuc_pham'),
      cong_nghiep: buildSectorItem('cong_nghiep'),
      ban_le: buildSectorItem('ban_le'),
      dau_khi: buildSectorItem('dau_khi'),
      cntt: buildSectorItem('cntt'),
      hoa_chat: buildSectorItem('hoa_chat'),
      vin: buildSectorItem('vin'),
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

    const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getHours();
    
    // Only attempt live SSI fetch if market is open (9:00 - 15:00) OR if history doesn't have today's session yet
    const shouldFetchLive = (vnHour >= 9 && vnHour < 15) || (history[0]?.date !== todayDateStr && vnHour >= 9);

    if (shouldFetchLive) {
      const liveSession = await fetchLiveSectorFlow();
      if (liveSession) {
        const existingIdx = history.findIndex((h) => h.date === liveSession.date);
        if (existingIdx !== -1) {
          history[existingIdx] = { ...liveSession, isLive: true };
        } else {
          history.unshift(liveSession);
        }
      }
    }

    const sliced = limit > 0 ? history.slice(0, limit) : history;

    // Calculate current market warnings/climax
    const latest = sliced[0];
    const warnings: string[] = [];
    if (latest) {
      if (latest.nh?.isClimax) warnings.push(`Ngân hàng đạt đỉnh dòng tiền (${latest.nh.ratioPct}%) - Cảnh giác rung lắc`);
      if (latest.ck?.isClimax) warnings.push(`Chứng khoán đạt đỉnh dòng tiền (${latest.ck.ratioPct}%) - Quá nhiệt ngắn hạn`);
      if (latest.bds?.isClimax) warnings.push(`Bất động sản hút tiền mạnh (${latest.bds.ratioPct}%)`);
      if (latest.thep?.isClimax) warnings.push(`Thép quá nhiệt (${latest.thep.ratioPct}%)`);
      if (latest.vin?.isClimax) warnings.push(`Họ Vin kéo xả mạnh (${latest.vin.ratioPct}%)`);

      if (latest.nh?.isTrough) warnings.push(`Ngân hàng cạn kiệt thanh khoản (${latest.nh.ratioPct}%) - Vùng trũng tích lũy`);
      if (latest.ck?.isTrough) warnings.push(`Chứng khoán cạn kiệt thanh khoản (${latest.ck.ratioPct}%) - Vùng gom`);
      if (latest.thep?.isTrough) warnings.push(`Thép cạn kiệt thanh khoản (${latest.thep.ratioPct}%) - Vùng gom`);
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
        bds: { climax: 22, trough: 8 },
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
