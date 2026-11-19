import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface MarketIndexItem {
  symbol: string;
  name: string;
  category: 'equity' | 'yield' | 'volatility' | 'currency' | 'commodity' | 'crypto';
  region?: 'us' | 'asia' | 'europe' | 'global';
  price: number;
  change: number;
  changePercent: number;
  unit?: string;
  note?: string;
}

export interface UsInflationData {
  /** Ngày nguồn cập nhật số mới nhất (dd/mm/yyyy) */
  updatedAt: string | null;
  cpiYoY: number | null;
  /** Chênh lệch CPI so cùng kỳ so với tháng trước (điểm %) */
  cpiChange: number | null;
  coreCpiYoY: number | null;
  /** Mục tiêu lạm phát chính thức của Fed (2%) */
  fedTarget: number;
  source: string;
}

async function fetchTvEconomic(symbol: string): Promise<{ value: number; change: number | null; updatedAt: string | null } | null> {
  try {
    const res = await fetch(
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbol)}&fields=close,change_abs,last_bar_update_time`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const value = Number(j?.close);
    if (!Number.isFinite(value)) return null;
    const change = Number(j?.change_abs);
    const ts = Number(j?.last_bar_update_time);
    return {
      value: Number(value.toFixed(2)),
      change: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
      updatedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : null,
    };
  } catch {
    return null;
  }
}

export interface VietnamImpactItem {
  pillar: string;
  status: 'Tích Cực' | 'Trung Lập' | 'Thận Trọng';
  statusColor: 'emerald' | 'amber' | 'rose';
  headline: string;
  detail: string;
}

export interface USGlobalMacroResponse {
  success: boolean;
  timestamp: string;
  updateTime: string;
  indices: MarketIndexItem[];
  usInflation: UsInflationData;
  vietnamImpact: VietnamImpactItem[];
}

let cachedData: { timestamp: number; payload: USGlobalMacroResponse } | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15s cache

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedData.payload);
  }

  const nowDate = new Date();
  const timeStr = nowDate.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });

  // 1. Fetch 100% Realtime Data from Official Yahoo Finance Chart API
  // All symbols here have official free public live endpoints
  const symbolConfigs = [
    // Mỹ (Wall Street)
    { symbol: '^GSPC', name: 'S&P 500', cat: 'equity' as const, region: 'us' as const, unit: 'pts', note: 'Top 500 CP vốn hóa lớn nhất Mỹ' },
    { symbol: '^IXIC', name: 'Nasdaq Comp', cat: 'equity' as const, region: 'us' as const, unit: 'pts', note: 'Chỉ số nhóm cổ phiếu công nghệ Mỹ' },
    { symbol: '^DJI', name: 'Dow Jones', cat: 'equity' as const, region: 'us' as const, unit: 'pts', note: '30 Bluechip lớn nhất sàn New York' },

    // Châu Á (Asia)
    { symbol: '^N225', name: 'Nikkei 225', cat: 'equity' as const, region: 'asia' as const, unit: 'pts', note: 'Chỉ số chứng khoán Nhật Bản (Tokyo)' },
    { symbol: '^HSI', name: 'Hang Seng', cat: 'equity' as const, region: 'asia' as const, unit: 'pts', note: 'Chỉ số chứng khoán Hồng Kông' },
    { symbol: '000001.SS', name: 'Shanghai Comp', cat: 'equity' as const, region: 'asia' as const, unit: 'pts', note: 'Chỉ số sàn Thượng Hải (Trung Quốc)' },
    { symbol: '^KS11', name: 'KOSPI', cat: 'equity' as const, region: 'asia' as const, unit: 'pts', note: 'Chỉ số chứng khoán Hàn Quốc' },

    // Châu Âu (Europe)
    { symbol: '^FTSE', name: 'FTSE 100', cat: 'equity' as const, region: 'europe' as const, unit: 'pts', note: 'Chỉ số 100 Bluechip sàn London (Anh)' },
    { symbol: '^GDAXI', name: 'DAX 40', cat: 'equity' as const, region: 'europe' as const, unit: 'pts', note: 'Chỉ số 40 cổ phiếu hàng đầu nước Đức' },

    // Hàng Hóa & Năng Lượng (Commodities)
    { symbol: 'GC=F', name: 'Vàng Thế Giới', cat: 'commodity' as const, region: 'global' as const, unit: 'USD/oz', note: 'Giá vàng giao ngay quốc tế' },
    { symbol: 'BZ=F', name: 'Dầu Brent', cat: 'commodity' as const, region: 'global' as const, unit: 'USD/thùng', note: 'Dầu thô tiêu chuẩn toàn cầu' },
    { symbol: 'CL=F', name: 'Dầu WTI', cat: 'commodity' as const, region: 'global' as const, unit: 'USD/thùng', note: 'Dầu thô ngọt nhẹ giao dịch tại NYMEX' },
    { symbol: 'SI=F', name: 'Bạc Thế Giới', cat: 'commodity' as const, region: 'global' as const, unit: 'USD/oz', note: 'Giá kim loại bạc thế giới' },

    // Vĩ Mô & Tiền Tệ
    { symbol: 'DX-Y.NYB', name: 'DXY Index', cat: 'currency' as const, region: 'global' as const, unit: 'pts', note: 'Chỉ số đo lường sức mạnh đồng USD' },
    { symbol: '^TNX', name: 'US 10Y Yield', cat: 'yield' as const, region: 'us' as const, unit: '%', note: 'Lợi suất Trái phiếu Chính phủ Mỹ 10 năm' },
    { symbol: '^VIX', name: 'CBOE VIX', cat: 'volatility' as const, region: 'global' as const, unit: 'pts', note: 'Thước đo mức độ biến động & sợ hãi toàn cầu' },

    // Tiền Kỹ Thuật Số (Crypto)
    { symbol: 'BTC-USD', name: 'Bitcoin (BTC)', cat: 'crypto' as const, region: 'global' as const, unit: 'USD', note: 'Đồng tiền mã hóa vốn hóa lớn nhất' },
    { symbol: 'ETH-USD', name: 'Ethereum (ETH)', cat: 'crypto' as const, region: 'global' as const, unit: 'USD', note: 'Nền tảng smart contract hàng đầu' },
  ];

  const fetchedIndices: MarketIndexItem[] = [];

  await Promise.all(
    symbolConfigs.map(async (cfg) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.symbol)}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
              Accept: 'application/json',
            },
            next: { revalidate: 15 },
          }
        );
        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta) {
            const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
            const change = meta.fulldayChange ?? (price - (meta.chartPreviousClose || price));
            const changePercent = meta.regularMarketChangePercent ?? 0;

            fetchedIndices.push({
              symbol: cfg.symbol,
              name: cfg.name,
              category: cfg.cat,
              region: cfg.region,
              price: Number(price.toFixed(2)),
              change: Number(change.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2)),
              unit: cfg.unit,
              note: cfg.note,
            });
          }
        }
      } catch (err) {
        console.error(`Lỗi fetch ${cfg.symbol} từ Yahoo Finance:`, err);
      }
    })
  );

  // Preserve ordering matching symbolConfigs
  const sortedIndices = symbolConfigs
    .map((cfg) => fetchedIndices.find((i) => i.symbol === cfg.symbol))
    .filter((item): item is MarketIndexItem => Boolean(item));

  // 2. Lạm phát Mỹ — số công bố mới nhất (BLS) qua TradingView; không có số thì để trống, không ghi cứng
  const [usCpi, usCore] = await Promise.all([fetchTvEconomic('ECONOMICS:USIRYY'), fetchTvEconomic('ECONOMICS:USCIR')]);
  const usInflation: UsInflationData = {
    updatedAt: usCpi?.updatedAt ?? null,
    cpiYoY: usCpi?.value ?? null,
    cpiChange: usCpi?.change ?? null,
    coreCpiYoY: usCore?.value ?? null,
    fedTarget: 2.0,
    source: 'BLS qua TradingView (ECONOMICS:USIRYY, USCIR)',
  };

  // 3. Tác động tới Việt Nam — chỉ đánh giá khi có số thật
  const dxyPrice = sortedIndices.find((i) => i.symbol === 'DX-Y.NYB')?.price ?? null;
  const us10yPrice = sortedIndices.find((i) => i.symbol === '^TNX')?.price ?? null;
  const vixPrice = sortedIndices.find((i) => i.symbol === '^VIX')?.price ?? null;
  const noData = (pillar: string): VietnamImpactItem => ({
    pillar,
    status: 'Trung Lập',
    statusColor: 'amber',
    headline: 'Chưa có dữ liệu',
    detail: 'Nguồn dữ liệu quốc tế chưa trả số liệu; không đánh giá khi thiếu số thật.',
  });

  const vietnamImpact: VietnamImpactItem[] = [
    dxyPrice === null
      ? noData('Áp Lực Tỷ Giá USD/VND')
      : (() => {
          const status: VietnamImpactItem['status'] = dxyPrice <= 102.5 ? 'Tích Cực' : dxyPrice <= 104.5 ? 'Trung Lập' : 'Thận Trọng';
          return {
            pillar: 'Áp Lực Tỷ Giá USD/VND',
            status,
            statusColor: status === 'Tích Cực' ? 'emerald' : status === 'Trung Lập' ? 'amber' : 'rose',
            headline: `DXY ở mức ${dxyPrice.toFixed(2)} điểm`,
            detail:
              status === 'Tích Cực'
                ? `USD yếu (DXY ${dxyPrice.toFixed(2)}) giảm áp lực lên tỷ giá USD/VND.`
                : `USD mạnh (DXY ${dxyPrice.toFixed(2)}) gây áp lực lên tỷ giá USD/VND.`,
          };
        })(),
    us10yPrice === null || dxyPrice === null
      ? noData('Không Gian Lãi Suất NHNN')
      : (() => {
          const status: VietnamImpactItem['status'] = dxyPrice <= 103.0 && us10yPrice <= 4.5 ? 'Tích Cực' : us10yPrice <= 5.2 ? 'Trung Lập' : 'Thận Trọng';
          return {
            pillar: 'Không Gian Lãi Suất NHNN',
            status,
            statusColor: status === 'Tích Cực' ? 'emerald' : status === 'Trung Lập' ? 'amber' : 'rose',
            headline: `Lợi suất TPCP Mỹ 10 năm ${us10yPrice.toFixed(2)}%`,
            detail:
              status === 'Tích Cực'
                ? 'Lãi suất USD thấp và USD yếu cho NHNN thêm dư địa giữ lãi suất thấp.'
                : 'Lãi suất USD cao khiến NHNN phải cân đối giữa hỗ trợ tăng trưởng và ổn định tỷ giá.',
          };
        })(),
    vixPrice === null || us10yPrice === null
      ? noData('Dòng Vốn Khối Ngoại (FII)')
      : (() => {
          const status: VietnamImpactItem['status'] = vixPrice < 22 && us10yPrice <= 5.2 ? 'Trung Lập' : 'Thận Trọng';
          return {
            pillar: 'Dòng Vốn Khối Ngoại (FII)',
            status,
            statusColor: status === 'Trung Lập' ? 'amber' : 'rose',
            headline: `VIX ${vixPrice.toFixed(2)} · US10Y ${us10yPrice.toFixed(2)}%`,
            detail: `Khẩu vị rủi ro toàn cầu: ${vixPrice < 22 ? 'ổn định' : 'căng thẳng'} (VIX ${vixPrice.toFixed(2)}); lợi suất USD ${us10yPrice.toFixed(2)}%.`,
          };
        })(),
  ];

  const payload: USGlobalMacroResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    updateTime: timeStr,
    indices: sortedIndices,
    usInflation,
    vietnamImpact,
  };

  cachedData = {
    timestamp: now,
    payload,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
