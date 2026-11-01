import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function getHistoryFilePath() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/features/market/data/sector_flow_history.json'),
    path.resolve(process.cwd(), 'frontend/src/features/market/data/sector_flow_history.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hours = vnDate.getHours();
  const isMorning = hours < 13;
  const sessionLabel = isMorning ? 'Chốt Phiên Sáng (11:30)' : 'Chốt Phiên Chiều (15:00)';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

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

    if (!hoseRes.ok && !hnxRes.ok && !upcomRes.ok) {
      throw new Error(`SSI iBoard returned error HOSE:${hoseRes.status} HNX:${hnxRes.status} UPCOM:${upcomRes.status}`);
    }

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
    if (allStocks.length === 0) {
      return NextResponse.json({ success: false, message: 'No stock data received from SSI' });
    }

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

    if (totalMarketVal <= 0) {
      return NextResponse.json({ success: false, message: 'Market volume is 0' });
    }

    let dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (tradeDateRaw && tradeDateRaw.length === 8) {
      dateStr = `${tradeDateRaw.slice(0, 4)}-${tradeDateRaw.slice(4, 6)}-${tradeDateRaw.slice(6, 8)}`;
    }
    const displayDate = dateStr.slice(2);

    const toB = (v: number) => Number((v / 1e9).toFixed(2));
    const toPct = (secVal: number) => Number(((secVal / (totalMarketVal || 1)) * 100).toFixed(2));

    const buildSectorItem = (key: string) => {
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

    const sessionData: any = {
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
      updatedAt: vnTime,
      sessionLabel,
    };

    const filePath = getHistoryFilePath();
    let history: any[] = [];
    if (fs.existsSync(filePath)) {
      try {
        history = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        history = [];
      }
    }

    const existingIdx = history.findIndex((h) => h.date === dateStr);
    if (existingIdx !== -1) {
      history[existingIdx] = sessionData;
    } else {
      history.unshift(sessionData);
    }

    const trimmed = history.slice(0, 60);
    fs.writeFileSync(filePath, JSON.stringify(trimmed, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật chốt sổ dòng tiền ngành cho phiên ${dateStr} (${sessionLabel})`,
      session: sessionData,
      totalSessionsStored: trimmed.length,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update sector flow cron',
      },
      { status: 500 }
    );
  }
}
