import { NextResponse } from 'next/server';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { SECTOR_MAPPING } from '../../../../features/market/data/sectorMapping';
import lastMinerviniScanData from '../../../../features/market/data/lastMinerviniScan.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'sin1';

interface StockMeta {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
}

const STOCK_LOOKUP = new Map<string, StockMeta>();
(stockDatabase as StockMeta[]).forEach((item) => {
  STOCK_LOOKUP.set(item.symbol.toUpperCase(), item);
});

// Shares outstanding in millions of shares
const OUTSTANDING_SHARES_M: Record<string, number> = {
  // Ngân hàng
  VCB: 5589, BID: 5700, CTG: 5369, TCB: 7067, MBB: 5287, ACB: 4466, VPB: 7933,
  HDB: 2900, STB: 1885, LPB: 2557, SHB: 3662, TPB: 2201, VIB: 2536, MSB: 2600,
  OCB: 2054, SSB: 2490, EIB: 1740, NAB: 1058, BAB: 825, BVB: 501,
  // Chứng khoán
  SSI: 1511, VND: 1522, VCI: 718, HCM: 705, SHS: 813, MBS: 437, FTS: 242,
  BSI: 202, CTS: 148, VIX: 1459, AGR: 215, ORS: 200, TVS: 151, PHS: 210,
  // Bất động sản
  VHM: 4354, VIC: 3880, VRE: 2272, KDH: 800, NLG: 384, PDR: 873, DIG: 609,
  DXG: 720, CEO: 514, NVL: 1950, TCH: 668, HQC: 516, DRH: 124, KHG: 450,
  VPI: 241, HDG: 305, DXS: 474, NTL: 61,
  // BĐS Khu công nghiệp
  KBC: 767, IDC: 330, VGC: 448, SZC: 180, BCM: 1035, TIP: 65, LHG: 50, SIP: 191, D2D: 30, PHR: 135,
  // Thép & Kim loại
  HPG: 8443, HSG: 616, NKG: 263, VGS: 107, SMC: 73, TLH: 102, TVN: 678,
  // Công nghệ
  FPT: 1460, CMG: 150, ELC: 82, CTR: 114, VGI: 3043, FOX: 792, VNZ: 35, ITD: 24,
  // Dầu khí
  GAS: 2296, PLX: 1270, BSR: 3100, PVD: 555, PVS: 478, PVT: 356, PVP: 94, PVC: 50, PVB: 21,
  // Điện & Tiện ích
  POW: 2341, REE: 409, PC1: 310, GEG: 338, GEE: 300, NT2: 287, QTP: 378, VSH: 236, TV2: 67, BCG: 533,
  // Hóa chất & Phân bón
  DGC: 379, DCM: 529, DPM: 391, CSV: 132, GVR: 4000, BFC: 77, LAS: 112, DPR: 43, DRC: 118, DDV: 146,
  // Bán lẻ & Tiêu dùng
  MSN: 1430, MWG: 1463, VNM: 2089, SAB: 1282, PNJ: 338, FRT: 136, DGW: 167, KDC: 289, MCH: 716,
  // Thủy sản & Nông nghiệp
  VHC: 224, ANV: 266, ASM: 335, IDI: 227, PAN: 208, DBC: 242, HAG: 1057, BAF: 239, HNG: 1108,
  // Cảng biển & Logistics
  GMD: 335, HAH: 121, VSC: 266, VTP: 121, PHP: 326, PET: 99, SGP: 216, VJC: 541, HVN: 2214,
  // Xây dựng & Vật liệu
  VCG: 534, HHV: 411, CII: 318, CTD: 103, FCN: 157, LCG: 190, C4G: 337, HT1: 381, BCC: 123, BMP: 81, NTP: 129,
  // Dệt may
  TNG: 113, MSH: 75, GIL: 69, STK: 102, TCM: 101, VGT: 500,
};

// In-memory cache TTL: 3 seconds to ensure real-time responsiveness without spamming SSI
let cachedData: { timestamp: number; data: any[] } | null = null;
const CACHE_TTL_MS = 3000;

