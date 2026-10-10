'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMarketStore } from '../store/marketStore';
import {
  Flame,
  SlidersHorizontal,
  MagnifyingGlass,
} from '@phosphor-icons/react';

export interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  mktCapT: number;
  rsRating?: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PlacedItem<T> extends Rect {
  data: T;
}

// Map stock ticker symbols to official Vietnamese Industry Sectors
const SECTOR_MAPPING: Record<string, string> = {
  // Ngân hàng
  VCB: 'Ngân hàng', BID: 'Ngân hàng', CTG: 'Ngân hàng', TCB: 'Ngân hàng',
  MBB: 'Ngân hàng', ACB: 'Ngân hàng', VPB: 'Ngân hàng', HDB: 'Ngân hàng',
  STB: 'Ngân hàng', LPB: 'Ngân hàng', SHB: 'Ngân hàng', TPB: 'Ngân hàng',
  VIB: 'Ngân hàng', MSB: 'Ngân hàng', OCB: 'Ngân hàng', SSB: 'Ngân hàng',
  EIB: 'Ngân hàng', NAB: 'Ngân hàng', BAB: 'Ngân hàng', BVB: 'Ngân hàng',

  // Chứng khoán
  SSI: 'Chứng khoán', VND: 'Chứng khoán', VCI: 'Chứng khoán', HCM: 'Chứng khoán',
  SHS: 'Chứng khoán', MBS: 'Chứng khoán', FTS: 'Chứng khoán', BSI: 'Chứng khoán',
  CTS: 'Chứng khoán', VIX: 'Chứng khoán', AGR: 'Chứng khoán', ORS: 'Chứng khoán',
  TVS: 'Chứng khoán', PHS: 'Chứng khoán',

  // Bất động sản
  VHM: 'Bất động sản', VIC: 'Bất động sản', VRE: 'Bất động sản', KDH: 'Bất động sản',
  NLG: 'Bất động sản', PDR: 'Bất động sản', DIG: 'Bất động sản', DXG: 'Bất động sản',
  CEO: 'Bất động sản', NVL: 'Bất động sản', KBC: 'Bất động sản', IDC: 'Bất động sản',
  VGC: 'Bất động sản', SZC: 'Bất động sản', BCM: 'Bất động sản', TCH: 'Bất động sản',
  HQC: 'Bất động sản', DRH: 'Bất động sản', KHG: 'Bất động sản', VPI: 'Bất động sản',
  HDG: 'Bất động sản', DXS: 'Bất động sản', NTL: 'Bất động sản',

  // Thép & Vật liệu
  HPG: 'Thép & Vật liệu', HSG: 'Thép & Vật liệu', NKG: 'Thép & Vật liệu',
  VGS: 'Thép & Vật liệu', SMC: 'Thép & Vật liệu', TLH: 'Thép & Vật liệu',
  HT1: 'Thép & Vật liệu', BCC: 'Thép & Vật liệu', BMP: 'Thép & Vật liệu',
  NTP: 'Thép & Vật liệu',

  // Công nghệ & Viễn thông
  FPT: 'Công nghệ', CMG: 'Công nghệ', ELC: 'Công nghệ', FOX: 'Công nghệ',
  VGI: 'Công nghệ', CTR: 'Công nghệ', VNZ: 'Công nghệ', ITD: 'Công nghệ',

  // Năng lượng & Dầu khí
  GAS: 'Năng lượng & Dầu khí', PLX: 'Năng lượng & Dầu khí', BSR: 'Năng lượng & Dầu khí',
  PVD: 'Năng lượng & Dầu khí', PVS: 'Năng lượng & Dầu khí', PVT: 'Năng lượng & Dầu khí',
  PVP: 'Năng lượng & Dầu khí', POW: 'Năng lượng & Dầu khí', NT2: 'Năng lượng & Dầu khí',
  GEG: 'Năng lượng & Dầu khí', GEE: 'Năng lượng & Dầu khí', PC1: 'Năng lượng & Dầu khí',
  REE: 'Năng lượng & Dầu khí',

  // Hóa chất & Phân bón
  DGC: 'Hóa chất & Phân bón', DCM: 'Hóa chất & Phân bón', DPM: 'Hóa chất & Phân bón',
  CSV: 'Hóa chất & Phân bón', BFC: 'Hóa chất & Phân bón', LAS: 'Hóa chất & Phân bón',
  GVR: 'Hóa chất & Phân bón', PHR: 'Hóa chất & Phân bón', DPR: 'Hóa chất & Phân bón',

  // Bán lẻ & Hàng tiêu dùng
  MSN: 'Bán lẻ & Tiêu dùng', VNM: 'Bán lẻ & Tiêu dùng', SAB: 'Bán lẻ & Tiêu dùng',
  MWG: 'Bán lẻ & Tiêu dùng', FRT: 'Bán lẻ & Tiêu dùng', DGW: 'Bán lẻ & Tiêu dùng',
  PNJ: 'Bán lẻ & Tiêu dùng', DBC: 'Bán lẻ & Tiêu dùng', HAG: 'Bán lẻ & Tiêu dùng',
  BAF: 'Bán lẻ & Tiêu dùng', VHC: 'Bán lẻ & Tiêu dùng', ANV: 'Bán lẻ & Tiêu dùng',
  KDC: 'Bán lẻ & Tiêu dùng', MCH: 'Bán lẻ & Tiêu dùng',

  // Xây dựng, Công nghiệp & Vận tải
  GEX: 'Công nghiệp & Xây dựng', VCG: 'Công nghiệp & Xây dựng', HHV: 'Công nghiệp & Xây dựng',
  CII: 'Công nghiệp & Xây dựng', CTD: 'Công nghiệp & Xây dựng', FCN: 'Công nghiệp & Xây dựng',
  GMD: 'Vận tải & Cảng biển', HAH: 'Vận tải & Cảng biển', VSC: 'Vận tải & Cảng biển',
  VTP: 'Vận tải & Cảng biển', PHP: 'Vận tải & Cảng biển', VJC: 'Vận tải & Cảng biển',
  HVN: 'Vận tải & Cảng biển', TNG: 'Dệt may & Sản xuất', MSH: 'Dệt may & Sản xuất'
};

