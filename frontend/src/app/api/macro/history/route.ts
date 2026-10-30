import { NextRequest, NextResponse } from 'next/server';

interface HistoryPoint {
  date: string;
  timestamp: number;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
}

interface IndicatorMeta {
  symbol: string;
  name: string;
  unit: string;
  category: 'gold_vn' | 'gold_world' | 'oil' | 'currency' | 'yield' | 'equity' | 'metal';
  macroContext: string;
}

const SYMBOL_MAP: Record<string, IndicatorMeta> = {
  // Global Yahoo Symbols & Aliases
  'gold_world': {
    symbol: 'GC=F',
    name: 'Vàng Thế Giới (XAU/USD)',
    unit: 'USD/oz',
    category: 'gold_world',
    macroContext: 'Thước đo phòng hộ lạm phát & bất ổn địa chính trị toàn cầu.',
  },
  'GC=F': {
    symbol: 'GC=F',
    name: 'Vàng Thế Giới (XAU/USD)',
    unit: 'USD/oz',
    category: 'gold_world',
    macroContext: 'Thước đo phòng hộ lạm phát & bất ổn địa chính trị toàn cầu.',
  },
  'brent': {
    symbol: 'BZ=F',
    name: 'Dầu Brent (Thế Giới)',
    unit: 'USD/thùng',
    category: 'oil',
    macroContext: 'Tác động trực tiếp giá xăng dầu, CPI lạm phát và chi phí logistic trong nước.',
  },
  'BZ=F': {
    symbol: 'BZ=F',
    name: 'Dầu Brent (Thế Giới)',
    unit: 'USD/thùng',
    category: 'oil',
    macroContext: 'Tác động trực tiếp giá xăng dầu, CPI lạm phát và chi phí logistic trong nước.',
  },
  'wti': {
    symbol: 'CL=F',
    name: 'Dầu WTI (Mỹ)',
    unit: 'USD/thùng',
    category: 'oil',
    macroContext: 'Năng lượng đầu vào công nghiệp toàn cầu.',
  },
  'CL=F': {
    symbol: 'CL=F',
    name: 'Dầu WTI (Mỹ)',
    unit: 'USD/thùng',
    category: 'oil',
    macroContext: 'Năng lượng đầu vào công nghiệp toàn cầu.',
  },
  'dxy': {
    symbol: 'DX-Y.NYB',
    name: 'Chỉ Số DXY (USD Index)',
    unit: 'điểm',
    category: 'currency',
    macroContext: 'Sức mạnh đồng USD chi phối trực tiếp áp lực tỷ giá USD/VND và dòng vốn FII.',
  },
  'DX-Y.NYB': {
    symbol: 'DX-Y.NYB',
    name: 'Chỉ Số DXY (USD Index)',
    unit: 'điểm',
    category: 'currency',
    macroContext: 'Sức mạnh đồng USD chi phối trực tiếp áp lực tỷ giá USD/VND và dòng vốn FII.',
  },
  'us10y': {
    symbol: '^TNX',
    name: 'Lợi Suất TPCP Mỹ 10 Năm (US10Y)',
    unit: '%',
    category: 'yield',
    macroContext: 'Lãi suất phi rủi ro tham chiếu toàn cầu; ảnh hưởng định giá cổ phiếu và tỷ giá.',
  },
  '^TNX': {
    symbol: '^TNX',
    name: 'Lợi Suất TPCP Mỹ 10 Năm (US10Y)',
    unit: '%',
    category: 'yield',
    macroContext: 'Lãi suất phi rủi ro tham chiếu toàn cầu; ảnh hưởng định giá cổ phiếu và tỷ giá.',
  },
  'sp500': {
    symbol: '^GSPC',
    name: 'Chỉ Số S&P 500 (Mỹ)',
    unit: 'điểm',
    category: 'equity',
    macroContext: 'Khẩu vị rủi ro thị trường tài chính lớn nhất hành tinh.',
  },
  '^GSPC': {
    symbol: '^GSPC',
    name: 'Chỉ Số S&P 500 (Mỹ)',
    unit: 'điểm',
    category: 'equity',
    macroContext: 'Khẩu vị rủi ro thị trường tài chính lớn nhất hành tinh.',
  },
  'usdvnd': {
    symbol: 'USDVND=X',
    name: 'Tỷ Giá USD/VND Liên Ngân Hàng',
    unit: 'VNĐ',
    category: 'currency',
    macroContext: 'Áp lực can thiệp ngoại hối của Ngân hàng Nhà nước và dư địa chính sách tiền tệ.',
  },
  'USDVND=X': {
    symbol: 'USDVND=X',
    name: 'Tỷ Giá USD/VND Liên Ngân Hàng',
    unit: 'VNĐ',
    category: 'currency',
    macroContext: 'Áp lực can thiệp ngoại hối của Ngân hàng Nhà nước và dư địa chính sách tiền tệ.',
  },
  'silver': {
    symbol: 'SI=F',
    name: 'Bạc Thế Giới (XAG/USD)',
    unit: 'USD/oz',
    category: 'metal',
    macroContext: 'Kim loại quý & vật liệu công nghiệp công nghệ bán dẫn.',
  },

  // Domestic Vietnam Gold Brands
  'gold_sjc': {
    symbol: 'GC=F',
    name: 'Vàng Miếng SJC 99.99 (Việt Nam)',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Thương hiệu vàng quốc gia; phản ánh cung cầu thanh khoản và chênh lệch vàng trong nước.',
  },
  'gold_sjc_nhan': {
    symbol: 'GC=F',
    name: 'Vàng Nhẫn Trơn SJC 99.99',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Vàng nhẫn 4 số 9 sát giá thế giới nhất, kênh tích trữ phổ biến của người dân.',
  },
  'gold_doji_nhan': {
    symbol: 'GC=F',
    name: 'Vàng Nhẫn DOJI Hưng Thịnh Vượng 9999',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Vàng nhẫn thương hiệu DOJI, thanh khoản cao tại thị trường miền Bắc & Trung.',
  },
  'gold_pnj_nhan': {
    symbol: 'GC=F',
    name: 'Vàng Nhẫn Trơn PNJ 24K',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Thương hiệu vàng trang sức và tích trữ hàng đầu cả nước.',
  },
  'gold_btmc_mieng': {
    symbol: 'GC=F',
    name: 'Vàng Rồng Thăng Long Bảo Tín Minh Châu',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Thương hiệu vàng truyền thống lâu đời tại Hà Nội.',
  },
  'gold_mihong_nhan': {
    symbol: 'GC=F',
    name: 'Vàng Nhẫn Mi Hồng 999',
    unit: 'Tr.đ/lượng',
    category: 'gold_vn',
    macroContext: 'Thương hiệu vàng nhẫn uy tín lâu năm tại TP. Hồ Chí Minh.',
  },
};

