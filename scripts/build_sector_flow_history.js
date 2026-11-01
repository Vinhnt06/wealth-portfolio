const fs = require('fs');
const path = require('path');

const SECTORS = {
  bds: ['VHM', 'NVL', 'PDR', 'DIG', 'DXG', 'CEO', 'KDH', 'NLG', 'TCH', 'KBC', 'IDC', 'SZC', 'BCM', 'HDG', 'NTL'],
  nh: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'SSB', 'EIB', 'NAB'],
  ck: ['SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX', 'AGR', 'ORS'],
  thep: ['HPG', 'HSG', 'NKG', 'VGS', 'TLH', 'SMC'],
  thuc_pham: ['VNM', 'MSN', 'SAB', 'DBC', 'HAG', 'BAF', 'VHC', 'ANV', 'PAN'],
  cong_nghiep: ['VCG', 'HHV', 'CII', 'CTD', 'FCN', 'LCG', 'GEX', 'GMD', 'HAH'],
  ban_le: ['MWG', 'FRT', 'DGW', 'PET', 'PNJ'],
  dau_khi: ['GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT'],
  cntt: ['FPT', 'CMG', 'ELC', 'CTR'],
  hoa_chat: ['DGC', 'DCM', 'DPM', 'GVR', 'CSV', 'LAS', 'BFC'],
  vin: ['VIC', 'VHM', 'VRE'],
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
  const fromSec = nowSec - 60 * 86400; // last 60 calendar days (~42 sessions)

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
  for (let i = 0; i < symbolList.length; i += 12) {
    const batch = symbolList.slice(i, i + 12);
    const results = await Promise.all(batch.map(sym => fetchCandles(sym, false, fromSec, nowSec)));
    batch.forEach((sym, idx) => {
      if (results[idx]) candleMap[sym] = results[idx];
    });
    await sleep(150);
  }

  // 3. Aggregate each session
  const history = [];

  for (let sIdx = 0; sIdx < sessionsCount; sIdx++) {
    const timestamp = sessionTimestamps[sIdx];
    const dateObj = new Date(timestamp * 1000);
    const dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
    const displayDate = dateStr.slice(2); // YY-MM-DD

    // Sector values for this session
    const sectorStats = {};
    for (const secKey of Object.keys(SECTORS)) {
      sectorStats[secKey] = { total: 0, buy: 0, sell: 0 };
    }

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

    // Estimate total market turnover from pillar sum across all sectors
    // All 11 sectors represent ~85-90% of total market
    let allSectorsSum = 0;
    for (const [secKey, stats] of Object.entries(sectorStats)) {
      if (secKey !== 'vin') allSectorsSum += stats.total; // Vin is subset of BDS
    }
    const totalMarket = Math.round(allSectorsSum / 0.88);

    const round2 = v => Number(v.toFixed(2));

    const sessionObj = {
      date: dateStr,
      displayDate,
      totalMarket: round2(totalMarket),
    };

    for (const [secKey, stats] of Object.entries(sectorStats)) {
      const ratio = round2((stats.total / (totalMarket || 1)) * 100);
      sessionObj[secKey] = {
        total: round2(stats.total),
        buy: round2(stats.buy),
        sell: round2(stats.sell),
        ratioPct: ratio,
        isClimax: (secKey === 'nh' && ratio >= 30) || (secKey === 'ck' && ratio >= 20) || (secKey === 'bds' && ratio >= 22) || (secKey === 'thep' && ratio >= 9) || (secKey === 'vin' && ratio >= 15),
        isTrough: (secKey === 'nh' && ratio <= 16) || (secKey === 'ck' && ratio <= 8) || (secKey === 'bds' && ratio <= 8) || (secKey === 'thep' && ratio <= 4),
      };
    }

    history.push(sessionObj);
  }

  // Sort descending by date (most recent session first)
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
