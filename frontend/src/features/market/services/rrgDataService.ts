import {
  RRG_SECTOR_CONFIGS,
  calculateRRGSeries,
  getQuadrant,
  RRGSectorData,
  RRGDataset,
  RRGQuadrant,
} from '@/features/market/utils/rrgCalculator';

interface CandlePoint {
  date: string;
  close: number;
}

interface RRGCacheItem {
  timestamp: number;
  data: RRGDataset;
}

const cacheStore: Record<string, RRGCacheItem> = {};
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

async function fetchEntradeCandles(symbol: string, isIndex: boolean, resolution: string = '1D'): Promise<CandlePoint[]> {
  const type = isIndex ? 'index' : 'stock';
  const now = Math.floor(Date.now() / 1000);
  const daysBack = resolution === '1W' ? 730 : 180;
  const from = now - daysBack * 24 * 3600;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/${type}?from=${from}&to=${now}&symbol=${encodeURIComponent(
        symbol
      )}&resolution=${resolution}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];
    const json = await res.json();
    if (!json.t || !json.c || !Array.isArray(json.t)) return [];

    return json.t.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString().split('T')[0],
      close: json.c[i],
    }));
  } catch {
    return [];
  }
}

/**
 * Lấy bộ dữ liệu RRG tính toán trực tiếp từ dữ liệu thực tế DNSE Entrade (có cache 60s)
 */
