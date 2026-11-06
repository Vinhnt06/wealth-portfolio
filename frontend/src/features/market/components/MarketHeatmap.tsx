'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMarketStore } from '../store/marketStore';
import { TickData } from '../types/dnse.types';
import {
  Flame,
  SlidersHorizontal,
  MagnifyingGlass,
  ArrowsClockwise,
  Globe,
  SquaresFour,
  ArrowLeft,
  TrendUp,
  Buildings,
  CaretRight,
} from '@phosphor-icons/react';

export interface SectorSummary {
  name: string;
  stocks: HeatmapStock[];
  totalStocks: number;
  advances: number;
  declines: number;
  unchanged: number;
  ceilings: number;
  floors: number;
  totalMktCap: number; // nghìn tỷ VNĐ
  totalVolume: number; // CP
  totalValueB: number; // tỷ VNĐ
  weightedChange: number; // %
  avgChange: number; // %
  topGainers: HeatmapStock[];
  leaders: HeatmapStock[];
}

export interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  price: number;
  refPrice?: number;
  ceiling?: number;
  floor?: number;
  change: number;
  changePercent: number;
  volume: number;
  high?: number;
  low?: number;
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

import { SECTOR_MAPPING } from '../data/sectorMapping';

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

// Nhãn nguồn dữ liệu hiển thị trên header để biết realtime hay dữ liệu cũ
const SOURCE_LABELS: Record<string, string> = {
  vietcap: 'Vietcap Live',
  ssi_iboard: 'SSI iBoard',
  stale: 'Cache cũ • đang thử lại',
  snapshot: 'Ảnh chụp cuối phiên',
};