const VN30_LIST = new Set([
  'ACB', 'BCM', 'BID', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'MBB',
  'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB',
  'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VRE', 'LPB'
]);

// Real Shares Outstanding (Cổ phiếu lưu hành) for Vietnamese equities (in millions of shares)
const OUTSTANDING_SHARES_M: Record<string, number> = {
  // Ngân hàng
  VCB: 5589, BID: 5700, CTG: 5369, TCB: 7067, MBB: 5287, ACB: 4466, VPB: 7933,
  HDB: 2900, STB: 1885, LPB: 2557, SHB: 3662, TPB: 2201, VIB: 2536, MSB: 2600,
  OCB: 2054, SSB: 2490, EIB: 1740,
  // Chứng khoán
  SSI: 1511, VND: 1522, VCI: 718, HCM: 705, SHS: 813, MBS: 437, FTS: 242,
  BSI: 202, CTS: 148, VIX: 1459,
  // Bất động sản
  VHM: 4354, VIC: 3880, VRE: 2272, KDH: 800, NLG: 384, PDR: 873, DIG: 609,
  DXG: 720, CEO: 514, NVL: 1950, KBC: 767, IDC: 330, VGC: 448, SZC: 180,
  BCM: 1035, TCH: 668, VPI: 241, HDG: 305,
  // Thép & Vật liệu
  HPG: 8443, HSG: 616, NKG: 263, VGS: 107, HT1: 381, BMP: 81, NTP: 129,
  // Công nghệ
  FPT: 1460, CMG: 150, ELC: 82, CTR: 114, VGI: 3043,
  // Bán lẻ & Tiêu dùng
  MSN: 1430, MWG: 1463, VNM: 2089, SAB: 1282, PNJ: 338, FRT: 136, DGW: 167,
  DBC: 242, HAG: 1057, BAF: 239, VHC: 224, ANV: 266,
  // Năng lượng & Dầu khí
  GAS: 2296, PLX: 1270, BSR: 3100, PVD: 555, PVS: 478, PVT: 356, PVP: 94,
  POW: 2341, REE: 409, PC1: 310, GEG: 338,
  // Hóa chất & Phân bón
  DGC: 379, DCM: 529, DPM: 391, CSV: 132, GVR: 4000, BFC: 77, LAS: 112,
  // Công nghiệp & Vận tải
  GEX: 851, VSC: 266, GMD: 335, HAH: 121, VCG: 534, HHV: 411, CII: 318,
  VJC: 541, TNG: 113, MSH: 75
};