export async function getLiveRRGDataset(
  timeframe: '1D' | '1W' = '1D',
  tailLength: number = 4,
  benchmark: string = 'VNINDEX'
): Promise<RRGDataset | null> {
  const cacheKey = `${timeframe}_${tailLength}_${benchmark}`;
  const now = Date.now();

  if (cacheStore[cacheKey] && now - cacheStore[cacheKey].timestamp < CACHE_TTL_MS) {
    return cacheStore[cacheKey].data;
  }

  try {
    // 1. Fetch Benchmark (VNINDEX) candles
    const benchCandles = await fetchEntradeCandles(benchmark, true, timeframe);
    if (!benchCandles.length) return null;

    // 2. Collect unique representative symbols for the 16 sectors (top 3 per sector)
    const symbolsToFetch = new Set<string>();
    RRG_SECTOR_CONFIGS.forEach((sector) => {
      sector.symbols.slice(0, 3).forEach((s) => symbolsToFetch.add(s));
    });

    const symbolArray = Array.from(symbolsToFetch);
    const symbolCandleMap = new Map<string, CandlePoint[]>();
    const batchSize = 10;
    for (let i = 0; i < symbolArray.length; i += batchSize) {
      const batch = symbolArray.slice(i, i + batchSize);
      const batchPromises = batch.map(async (sym) => {
        const candles = await fetchEntradeCandles(sym, false, timeframe);
        return { sym, candles };
      });
      const batchRes = await Promise.all(batchPromises);
      batchRes.forEach(({ sym, candles }) => {
        if (candles.length) {
          symbolCandleMap.set(sym, candles);
        }
      });
    }

    // 3. Synthesize sector composite prices
    const dateList = benchCandles.map((c) => c.date);
    const sectorsData: RRGSectorData[] = [];
    let leadingCount = 0;
    let weakeningCount = 0;
    let laggingCount = 0;
    let improvingCount = 0;

    for (const config of RRG_SECTOR_CONFIGS) {
      const validStockCandles = config.symbols
        .slice(0, 3)
        .map((s) => symbolCandleMap.get(s))
        .filter((c): c is CandlePoint[] => !!c && c.length >= 20);

      if (!validStockCandles.length) continue;

      const stockPriceMaps = validStockCandles.map((candles) => {
        const map = new Map<string, number>();
        candles.forEach((c) => map.set(c.date, c.close));
        return {
          basePrice: candles[0]?.close || 1,
          map,
        };
      });

      const sectorPrices: CandlePoint[] = [];
      for (const d of dateList) {
        let normalizedSum = 0;
        let count = 0;
        for (const item of stockPriceMaps) {
          const price = item.map.get(d);
          if (price !== undefined && price > 0) {
            normalizedSum += (price / item.basePrice) * 100;
            count++;
          }
        }
        if (count > 0) {
          sectorPrices.push({
            date: d,
            close: normalizedSum / count,
          });
        }
      }

      if (sectorPrices.length < 28) continue;

      const points = calculateRRGSeries(sectorPrices, benchCandles, 14, 1.8, tailLength);
      if (!points.length) continue;

      const currentPoint = points[points.length - 1];
      const prevPoint = points.length >= 2 ? points[points.length - 2] : currentPoint;

      const quadrant = getQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);
      if (quadrant === 'leading') leadingCount++;
      else if (quadrant === 'weakening') weakeningCount++;
      else if (quadrant === 'lagging') laggingCount++;
      else if (quadrant === 'improving') improvingCount++;

      const dx = currentPoint.rsRatio - 100;
      const dy = currentPoint.rsMomentum - 100;
      const distanceFromCenter = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
      const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const angle = Number(((rawAngle + 360) % 360).toFixed(1));

      const vdx = currentPoint.rsRatio - prevPoint.rsRatio;
      const vdy = currentPoint.rsMomentum - prevPoint.rsMomentum;
      const velocity = Number(Math.sqrt(vdx * vdx + vdy * vdy).toFixed(2));

      const lastClose = sectorPrices[sectorPrices.length - 1]?.close || 1;
      const prevClose = sectorPrices[sectorPrices.length - 2]?.close || lastClose;
      const changePercent = Number((((lastClose - prevClose) / prevClose) * 100).toFixed(2));

      sectorsData.push({
        id: config.id,
        name: config.name,
        shortName: config.shortName,
        color: config.color,
        symbols: config.symbols,
        points,
        currentPoint,
        quadrant,
        distanceFromCenter,
        angle,
        velocity,
        changePercent,
      });
    }

    sectorsData.sort((a, b) => b.distanceFromCenter - a.distanceFromCenter);

    const dataset: RRGDataset = {
      sectors: sectorsData,
      benchmark,
      dateRange: {
        start: dateList[0] || '',
        end: dateList[dateList.length - 1] || '',
      },
      summary: {
        leading: leadingCount,
        weakening: weakeningCount,
        lagging: laggingCount,
        improving: improvingCount,
        total: sectorsData.length,
      },
    };

    cacheStore[cacheKey] = {
      timestamp: now,
      data: dataset,
    };

    return dataset;
  } catch (error) {
    console.error('getLiveRRGDataset error:', error);
    return null;
  }
}

export interface SectorRRGInfo {
  sectorId: string;
  sectorName: string;
  sectorRank: string;
  sectorRS: number;
  sectorStatus: 'Dẫn dắt (Leading)' | 'Cải thiện (Improving)' | 'Suy yếu (Weakening)' | 'Tụt hậu (Lagging)';
  quadrant: RRGQuadrant;
  rsRatio: number;
  rsMomentum: number;
}

/**
 * Khớp mã cổ phiếu và nhóm ngành với kết quả RRG thực tế để trả về trạng thái chuẩn hóa, 
 * tuyệt đối không dùng số liệu mock hay bảng hardcode tĩnh.
 */
