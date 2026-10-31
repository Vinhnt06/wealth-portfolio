import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECTORS_LIST = {
  banks: new Set(['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB', 'ABB', 'BAB', 'BVB']),
  cks: new Set(['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS', 'TVS', 'PHS']),
  bds: new Set(['VHM', 'NVL', 'PDR', 'DIG', 'DXG', 'CEO', 'KDH', 'NLG', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'SIP', 'HDG', 'NTL']),
  theps: new Set(['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'SMC', 'TVN']),
  vins: new Set(['VIC', 'VHM', 'VRE']),
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
  // Optional security verification if CRON_SECRET is set
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

    const [hoseRes, hnxRes] = await Promise.all([
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hose', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      }),
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hnx', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    if (!hoseRes.ok && !hnxRes.ok) {
      throw new Error(`SSI iBoard returned error HOSE:${hoseRes.status} HNX:${hnxRes.status}`);
    }

    const hose = hoseRes.ok ? await hoseRes.json() : { data: [] };
    const hnx = hnxRes.ok ? await hnxRes.json() : { data: [] };

    let totalMarketVal = 0;
    let bankVal = 0, bankBuy = 0, bankSell = 0;
    let ckVal = 0, ckBuy = 0, ckSell = 0;
    let bdsVal = 0, bdsBuy = 0, bdsSell = 0;
    let thepVal = 0, thepBuy = 0, thepSell = 0;
    let vinVal = 0, vinBuy = 0, vinSell = 0;

    let tradeDateRaw = '';
    const allStocks = [...(hose.data || []), ...(hnx.data || [])];
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

    if (totalMarketVal <= 0) {
      return NextResponse.json({ success: false, message: 'Market volume is 0' });
    }

    // Format tradeDate
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

    const sessionData = {
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
      updatedAt: vnTime,
      sessionLabel,
    };

    // Load and update history file
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

    // Keep up to 60 trading sessions
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