// Mathematically Exact Squarified Treemap Layout (Bruls, Huizing, van Wijk)
function squarify<T extends { weight: number }>(
  items: T[],
  rect: Rect
): PlacedItem<T>[] {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return [];

  const totalWeight = items.reduce((sum, item) => sum + Math.max(0.001, item.weight), 0);
  if (totalWeight <= 0) return [];

  const totalArea = rect.w * rect.h;
  const scaledItems = items.map((item) => ({
    ...item,
    scaledArea: (Math.max(0.001, item.weight) / totalWeight) * totalArea,
  }));

  const results: PlacedItem<T>[] = [];

  function layoutRow(row: typeof scaledItems, rowArea: number, currentRect: Rect): Rect {
    const isWider = currentRect.w >= currentRect.h;
    if (isWider) {
      // Slicing vertical column along currentRect.h
      const breadth = currentRect.h > 0 ? rowArea / currentRect.h : 0;
      let offset = 0;
      for (const item of row) {
        const itemH = breadth > 0 ? item.scaledArea / breadth : 0;
        results.push({
          x: currentRect.x,
          y: currentRect.y + offset,
          w: Math.max(0, breadth),
          h: Math.max(0, itemH),
          data: item,
        });
        offset += itemH;
      }
      return {
        x: currentRect.x + breadth,
        y: currentRect.y,
        w: Math.max(0, currentRect.w - breadth),
        h: currentRect.h,
      };
    } else {
      // Slicing horizontal row along currentRect.w
      const breadth = currentRect.w > 0 ? rowArea / currentRect.w : 0;
      let offset = 0;
      for (const item of row) {
        const itemW = breadth > 0 ? item.scaledArea / breadth : 0;
        results.push({
          x: currentRect.x + offset,
          y: currentRect.y,
          w: Math.max(0, itemW),
          h: Math.max(0, breadth),
          data: item,
        });
        offset += itemW;
      }
      return {
        x: currentRect.x,
        y: currentRect.y + breadth,
        w: currentRect.w,
        h: Math.max(0, currentRect.h - breadth),
      };
    }
  }

  function worstAspectRatio(row: typeof scaledItems, length: number): number {
    if (row.length === 0 || length <= 0) return Infinity;
    const rowArea = row.reduce((sum, item) => sum + item.scaledArea, 0);
    const breadth = rowArea / length;
    if (breadth <= 0) return Infinity;

    let worst = 0;
    for (const item of row) {
      const itemLen = item.scaledArea / breadth;
      const ratio = itemLen >= breadth ? itemLen / breadth : breadth / itemLen;
      if (ratio > worst) worst = ratio;
    }
    return worst;
  }

  let remainingRect = { ...rect };
  let remainingItems = [...scaledItems];
  let currentRow: typeof scaledItems = [];

  while (remainingItems.length > 0) {
    const nextItem = remainingItems[0];
    const isWider = remainingRect.w >= remainingRect.h;
    const length = isWider ? remainingRect.h : remainingRect.w;

    if (currentRow.length === 0) {
      currentRow.push(nextItem);
      remainingItems.shift();
    } else {
      const currentWorst = worstAspectRatio(currentRow, length);
      const testRow = [...currentRow, nextItem];
      const testWorst = worstAspectRatio(testRow, length);

      if (testWorst <= currentWorst) {
        currentRow.push(nextItem);
        remainingItems.shift();
      } else {
        const rowArea = currentRow.reduce((sum, item) => sum + item.scaledArea, 0);
        remainingRect = layoutRow(currentRow, rowArea, remainingRect);
        currentRow = [];
      }
    }
  }

  if (currentRow.length > 0) {
    const rowArea = currentRow.reduce((sum, item) => sum + item.scaledArea, 0);
    layoutRow(currentRow, rowArea, remainingRect);
  }

  return results;
}