export const MarketHeatmap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 1100, height: 600 });
  const [rawStocks, setRawStocks] = useState<HeatmapStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'VN30' | 'HOSE' | 'HNX'>('ALL');
  const [heatmapMode, setHeatmapMode] = useState<'market' | 'sector'>('market');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sizeMetric, setSizeMetric] = useState<'mktCap' | 'volume'>('mktCap');
  const [groupBySector, setGroupBySector] = useState(true);
  const [hoveredStock, setHoveredStock] = useState<HeatmapStock | null>(null);
  const [hoveredSector, setHoveredSector] = useState<SectorSummary | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [searchFilter, setSearchFilter] = useState('');

  const { ticks, wsStatus, setSelectedSymbol, updateTicks, setViewMode } = useMarketStore();
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');
  const [isStale, setIsStale] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevPricesRef = useRef<Record<string, number>>({});
  // snapshot giá + khối lượng lần poll trước, chỉ push tick khi có gì đó đổi
  const prevSnapshotRef = useRef<Record<string, { price: number; volume: number }>>({});

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

  // Load verified market universe (700+ equities from realtime market board)
  const fetchHeatmapData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/market/heatmap', { cache: 'no-store' });
      const resData = await res.json();
      if (resData.success && Array.isArray(resData.data)) {
        const newFlashes: Record<string, 'up' | 'down'> = {};
        let hasFlashes = false;
        const changedTicks: TickData[] = [];

        resData.data.forEach((s: HeatmapStock) => {
          const prev = prevPricesRef.current[s.symbol];
          if (prev !== undefined && s.price !== prev) {
            newFlashes[s.symbol] = s.price > prev ? 'up' : 'down';
            hasFlashes = true;
          }
          prevPricesRef.current[s.symbol] = s.price;

          const prevSnap = prevSnapshotRef.current[s.symbol];
          if (prevSnap && prevSnap.price === s.price && prevSnap.volume === s.volume) return;
          prevSnapshotRef.current[s.symbol] = { price: s.price, volume: s.volume };

          // Propagate live price to global store for active stocks
          if (s.volume > 0 || s.price > 0) {
            changedTicks.push({
              symbol: s.symbol,
              price: s.price,
              change: s.change,
              changePercent: s.changePercent,
              volume: Math.floor(s.volume / 10),
              totalVolume: s.volume,
              high: s.high || s.price,
              low: s.low || s.price,
              open: s.price - s.change,
              referencePrice: s.price - s.change,
              ceilingPrice: s.ceiling || Math.round((s.price - s.change) * 1.07),
              floorPrice: s.floor || Math.round((s.price - s.change) * 0.93),
              timestamp: Date.now(),
              matchType: s.change >= 0 ? 'B' : 'S',
            });
          }
        });

        // 1 lần set() cho toàn bộ thay đổi thay vì 700+ lần re-render
        if (changedTicks.length > 0) updateTicks(changedTicks);

        if (hasFlashes) {
          setFlashMap((prev) => ({ ...prev, ...newFlashes }));
          setTimeout(() => setFlashMap({}), 700);
        }

        setRawStocks(resData.data);
        setDataSource(resData.source || (resData.isFallback ? 'snapshot' : ''));
        setIsStale(Boolean(resData.stale));
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu Heatmap realtime:', err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [updateTicks]);

  useEffect(() => {
    fetchHeatmapData();

    // Auto-polling every 4 seconds, tạm dừng khi tab ẩn để không đốt quota serverless
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (!document.hidden) fetchHeatmapData();
      }, 4000);
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
        fetchHeatmapData();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchHeatmapData]);

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const clientW = containerRef.current.clientWidth;
        const w = clientW > 0 ? clientW : (typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 64) : 1100);
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

  // Market Breadth Statistics (Realtime counts for Stocks)
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

  // Realtime Sector Aggregation (100% computed from verified stocks)
  const sectorSummaries = useMemo<SectorSummary[]>(() => {
    const groups: Record<string, HeatmapStock[]> = {};
    filteredStocks.forEach((s) => {
      const sec = s.sector || SECTOR_MAPPING[s.symbol] || 'Khác';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(s);
    });

    return Object.entries(groups)
      .map(([name, stocks]) => {
        let advances = 0;
        let declines = 0;
        let unchanged = 0;
        let ceilings = 0;
        let floors = 0;
        let totalMktCap = 0;
        let totalVolume = 0;
        let totalValueB = 0;
        let sumWeightedChange = 0;
        let totalWeightForChange = 0;
        let sumChange = 0;

        stocks.forEach((s) => {
          const pct = s.changePercent;
          const isHnx = s.exchange === 'HNX';
          const ceilLimit = isHnx ? 9.8 : 6.85;
          const floorLimit = isHnx ? -9.8 : -6.85;

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

          const mktCap = s.mktCapT || 0;
          totalMktCap += mktCap;
          totalVolume += s.volume || 0;
          totalValueB += ((s.price || 0) * (s.volume || 0)) / 1_000_000_000;

          const weight = mktCap > 0 ? mktCap : (s.volume > 0 ? Math.sqrt(s.volume) : 1);
          sumWeightedChange += pct * weight;
          totalWeightForChange += weight;
          sumChange += pct;
        });

        const weightedChange =
          totalWeightForChange > 0
            ? Number((sumWeightedChange / totalWeightForChange).toFixed(2))
            : Number((sumChange / (stocks.length || 1)).toFixed(2));

        const avgChange = Number((sumChange / (stocks.length || 1)).toFixed(2));

        const topGainers = [...stocks]
          .filter((s) => s.volume > 0)
          .sort((a, b) => b.changePercent - a.changePercent)
          .slice(0, 3);

        const leaders = [...stocks]
          .sort((a, b) => (b.mktCapT || 0) - (a.mktCapT || 0))
          .slice(0, 3);

        return {
          name,
          stocks,
          totalStocks: stocks.length,
          advances,
          declines,
          unchanged,
          ceilings,
          floors,
          totalMktCap: Math.round(totalMktCap * 10) / 10,
          totalVolume,
          totalValueB: Math.round(totalValueB * 10) / 10,
          weightedChange,
          avgChange,
          topGainers,
          leaders,
        };
      })
      .sort((a, b) => {
        if (sizeMetric === 'volume') return b.totalVolume - a.totalVolume;
        return b.totalMktCap - a.totalMktCap;
      });
  }, [filteredStocks, sizeMetric]);

  // Sector Level Breadth Statistics
  const sectorStats = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let topGainer: SectorSummary | null = null;
    let topValue: SectorSummary | null = null;

    sectorSummaries.forEach((sec) => {
      if (sec.weightedChange > 0.05) advances++;
      else if (sec.weightedChange < -0.05) declines++;
      else unchanged++;

      if (!topGainer || sec.weightedChange > topGainer.weightedChange) {
        topGainer = sec;
      }
      if (!topValue || sec.totalValueB > topValue.totalValueB) {
        topValue = sec;
      }
    });

    return {
      advances,
      declines,
      unchanged,
      totalSectors: sectorSummaries.length,
      topGainer: topGainer as SectorSummary | null,
      topValue: topValue as SectorSummary | null,
    };
  }, [sectorSummaries]);

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

  // Color according to Sector weighted percentage change
  const getSectorColorClasses = (sec: SectorSummary) => {
    const chg = sec.weightedChange;
    // Tăng rất mạnh >= 2.0%
    if (chg >= 2.0) {
      return {
        bg: 'bg-[#15803d]',
        border: 'border-emerald-500/80',
        text: 'text-white',
        tagBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
        glow: 'hover:shadow-[0_0_15px_rgba(16,185,129,0.35)]',
      };
    }
    // Tăng tốt >= 0.5%
    if (chg >= 0.5) {
      return {
        bg: 'bg-[#166534]',
        border: 'border-emerald-600/80',
        text: 'text-white',
        tagBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30',
        glow: 'hover:shadow-[0_0_15px_rgba(22,101,52,0.35)]',
      };
    }
    // Tăng nhẹ > 0.05%
    if (chg > 0.05) {
      return {
        bg: 'bg-[#14532d]',
        border: 'border-emerald-700/80',
        text: 'text-white',
        tagBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30',
        glow: 'hover:shadow-[0_0_15px_rgba(20,83,45,0.35)]',
      };
    }
    // Tham chiếu
    if (Math.abs(chg) <= 0.05) {
      return {
        bg: 'bg-[#854d0e]',
        border: 'border-amber-600/80',
        text: 'text-white',
        tagBg: 'bg-amber-950/70 text-amber-300 border-amber-500/30',
        glow: 'hover:shadow-[0_0_15px_rgba(234,179,8,0.35)]',
      };
    }
    // Giảm nhẹ > -0.5%
    if (chg > -0.5) {
      return {
        bg: 'bg-[#7f1d1d]',
        border: 'border-rose-800/80',
        text: 'text-white',
        tagBg: 'bg-rose-950/70 text-rose-300 border-rose-500/30',
        glow: 'hover:shadow-[0_0_15px_rgba(127,29,29,0.35)]',
      };
    }
    // Giảm vừa > -2.0%
    if (chg > -2.0) {
      return {
        bg: 'bg-[#991b1b]',
        border: 'border-rose-700/80',
        text: 'text-white',
        tagBg: 'bg-rose-950/70 text-rose-300 border-rose-500/30',
        glow: 'hover:shadow-[0_0_15px_rgba(153,27,27,0.35)]',
      };
    }
    // Giảm mạnh <= -2.0%
    return {
      bg: 'bg-[#b91c1c]',
      border: 'border-rose-600/80',
      text: 'text-white',
      tagBg: 'bg-rose-950/70 text-rose-300 border-rose-500/30',
      glow: 'hover:shadow-[0_0_15px_rgba(185,28,28,0.35)]',
    };
  };

  // Build the Treemap Layout
  const layout = useMemo(() => {
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0 || filteredStocks.length === 0) {
      return {
        mode: 'empty' as const,
        sectors: [] as Array<PlacedItem<SectorSummary> & { headerHeight: number; children: PlacedItem<HeatmapStock>[] }>,
        flat: [] as PlacedItem<HeatmapStock>[],
        sectorBoxes: [] as PlacedItem<SectorSummary>[],
      };
    }

    // Function to calculate weight per stock item
    const getStockWeight = (s: HeatmapStock) => {
      if (sizeMetric === 'volume') return Math.max(100, Math.sqrt((s.volume || 1) * (s.price || 10000)));
      return Math.max(1, (s.mktCapT || 0) * 10);
    };

    // ── Mode 1: Theo Nhóm Ngành (Industry Sector) ──
    if (heatmapMode === 'sector') {
      // 1A. Drill-down into a specific sector
      if (selectedSector) {
        const targetSec = sectorSummaries.find((s) => s.name === selectedSector);
        const targetStocks = targetSec ? targetSec.stocks : [];
        const items = targetStocks
          .map((s) => ({ ...s, weight: getStockWeight(s) }))
          .sort((a, b) => b.weight - a.weight);

        const placed = squarify(items, { x: 0, y: 0, w: width, h: height });
        return {
          mode: 'sector-drilldown' as const,
          sectors: [],
          flat: placed,
          sectorBoxes: [],
        };
      }

      // 1B. Pure Sector Overview Treemap (Each box is an entire Sector)
      const sectorItems = sectorSummaries.map((sec) => {
        const weight =
          sizeMetric === 'volume'
            ? Math.max(10, Math.sqrt(sec.totalVolume || 100))
            : Math.max(1, (sec.totalMktCap || 1) * 10);
        return { ...sec, weight };
      });

      const placedSectors = squarify(sectorItems, { x: 0, y: 0, w: width, h: height });
      return {
        mode: 'sector-overview' as const,
        sectors: [],
        flat: [],
        sectorBoxes: placedSectors,
      };
    }

    // ── Mode 2: Thị Trường Chung (General Market) ──
    if (!groupBySector) {
      // Flat treemap
      const items = filteredStocks
        .map((s) => ({ ...s, weight: getStockWeight(s) }))
        .sort((a, b) => b.weight - a.weight);

      const placed = squarify(items, { x: 0, y: 0, w: width, h: height });
      return {
        mode: 'market-flat' as const,
        sectors: [],
        flat: placed,
        sectorBoxes: [],
      };
    }

    // Nested Sector layout (Stocks clustered by sector)
    const placedSectors = squarify(
      sectorSummaries.map((sec) => {
        const weight = sec.stocks.reduce((sum, s) => sum + getStockWeight(s), 0);
        return { ...sec, weight };
      }),
      { x: 0, y: 0, w: width, h: height }
    );

    const finalSectors = placedSectors.map((secPlaced) => {
      const headerHeight = secPlaced.h >= 60 && secPlaced.w >= 60 ? 22 : 0;
      const childRect: Rect = {
        x: 0,
        y: headerHeight,
        w: secPlaced.w,
        h: Math.max(0, secPlaced.h - headerHeight),
      };

      const sortedStocks = secPlaced.data.stocks
        .map((s) => ({ ...s, weight: getStockWeight(s) }))
        .sort((a, b) => b.weight - a.weight);

      const placedStocks = squarify(sortedStocks, childRect);

      return {
        ...secPlaced,
        headerHeight,
        children: placedStocks,
      };
    });

    return {
      mode: 'market-nested' as const,
      sectors: finalSectors,
      flat: [],
      sectorBoxes: [],
    };
  }, [dimensions, filteredStocks, heatmapMode, selectedSector, sectorSummaries, sizeMetric, groupBySector]);

  const handleTileClick = (stock: HeatmapStock) => {
    setSelectedSymbol(stock.symbol);
    setViewMode('detail');
  };

  const handleStockMouseMove = (e: React.MouseEvent, stock: HeatmapStock) => {
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
    setHoveredSector(null);
  };

  const handleSectorMouseMove = (e: React.MouseEvent, sector: SectorSummary) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const tooltipWidth = 290;
    const tooltipHeight = 260;
    const x = mouseX + 16 + tooltipWidth > rect.width ? mouseX - tooltipWidth - 12 : mouseX + 16;
    const y = mouseY + 16 + tooltipHeight > rect.height ? mouseY - tooltipHeight - 12 : mouseY + 16;

    setTooltipPos({ x: Math.max(8, x), y: Math.max(8, y) });
    setHoveredSector(sector);
    setHoveredStock(null);
  };

  return (
    <div className="space-y-4 font-mono">
      {/* ── Top Header Controls (TradingView Style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl backdrop-blur-xl shadow-lg">
        {/* Left: Title + Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Flame className="w-4 h-4" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5 leading-none">
                  BẢN ĐỒ NHIỆT (HEATMAP)
                </h3>
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] border ${
                    isStale
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isStale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span>{isStale ? 'DỮ LIỆU CŨ' : 'LIVE REALTIME'}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <span>
                  {(dataSource && SOURCE_LABELS[dataSource]) || dataSource || 'Realtime'} • {rawStocks.length} mã
                </span>
                {lastUpdated && (
                  <span className="text-zinc-500">
                    • Cập nhật: <strong className="text-emerald-400 font-mono">{lastUpdated}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary View Mode Switcher: [Thị Trường Chung] | [Theo Nhóm Ngành] */}
          <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => {
                setHeatmapMode('market');
                setSelectedSector(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                heatmapMode === 'market'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" weight={heatmapMode === 'market' ? 'fill' : 'regular'} />
              <span>Thị Trường Chung</span>
            </button>

            <button
              onClick={() => {
                setHeatmapMode('sector');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                heatmapMode === 'sector'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <SquaresFour className="w-3.5 h-3.5" weight={heatmapMode === 'sector' ? 'fill' : 'regular'} />
              <span>Theo Nhóm Ngành</span>
            </button>
          </div>

          {/* Exchange Filter Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            {(['ALL', 'VN30', 'HOSE', 'HNX'] as const).map((ex) => (
              <button
                key={ex}
                onClick={() => setExchangeFilter(ex)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  exchangeFilter === ex
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
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
            placeholder={heatmapMode === 'sector' && !selectedSector ? "Tìm ngành hoặc mã..." : "Lọc mã CP..."}
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

          {/* Group by Sector toggle (chỉ có trong chế độ Thị Trường Chung) */}
          {heatmapMode === 'market' && (
            <button
              onClick={() => setGroupBySector(!groupBySector)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                groupBySector
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Gom Nhóm</span>
            </button>
          )}

          {/* Manual Refresh button */}
          <button
            onClick={() => fetchHeatmapData(true)}
            disabled={isRefreshing}
            title="Làm mới dữ liệu Realtime"
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-all disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── Sub-bar: Realtime Breadth Breakdown / Sector Breakdown ── */}
      {heatmapMode === 'sector' && !selectedSector ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
          {/* Ngành tăng */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Ngành tăng:</span>
            </div>
            <span className="font-bold text-emerald-400">{sectorStats.advances}</span>
          </div>

          {/* Ngành tham chiếu */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-zinc-400">Tham chiếu:</span>
            </div>
            <span className="font-bold text-amber-400">{sectorStats.unchanged}</span>
          </div>

          {/* Ngành giảm */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-zinc-400">Ngành giảm:</span>
            </div>
            <span className="font-bold text-rose-400">{sectorStats.declines}</span>
          </div>

          {/* Ngành dẫn dắt (Top Gainer) */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between truncate">
            <div className="flex items-center gap-1.5 truncate">
              <TrendUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
              <span className="text-zinc-400 truncate">Dẫn đầu:</span>
            </div>
            {sectorStats.topGainer != null ? (
              <span className="font-bold text-emerald-400 truncate ml-1 text-[10px]">
                {(sectorStats.topGainer as SectorSummary).name} (+{(sectorStats.topGainer as SectorSummary).weightedChange}%)
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </div>

          {/* Ngành hút tiền nhất (Top Value) */}
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between truncate">
            <div className="flex items-center gap-1.5 truncate">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="fill" />
              <span className="text-zinc-400 truncate">Hút tiền:</span>
            </div>
            {sectorStats.topValue != null ? (
              <span className="font-bold text-amber-300 truncate ml-1 text-[10px]">
                {(sectorStats.topValue as SectorSummary).name} (
                {(sectorStats.topValue as SectorSummary).totalValueB >= 1000
                  ? `${((sectorStats.topValue as SectorSummary).totalValueB / 1000).toFixed(1)}k tỷ`
                  : `${(sectorStats.topValue as SectorSummary).totalValueB} tỷ`}
                )
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </div>
        </div>
      ) : heatmapMode === 'sector' && selectedSector ? (
        // Sector Drilldown Header Navigation
        <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedSector(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
              <span>← Trở lại danh sách ngành</span>
            </button>
            <span className="text-zinc-600">/</span>
            <div className="flex items-center gap-1.5 font-bold text-zinc-100">
              <Buildings className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black">{selectedSector}</span>
            </div>
          </div>

          {(() => {
            const currentSec = sectorSummaries.find((s) => s.name === selectedSector);
            if (!currentSec) return null;
            return (
              <div className="flex items-center gap-3 text-zinc-300">
                <span>
                  Tổng số: <strong className="text-zinc-100 font-mono">{currentSec.totalStocks} mã</strong>
                </span>
                <span>•</span>
                <span>
                  Vốn hóa:{' '}
                  <strong className="text-zinc-100 font-mono">
                    {currentSec.totalMktCap.toLocaleString('vi-VN')}k tỷ
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Biến động:{' '}
                  <strong
                    className={`font-mono font-bold ${
                      currentSec.weightedChange > 0
                        ? 'text-emerald-400'
                        : currentSec.weightedChange < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {currentSec.weightedChange > 0 ? `+${currentSec.weightedChange}%` : `${currentSec.weightedChange}%`}
                  </strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <span className="text-emerald-400">{currentSec.advances} Tăng</span> |{' '}
                  <span className="text-amber-400">{currentSec.unchanged} TC</span> |{' '}
                  <span className="text-rose-400">{currentSec.declines} Giảm</span>
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        // Stock Breadth Breakdown
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
      )}

      {/* ── Main Interactive Treemap Container ── */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl bg-[#0a0a0c] border border-zinc-800/80 shadow-2xl overflow-hidden select-none"
        style={{ height: `${dimensions.height}px` }}
        onMouseLeave={() => {
          setHoveredStock(null);
          setHoveredSector(null);
        }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 backdrop-blur-sm z-20">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-xs text-zinc-400 font-mono">Đang tải bản đồ nhiệt thị trường...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
            Không tìm thấy dữ liệu phù hợp bộ lọc
          </div>
        ) : layout.mode === 'sector-overview' ? (
          // ── Render Pure Sector Treemap (Mỗi ô là 1 Nhóm Ngành) ──
          layout.sectorBoxes.map((box) => {
            const sec = box.data;
            const colors = getSectorColorClasses(sec);
            const canShowName = box.w >= 48 && box.h >= 32;
            const canShowChange = box.w >= 68 && box.h >= 48;
            const canShowStats = box.w >= 96 && box.h >= 68;
            const canShowLeaders = box.w >= 140 && box.h >= 96;

            const totalAdv = sec.advances;
            const totalDec = sec.declines;
            const totalUnc = sec.unchanged;
            const totalAll = sec.totalStocks || 1;
            const pctAdv = (totalAdv / totalAll) * 100;
            const pctUnc = (totalUnc / totalAll) * 100;
            const pctDec = (totalDec / totalAll) * 100;

            return (
              <div
                key={sec.name}
                onClick={() => setSelectedSector(sec.name)}
                onMouseMove={(e) => handleSectorMouseMove(e, sec)}
                className={`absolute flex flex-col justify-between p-2 cursor-pointer border border-black/60 transition-all ${colors.bg} ${colors.glow} hover:z-20 hover:scale-[1.006] box-border overflow-hidden select-none group`}
                style={{
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${box.w}px`,
                  height: `${box.h}px`,
                }}
                title={`${sec.name}: ${sec.weightedChange > 0 ? '+' : ''}${sec.weightedChange}% (Click để xem toàn bộ ${sec.totalStocks} mã)`}
              >
                {canShowName && (
                  <div className="flex items-start justify-between gap-1 w-full leading-tight">
                    <span className={`font-black text-white drop-shadow-sm truncate ${canShowChange ? 'text-xs sm:text-sm' : 'text-[10px]'}`}>
                      {sec.name}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/90 shrink-0">
                      <CaretRight className="w-3.5 h-3.5" weight="bold" />
                    </span>
                  </div>
                )}

                {canShowChange && (
                  <div className="my-auto flex flex-col items-center justify-center text-center">
                    <div className={`font-black tracking-tight drop-shadow-md text-white ${canShowStats ? 'text-base sm:text-xl' : 'text-xs sm:text-sm'}`}>
                      {sec.weightedChange > 0 ? `+${sec.weightedChange}%` : `${sec.weightedChange}%`}
                    </div>
                    {canShowStats && (
                      <div className="text-[10px] text-white/80 font-mono mt-0.5">
                        {sizeMetric === 'volume'
                          ? `${(sec.totalVolume / 1_000_000).toFixed(1)}M CP`
                          : `${sec.totalMktCap.toLocaleString('vi-VN')}k tỷ`}
                      </div>
                    )}
                  </div>
                )}

                {canShowStats && (
                  <div className="w-full space-y-1 mt-auto">
                    {/* Mini breadth proportion bar */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-black/40">
                      <div style={{ width: `${pctAdv}%` }} className="h-full bg-emerald-400" title={`Tăng: ${totalAdv}`} />
                      <div style={{ width: `${pctUnc}%` }} className="h-full bg-amber-400" title={`Đứng giá: ${totalUnc}`} />
                      <div style={{ width: `${pctDec}%` }} className="h-full bg-rose-500" title={`Giảm: ${totalDec}`} />
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-white/90 font-medium">
                      <span>{sec.totalStocks} mã</span>
                      <span className="flex items-center gap-1 font-mono">
                        <span className="text-emerald-300">{totalAdv}▲</span>
                        <span className="text-amber-200">{totalUnc}■</span>
                        <span className="text-rose-300">{totalDec}▼</span>
                      </span>
                    </div>

                    {canShowLeaders && sec.leaders.length > 0 && (
                      <div className="pt-1 border-t border-white/20 text-[9px] text-white/85 truncate">
                        {sec.leaders.map((l) => `${l.symbol} ${l.changePercent > 0 ? '+' : ''}${l.changePercent}%`).join(' • ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : layout.mode === 'market-nested' ? (
          // ── Render Hierarchical Sector Treemap ──
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
                  onClick={() => {
                    setHeatmapMode('sector');
                    setSelectedSector(sec.data.name);
                  }}
                  className="flex items-center justify-between px-2 bg-zinc-900/95 hover:bg-zinc-800/95 border-b border-zinc-800 text-[10px] text-zinc-400 font-bold overflow-hidden whitespace-nowrap select-none cursor-pointer transition-colors"
                  style={{ height: `${sec.headerHeight}px` }}
                  title="Click để phóng to riêng nhóm ngành này"
                >
                  <span className="truncate hover:text-zinc-100 flex items-center gap-1">
                    {sec.data.name} <CaretRight className="w-2.5 h-2.5" />
                  </span>
                  <span
                    className={`ml-2 shrink-0 ${
                      sec.data.weightedChange > 0
                        ? 'text-emerald-400'
                        : sec.data.weightedChange < 0
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {sec.data.weightedChange > 0 ? `+${sec.data.weightedChange}%` : `${sec.data.weightedChange}%`}
                  </span>
                </div>
              )}

              {/* Stock Tiles in this sector */}
              {sec.children.map((child) => {
                const stock = child.data;
                const colors = getColorClasses(stock);
                const canShowSymbol = child.w >= 38 && child.h >= 26;
                const canShowChange = child.w >= 54 && child.h >= 36;
                const canShowPrice = child.w >= 75 && child.h >= 52;
                const flash = flashMap[stock.symbol];

                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleTileClick(stock)}
                    onMouseMove={(e) => handleStockMouseMove(e, stock)}
                    title={`${stock.symbol}: ${stock.changePercent > 0 ? '+' : ''}${stock.changePercent}%`}
                    className={`absolute flex flex-col items-center justify-center p-0.5 cursor-pointer border border-black/50 transition-all ${
                      flash === 'up'
                        ? 'ring-2 ring-emerald-400 z-30 brightness-125 scale-[1.01]'
                        : flash === 'down'
                        ? 'ring-2 ring-rose-400 z-30 brightness-125 scale-[1.01]'
                        : 'hover:opacity-90'
                    } ${colors.bg} box-border overflow-hidden`}
                    style={{
                      left: `${child.x}px`,
                      top: `${child.y}px`,
                      width: `${child.w}px`,
                      height: `${child.h}px`,
                    }}
                  >
                    {canShowSymbol && (
                      <>
                        <div className="flex items-center gap-1 leading-none">
                          <span className={`font-black text-white drop-shadow-sm ${canShowChange ? 'text-xs sm:text-sm' : 'text-[10px]'}`}>
                            {stock.symbol}
                          </span>
                          {colors.label && child.w >= 65 && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-black bg-white/20 text-white">
                              {colors.label}
                            </span>
                          )}
                        </div>

                        {canShowChange && (
                          <span className="text-[10px] font-bold text-white/90 mt-0.5 leading-none">
                            {stock.changePercent > 0 ? `+${stock.changePercent}%` : `${stock.changePercent}%`}
                          </span>
                        )}

                        {canShowPrice && (
                          <span className="text-[9px] text-white/70 mt-0.5 leading-none">
                            {(stock.price / 1000).toFixed(2)}
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
          // ── Render Flat Treemap (or Sector Drilldown) ──
          layout.flat.map((item) => {
            const stock = item.data;
            const colors = getColorClasses(stock);
            const canShowSymbol = item.w >= 38 && item.h >= 26;
            const canShowChange = item.w >= 54 && item.h >= 36;
            const canShowPrice = item.w >= 75 && item.h >= 52;
            const flash = flashMap[stock.symbol];

            return (
              <div
                key={stock.symbol}
                onClick={() => handleTileClick(stock)}
                onMouseMove={(e) => handleStockMouseMove(e, stock)}
                title={`${stock.symbol}: ${stock.changePercent > 0 ? '+' : ''}${stock.changePercent}%`}
                className={`absolute flex flex-col items-center justify-center p-0.5 cursor-pointer border border-black/50 transition-all ${
                  flash === 'up'
                    ? 'ring-2 ring-emerald-400 z-30 brightness-125 scale-[1.01]'
                    : flash === 'down'
                    ? 'ring-2 ring-rose-400 z-30 brightness-125 scale-[1.01]'
                    : 'hover:opacity-90'
                } ${colors.bg} box-border overflow-hidden`}
                style={{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  width: `${item.w}px`,
                  height: `${item.h}px`,
                }}
              >
                {canShowSymbol && (
                  <>
                    <div className="flex items-center gap-1 leading-none">
                      <span className={`font-black text-white drop-shadow-sm ${canShowChange ? 'text-xs sm:text-sm' : 'text-[10px]'}`}>
                        {stock.symbol}
                      </span>
                      {colors.label && item.w >= 65 && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-black bg-white/20 text-white">
                          {colors.label}
                        </span>
                      )}
                    </div>

                    {canShowChange && (
                      <span className="text-[10px] font-bold text-white/90 mt-0.5 leading-none">
                        {stock.changePercent > 0 ? `+${stock.changePercent}%` : `${stock.changePercent}%`}
                      </span>
                    )}

                    {canShowPrice && (
                      <span className="text-[9px] text-white/70 mt-0.5 leading-none">
                        {(stock.price / 1000).toFixed(2)}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}

        {/* ── High-Resolution Hover Tooltip: Stock Level ── */}
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

        {/* ── High-Resolution Hover Tooltip: Sector Level ── */}
        {hoveredSector && (
          <div
            className="absolute z-50 pointer-events-none p-3.5 rounded-xl bg-zinc-950/98 border border-zinc-700/80 shadow-2xl backdrop-blur-xl w-72 animate-in fade-in duration-75"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Buildings className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-sm text-zinc-100">{hoveredSector.name}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800 text-zinc-300 font-bold">
                {hoveredSector.totalStocks} mã CP
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Biến động (trọng số):</span>
                <span
                  className={`font-black text-xs ${
                    hoveredSector.weightedChange > 0
                      ? 'text-emerald-400'
                      : hoveredSector.weightedChange < 0
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {hoveredSector.weightedChange > 0 ? `+${hoveredSector.weightedChange}%` : `${hoveredSector.weightedChange}%`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Biến động (bình quân):</span>
                <span
                  className={`font-medium ${
                    hoveredSector.avgChange > 0
                      ? 'text-emerald-400'
                      : hoveredSector.avgChange < 0
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {hoveredSector.avgChange > 0 ? `+${hoveredSector.avgChange}%` : `${hoveredSector.avgChange}%`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Tổng vốn hóa:</span>
                <span className="font-bold text-zinc-100">
                  {hoveredSector.totalMktCap.toLocaleString('vi-VN')} nghìn tỷ
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">GTGD ước tính:</span>
                <span className="font-bold text-emerald-400">
                  {hoveredSector.totalValueB >= 1000
                    ? `${(hoveredSector.totalValueB / 1000).toFixed(2)}k tỷ`
                    : `${hoveredSector.totalValueB.toLocaleString('vi-VN')} tỷ`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Tổng khối lượng:</span>
                <span className="font-bold text-zinc-200">
                  {hoveredSector.totalVolume.toLocaleString('vi-VN')} CP
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-zinc-400 text-[10px]">Độ rộng ngành:</span>
                  <span className="text-[10px] text-zinc-300 font-bold">
                    <span className="text-emerald-400">{hoveredSector.advances} Tăng</span> (
                    <span className="text-purple-400">{hoveredSector.ceilings} Trần</span>) •{' '}
                    <span className="text-amber-400">{hoveredSector.unchanged} TC</span> •{' '}
                    <span className="text-rose-400">{hoveredSector.declines} Giảm</span> (
                    <span className="text-cyan-400">{hoveredSector.floors} Sàn</span>)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-zinc-800">
                  <div
                    style={{ width: `${(hoveredSector.advances / (hoveredSector.totalStocks || 1)) * 100}%` }}
                    className="h-full bg-emerald-500"
                  />
                  <div
                    style={{ width: `${(hoveredSector.unchanged / (hoveredSector.totalStocks || 1)) * 100}%` }}
                    className="h-full bg-amber-400"
                  />
                  <div
                    style={{ width: `${(hoveredSector.declines / (hoveredSector.totalStocks || 1)) * 100}%` }}
                    className="h-full bg-rose-500"
                  />
                </div>
              </div>

              {hoveredSector.leaders.length > 0 && (
                <div className="pt-2 border-t border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold">Cổ phiếu tiêu biểu:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {hoveredSector.leaders.map((lead) => (
                      <div key={lead.symbol} className="p-1 rounded bg-zinc-900 border border-zinc-800 text-center">
                        <div className="font-black text-zinc-200 text-[10px]">{lead.symbol}</div>
                        <div
                          className={`text-[9px] font-bold ${
                            lead.changePercent > 0
                              ? 'text-emerald-400'
                              : lead.changePercent < 0
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {lead.changePercent > 0 ? `+${lead.changePercent}%` : `${lead.changePercent}%`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-zinc-800/80 text-center text-[9px] text-emerald-400 font-bold">
              ⚡ Click vào ô để phóng to xem chi tiết các mã trong ngành
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Legend ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-950/70 border border-zinc-800/60 rounded-xl text-[10px] text-zinc-400">
        <span className="font-bold text-zinc-300">
          {heatmapMode === 'sector' && !selectedSector ? 'Quy ước màu Nhóm Ngành:' : 'Quy ước màu Cổ Phiếu:'}
        </span>
        {heatmapMode === 'sector' && !selectedSector ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#15803d]" />
              <span>Tăng mạnh (&gt;= +2%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#166534]" />
              <span>Tăng (+0.5% .. +2%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#14532d]" />
              <span>Tăng nhẹ (&gt; 0%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#854d0e]" />
              <span>Tham chiếu (0%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#7f1d1d]" />
              <span>Giảm nhẹ (&lt; 0%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#991b1b]" />
              <span>Giảm (-0.5% .. -2%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#b91c1c]" />
              <span>Giảm mạnh (&lt;= -2%)</span>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
