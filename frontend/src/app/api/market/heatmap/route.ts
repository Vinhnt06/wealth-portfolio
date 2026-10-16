import { NextResponse } from 'next/server';
import stockDatabase from '../../../../features/market/data/stockDatabase.json';
import { SECTOR_MAPPING } from '../../../../features/market/data/sectorMapping';
import lastMinerviniScanData from '../../../../features/market/data/lastMinerviniScan.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const preferredRegion = 'sin1';

// Không bao giờ để CDN/trình duyệt cache phản hồi giá realtime
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

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

// Danh sách mã gửi lên Vietcap: HOSE + HNX (đúng phạm vi SSI iBoard đang dùng)
const BOARD_SYMBOLS: string[] = (stockDatabase as StockMeta[])
  .filter((s) => s.exchange === 'HOSE' || s.exchange === 'HNX')
  .map((s) => s.symbol.toUpperCase());

// Shares outstanding in millions of shares (dùng khi nguồn không trả về số cổ phiếu)
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

interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  refPrice: number;
  ceiling: number;
  floor: number;
  change: number;
  changePercent: number;
  volume: number;
  totalValue: number;
  high: number;
  low: number;
  mktCapT: number;
  rsRating?: number;
}

type UpstreamSource = 'vietcap' | 'ssi_iboard';
type DataSource = UpstreamSource | 'stale' | 'snapshot';

// In-memory cache TTL: 3 seconds để realtime mà không spam nguồn upstream
let cachedData: { timestamp: number; source: DataSource; data: HeatmapStock[] } | null = null;
const CACHE_TTL_MS = 3000;

// Circuit breaker: nguồn nào lỗi thì nghỉ 60s rồi thử lại (tránh mỗi request đều chờ timeout)
const COOLDOWN_MS = 60_000;
const cooldownUntil: Record<UpstreamSource, number> = { vietcap: 0, ssi_iboard: 0 };
let lastErrorLogAt = 0;

function errText(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'AbortError' ? 'timeout' : err.message;
  }
  return String(err);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Nguồn 1: Vietcap Live (trading.vietcap.com.vn) ─────────────────────────
// Ưu tiên vì chạy ổn định từ datacenter (Vercel) và phản hồi ~0.5s.
const VIETCAP_LIST_URL = 'https://trading.vietcap.com.vn/api/price/symbols/getList';
const VIETCAP_BOARD_MAP: Record<string, string> = { HSX: 'HOSE', HOSE: 'HOSE', HNX: 'HNX', UPCOM: 'UPCOM' };

async function fetchFromVietcap(): Promise<HeatmapStock[] | null> {
  try {
    const res = await fetchWithTimeout(
      VIETCAP_LIST_URL,
      {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/json',
          Origin: 'https://trading.vietcap.com.vn',
          Referer: 'https://trading.vietcap.com.vn/',
        },
        body: JSON.stringify({ symbols: BOARD_SYMBOLS }),
      },
      6000
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('payload rỗng');

    const items: HeatmapStock[] = [];
    for (const raw of list) {
      const li = raw?.listingInfo;
      const mp = raw?.matchPrice || {};
      if (!li || li.isDelisted === 1 || li.stockType === 'WARRANT') continue;

      const symbol = String(li.symbol || mp.symbol || '').toUpperCase();
      if (!symbol) continue;

      const refPrice = Number(li.refPrice || mp.referencePrice || 0);
      const matched = Number(mp.matchPrice || 0);
      const price = matched > 0 ? matched : refPrice;
      if (price <= 0 || refPrice <= 0) continue;

      const change = price - refPrice;
      const changePercent = refPrice > 0 ? Number(((change / refPrice) * 100).toFixed(2)) : 0;
      const volume = Number(mp.accumulatedVolume || 0);
      // accumulatedValue của Vietcap tính theo triệu VND
      const totalValue = Number(mp.accumulatedValue || 0) * 1_000_000;
      const listedShare = Number(li.listedShare || 0);
      const sharesFallbackM = OUTSTANDING_SHARES_M[symbol] || 250;
      const mktCapT =
        listedShare > 0
          ? Math.round(((listedShare * price) / 1e12) * 10) / 10
          : Math.round(((sharesFallbackM * price) / 1e6) * 10) / 10;

      const meta = STOCK_LOOKUP.get(symbol);
      items.push({
        symbol,
        name: meta?.name || li.organShortName || li.organName || symbol,
        sector: SECTOR_MAPPING[symbol] || meta?.sector || 'Khác',
        exchange: VIETCAP_BOARD_MAP[li.board] || meta?.exchange || 'HOSE',
        price,
        refPrice,
        ceiling: Number(li.ceiling || mp.ceilingPrice || Math.round(refPrice * 1.07)),
        floor: Number(li.floor || mp.floorPrice || Math.round(refPrice * 0.93)),
        change,
        changePercent,
        volume,
        totalValue,
        high: Number(mp.highest || price),
        low: Number(mp.lowest || price),
        mktCapT,
      });
    }

    if (items.length === 0) throw new Error('không có dữ liệu hợp lệ');
    cooldownUntil.vietcap = 0;
    return items;
  } catch (err) {
    cooldownUntil.vietcap = Date.now() + COOLDOWN_MS;
    console.error(`[market/heatmap] Vietcap lỗi: ${errText(err)}`);
    return null;
  }
}