export const MarketHeatmap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 1100, height: 600 });
  const [rawStocks, setRawStocks] = useState<HeatmapStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'VN30' | 'HOSE' | 'HNX'>('ALL');
  const [sizeMetric, setSizeMetric] = useState<'mktCap' | 'volume'>('mktCap');
  const [groupBySector, setGroupBySector] = useState(true);
  const [hoveredStock, setHoveredStock] = useState<HeatmapStock | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [searchFilter, setSearchFilter] = useState('');

  const { ticks, wsStatus, setSelectedSymbol } = useMarketStore();
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  // Realtime tick price change detector for visual flash
  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down'> = {};
    let hasUpdate = false;
    Object.entries(ticks).forEach(([sym, tick]) => {
      const prev = prevPricesRef.current[sym];
      if (prev !== undefined && tick.price !== prev) {
        newFlashes[sym] = tick.price > prev ? 'up' : 'down';
        hasUpdate = true;
      }
      prevPricesRef.current[sym] = tick.price;
    });

    if (hasUpdate) {
      setFlashMap((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setFlashMap({});
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [ticks]);

  // Load verified market universe (80+ sector leaders)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/market/minervini/screener?minMktCap=0&minVol=0&minRS=1&stage2=false')
      .then((res) => res.json())
      .then((resData) => {
        if (!isMounted) return;
        if (resData.success && Array.isArray(resData.data)) {
          const mapped: HeatmapStock[] = resData.data.map((item: any) => {
            const sym = item.symbol.toUpperCase();
            const sector = SECTOR_MAPPING[sym] || item.sector || 'Khác';
            const price = item.price || 0;
            const sharesM = OUTSTANDING_SHARES_M[sym] || (item.mktCapT > 0 && price > 0 ? (item.mktCapT * 1000000) / price : 250);
            const mktCapT = Math.round(((sharesM * (price || 10000)) / 1000000) * 10) / 10;
            return {
              symbol: sym,
              name: item.name || sym,
              sector,
              exchange: item.exchange || 'HOSE',
              price,
              change: item.change || 0,
              changePercent: item.changePct !== undefined ? item.changePct : (item.changePercent || 0),
              volume: item.volume || 0,
              mktCapT,
              rsRating: item.rsRating || 50,
            };
          });
          setRawStocks(mapped);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = Math.max(520, Math.min(800, Math.round(w * 0.52)));
        setDimensions({ width: w, height: h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Merge Live WebSocket Ticks directly into stock items (Zero-Mock Realtime)
  const liveStocks = useMemo(() => {
    return rawStocks.map((stock) => {
      const live = ticks[stock.symbol];
      if (!live) return stock;

      const price = live.price || stock.price;
      const ref = live.referencePrice || (price - (live.change || 0));
      const change = live.change !== undefined ? live.change : (price - ref);
      const changePercent = live.changePercent !== undefined
        ? live.changePercent
        : (ref > 0 ? (change / ref) * 100 : 0);
      const volume = live.totalVolume || live.volume || stock.volume;

      // Realtime market cap dynamic calculation
      const sharesM = OUTSTANDING_SHARES_M[stock.symbol] || (stock.mktCapT > 0 && stock.price > 0 ? (stock.mktCapT * 1000000) / stock.price : 250);
      const mktCapT = Math.round(((sharesM * price) / 1000000) * 10) / 10;

      return {
        ...stock,
        price,
        change,
        changePercent: Number(changePercent.toFixed(2)),
        volume,
        mktCapT,
      };
    });
  }, [rawStocks, ticks]);

  // Filter stocks by exchange, index and search query
  const filteredStocks = useMemo(() => {
    return liveStocks.filter((s) => {
      if (searchFilter && !s.symbol.toLowerCase().includes(searchFilter.toLowerCase()) && !s.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      if (exchangeFilter === 'VN30') return VN30_LIST.has(s.symbol);
      if (exchangeFilter === 'HOSE') return s.exchange === 'HOSE';
      if (exchangeFilter === 'HNX') return s.exchange === 'HNX';
      return true;
    });
  }, [liveStocks, exchangeFilter, searchFilter]);

  // Market Breadth Statistics (Realtime counts)
  const stats = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let ceilings = 0;
    let floors = 0;

    filteredStocks.forEach((s) => {
      const pct = s.changePercent;
      const ceilLimit = s.exchange === 'HNX' ? 9.8 : 6.85;
      const floorLimit = s.exchange === 'HNX' ? -9.8 : -6.85;

      if (pct >= ceilLimit) {
        ceilings++;
        advances++;
      } else if (pct > 0.05) {
        advances++;
      } else if (pct <= floorLimit) {
        floors++;
        declines++;
      } else if (pct < -0.05) {
        declines++;
      } else {
        unchanged++;
      }
    });

    return {
      advances,
      declines,
      unchanged,
      ceilings,
      floors,
    };
  }, [filteredStocks]);

  // Calculate Color according to Vietnam Stock Market conventions
  const getColorClasses = (stock: HeatmapStock) => {
    const pct = stock.changePercent;
    const isHnx = stock.exchange === 'HNX';
    const ceilLimit = isHnx ? 9.8 : 6.85;
    const floorLimit = isHnx ? -9.8 : -6.85;

    // Ceiling (Trần tím)
    if (pct >= ceilLimit) {
      return {
        bg: 'bg-[#9333ea]',
        border: 'border-purple-400',
        text: 'text-white',
        label: 'CE',
      };
    }
    // Floor (Sàn xanh lơ)
    if (pct <= floorLimit) {
      return {
        bg: 'bg-[#0891b2]',
        border: 'border-cyan-400',
        text: 'text-white',
        label: 'FL',
      };
    }
    // Strong Green
    if (pct >= 3.0) {
      return {
        bg: 'bg-[#15803d]',
        border: 'border-emerald-600',
        text: 'text-white',
        label: '',
      };
    }
    // Moderate Green
    if (pct > 0.05) {
      return {
        bg: 'bg-[#166534]',
        border: 'border-emerald-700',
        text: 'text-white',
        label: '',
      };
    }
    // Unchanged / Reference (Vàng)
    if (Math.abs(pct) <= 0.05) {
      return {
        bg: 'bg-[#854d0e]',
        border: 'border-amber-600',
        text: 'text-white',
        label: '',
      };
    }
    // Moderate Red
    if (pct > -3.0) {
      return {
        bg: 'bg-[#991b1b]',
        border: 'border-rose-700',
        text: 'text-white',
        label: '',
      };
    }
    // Strong Red
    return {
      bg: 'bg-[#b91c1c]',
      border: 'border-rose-600',
      text: 'text-white',
      label: '',
    };
  };

  // Build the Treemap Layout
  const layout = useMemo(() => {
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0 || filteredStocks.length === 0) return { sectors: [], flat: [] };

    // Function to calculate weight per item
    const getWeight = (s: HeatmapStock) => {
      if (sizeMetric === 'volume') return Math.max(100, Math.sqrt(s.volume * (s.price || 10000)));
      return Math.max(1, s.mktCapT * 10);
    };

    if (!groupBySector) {
      // Flat treemap
      const items = filteredStocks
        .map((s) => ({ ...s, weight: getWeight(s) }))
        .sort((a, b) => b.weight - a.weight);

      const placed = squarify(items, { x: 0, y: 0, w: width, h: height });
      return { sectors: [], flat: placed };
    }

    // Group by Sectors
    const sectorGroups: Record<string, HeatmapStock[]> = {};
    filteredStocks.forEach((s) => {
      const sec = s.sector || 'Khác';
      if (!sectorGroups[sec]) sectorGroups[sec] = [];
      sectorGroups[sec].push(s);
    });

    // Calculate total weight and avg change for each sector
    const sectorSummaries = Object.entries(sectorGroups).map(([name, stocks]) => {
      const weight = stocks.reduce((sum, s) => sum + getWeight(s), 0);
      const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / (stocks.length || 1);
      return {
        name,
        stocks,
        weight,
        avgChange: Number(avgChange.toFixed(2)),
      };
    }).sort((a, b) => b.weight - a.weight);

    // Layout sector outer boxes
    const placedSectors = squarify(sectorSummaries, { x: 0, y: 0, w: width, h: height });

    // Inside each sector box, layout stock children relative to (0, 0)
    const finalSectors = placedSectors.map((secPlaced) => {
      const headerHeight = secPlaced.h >= 60 && secPlaced.w >= 60 ? 22 : 0;
      const childRect: Rect = {
        x: 0,
        y: headerHeight,
        w: secPlaced.w,
        h: Math.max(0, secPlaced.h - headerHeight),
      };

      const sortedStocks = secPlaced.data.stocks
        .map((s) => ({ ...s, weight: getWeight(s) }))
        .sort((a, b) => b.weight - a.weight);

      const placedStocks = squarify(sortedStocks, childRect);

      return {
        ...secPlaced,
        headerHeight,
        children: placedStocks,
      };
    });

    return { sectors: finalSectors, flat: [] };
  }, [dimensions, filteredStocks, groupBySector, sizeMetric]);

  const handleTileClick = (stock: HeatmapStock) => {
    setSelectedSymbol(stock.symbol);
  };

  const handleMouseMove = (e: React.MouseEvent, stock: HeatmapStock) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const tooltipWidth = 250;
    const tooltipHeight = 180;
    const x = mouseX + 16 + tooltipWidth > rect.width ? mouseX - tooltipWidth - 12 : mouseX + 16;
    const y = mouseY + 16 + tooltipHeight > rect.height ? mouseY - tooltipHeight - 12 : mouseY + 16;

    setTooltipPos({ x: Math.max(8, x), y: Math.max(8, y) });
    setHoveredStock(stock);
  };

  return (
    <div className="space-y-4 font-mono">
      {/* ── Top Header Controls (TradingView Style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl backdrop-blur-xl shadow-lg">
        {/* Left: Title + Exchange Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Flame className="w-4 h-4" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5 leading-none">
                  BẢN ĐỒ NHIỆT (HEATMAP)
                </h3>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE DNSE WS</span>
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">Realtime TradingView Layer</span>
            </div>
          </div>

          {/* Index Selector Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            {(['ALL', 'VN30', 'HOSE', 'HNX'] as const).map((ex) => (
              <button
                key={ex}
                onClick={() => setExchangeFilter(ex)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  exchangeFilter === ex
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {ex === 'ALL' ? 'Toàn Thị Trường' : ex}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Search Filter */}
        <div className="relative min-w-[160px] max-w-[220px]">
          <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Lọc mã CP..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Right: Sizing Metric & Grouping Options */}
        <div className="flex items-center gap-2">
          {/* Sizing buttons */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px]">
            <button
              onClick={() => setSizeMetric('mktCap')}
              className={`px-2 py-1 rounded font-bold transition-all ${
                sizeMetric === 'mktCap'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Vốn Hóa
            </button>
            <button
              onClick={() => setSizeMetric('volume')}
              className={`px-2 py-1 rounded font-bold transition-all ${
                sizeMetric === 'volume'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Khối Lượng
            </button>
          </div>

          {/* Group by Sector toggle */}
          <button
            onClick={() => setGroupBySector(!groupBySector)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
              groupBySector
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Theo Ngành</span>
          </button>
        </div>
      </div>

      {/* ── Sub-bar: Realtime Breadth Breakdown (Image 2 Style) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
        {/* Tăng */}
        <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Tăng giá:</span>
          </div>
          <span className="font-bold text-emerald-400">{stats.advances}</span>
        </div>

        {/* Trần */}
        <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-zinc-400">Giá trần:</span>
          </div>
          <span className="font-bold text-purple-400">{stats.ceilings}</span>
        </div>

        {/* Tham chiếu */}
        <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-zinc-400">Tham chiếu:</span>
          </div>
          <span className="font-bold text-amber-400">{stats.unchanged}</span>
        </div>

        {/* Giảm */}
        <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-zinc-400">Giảm giá:</span>
          </div>
          <span className="font-bold text-rose-400">{stats.declines}</span>
        </div>

        {/* Sàn */}
        <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-zinc-400">Giá sàn:</span>
          </div>
          <span className="font-bold text-cyan-400">{stats.floors}</span>
        </div>
      </div>

      {/* ── Main Interactive Treemap Container ── */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl bg-[#0a0a0c] border border-zinc-800/80 shadow-2xl overflow-hidden select-none"
        style={{ height: `${dimensions.height}px` }}
        onMouseLeave={() => setHoveredStock(null)}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 backdrop-blur-sm z-20">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-xs text-zinc-400 font-mono">Đang tải bản đồ nhiệt thị trường...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
            Không tìm thấy cổ phiếu phù hợp bộ lọc
          </div>
        ) : groupBySector ? (
          // Render Hierarchical Sector Treemap
          layout.sectors.map((sec) => (
            <div
              key={sec.data.name}
              className="absolute border border-black/80 bg-zinc-950 overflow-hidden box-border"
              style={{
                left: `${sec.x}px`,
                top: `${sec.y}px`,
                width: `${sec.w}px`,
                height: `${sec.h}px`,
              }}
            >
              {/* Sector Header Label */}
              {sec.headerHeight > 0 && (
                <div
                  className="flex items-center justify-between px-2 bg-zinc-900/95 border-b border-zinc-800 text-[10px] text-zinc-400 font-bold overflow-hidden whitespace-nowrap select-none"
                  style={{ height: `${sec.headerHeight}px` }}
                >
                  <span className="truncate hover:text-zinc-200">
                    {sec.data.name} &gt;
                  </span>
                  <span
                    className={`ml-2 shrink-0 ${
                      sec.data.avgChange > 0
                        ? 'text-emerald-400'
                        : sec.data.avgChange < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {sec.data.avgChange > 0 ? `+${sec.data.avgChange}%` : `${sec.data.avgChange}%`}
                  </span>
                </div>
              )}

              {/* Stock Tiles in this sector */}
              {sec.children.map((child) => {
                const stock = child.data;
                const colors = getColorClasses(stock);
                const isSmall = child.w < 50 || child.h < 34;
                const isTiny = child.w < 36 || child.h < 24;

                const flash = flashMap[stock.symbol];

                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleTileClick(stock)}
                    onMouseMove={(e) => handleMouseMove(e, stock)}
                    className={`absolute flex flex-col items-center justify-center p-0.5 cursor-pointer border border-black/50 transition-all ${
                      flash === 'up'
                        ? 'ring-2 ring-emerald-400 z-30 brightness-125 scale-[1.01]'
                        : flash === 'down'
                        ? 'ring-2 ring-rose-400 z-30 brightness-125 scale-[1.01]'
                        : 'hover:opacity-90'
                    } ${colors.bg} box-border`}
                    style={{
                      left: `${child.x}px`,
                      top: `${child.y}px`,
                      width: `${child.w}px`,
                      height: `${child.h}px`,
                    }}
                  >
                    {isTiny ? (
                      <span className="font-black text-[9px] text-white leading-none">
                        {stock.symbol}
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 leading-none">
                          <span className="font-black text-xs sm:text-sm text-white drop-shadow-sm">
                            {stock.symbol}
                          </span>
                          {colors.label && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-black bg-white/20 text-white">
                              {colors.label}
                            </span>
                          )}
                        </div>

                        {!isSmall && (
                          <span className="text-[10px] font-bold text-white/90 mt-0.5">
                            {stock.changePercent > 0 ? `+${stock.changePercent}%` : `${stock.changePercent}%`}
                          </span>
                        )}

                        {child.w > 70 && child.h > 52 && (
                          <span className="text-[9px] text-white/70 mt-0.5">
                            {(stock.price / 1000).toFixed(2)}k
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          // Render Flat Treemap
          layout.flat.map((item) => {
            const stock = item.data;
            const colors = getColorClasses(stock);
            const isSmall = item.w < 50 || item.h < 34;
            const isTiny = item.w < 36 || item.h < 24;
            const flash = flashMap[stock.symbol];

            return (
              <div
                key={stock.symbol}
                onClick={() => handleTileClick(stock)}
                onMouseMove={(e) => handleMouseMove(e, stock)}
                className={`absolute flex flex-col items-center justify-center p-0.5 cursor-pointer border border-black/50 transition-all ${
                  flash === 'up'
                    ? 'ring-2 ring-emerald-400 z-30 brightness-125 scale-[1.01]'
                    : flash === 'down'
                    ? 'ring-2 ring-rose-400 z-30 brightness-125 scale-[1.01]'
                    : 'hover:opacity-90'
                } ${colors.bg} box-border`}
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  width: `${item.w}px`,
                  height: `${item.h}px`,
                }}
              >
                {isTiny ? (
                  <span className="font-black text-[9px] text-white leading-none">
                    {stock.symbol}
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-1 leading-none">
                      <span className="font-black text-xs sm:text-sm text-white drop-shadow-sm">
                        {stock.symbol}
                      </span>
                      {colors.label && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-black bg-white/20 text-white">
                          {colors.label}
                        </span>
                      )}
                    </div>

                    {!isSmall && (
                      <span className="text-[10px] font-bold text-white/90 mt-0.5">
                        {stock.changePercent > 0 ? `+${stock.changePercent}%` : `${stock.changePercent}%`}
                      </span>
                    )}

                    {item.w > 70 && item.h > 52 && (
                      <span className="text-[9px] text-white/70 mt-0.5">
                        {(stock.price / 1000).toFixed(2)}k
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}

        {/* ── High-Resolution Hover Tooltip ── */}
        {hoveredStock && (
          <div
            className="absolute z-50 pointer-events-none p-3 rounded-xl bg-zinc-950/98 border border-zinc-700/80 shadow-2xl backdrop-blur-xl w-60 animate-in fade-in duration-75"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
              <div>
                <span className="font-black text-sm text-zinc-100">{hoveredStock.symbol}</span>
                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 text-zinc-400">
                  {hoveredStock.exchange}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">
                {hoveredStock.sector}
              </span>
            </div>

            <p className="text-[10px] text-zinc-300 font-sans line-clamp-1 mb-2">
              {hoveredStock.name}
            </p>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Giá khớp:</span>
                <span className="font-black text-zinc-100">
                  {hoveredStock.price.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Thay đổi:</span>
                <span
                  className={`font-bold ${
                    hoveredStock.changePercent > 0
                      ? 'text-emerald-400'
                      : hoveredStock.changePercent < 0
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {hoveredStock.change > 0 ? `+${hoveredStock.change}` : hoveredStock.change} đ (
                  {hoveredStock.changePercent > 0
                    ? `+${hoveredStock.changePercent}%`
                    : `${hoveredStock.changePercent}%`}
                  )
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Khối lượng:</span>
                <span className="font-bold text-zinc-200">
                  {hoveredStock.volume.toLocaleString('vi-VN')} CP
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Vốn hóa:</span>
                <span className="font-bold text-zinc-200">{hoveredStock.mktCapT} nghìn tỷ</span>
              </div>

              {hoveredStock.rsRating && (
                <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
                  <span className="text-zinc-400">RS Rating:</span>
                  <span className="font-bold text-amber-400">{hoveredStock.rsRating}/99</span>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-zinc-800/80 text-center text-[9px] text-emerald-400 font-bold">
              ⚡ Click để mở Chart & Sổ Lệnh realtime
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Legend (Chuẩn màu HOSE & HNX) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-950/70 border border-zinc-800/60 rounded-xl text-[10px] text-zinc-400">
        <span className="font-bold text-zinc-300">Quy ước màu:</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-500 border border-purple-400" />
            <span>Trần (+7% / +10%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#15803d]" />
            <span>Tăng mạnh (&gt; +3%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#166534]" />
            <span>Tăng (&gt; 0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#854d0e]" />
            <span>Tham chiếu (0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#991b1b]" />
            <span>Giảm (&lt; 0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#b91c1c]" />
            <span>Giảm mạnh (&lt; -3%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500 border border-cyan-400" />
            <span>Sàn (-7% / -10%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