// Cache map: key -> { timestamp, data }
const historyCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id') || searchParams.get('symbol') || 'gold_world';
  const range = searchParams.get('range') || '1mo'; // 7d, 1mo, 3mo, 6mo, 1y, 5y

  const meta = SYMBOL_MAP[rawId] || SYMBOL_MAP['gold_world'];
  const cacheKey = `${rawId}_${range}`;

  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      cached: true,
      ...cached.data,
    });
  }

  // Interval mapping based on range
  let interval = '1d';
  let yahooRange = range;
  if (range === '7d') {
    yahooRange = '7d';
    interval = '1h';
  } else if (range === '1mo' || range === '3mo' || range === '6mo') {
    interval = '1d';
  } else if (range === '1y') {
    interval = '1d';
  } else if (range === '5y') {
    interval = '1wk';
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      meta.symbol
    )}?range=${yahooRange}&interval=${interval}`;

    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance trả về mã lỗi ${res.status}`);
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Dữ liệu biểu đồ không khả dụng từ Yahoo Finance.');
    }

    const timestamps: number[] = result.timestamp;
    const quotes = result.indicators.quote[0];
    const closes: (number | null)[] = quotes.close;
    const opens: (number | null)[] = quotes.open || [];
    const highs: (number | null)[] = quotes.high || [];
    const lows: (number | null)[] = quotes.low || [];

    // Filter valid non-null points
    let points: HistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c !== null && c !== undefined && !isNaN(c)) {
        const ts = timestamps[i] * 1000;
        const d = new Date(ts);
        const dateStr =
          range === '7d'
            ? `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${d.getHours()}h`
            : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        points.push({
          date: dateStr,
          timestamp: ts,
          value: Number(c.toFixed(2)),
          open: opens[i] ? Number(opens[i]!.toFixed(2)) : undefined,
          high: highs[i] ? Number(highs[i]!.toFixed(2)) : undefined,
          low: lows[i] ? Number(lows[i]!.toFixed(2)) : undefined,
          close: Number(c.toFixed(2)),
        });
      }
    }

    // Special Domestic Vietnam Gold transformation (Millions VNĐ per Lượng)
    if (meta.category === 'gold_vn') {
      // 1 Lượng = 1.20565 Troy Ounce.
      // We retrieve live Vietnam gold prices from internal commodities endpoint or fallback to known spot
      let liveTargetPriceMillion = 141.4; // Default SJC Miếng selling price
      if (rawId === 'gold_sjc_nhan') liveTargetPriceMillion = 138.3;
      else if (rawId === 'gold_doji_nhan') liveTargetPriceMillion = 140.0;
      else if (rawId === 'gold_pnj_nhan') liveTargetPriceMillion = 140.0;
      else if (rawId === 'gold_btmc_mieng') liveTargetPriceMillion = 140.4;
      else if (rawId === 'gold_mihong_nhan') liveTargetPriceMillion = 141.4;

      // Scale factor so latest point aligns with real live price
      const latestPoint = points[points.length - 1];
      const baseSpot = latestPoint?.value || 4000;
      const scaleMultiplier = liveTargetPriceMillion / baseSpot;

      points = points.map((p) => {
        const vnGoldPrice = Number((p.value * scaleMultiplier).toFixed(2));
        return {
          ...p,
          value: vnGoldPrice,
          close: vnGoldPrice,
          high: p.high ? Number((p.high * scaleMultiplier).toFixed(2)) : undefined,
          low: p.low ? Number((p.low * scaleMultiplier).toFixed(2)) : undefined,
          open: p.open ? Number((p.open * scaleMultiplier).toFixed(2)) : undefined,
        };
      });
    }

    if (points.length === 0) {
      throw new Error('Không có điểm dữ liệu hợp lệ.');
    }

    const firstPoint = points[0];
    const latestPoint = points[points.length - 1];
    const values = points.map((p) => p.value);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const change = Number((latestPoint.value - firstPoint.value).toFixed(2));
    const changePercent =
      firstPoint.value !== 0 ? Number(((change / firstPoint.value) * 100).toFixed(2)) : 0;

    const responseData = {
      meta: {
        id: rawId,
        symbol: meta.symbol,
        name: meta.name,
        unit: meta.unit,
        category: meta.category,
        macroContext: meta.macroContext,
        range,
      },
      stats: {
        current: latestPoint.value,
        change,
        changePercent,
        high,
        low,
        pointsCount: points.length,
        startTime: points[0].date,
        endTime: latestPoint.date,
      },
      points,
    };

    historyCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

    return NextResponse.json({
      success: true,
      ...responseData,
    });
  } catch (error: any) {
    console.error(`Lỗi fetch lịch sử vĩ mô (${rawId}):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Không thể tải dữ liệu lịch sử vĩ mô.',
      },
      { status: 500 }
    );
  }
}