// ─── Nguồn 2: SSI iBoard (hoạt động tốt từ IP Việt Nam, chặn IP datacenter) ───
const SSI_EXCHANGES = ['hose', 'hnx'];

async function fetchFromSsi(): Promise<HeatmapStock[] | null> {
  try {
    const responses = await Promise.all(
      SSI_EXCHANGES.map((ex) =>
        fetchWithTimeout(`https://iboard-query.ssi.com.vn/stock/exchange/${ex}`, { headers: BROWSER_HEADERS }, 5000)
      )
    );

    const failed = responses.filter((r) => !r.ok);
    if (failed.length > 0) throw new Error(`HTTP ${failed.map((r) => r.status).join('/')}`);

    const payloads = await Promise.all(responses.map((r) => r.json()));
    const rawList = payloads.flatMap((p) => (Array.isArray(p?.data) ? p.data : []));
    if (rawList.length === 0) throw new Error('payload rỗng');

    const items: HeatmapStock[] = [];
    for (const s of rawList) {
      const symRaw = s?.stockSymbol;
      if (!symRaw || String(symRaw).length !== 3) continue;
      if (!(s.stockType === 's' || !s.coveredWarrantType)) continue;
      if (!((s.matchedPrice > 0) || (s.refPrice > 0))) continue;

      const sym = String(symRaw).toUpperCase();
      const meta = STOCK_LOOKUP.get(sym);
      const refPrice = Number(s.refPrice || 0);
      const price = s.matchedPrice > 0 ? s.matchedPrice : refPrice;
      if (price <= 0) continue;

      const change =
        s.priceChange !== undefined && s.priceChange !== null ? s.priceChange : price - refPrice;
      const changePercent =
        s.priceChangePercent !== undefined && s.priceChangePercent !== null
          ? Number(Number(s.priceChangePercent).toFixed(2))
          : refPrice > 0
          ? Number(((change / refPrice) * 100).toFixed(2))
          : 0;

      const sharesM = OUTSTANDING_SHARES_M[sym] || (price > 0 ? 250 : 0);
      items.push({
        symbol: sym,
        name: meta?.name || s.companyNameVi || s.companyNameEn || sym,
        sector: SECTOR_MAPPING[sym] || meta?.sector || 'Khác',
        exchange: String(s.exchange || '').toLowerCase() === 'hnx' ? 'HNX' : 'HOSE',
        price,
        refPrice,
        ceiling: Number(s.ceiling || Math.round(refPrice * 1.07)),
        floor: Number(s.floor || Math.round(refPrice * 0.93)),
        change,
        changePercent,
        volume: Number(s.nmTotalTradedQty || s.stockVol || 0),
        totalValue: Number(s.nmTotalTradedValue || 0),
        high: Number(s.highest || price),
        low: Number(s.lowest || price),
        mktCapT: Math.round(((sharesM * price) / 1e6) * 10) / 10,
      });
    }

    if (items.length === 0) throw new Error('không có dữ liệu hợp lệ');
    cooldownUntil.ssi_iboard = 0;
    return items;
  } catch (err) {
    cooldownUntil.ssi_iboard = Date.now() + COOLDOWN_MS;
    console.error(`[market/heatmap] SSI iBoard lỗi: ${errText(err)}`);
    return null;
  }
}