function getFallbackHeatmapData(): any[] {
  try {
    const list = (lastMinerviniScanData as any)?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item: any) => {
        const sym = (item.symbol || '').toUpperCase();
        const price = item.price || 0;
        const changePercent = item.changePct !== undefined && item.changePct !== null ? Number(item.changePct) : 0;
        const refPrice = price > 0 ? Math.round(price / (1 + changePercent / 100)) : 0;
        const change = price - refPrice;
        const ceiling = Math.round(refPrice * 1.07);
        const floor = Math.round(refPrice * 0.93);
        const sharesM = OUTSTANDING_SHARES_M[sym] || (price > 0 ? 250 : 0);
        const mktCapT = item.mktCapT || Math.round(((sharesM * price) / 1000000) * 10) / 10;
        return {
          symbol: sym,
          name: item.name || sym,
          sector: item.sector || SECTOR_MAPPING[sym] || 'Khác',
          exchange: item.exchange || 'HOSE',
          price,
          refPrice,
          ceiling,
          floor,
          change,
          changePercent,
          volume: item.volume || 0,
          totalValue: (item.volume || 0) * price,
          high: price,
          low: price,
          mktCapT,
          rsRating: item.rsRating || 50,
        };
      });
    }
  } catch (e) {
    console.error('Error generating fallback heatmap:', e);
  }
  return [];
}

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      timestamp: cachedData.timestamp,
      total: cachedData.data.length,
      data: cachedData.data,
      cached: true,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const [resHose, resHnx] = await Promise.all([
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hose', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch('https://iboard-query.ssi.com.vn/stock/exchange/hnx', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : { data: [] })),
    ]);

    clearTimeout(timeout);

    const rawList = [
      ...((resHose && resHose.data) || []),
      ...((resHnx && resHnx.data) || []),
    ];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      if (cachedData) {
        return NextResponse.json({
          success: true,
          timestamp: cachedData.timestamp,
          total: cachedData.data.length,
          data: cachedData.data,
          cached: true,
        });
      }
      const fallbackList = getFallbackHeatmapData();
      if (fallbackList.length > 0) {
        cachedData = { timestamp: now, data: fallbackList };
        return NextResponse.json({
          success: true,
          timestamp: now,
          total: fallbackList.length,
          data: fallbackList,
          isFallback: true,
        });
      }
      return NextResponse.json({ success: false, message: 'Dữ liệu chưa sẵn sàng' }, { status: 503 });
    }

    const processedStocks = rawList
      .filter((s: any) => {
        const sym = s.stockSymbol;
        return (
          sym &&
          sym.length === 3 &&
          (s.stockType === 's' || !s.coveredWarrantType) &&
          (s.matchedPrice > 0 || s.refPrice > 0)
        );
      })
      .map((s: any) => {
        const sym = s.stockSymbol.toUpperCase();
        const meta = STOCK_LOOKUP.get(sym);
        const name = meta?.name || s.companyNameVi || s.companyNameEn || sym;
        const sector = SECTOR_MAPPING[sym] || meta?.sector || 'Khác';
        const exchange = s.exchange?.toLowerCase() === 'hnx' ? 'HNX' : 'HOSE';

        const price = s.matchedPrice > 0 ? s.matchedPrice : (s.refPrice || 0);
        const refPrice = s.refPrice || price;
        const change = s.priceChange !== undefined && s.priceChange !== null
          ? s.priceChange
          : (s.matchedPrice > 0 ? s.matchedPrice - refPrice : 0);
        const changePercent = s.priceChangePercent !== undefined && s.priceChangePercent !== null
          ? Number(s.priceChangePercent.toFixed(2))
          : (refPrice > 0 ? Number(((change / refPrice) * 100).toFixed(2)) : 0);

        const volume = s.nmTotalTradedQty || s.stockVol || 0;
        const totalValue = s.nmTotalTradedValue || 0;
        const high = s.highest || price;
        const low = s.lowest || price;
        const ceiling = s.ceiling || Math.round(refPrice * 1.07);
        const floor = s.floor || Math.round(refPrice * 0.93);

        const sharesM = OUTSTANDING_SHARES_M[sym] || (price > 0 ? 250 : 0);
        const mktCapT = Math.round(((sharesM * price) / 1000000) * 10) / 10;

        return {
          symbol: sym,
          name,
          sector,
          exchange,
          price,
          refPrice,
          ceiling,
          floor,
          change,
          changePercent,
          volume,
          totalValue,
          high,
          low,
          mktCapT,
        };
      });

    cachedData = {
      timestamp: now,
      data: processedStocks,
    };

    return NextResponse.json({
      success: true,
      timestamp: now,
      total: processedStocks.length,
      data: processedStocks,
    });
  } catch (err: any) {
    if (cachedData) {
      return NextResponse.json({
        success: true,
        timestamp: cachedData.timestamp,
        total: cachedData.data.length,
        data: cachedData.data,
        cached: true,
      });
    }
    const fallbackList = getFallbackHeatmapData();
    if (fallbackList.length > 0) {
      cachedData = { timestamp: now, data: fallbackList };
      return NextResponse.json({
        success: true,
        timestamp: now,
        total: fallbackList.length,
        data: fallbackList,
        isFallback: true,
      });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