export function findMatchingRRGSector(
  symbol: string,
  sectorName: string,
  rrgDataset: RRGDataset | null
): SectorRRGInfo | null {
  if (!rrgDataset || !rrgDataset.sectors.length) return null;

  const symbolUpper = symbol.toUpperCase().trim();
  const sectorLower = (sectorName || '').toLowerCase().trim();

  // 1. Tìm theo mã cổ phiếu trong danh sách đại diện ngành
  let matched = rrgDataset.sectors.find((s) => s.symbols.map((x) => x.toUpperCase()).includes(symbolUpper));

  // 2. Nếu không có trong danh sách đại diện, map theo tên nhóm ngành
  if (!matched && sectorLower) {
    matched = rrgDataset.sectors.find((s) => {
      const sName = s.name.toLowerCase();
      const sShort = s.shortName.toLowerCase();
      if (sName.includes(sectorLower) || sectorLower.includes(sName)) return true;
      if (sShort.includes(sectorLower) || sectorLower.includes(sShort)) return true;

      if (sectorLower.includes('bất động sản') && s.id === 'real_estate') return true;
      if (sectorLower.includes('khu công nghiệp') && s.id === 'industrial_park') return true;
      if (sectorLower.includes('ngân hàng') && s.id === 'banking') return true;
      if (sectorLower.includes('chứng khoán') && s.id === 'securities') return true;
      if ((sectorLower.includes('thép') || sectorLower.includes('kim loại')) && s.id === 'steel') return true;
      if (sectorLower.includes('dầu khí') && s.id === 'oil_gas') return true;
      if (sectorLower.includes('bán lẻ') && s.id === 'retail') return true;
      if ((sectorLower.includes('thực phẩm') || sectorLower.includes('đồ uống') || sectorLower.includes('tiêu dùng')) && s.id === 'food_beverage') return true;
      if ((sectorLower.includes('công nghệ') || sectorLower.includes('viễn thông')) && s.id === 'tech') return true;
      if ((sectorLower.includes('xây dựng') || sectorLower.includes('hạ tầng')) && s.id === 'construction') return true;
      if (sectorLower.includes('thủy sản') && s.id === 'seafood') return true;
      if ((sectorLower.includes('nông nghiệp') || sectorLower.includes('chăn nuôi')) && s.id === 'agriculture') return true;
      if ((sectorLower.includes('năng lượng') || sectorLower.includes('điện')) && s.id === 'energy') return true;
      if ((sectorLower.includes('hóa chất') || sectorLower.includes('phân bón')) && s.id === 'chemicals') return true;
      if ((sectorLower.includes('cảng') || sectorLower.includes('logistics') || sectorLower.includes('vận tải')) && s.id === 'logistics') return true;
      if ((sectorLower.includes('cao su') || sectorLower.includes('nhựa')) && s.id === 'rubber_plastic') return true;
      return false;
    });
  }

  if (!matched) return null;

  // Xếp hạng 16 nhóm ngành theo rsRatio giảm dần (Chuẩn Julius de Kempenaer)
  const sortedByRs = [...rrgDataset.sectors].sort((a, b) => b.currentPoint.rsRatio - a.currentPoint.rsRatio);
  const rankIndex = sortedByRs.findIndex((s) => s.id === matched!.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : 1;
  const total = sortedByRs.length;

  // Map quadrant sang nhãn tiếng Việt chuẩn
  let sectorStatus: 'Dẫn dắt (Leading)' | 'Cải thiện (Improving)' | 'Suy yếu (Weakening)' | 'Tụt hậu (Lagging)';
  switch (matched.quadrant) {
    case 'leading':
      sectorStatus = 'Dẫn dắt (Leading)';
      break;
    case 'improving':
      sectorStatus = 'Cải thiện (Improving)';
      break;
    case 'weakening':
      sectorStatus = 'Suy yếu (Weakening)';
      break;
    case 'lagging':
    default:
      sectorStatus = 'Tụt hậu (Lagging)';
      break;
  }

  // Điểm sức mạnh ngành RS Rating (thang điểm 1 - 99 theo thứ hạng tương đối)
  const sectorRS = Math.round(Math.min(99, Math.max(1, 99 - ((rank - 1) / Math.max(1, total - 1)) * 65)));

  return {
    sectorId: matched.id,
    sectorName: matched.name,
    sectorRank: `Top ${rank} / ${total} ngành`,
    sectorRS,
    sectorStatus,
    quadrant: matched.quadrant,
    rsRatio: matched.currentPoint.rsRatio,
    rsMomentum: matched.currentPoint.rsMomentum,
  };
}