// ─── Ảnh chụp cuối phiên (chỉ dùng khi mọi nguồn realtime đều chết) ───────────
function getSnapshotData(): HeatmapStock[] {
  try {
    const list = (lastMinerviniScanData as any)?.data || [];
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.map((item: any) => {
      const sym = String(item.symbol || '').toUpperCase();
      const price = item.price || 0;
      const changePercent =
        item.changePct !== undefined && item.changePct !== null ? Number(item.changePct) : 0;
      const refPrice = price > 0 ? Math.round(price / (1 + changePercent / 100)) : 0;
      const change = price - refPrice;
      const sharesM = OUTSTANDING_SHARES_M[sym] || (price > 0 ? 250 : 0);
      const meta = STOCK_LOOKUP.get(sym);

      return {
        symbol: sym,
        name: item.name || meta?.name || sym,
        sector: item.sector || SECTOR_MAPPING[sym] || meta?.sector || 'Khác',
        exchange: item.exchange || meta?.exchange || 'HOSE',
        price,
        refPrice,
        ceiling: Math.round(refPrice * 1.07),
        floor: Math.round(refPrice * 0.93),
        change,
        changePercent,
        volume: item.volume || 0,
        totalValue: (item.volume || 0) * price,
        high: price,
        low: price,
        mktCapT:
          Math.round(((sharesM * price) / 1e6) * 10) / 10,
        rsRating: item.rsRating || 50,
      } as HeatmapStock;
    });
  } catch (e) {
    console.error('[market/heatmap] Lỗi tạo ảnh chụp dự phòng:', e);
    return [];
  }
}

function respond(data: HeatmapStock[], source: DataSource, cached: boolean, timestamp: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      success: true,
      timestamp,
      total: data.length,
      source,
      cached,
      stale: source === 'stale' || source === 'snapshot',
      ...extra,
      data,
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function GET() {
  const now = Date.now();

  // Cache 3s trong cùng instance để mọi client dùng chung 1 lần gọi upstream
  if (cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    return respond(cachedData.data, cachedData.source, true, cachedData.timestamp);
  }

  const upstreams: Array<{ source: UpstreamSource; fetch: () => Promise<HeatmapStock[] | null> }> = [
    { source: 'vietcap', fetch: fetchFromVietcap },
    { source: 'ssi_iboard', fetch: fetchFromSsi },
  ];

  for (const upstream of upstreams) {
    if (now < cooldownUntil[upstream.source]) continue;
    const data = await upstream.fetch();
    if (data && data.length > 0) {
      cachedData = { timestamp: now, source: upstream.source, data };
      return respond(data, upstream.source, false, now);
    }
  }

  // Mọi nguồn realtime đều lỗi: trả dữ liệu cũ (vẫn mới hơn ảnh chụp) và thử lại ở request sau
  if (cachedData) {
    if (Date.now() - lastErrorLogAt > 30_000) {
      lastErrorLogAt = Date.now();
      console.error('[market/heatmap] Cả 2 nguồn realtime đều lỗi, trả dữ liệu cache cũ.');
    }
    return respond(cachedData.data, 'stale', true, cachedData.timestamp, {
      retriedAt: now,
    });
  }

  const snapshot = getSnapshotData();
  if (snapshot.length > 0) {
    cachedData = { timestamp: now, source: 'snapshot', data: snapshot };
    console.error('[market/heatmap] Không có nguồn realtime, dùng ảnh chụp cuối phiên.');
    return respond(snapshot, 'snapshot', false, now);
  }

  return NextResponse.json(
    { success: false, message: 'Dữ liệu chưa sẵn sàng' },
    { status: 503, headers: NO_STORE_HEADERS }
  );
}
