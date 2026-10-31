const fs = require('fs');
const path = require('path');

const SECTORS = {
  NH: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB'],
  CK: ['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS'],
  BDS: ['VHM', 'NVL', 'PDR', 'DIG', 'DXG', 'CEO', 'KDH', 'NLG', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'HDG', 'NTL'],
  THEP: ['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'SMC'],
  VIN: ['VIC', 'VHM', 'VRE'],
};

async function fetchCandles(symbol, isIndex = false, fromSec, nowSec) {
  const type = isIndex ? 'index' : 'stock';
  const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/${type}?from=${fromSec}&to=${nowSec}&symbol=${encodeURIComponent(symbol)}&resolution=1D`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !d.t || !Array.isArray(d.t)) return null;
    return d;
  } catch (e) {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Fetching historical daily sessions from Entrade...');
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - 60 * 86400; // last 60 calendar days (~40 sessions)

  // 1. Fetch VNINDEX
  const vnData = await fetchCandles('VNINDEX', true, fromSec, nowSec);
  if (!vnData || !vnData.t) {
    console.error('Failed to fetch VNINDEX');
    process.exit(1);
  }

  const sessionTimestamps = vnData.t;
  const sessionsCount = sessionTimestamps.length;
  console.log(`Found ${sessionsCount} trading sessions.`);

  // 2. Fetch all sector tickers
  const allSymbols = new Set();
  for (const list of Object.values(SECTORS)) {
    list.forEach(s => allSymbols.add(s));
  }

  const symbolList = Array.from(allSymbols);
  console.log(`Fetching candles for ${symbolList.length} sector tickers...`);

  const candleMap = {};
  for (let i = 0; i < symbolList.length; i += 10) {
    const batch = symbolList.slice(i, i + 10);
    const results = await Promise.all(batch.map(sym => fetchCandles(sym, false, fromSec, nowSec)));
    batch.forEach((sym, idx) => {
      if (results[idx]) candleMap[sym] = results[idx];
    });
    await sleep(200);
  }

  // 3. Aggregate each session
  const history = [];

  for (let sIdx = 0; sIdx < sessionsCount; sIdx++) {
    const timestamp = sessionTimestamps[sIdx];
    const dateObj = new Date(timestamp * 1000);
    const dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
    const displayDate = dateStr.slice(2); // YY-MM-DD

    // Sector values for this session
    const sectorStats = {
      NH: { total: 0, buy: 0, sell: 0 },
      CK: { total: 0, buy: 0, sell: 0 },
      BDS: { total: 0, buy: 0, sell: 0 },
      THEP: { total: 0, buy: 0, sell: 0 },
      VIN: { total: 0, buy: 0, sell: 0 },
    };

    for (const [secKey, syms] of Object.entries(SECTORS)) {
      for (const sym of syms) {
        const cData = candleMap[sym];
        if (!cData) continue;
        const matchIdx = cData.t.indexOf(timestamp);
        if (matchIdx !== -1) {
          const closeP = cData.c[matchIdx];
          const openP = cData.o[matchIdx];
          const vol = cData.v[matchIdx] || 0;
          const valBillion = (closeP * vol) / 1e6; // in Billion VND

          sectorStats[secKey].total += valBillion;

          // Estimate buy/sell distribution based on candle body & wick momentum
          const delta = closeP - openP;
          let buyRatio = 0.5;
          if (delta > 0) {
            buyRatio = 0.55 + Math.min(0.25, (delta / openP) * 5);
          } else if (delta < 0) {
            buyRatio = 0.45 - Math.min(0.25, (Math.abs(delta) / openP) * 5);
          }
          buyRatio = Math.max(0.3, Math.min(0.7, buyRatio));

          sectorStats[secKey].buy += valBillion * buyRatio;
          sectorStats[secKey].sell += valBillion * (1 - buyRatio);
        }
      }
    }

    // Estimate total market turnover from VNINDEX volume * avg price + HNX
    const vnClose = vnData.c[sIdx];
    const vnVol = vnData.v[sIdx];
    // VNIndex point to market value factor: typically HOSE turnover is ~ 18-25 VND/share average on VNIndex
    // Sum of core pillar sectors typically represents ~60-70% of total market
    const pillarSum = sectorStats.NH.total + sectorStats.CK.total + sectorStats.BDS.total + sectorStats.THEP.total;
    // Real market turnover in Vietnam is approx pillarSum / 0.65
    const totalMarket = Math.round(pillarSum / 0.65);

    const round2 = v => Number(v.toFixed(2));

    const nhRatio = round2((sectorStats.NH.total / totalMarket) * 100);
    const ckRatio = round2((sectorStats.CK.total / totalMarket) * 100);
    const bdsRatio = round2((sectorStats.BDS.total / totalMarket) * 100);
    const thepRatio = round2((sectorStats.THEP.total / totalMarket) * 100);
    const vinRatio = round2((sectorStats.VIN.total / totalMarket) * 100);

    history.push({
      date: dateStr,
      displayDate,
      totalMarket: round2(totalMarket),
      nh: {
        total: round2(sectorStats.NH.total),
        buy: round2(sectorStats.NH.buy),
        sell: round2(sectorStats.NH.sell),
        ratioPct: nhRatio,
        isClimax: nhRatio >= 30,
        isTrough: nhRatio <= 16,
      },
      ck: {
        total: round2(sectorStats.CK.total),
        buy: round2(sectorStats.CK.buy),
        sell: round2(sectorStats.CK.sell),
        ratioPct: ckRatio,
        isClimax: ckRatio >= 20,
        isTrough: ckRatio <= 8,
      },
      bds: {
        total: round2(sectorStats.BDS.total),
        buy: round2(sectorStats.BDS.buy),
        sell: round2(sectorStats.BDS.sell),
        ratioPct: bdsRatio,
        isClimax: bdsRatio >= 20,
        isTrough: bdsRatio <= 8,
      },
      thep: {
        total: round2(sectorStats.THEP.total),
        buy: round2(sectorStats.THEP.buy),
        sell: round2(sectorStats.THEP.sell),
        ratioPct: thepRatio,
        isClimax: thepRatio >= 9,
        isTrough: thepRatio <= 4,
      },
      vin: {
        total: round2(sectorStats.VIN.total),
        buy: round2(sectorStats.VIN.buy),
        sell: round2(sectorStats.VIN.sell),
        ratioPct: vinRatio,
        isClimax: vinRatio >= 15,
        isTrough: vinRatio <= 5,
      },
    });
  }

  // Sort descending by date (most recent session first, like in the image)
  history.sort((a, b) => b.date.localeCompare(a.date));

  const outDir = path.join(__dirname, '../frontend/src/features/market/data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'sector_flow_history.json');
  fs.writeFileSync(outFile, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`Successfully generated ${history.length} sessions at ${outFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
