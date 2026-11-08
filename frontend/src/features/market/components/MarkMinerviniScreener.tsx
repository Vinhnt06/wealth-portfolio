'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkle,
  TrendUp,
  TrendDown,
  Funnel,
  ArrowClockwise,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  ChartLineUp,
  Coins,
  Gauge,
  Tag,
  ArrowRight,
  ShieldCheck,
  Flame,
  Buildings,
  Compass,
  CaretUp,
  CaretDown,
  CaretUpDown,
  SquaresFour,
  Table as TableIcon,
  X,
  Warning,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { useDnseWebSocket } from '../hooks/useDnseWebSocket';
import { MinerviniScreenerItem } from '../types/minervini.types';
import {
  evaluateMinerviniCriteria,
  calcMarketCapT,
  MINERVINI_8_CRITERIA_META,
} from '../utils/minerviniEvaluator';
import { getStockPriceColor } from '../utils/priceColors';
import { SECTOR_MAPPING, ICB_20_SECTORS } from '../data/sectorMapping';
import { EconomicCycleWheel } from './EconomicCycleWheel';
import { isMarketTradingSession } from '../utils/marketHours';
import financialsDatabase from '../data/financialsDatabase.json';

const finMap = (financialsDatabase as any)?.data || {};

type ScreenerTab = 'overview' | 'performance' | 'technicals' | 'valuation';
type ViewMode = 'table' | 'sectors' | 'cycle';
type SectorSortOption = 'rs' | 'change' | 'stage2' | 'name';

export const MarkMinerviniScreener: React.FC = () => {
  const { setSelectedSymbol, setViewMode } = useMarketStore();
  const ticks = useMarketStore((state) => state.ticks);
  const wsStatus = useMarketStore((state) => state.wsStatus);

  const [items, setItems] = useState<MinerviniScreenerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingOnDemand, setIsSearchingOnDemand] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ScreenerTab>('overview');
  const [mainViewMode, setMainViewMode] = useState<ViewMode>('table');
  const [sectorSortBy, setSectorSortBy] = useState<SectorSortOption>('rs');

  // Filter states (Mặc định chống thao túng TTCK Việt Nam: KL TB 20N >= 100.000 CP & Vốn hóa thực tế >= 1.000 Tỷ VNĐ)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedExchange, setSelectedExchange] = useState<string>('all');
  const [minAvgVol20, setMinAvgVol20] = useState<number>(100000);
  const [minMktCapT, setMinMktCapT] = useState<number>(1000);
  const [volSignalFilter, setVolSignalFilter] = useState<string>('all');
  const [minRs, setMinRs] = useState<number>(70);
  const [minScore, setMinScore] = useState<number>(7);
  const [onlyStage2, setOnlyStage2] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Sorting state (Auto-sorts dynamically when clicked)
  const [sortKey, setSortKey] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [scanFeedback, setScanFeedback] = useState<{
    symbol: string;
    type: 'success' | 'warning' | 'error';
    message: string;
    score?: number;
    rsRating?: number;
    isStage2?: boolean;
  } | null>(null);

  const [scanMeta, setScanMeta] = useState<{
    scannedAt?: number;
    scannedAtText?: string;
    session?: string;
    sessionLabel?: string;
    stage2Count?: number;
    leadersCount?: number;
    source?: string;
  } | null>(null);

  const fetchScreenerData = async (forceRefresh = false, isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    }
    try {
      const url = forceRefresh
        ? '/api/market/minervini/screener?stage2=false&minRS=1&refresh=true'
        : '/api/market/minervini/screener?stage2=false&minRS=1';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        let enrichedItems = data.data.map((it: MinerviniScreenerItem) => ({
          ...it,
          sector: SECTOR_MAPPING[it.symbol] || it.sector || 'Khác',
        }));

        // Restore and merge custom scanned symbols from localStorage (chỉ giữ các mã đạt chuẩn KL >= 100K & Vốn hóa >= 1.000 Tỷ)
        try {
          if (typeof window !== 'undefined') {
            const saved: string[] = JSON.parse(localStorage.getItem('yourfin_minervini_custom_scans') || '[]');
            if (Array.isArray(saved) && saved.length > 0) {
              const missing = saved.filter((s) => !enrichedItems.some((it: any) => it.symbol === s));
              if (missing.length > 0) {
                const customRes = await fetch(`/api/market/minervini/screener?symbols=${missing.join(',')}`);
                const customData = await customRes.json();
                if (customData.success && Array.isArray(customData.data)) {
                  const extraItems = customData.data
                    .map((it: MinerviniScreenerItem) => ({
                      ...it,
                      sector: SECTOR_MAPPING[it.symbol] || it.sector || 'Khác',
                    }))
                    .filter(
                      (it: MinerviniScreenerItem) =>
                        it.isVnLiquidStandard && (it.avgVol20 ?? 0) >= 100000 && (it.mktCapT ?? 0) >= 1000
                    );
                  enrichedItems = [...extraItems, ...enrichedItems];
                  const validSavedSymbols = saved.filter((s) =>
                    enrichedItems.some((it: any) => it.symbol === s && (it.avgVol20 ?? 0) >= 100000 && (it.mktCapT ?? 0) >= 1000)
                  );
                  localStorage.setItem('yourfin_minervini_custom_scans', JSON.stringify(validSavedSymbols));
                }
              }
            }
          }
        } catch {}

        setItems(enrichedItems);
        if (data.scanMeta) {
          setScanMeta(data.scanMeta);
        }
        setLastUpdated(
          new Date().toLocaleTimeString('vi-VN', {
            hour12: false,
            timeZone: 'Asia/Ho_Chi_Minh',
          }) + ' (SSI Live)'
        );
      }
    } catch (err) {
      console.error('Failed to fetch Minervini screener:', err);
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchScreenerData();
    // Auto-refresh realtime market data from SSI every 10 seconds during trading sessions
    const interval = setInterval(() => {
      fetchScreenerData(false, true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Explicit Manual Scan and Validation for Any Custom Symbol
  const handleScanCustomSymbol = async (symbolOverride?: string) => {
    const sym = (symbolOverride || searchQuery).trim().toUpperCase();
    if (!sym || sym.length !== 3 || !/^[A-Z0-9]{3}$/.test(sym)) {
      setScanFeedback({
        symbol: sym || '---',
        type: 'warning',
        message: 'Vui lòng nhập đúng mã cổ phiếu gồm 3 ký tự (Ví dụ: ABB, MSR, VND, DIG).',
      });
      return;
    }

    setIsSearchingOnDemand(true);
    setScanFeedback(null);
    try {
      const res = await fetch(`/api/market/minervini/screener?symbols=${sym}`);
      const resData = await res.json();
      if (resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
        const raw = resData.data[0];
        const newItem: MinerviniScreenerItem = {
          ...raw,
          sector: SECTOR_MAPPING[sym] || raw.sector || 'Khác',
        };
        const passesLiquidityAndCap =
          Boolean(newItem.isVnLiquidStandard) &&
          (newItem.avgVol20 ?? 0) >= 100000 &&
          (newItem.mktCapT ?? 0) >= 1000;

        if (passesLiquidityAndCap) {
          setItems((prev) => {
            const without = prev.filter((p) => p.symbol !== sym);
            return [newItem, ...without];
          });
          setSearchQuery(sym);

          // Chỉ lưu vào bộ lọc đối với cổ phiếu đạt chuẩn KL TB >= 100K & Vốn hóa >= 1.000 Tỷ
          try {
            if (typeof window !== 'undefined') {
              const saved: string[] = JSON.parse(localStorage.getItem('yourfin_minervini_custom_scans') || '[]');
              if (!saved.includes(sym)) {
                localStorage.setItem('yourfin_minervini_custom_scans', JSON.stringify([...saved, sym]));
              }
            }
          } catch {}
        }

        if (!passesLiquidityAndCap) {
          const avgVolK = Math.round(((newItem.avgVol20 ?? newItem.volume ?? 0) / 1000) * 10) / 10;
          setScanFeedback({
            symbol: sym,
            type: 'warning',
            score: newItem.criteriaPassed,
            rsRating: newItem.rsRating,
            isStage2: false,
            message: `🚫 LOẠI KHỎI BỘ LỌC CHỐNG THAO TÚNG — Mã [${sym}] có KL TB 20N = ${avgVolK}K CP (Hôm nay: ${(newItem.volume || 0).toLocaleString('vi-VN')} CP) và Vốn hóa = ${(newItem.mktCapT || 0).toLocaleString('vi-VN')} Tỷ VNĐ. Yêu cầu tối thiểu: KL TB >= 100.000 CP duy trì đều & Vốn hóa >= 1.000 Tỷ VNĐ (Điểm kỹ thuật tham khảo: ${newItem.criteriaPassed}/8, RS ${newItem.rsRating}).`,
          });
        } else if (newItem.isStage2Eligible) {
          setScanFeedback({
            symbol: sym,
            type: 'success',
            score: newItem.criteriaPassed,
            rsRating: newItem.rsRating,
            isStage2: true,
            message: `🎉 ĐẠT CHUẨN STAGE 2 (8/8) — Nhóm ngành [${newItem.sector}]: Cổ phiếu [${sym}] đạt 8/8 tiêu chí Trend Template, RS Rating: ${newItem.rsRating}/99, KL TB 20N: ${Math.round((newItem.avgVol20 || 0) / 1000)}K CP, Vốn hóa: ${(newItem.mktCapT || 0).toLocaleString('vi-VN')} Tỷ.`,
          });
        } else {
          const failedText =
            Array.isArray(newItem.failedCriteria) && newItem.failedCriteria.length > 0
              ? ` | Thiếu: ${newItem.failedCriteria.join(', ')}`
              : '';
          setScanFeedback({
            symbol: sym,
            type: 'warning',
            score: newItem.criteriaPassed,
            rsRating: newItem.rsRating,
            isStage2: false,
            message: `⚠️ CHƯA ĐẠT STAGE 2 (${newItem.criteriaPassed}/8) — Nhóm ngành [${newItem.sector}]: Cổ phiếu [${sym}] đạt ${newItem.criteriaPassed}/8 tiêu chí, RS Rating: ${newItem.rsRating}/99${failedText}.`,
          });
        }
      } else {
        setScanFeedback({
          symbol: sym,
          type: 'error',
          message: `Không tìm thấy dữ liệu giao dịch cho mã [${sym}] trên sàn HOSE/HNX/UPCoM. Vui lòng kiểm tra lại mã.`,
        });
      }
    } catch (err: any) {
      setScanFeedback({
        symbol: sym,
        type: 'error',
        message: `Lỗi khi quét mã [${sym}]: ${err.message || 'Không thể kết nối API'}`,
      });
    } finally {
      setIsSearchingOnDemand(false);
    }
  };

  // Dynamic On-Demand Auto-Scan for custom searched symbols when typing 3 characters
  useEffect(() => {
    const sym = searchQuery.trim().toUpperCase();
    if (sym.length === 3 && /^[A-Z0-9]{3}$/.test(sym)) {
      const exists = items.some((it) => it.symbol === sym);
      if (!exists) {
        handleScanCustomSymbol(sym);
      }
    }
  }, [searchQuery]);

  // Distinct sectors: use canonical 20 ICB sectors order
  const sectors = useMemo(() => {
    return Array.from(ICB_20_SECTORS);
  }, []);

  // Realtime subscription for top active stocks in the screener table via DNSE WebSocket (capped at 120 to avoid socket flood across 1,290 symbols)
  const screenerSymbols = useMemo(() => {
    return items
      .filter((it) => (it.criteriaPassed ?? it.score ?? 0) >= 7 || it.rsRating >= 85)
      .slice(0, 120)
      .map((it) => it.symbol);
  }, [items]);

  useDnseWebSocket(screenerSymbols.length > 0 ? screenerSymbols : undefined);

  // Live merge of real-time trade ticks & audited Vietcap financials
  const liveEnrichedItems = useMemo(() => {
    return items.map((item) => {
      const sym = item.symbol.toUpperCase();
      const live = ticks[sym];
      const fin = finMap[sym];

      const isOutside = !isMarketTradingSession();
      const currentPrice = live && live.price > 0 ? live.price : item.price;
      // Ngoài phiên (15:05 -> 08:30 sáng hôm sau): giữ nguyên mức thay đổi chốt phiên nếu tick nhận được là 0% do CTCK chốt sổ
      const currentChangePct =
        isOutside && (live?.changePercent === 0 || live?.changePercent === undefined) && item.changePct !== 0
          ? item.changePct
          : (live && live.changePercent !== undefined && !isNaN(live.changePercent)
              ? live.changePercent
              : item.changePct);
      const currentVolume =
        live && (live.totalVolume || live.volume)
          ? live.totalVolume || live.volume
          : item.volume;

      // Deterministic re-evaluation of all 8 Mark Minervini Trend Template criteria with live price
      const livePriceK = currentPrice / 1000;
      let criteriaPassed: number =
        typeof item.criteriaPassed === 'number'
          ? item.criteriaPassed
          : typeof item.score === 'number'
          ? item.score
          : 0;
      let failedCriteria = item.failedCriteria || [];
      let distHigh = item.distHigh;
      let distLow = item.distLow;
      let pctFrom52WHigh = item.pctFrom52WHigh;
      let pctAbove52WLow = item.pctAbove52WLow;

      if (item.sma50 && item.sma150 && item.sma200 && livePriceK > 0) {
        const sma200SlopeUp =
          typeof item.sma200SlopeUp === 'boolean'
            ? item.sma200SlopeUp
            : item.sma200Past
            ? item.sma200 > item.sma200Past
            : item.sma150 > item.sma200;

        const evalResult = evaluateMinerviniCriteria({
          priceK: livePriceK,
          sma50: item.sma50,
          sma150: item.sma150,
          sma200: item.sma200,
          sma200SlopeUp,
          high52W: item.high52W,
          low52W: item.low52W,
          distHigh: item.distHigh,
          distLow: item.distLow,
          rsRating: item.rsRating,
        });

        criteriaPassed = evalResult.criteriaPassed;
        failedCriteria = evalResult.failedCriteria;
        distHigh = evalResult.distHigh;
        distLow = evalResult.distLow;
        pctFrom52WHigh = evalResult.pctFrom52WHigh;
        pctAbove52WLow = evalResult.pctAbove52WLow;
      }

      const mktCapT = calcMarketCapT(sym, livePriceK);

      return {
        ...item,
        price: currentPrice,
        changePct: currentChangePct,
        volume: currentVolume,
        mktCapT,
        failedCriteria,
        distHigh,
        distLow,
        pctFrom52WHigh,
        pctAbove52WLow,
        criteriaPassed,
        score: criteriaPassed,
        isStage2: criteriaPassed === 8,
        isStage2Eligible: criteriaPassed === 8,
        pe: item.pe ?? fin?.pe ?? null,
        epsGrowthYoY: item.epsGrowthYoY ?? fin?.earningsGrowthYoY ?? null,
      };
    }).filter((item) => {
      // Loại bỏ triệt để cổ phiếu thanh khoản thấp (< 100K CP) hoặc vốn hóa nhỏ (< 1.000 Tỷ VNĐ) khỏi toàn bộ Bộ lọc, Top Leaders & Top Ngành (ngay cả khi RS = 99)
      const avgVol = item.avgVol20 !== undefined ? item.avgVol20 : item.volume;
      if (minAvgVol20 > 0 && avgVol < minAvgVol20) return false;
      if (minMktCapT > 0 && (item.mktCapT || 0) < minMktCapT) return false;
      return true;
    });
  }, [items, ticks, minAvgVol20, minMktCapT]);

  // Handle column header click to auto-sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'name' || key === 'sector' ? 'asc' : 'desc');
    }
  };

  // Filtered and automatically sorted items based on live ticks
  const filteredAndSortedItems = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;

    // 1. Filter
    const filtered = liveEnrichedItems.filter((item) => {
      // If user typed a search query, prioritize finding that stock across all sectors & criteria
      if (hasSearch) {
        const query = searchQuery.toUpperCase().trim();
        const matchSymbol = item.symbol.toUpperCase().includes(query);
        const matchName = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchSymbol || matchName;
      }

      if (selectedSector !== 'all') {
        const itemSec = (item.sector || '').trim().toLowerCase();
        const selSec = selectedSector.trim().toLowerCase();
        if (itemSec !== selSec) {
          return false;
        }
      }

      if (selectedExchange !== 'all') {
        if ((item.exchange || 'HOSE').toUpperCase() !== selectedExchange.toUpperCase()) {
          return false;
        }
      }

      if (volSignalFilter !== 'all') {
        if (volSignalFilter === 'BREAKOUT_OR_PIVOT') {
          if (item.volSignal !== 'BREAKOUT' && item.volSignal !== 'POCKET_PIVOT' && item.relVol < 1.3) {
            return false;
          }
        } else if (volSignalFilter === 'ACCUMULATION') {
          if ((item.upDownVolRatio ?? 1) < 1.2) {
            return false;
          }
        } else if (volSignalFilter === 'VCP_DRYUP') {
          if (item.volSignal !== 'VCP_DRYUP' && item.relVol > 0.75) {
            return false;
          }
        }
      }

      if (item.rsRating < minRs) {
        return false;
      }

      const effectiveMinScore = onlyStage2 ? 8 : minScore;
      if ((item.criteriaPassed ?? 0) < effectiveMinScore) {
        return false;
      }

      return true;
    });

    // 2. Sort dynamically (with intelligent tie-breaker between score and rsRating)
    return filtered.sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const diff = sortDir === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      if (diff !== 0) return diff;

      // Tie-breaker: if sorting by score, tie-break by rsRating desc; otherwise tie-break by score desc
      if (sortKey === 'score') {
        return (b.rsRating || 0) - (a.rsRating || 0);
      }
      return (b.score || 0) - (a.score || 0);
    });
  }, [liveEnrichedItems, searchQuery, selectedSector, selectedExchange, volSignalFilter, minRs, minScore, onlyStage2, sortKey, sortDir]);

  // Sector groups for "Top cổ phiếu theo nhóm ngành"
  const sectorGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        sector: string;
        items: MinerviniScreenerItem[];
        avgRs: number;
        stage2Count: number;
        avgChange: number;
      }
    > = {};

    liveEnrichedItems.forEach((item) => {
      const sec = SECTOR_MAPPING[item.symbol] || item.sector || 'Khác';
      if (!groups[sec]) {
        groups[sec] = {
          sector: sec,
          items: [],
          avgRs: 0,
          stage2Count: 0,
          avgChange: 0,
        };
      }
      groups[sec].items.push({
        ...item,
        sector: sec,
      });
    });

    return Object.values(groups)
      .map((g) => {
        // Sort items inside sector by RS Rating descending
        g.items.sort((a, b) => b.rsRating - a.rsRating);
        const totalRs = g.items.reduce((acc, x) => acc + x.rsRating, 0);
        const totalChg = g.items.reduce((acc, x) => acc + x.changePct, 0);
        g.avgRs = Math.round(totalRs / (g.items.length || 1));
        g.avgChange = Math.round((totalChg / (g.items.length || 1)) * 100) / 100;
        g.stage2Count = g.items.filter((x) => x.criteriaPassed === 8).length;
        return g;
      })
      .sort((a, b) => {
        if (sectorSortBy === 'change') return b.avgChange - a.avgChange;
        if (sectorSortBy === 'stage2') return b.stage2Count - a.stage2Count;
        if (sectorSortBy === 'name') return a.sector.localeCompare(b.sector);
        return b.avgRs - a.avgRs; // default: rank leading industry sectors by RS
      });
  }, [liveEnrichedItems, sectorSortBy]);

  // Summary counts
  const stage2Count = useMemo(() => liveEnrichedItems.filter((x) => x.criteriaPassed === 8).length, [liveEnrichedItems]);
  const nearStage2Count = useMemo(() => liveEnrichedItems.filter((x) => x.criteriaPassed === 7).length, [liveEnrichedItems]);
  const leadersCount = useMemo(() => liveEnrichedItems.filter((x) => x.rsRating >= 90).length, [liveEnrichedItems]);
  const topSectors = useMemo(() => {
    return sectorGroups.slice(0, 3).map((g) => g.sector);
  }, [sectorGroups]);

  // Real-time pass statistics for each of the 8 official Mark Minervini Trend Template criteria
  const criteriaPassStats = useMemo(() => {
    const total = liveEnrichedItems.length || 1;
    return MINERVINI_8_CRITERIA_META.map((meta) => {
      const passedCount = liveEnrichedItems.filter(
        (it) => !it.failedCriteria?.includes(meta.shortLabel)
      ).length;
      return {
        ...meta,
        passedCount,
        total: liveEnrichedItems.length,
        pct: Math.round((passedCount / total) * 100),
      };
    });
  }, [liveEnrichedItems]);

  const handleSelectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setViewMode('detail');
  };

  const renderSortIcon = (field: string) => {
    if (sortKey !== field) {
      return <CaretUpDown className="w-3.5 h-3.5 text-zinc-600 inline ml-1 opacity-60" />;
    }
    return sortDir === 'asc' ? (
      <CaretUp className="w-3.5 h-3.5 text-amber-400 inline ml-1 font-bold" />
    ) : (
      <CaretDown className="w-3.5 h-3.5 text-amber-400 inline ml-1 font-bold" />
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner: Minervini Pro Screener ─────────────────── */}
      <div className="p-6 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <Sparkle className="w-5 h-5" weight="fill" />
              </span>
              <h2 className="text-xl font-mono font-black text-zinc-100 tracking-tight">
                BỘ LỌC CỔ PHIẾU MARK MINERVINI
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                TREND TEMPLATE STAGE 2
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {wsStatus === 'connected' ? 'LIVE TICK STREAMING' : 'REALTIME SYNC'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Chiến lược tìm kiếm siêu cổ phiếu tăng trưởng đột biến (SEPA) & Xếp hạng Sức mạnh Giá Tương đối (RS Rating 1-99)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Table vs Sectors vs Cycle */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 font-mono text-xs">
              <button
                onClick={() => setMainViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainViewMode === 'table'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Bảng Lọc Chi Tiết</span>
              </button>
              <button
                onClick={() => setMainViewMode('sectors')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainViewMode === 'sectors'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Buildings className="w-4 h-4" />
                <span>Top CP Theo Ngành</span>
              </button>
              <button
                onClick={() => setMainViewMode('cycle')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mainViewMode === 'cycle'
                    ? 'bg-emerald-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Vòng Tròn Chu Kỳ</span>
              </button>
            </div>

            {/* Quick Scan Button */}
            <button
              onClick={() => fetchScreenerData(true)}
              disabled={isLoading}
              title="Quét lại 182 mã thị trường thật qua DNSE"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:via-orange-400 hover:to-rose-500 text-zinc-950 font-mono font-black text-xs transition-all shadow-lg shadow-amber-500/25 active:scale-95 border border-amber-300/40 cursor-pointer disabled:opacity-50"
            >
              <ArrowClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} weight="bold" />
              <span>{isLoading ? 'ĐANG QUÉT THẬT...' : '⚡ QUÉT LẠI'}</span>
            </button>
          </div>
        </div>

        {/* ── Metric Summary Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Đạt Trend Template (8/8)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-emerald-400">{stage2Count}</span>
              <span className="text-xs font-mono text-amber-400 font-bold">(+{nearStage2Count} mã 7/8)</span>
              <span className="text-xs font-mono text-zinc-500">/ {items.length} mã</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Top Leaders (RS &gt;= 90)</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-amber-400">{leadersCount}</span>
              <span className="text-xs font-mono text-zinc-500">cổ phiếu siêu sao</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Top Ngành Dẫn Sóng</span>
              <TrendUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xs font-mono font-bold text-zinc-200 truncate mt-1">
              {topSectors.length > 0 ? topSectors.join(' · ') : 'Chứng khoán, Thép, Công nghệ'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-1">
              <span>Lịch Quét Tự Động</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                2 LẦN/NGÀY
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-200 mt-1 flex flex-col gap-0.5">
              <span className="font-semibold text-zinc-100">{scanMeta?.sessionLabel || 'Phiên Sáng (11:30) & Chiều (15:00)'}</span>
              <span className="text-[10px] text-zinc-400">
                {scanMeta?.scannedAtText ? `Lúc: ${scanMeta.scannedAtText}` : 'Nguồn 100% Real DNSE'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Active 8 Official Trend Template Criteria Chips ─────────────────── */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Funnel className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                8 Tiêu Chí Chuẩn Mark Minervini SEPA Trend Template (Stage 2 Uptrend):
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Đang hiển thị: <strong className="text-amber-400">{filteredAndSortedItems.length}</strong> / {liveEnrichedItems.length} mã quét thực tế
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {criteriaPassStats.map((stat) => (
              <div
                key={stat.id}
                title={stat.fullLabel}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-amber-500/25 text-[11px] font-mono shadow-sm hover:border-amber-400/60 transition-all"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 font-black text-[10px] shrink-0">
                    C{stat.id}
                  </span>
                  <span className="text-zinc-200 font-semibold truncate">{stat.shortLabel}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                  {stat.passedCount}/{stat.total} ({stat.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 1: TOP CỔ PHIẾU THEO NHÓM NGÀNH (SECTOR LEADERS)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'sectors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Buildings className="w-5 h-5 text-amber-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-bold text-zinc-100 text-sm">
                    XẾP HẠNG VÀ TOP CỔ PHIẾU THEO TỪNG NHÓM NGÀNH ({sectorGroups.length} NGÀNH)
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE REALTIME
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-sans">
                  Sức mạnh ngành trung bình (Average RS) & Các mã dẫn sóng (Leaders) đạt chuẩn Minervini (Cập nhật trực tiếp SSI 10s/lần)
                </p>
              </div>
            </div>

            {/* Sector Sorting Options */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-500">Xếp hạng theo:</span>
              <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 font-mono text-xs">
                <button
                  onClick={() => setSectorSortBy('rs')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    sectorSortBy === 'rs'
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🏆 RS Ngành
                </button>
                <button
                  onClick={() => setSectorSortBy('change')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    sectorSortBy === 'change'
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  📈 % Tăng giá
                </button>
                <button
                  onClick={() => setSectorSortBy('stage2')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    sectorSortBy === 'stage2'
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🛡️ Mã Stage 2
                </button>
                <button
                  onClick={() => setSectorSortBy('name')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    sectorSortBy === 'name'
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🔤 Tên A-Z
                </button>
              </div>

              <button
                onClick={() => setMainViewMode('table')}
                className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 transition-colors"
              >
                Bảng Lọc Chi Tiết →
              </button>
            </div>
          </div>

          {/* ── Tra Cứu Nhanh & Quét Xét Tiêu Chí Cổ Phiếu Bất Kỳ ─────────────────── */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <MagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nhập mã CP (vd: ABB, MSR, VND)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScanCustomSymbol(searchQuery);
                    }
                  }}
                  className="pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 w-full transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setScanFeedback(null);
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-300 absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nút Bấm Quét & Xét Chuẩn Minervini */}
              <button
                onClick={() => handleScanCustomSymbol(searchQuery)}
                disabled={isSearchingOnDemand}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-mono font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                title="Bấm để quét dữ liệu thực tế và xét duyệt 8 tiêu chí Trend Template của mã này"
              >
                {isSearchingOnDemand ? (
                  <ArrowClockwise className="w-4 h-4 animate-spin text-zinc-950" />
                ) : (
                  <Sparkle className="w-4 h-4 text-zinc-950" weight="fill" />
                )}
                <span>{isSearchingOnDemand ? 'ĐANG QUÉT & XÉT...' : '⚡ QUÉT & XÉT TIÊU CHÍ'}</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-zinc-400">
              <span>💡 Nhập mã bất kỳ và bấm nút để quét nến kỹ thuật & xếp hạng RS tự động</span>
            </div>
          </div>

          {/* Feedback kết quả quét */}
          {scanFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-all animate-in fade-in ${
                scanFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : scanFeedback.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {scanFeedback.type === 'success' && <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
                {scanFeedback.type === 'warning' && <Warning className="w-4 h-4 text-amber-400 shrink-0" />}
                {scanFeedback.type === 'error' && <X className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-medium">{scanFeedback.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedSector('all');
                    setMainViewMode('table');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-400 text-amber-300 text-[11px] font-bold"
                >
                  Xem Bảng Lọc Chi Tiết →
                </button>
                <button
                  onClick={() => setScanFeedback(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Grid of Sector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorGroups.map((group, gIdx) => {
              const isLeadSector = gIdx < 3;
              return (
                <div
                  key={group.sector}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between backdrop-blur-xl relative overflow-hidden ${
                    isLeadSector
                      ? 'bg-zinc-950/95 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
                      : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  <div>
                    {/* Header: Sector rank & Avg RS */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                            gIdx === 0
                              ? 'bg-amber-400 text-zinc-950'
                              : gIdx === 1
                              ? 'bg-zinc-300 text-zinc-950'
                              : gIdx === 2
                              ? 'bg-amber-700 text-zinc-100'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          #{gIdx + 1}
                        </span>
                        <h4 className="font-mono font-bold text-sm text-zinc-100">{group.sector}</h4>
                      </div>

                      {/* Prominent Sector RS Pill */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono font-bold text-xs shadow-sm">
                        <Sparkle weight="fill" className="w-3.5 h-3.5 text-amber-400" />
                        <span>RS Ngành: {group.avgRs}/99</span>
                      </div>
                    </div>

                    {/* Sector Sub-metrics */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-3.5">
                      <span>{group.items.length} mã theo dõi</span>
                      <span className="text-emerald-400 font-bold">
                        {group.stage2Count}/{group.items.length} mã Stage 2
                      </span>
                      <span
                        className={`font-bold ${
                          group.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {group.avgChange >= 0 ? '+' : ''}
                        {group.avgChange.toFixed(2)}%
                      </span>
                    </div>

                    {/* Leaders List for this sector */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                        Top Cổ Phiếu Dẫn Dắt (Leaders):
                      </span>
                      {group.items.slice(0, 4).map((stock, sIdx) => {
                        const priceColor = getStockPriceColor({
                          price: stock.price,
                          changePercent: stock.changePct,
                          exchange: stock.exchange,
                        });
                        const isUp = stock.changePct > 0;
                        return (
                          <div
                            key={stock.symbol}
                            onClick={() => handleSelectStock(stock.symbol)}
                            className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-400/50 transition-all cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-zinc-500 font-mono text-xs font-bold w-4">
                                {sIdx + 1}.
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-xs text-zinc-100 group-hover:text-amber-400 transition-colors">
                                    {stock.symbol}
                                  </span>
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                    {stock.exchange}
                                  </span>
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                    stock.criteriaPassed === 8
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : stock.criteriaPassed === 7
                                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  }`}>
                                    {stock.criteriaPassed}/8
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 truncate max-w-[130px] font-sans">
                                  {stock.name}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-3">
                              {/* Prominent RS Rating */}
                              <div className="text-right">
                                <span className="font-mono font-black text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-sm block">
                                  RS {stock.rsRating}
                                </span>
                              </div>

                              <div>
                                <div className={`font-mono text-xs font-bold ${priceColor.colorClass}`}>
                                  {(stock.price / 1000).toFixed(2)}
                                </div>
                                <div
                                  className={`font-mono text-[10px] font-bold ${priceColor.colorClass}`}
                                >
                                  {isUp ? '+' : ''}
                                  {stock.changePct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card footer: filter this sector in table */}
                  <div className="pt-3 mt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <button
                      onClick={() => {
                        setSelectedSector(group.sector);
                        setMinRs(70);
                        setOnlyStage2(false);
                        setSearchQuery('');
                        setMainViewMode('table');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold transition-colors inline-flex items-center gap-1"
                    >
                      <span>Lọc riêng ngành này</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <span>{group.items.length} cổ phiếu</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 3: VÒNG TRÒN CHU KỲ KINH TẾ (ECONOMIC CYCLE WHEEL) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'cycle' && (
        <EconomicCycleWheel
          items={items}
          onSelectSector={(sec) => {
            setSelectedSector(sec);
            setMainViewMode('table');
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 2: BẢNG LỌC TOÀN BỘ CỔ PHIẾU (INTERACTIVE TABLE)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mainViewMode === 'table' && (
        <div className="space-y-4">
          {/* ── Search, Sector, RS Controls & Sub-Tabs ─────────────────────── */}
          <div className="p-4 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
            {/* Sub-tabs switcher */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tổng Quan
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'performance'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hiệu Suất & RS
              </button>
              <button
                onClick={() => setActiveTab('technicals')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'technicals'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Kỹ Thuật MA
              </button>
              <button
                onClick={() => setActiveTab('valuation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'valuation'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Định Giá & Tăng Trưởng
              </button>
            </div>

            {/* Quick Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Search & Explicit Scan Button */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <MagnifyingGlass className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Mã CP (vd: ABB, MSR)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleScanCustomSymbol(searchQuery);
                      }
                    }}
                    className="pl-9 pr-8 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 w-44 sm:w-52 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setScanFeedback(null);
                      }}
                      className="p-0.5 text-zinc-500 hover:text-zinc-300 absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleScanCustomSymbol(searchQuery)}
                  disabled={isSearchingOnDemand}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Quét và kiểm tra cổ phiếu theo chuẩn Minervini"
                >
                  {isSearchingOnDemand ? (
                    <ArrowClockwise className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                  ) : (
                    <Sparkle className="w-3.5 h-3.5 text-zinc-950" weight="fill" />
                  )}
                  <span>{isSearchingOnDemand ? 'ĐANG QUÉT...' : '⚡ QUÉT MÃ'}</span>
                </button>
              </div>

              {/* Sector Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono focus:outline-none transition-all ${
                    selectedSector !== 'all'
                      ? 'bg-amber-400/10 border-amber-400/50 text-amber-300 font-bold ring-1 ring-amber-400/30'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-amber-400'
                  }`}
                >
                  <option value="all">Tất cả ngành ({items.length} mã)</option>
                  {sectors.map((s) => {
                    const count = items.filter((it) => (it.sector || '').trim().toLowerCase() === s.trim().toLowerCase()).length;
                    return (
                      <option key={s} value={s}>
                        {s} ({count})
                      </option>
                    );
                  })}
                </select>

                {selectedSector !== 'all' && (
                  <button
                    onClick={() => setSelectedSector('all')}
                    className="px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors flex items-center gap-1 text-[11px] font-mono"
                    title="Bỏ lọc riêng ngành"
                  >
                    <X className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Bỏ lọc</span>
                  </button>
                )}
              </div>

              {/* Only Stage 2 toggle */}
              <button
                onClick={() => {
                  const next = !onlyStage2;
                  setOnlyStage2(next);
                  setMinScore(next ? 8 : 7);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                  onlyStage2
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Chỉ Stage 2 (8/8)</span>
              </button>

              {/* Compact Toggle Button for Advanced Filter Customization */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                  showAdvancedFilters || selectedExchange !== 'all' || minAvgVol20 !== 100000 || minMktCapT !== 1000 || volSignalFilter !== 'all' || minRs !== 70 || (!onlyStage2 && minScore !== 7)
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/40 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
                title="Mở tuỳ chỉnh nâng cao (Khối lượng, Vốn hóa, RS, Điểm tiêu chí, Sàn, Dòng tiền)"
              >
                <Funnel className="w-3.5 h-3.5" />
                <span>Tuỳ chỉnh lọc</span>
                <span className="text-[10px] opacity-75">
                  ({onlyStage2 ? '8/8' : `≥${minScore}/8`} · RS≥{minRs} · KL≥{Math.round(minAvgVol20 / 1000)}K · V.Hoá≥{(minMktCapT / 1000).toFixed(0)}kTỷ)
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filters Drawer (Chỉ hiện khi người dùng bấm nút "Tuỳ chỉnh lọc") */}
          {showAdvancedFilters && (
            <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-in fade-in">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Funnel className="w-3.5 h-3.5" />
                  Tuỳ chỉnh nâng cao:
                </span>

                {/* Minimum 20-Day Average Liquidity Filter */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">KL TB &gt;=</span>
                  <select
                    value={minAvgVol20}
                    onChange={(e) => setMinAvgVol20(Number(e.target.value))}
                    className="bg-transparent text-cyan-400 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="100000">100.000 CP (Mặc định)</option>
                    <option value="200000">200.000 CP</option>
                    <option value="300000">300.000 CP</option>
                    <option value="500000">500.000 CP</option>
                    <option value="1000000">1.000.000 CP</option>
                  </select>
                </div>

                {/* Minimum Market Cap Filter (Chống thao túng vốn hóa nhỏ) */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">Vốn hóa &gt;=</span>
                  <select
                    value={minMktCapT}
                    onChange={(e) => setMinMktCapT(Number(e.target.value))}
                    className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="1000">1.000 Tỷ (Mặc định)</option>
                    <option value="3000">3.000 Tỷ (Midcap+)</option>
                    <option value="5000">5.000 Tỷ</option>
                    <option value="10000">10.000 Tỷ (LargeCap)</option>
                  </select>
                </div>

                {/* Min RS rating */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">RS &gt;=</span>
                  <select
                    value={minRs}
                    onChange={(e) => setMinRs(Number(e.target.value))}
                    className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="70">70 (Mặc định SEPA)</option>
                    <option value="80">80 (Leader)</option>
                    <option value="90">90 (Siêu sao)</option>
                    <option value="50">50</option>
                    <option value="0">Tất cả (&gt;= 0)</option>
                  </select>
                </div>

                {/* Min Trend Template Score selector */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">Điểm &gt;=</span>
                  <select
                    value={onlyStage2 ? 8 : minScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinScore(val);
                      setOnlyStage2(val === 8);
                    }}
                    className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="8">8/8 (Chuẩn Stage 2)</option>
                    <option value="7">7/8 (Stage 2 &amp; Tiệm cận)</option>
                    <option value="6">6/8 (Tích lũy khỏe)</option>
                    <option value="0">0/8 (Tất cả mã quét)</option>
                  </select>
                </div>

                {/* Exchange Selector */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">Sàn:</span>
                  <select
                    value={selectedExchange}
                    onChange={(e) => setSelectedExchange(e.target.value)}
                    className="bg-transparent text-zinc-200 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả 3 Sàn</option>
                    <option value="HOSE">HOSE</option>
                    <option value="HNX">HNX</option>
                    <option value="UPCOM">UPCoM</option>
                  </select>
                </div>

                {/* Volume Action / Institutional Flow Signal Filter */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl">
                  <span className="text-zinc-500">Tín hiệu Vol:</span>
                  <select
                    value={volSignalFilter}
                    onChange={(e) => setVolSignalFilter(e.target.value)}
                    className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả</option>
                    <option value="BREAKOUT_OR_PIVOT">🔥 Nổ Vol / Pocket Pivot</option>
                    <option value="ACCUMULATION">📈 Gom hàng (U/D Vol &gt;= 1.2x)</option>
                    <option value="VCP_DRYUP">💧 Cạn cung VCP (Vol &lt;= 0.75x)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedExchange('all');
                  setMinAvgVol20(100000);
                  setMinMktCapT(1000);
                  setVolSignalFilter('all');
                  setMinRs(70);
                  setMinScore(7);
                  setOnlyStage2(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors text-[11px] cursor-pointer"
              >
                Khôi phục mặc định
              </button>
            </div>
          )}

          {/* Feedback kết quả quét cho Bảng Lọc */}
          {scanFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-all animate-in fade-in ${
                scanFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : scanFeedback.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {scanFeedback.type === 'success' && <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
                {scanFeedback.type === 'warning' && <Warning className="w-4 h-4 text-amber-400 shrink-0" />}
                {scanFeedback.type === 'error' && <X className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-medium">{scanFeedback.message}</span>
              </div>
              <button
                onClick={() => setScanFeedback(null)}
                className="p-1 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── Quick Sort Shortcuts Ribbon ───────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Sắp Xếp Nhanh:</span>
              <button
                onClick={() => {
                  setSortKey('rsRating');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'rsRating'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                🔥 Top RS Rating
              </button>
              <button
                onClick={() => {
                  setSortKey('changePct');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'changePct'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                % Tăng Mạnh Nhất
              </button>
              <button
                onClick={() => {
                  setSortKey('volume');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'volume'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                ⚡ Khối Lượng Cao
              </button>
              <button
                onClick={() => {
                  setSortKey('score');
                  setSortDir('desc');
                }}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  sortKey === 'score'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                    : 'bg-zinc-900 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                🛡️ Tiêu Chí 8/8
              </button>
            </div>
            <div className="text-[11px] text-zinc-500">
              Bấm vào bất kỳ tiêu đề cột nào để tự động đảo chiều sắp xếp (↑ / ↓)
            </div>
          </div>

          {/* ── Screener Data Table ───────────────────────────────────────── */}
          <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] border-b border-zinc-800/80 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('symbol')}
                      className="py-3 px-4 cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Mã CP {renderSortIcon('symbol')}
                    </th>
                    <th
                      onClick={() => handleSort('price')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Giá (VND) {renderSortIcon('price')}
                    </th>
                    <th
                      onClick={() => handleSort('changePct')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      % Thay đổi {renderSortIcon('changePct')}
                    </th>
                    <th
                      onClick={() => handleSort('volume')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Khối lượng {renderSortIcon('volume')}
                    </th>
                    <th
                      onClick={() => handleSort('relVol')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      KL Tương đối {renderSortIcon('relVol')}
                    </th>

                    {activeTab === 'overview' && (
                      <>
                        <th
                          onClick={() => handleSort('mktCapT')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Vốn hóa (Tỷ) {renderSortIcon('mktCapT')}
                        </th>
                        <th
                          onClick={() => handleSort('pe')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          P/E {renderSortIcon('pe')}
                        </th>
                        <th
                          onClick={() => handleSort('epsGrowthYoY')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          EPS YoY {renderSortIcon('epsGrowthYoY')}
                        </th>
                        <th
                          onClick={() => handleSort('sector')}
                          className="py-3 px-3 cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Ngành {renderSortIcon('sector')}
                        </th>
                      </>
                    )}

                    {activeTab === 'performance' && (
                      <>
                        <th
                          onClick={() => handleSort('perf1W')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Tuần {renderSortIcon('perf1W')}
                        </th>
                        <th
                          onClick={() => handleSort('perf1M')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Tháng {renderSortIcon('perf1M')}
                        </th>
                        <th
                          onClick={() => handleSort('perf1Y')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          1 Năm {renderSortIcon('perf1Y')}
                        </th>
                        <th
                          onClick={() => handleSort('distHigh')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Cách đỉnh 52W {renderSortIcon('distHigh')}
                        </th>
                      </>
                    )}

                    {activeTab === 'technicals' && (
                      <>
                        <th
                          onClick={() => handleSort('sma50')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 50 {renderSortIcon('sma50')}
                        </th>
                        <th
                          onClick={() => handleSort('sma150')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 150 {renderSortIcon('sma150')}
                        </th>
                        <th
                          onClick={() => handleSort('sma200')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          SMA 200 {renderSortIcon('sma200')}
                        </th>
                        <th
                          onClick={() => handleSort('distLow')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Trên đáy 52W {renderSortIcon('distLow')}
                        </th>
                      </>
                    )}

                    {activeTab === 'valuation' && (
                      <>
                        <th
                          onClick={() => handleSort('pe')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          P/E {renderSortIcon('pe')}
                        </th>
                        <th
                          onClick={() => handleSort('epsDiluted')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          EPS Pha Loãng {renderSortIcon('epsDiluted')}
                        </th>
                        <th
                          onClick={() => handleSort('epsGrowthYoY')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Tăng trưởng YoY {renderSortIcon('epsGrowthYoY')}
                        </th>
                        <th
                          onClick={() => handleSort('dividendYield')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                        >
                          Cổ tức (%) {renderSortIcon('dividendYield')}
                        </th>
                      </>
                    )}

                    {/* Prominent RS Rating Header */}
                    <th
                      onClick={() => handleSort('rsRating')}
                      className="py-3 px-3 text-center cursor-pointer hover:bg-zinc-800/80 hover:text-amber-300 transition-colors bg-amber-500/10"
                    >
                      RS Rating {renderSortIcon('rsRating')}
                    </th>
                    <th
                      onClick={() => handleSort('score')}
                      className="py-3 px-3 text-center cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
                    >
                      Stage 2 {renderSortIcon('score')}
                    </th>
                    <th className="py-3 px-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredAndSortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-zinc-500 font-mono">
                        {isLoading || isSearchingOnDemand ? (
                          <div className="flex items-center justify-center gap-2 text-amber-400">
                            <ArrowClockwise className="w-5 h-5 animate-spin" />
                            <span>
                              {isSearchingOnDemand
                                ? `Đang phân tích trực tiếp mã ${searchQuery.toUpperCase()} theo chuẩn Minervini (Trend Template & RS)...`
                                : 'Đang tính toán tiêu chuẩn Minervini từ hệ thống DNSE...'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3">
                            <p>Không tìm thấy cổ phiếu nào khớp với bộ lọc hiện tại.</p>
                            {searchQuery.trim().length >= 3 && (
                              <button
                                onClick={() => handleScanCustomSymbol(searchQuery)}
                                disabled={isSearchingOnDemand}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-mono font-black text-xs transition-all shadow-md active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                              >
                                <Sparkle className="w-4 h-4 text-zinc-950" weight="fill" />
                                <span>Bấm vào đây để Quét & Xét chuẩn Minervini cho mã [{searchQuery.toUpperCase()}] ngay ⚡</span>
                              </button>
                            )}
                            {(selectedSector !== 'all' || selectedExchange !== 'all' || minAvgVol20 !== 50000 || volSignalFilter !== 'all' || minRs !== 70 || minScore !== 7 || onlyStage2 || searchQuery) && (
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedSector('all');
                                    setSelectedExchange('all');
                                    setMinAvgVol20(50000);
                                    setVolSignalFilter('all');
                                    setMinRs(70);
                                    setMinScore(7);
                                    setOnlyStage2(false);
                                    setSearchQuery('');
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold hover:bg-amber-400/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Đặt lại mặc định (Điểm &gt;= 7/8, RS &gt;= 70, KL &gt;= 50K)</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedSector('all');
                                    setSelectedExchange('all');
                                    setMinAvgVol20(30000);
                                    setVolSignalFilter('all');
                                    setMinRs(0);
                                    setMinScore(0);
                                    setOnlyStage2(false);
                                    setSearchQuery('');
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Xem toàn bộ {liveEnrichedItems.length} mã đủ thanh khoản</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedItems.map((item) => {
                      const priceColor = getStockPriceColor({
                        price: item.price,
                        changePercent: item.changePct,
                        exchange: item.exchange,
                      });
                      const isUp = item.changePct > 0;

                      const rsBadgeColor =
                        item.rsRating >= 90
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 font-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                          : item.rsRating >= 80
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 font-black'
                          : item.rsRating >= 70
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700';

                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => handleSelectStock(item.symbol)}
                          className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                        >
                          {/* Symbol & Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-zinc-100 group-hover:text-amber-400 transition-colors">
                                {item.symbol}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                {item.exchange}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate max-w-[150px] font-sans">
                              {item.name}
                            </p>
                          </td>

                          {/* Price */}
                          <td className="py-3 px-3 text-right">
                            <span className={`font-mono font-bold text-xs ${priceColor.colorClass}`}>
                              {item.price.toLocaleString('vi-VN')}
                            </span>
                          </td>

                          {/* Change % */}
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${priceColor.badgeBgClass}`}
                            >
                              {isUp ? '+' : ''}
                              {item.changePct.toFixed(2)}%
                            </span>
                          </td>

                          {/* Volume & 20D Average Liquidity */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-zinc-200 font-mono">
                                {item.volume.toLocaleString('vi-VN')}
                              </span>
                              {item.avgVol20 !== undefined && (
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  TB20: {(item.avgVol20 / 1000).toFixed(0)}K{item.avgVal20B ? ` (${item.avgVal20B}Tỷ)` : ''}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Relative Volume & VCP / Pocket Pivot Signal */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={`font-mono font-bold ${
                                  item.relVol >= 1.5
                                    ? 'text-amber-400'
                                    : item.relVol >= 1.0
                                    ? 'text-emerald-400'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {item.relVol.toFixed(2)}x
                                {item.upDownVolRatio !== undefined && (
                                  <span
                                    title="Tỷ lệ Tổng Khối lượng Phiên Tăng / Phiên Giảm trong 20 phiên (Chuẩn tích lũy >= 1.2)"
                                    className={`ml-1 text-[9px] ${
                                      item.upDownVolRatio >= 1.2 ? 'text-emerald-400' : 'text-zinc-500'
                                    }`}
                                  >
                                    (U/D:{item.upDownVolRatio}x)
                                  </span>
                                )}
                              </span>
                              {item.volSignal === 'BREAKOUT' && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-bold">
                                  🔥 NỔ VOL
                                </span>
                              )}
                              {item.volSignal === 'POCKET_PIVOT' && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                                  ⚡ POCKET PIVOT
                                </span>
                              )}
                              {item.volSignal === 'VCP_DRYUP' && (
                                <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold">
                                  💧 CẠN CUNG VCP
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Tab-dependent columns */}
                          {activeTab === 'overview' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300 font-mono">
                                {item.mktCapT.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-500 font-mono">
                                {item.pe ? item.pe.toFixed(1) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {item.epsGrowthYoY !== null && item.epsGrowthYoY !== undefined ? (
                                  <span
                                    className={
                                      item.epsGrowthYoY >= 25
                                        ? 'text-emerald-400 font-bold'
                                        : item.epsGrowthYoY >= 0
                                        ? 'text-zinc-300'
                                        : 'text-rose-400'
                                    }
                                  >
                                    {item.epsGrowthYoY > 0 ? '+' : ''}{item.epsGrowthYoY.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 font-mono">--</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-zinc-400 truncate max-w-[130px]">
                                {item.sector}
                              </td>
                            </>
                          )}

                          {activeTab === 'performance' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1W !== undefined ? `${item.perf1W > 0 ? '+' : ''}${item.perf1W.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1M !== undefined ? `${item.perf1M > 0 ? '+' : ''}${item.perf1M.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.perf1Y !== undefined ? `${item.perf1Y > 0 ? '+' : ''}${item.perf1Y.toFixed(2)}%` : '0%'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={
                                    (item.distHigh ?? 0) >= -10
                                      ? 'text-emerald-400 font-bold'
                                      : (item.distHigh ?? 0) >= -25
                                      ? 'text-amber-400'
                                      : 'text-zinc-400'
                                  }
                                >
                                  {item.distHigh !== undefined ? `${item.distHigh.toFixed(1)}%` : '--'}
                                </span>
                              </td>
                            </>
                          )}

                          {activeTab === 'technicals' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma50 ? item.sma50.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma150 ? item.sma150.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">
                                {item.sma200 ? item.sma200.toFixed(2) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                                {item.distLow !== undefined ? `+${item.distLow.toFixed(1)}%` : '--'}
                              </td>
                            </>
                          )}

                          {activeTab === 'valuation' && (
                            <>
                              <td className="py-3 px-3 text-right text-zinc-500 font-mono">
                                {item.pe ? item.pe.toFixed(1) : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-500 font-mono">
                                {item.epsDiluted ? item.epsDiluted.toLocaleString('vi-VN') : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-500 font-mono">
                                {item.epsDilutedGrowthYoY !== null && item.epsDilutedGrowthYoY !== undefined
                                  ? `${item.epsDilutedGrowthYoY > 0 ? '+' : ''}${item.epsDilutedGrowthYoY.toFixed(1)}%`
                                  : '--'}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-500 font-mono">
                                {item.dividendYield ? `${item.dividendYield.toFixed(1)}%` : '--'}
                              </td>
                            </>
                          )}

                          {/* Large Prominent RS Rating */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-block px-3 py-1 rounded-xl text-sm font-mono font-black border ${rsBadgeColor}`}>
                                {item.rsRating}
                              </span>
                              {item.rsRank && item.rsUniverseTotal && (
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  #{item.rsRank}/{item.rsUniverseTotal}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stage 2 Pass / Fail */}
                          <td className="py-3 px-3 text-center">
                            {item.criteriaPassed === 8 ? (
                              <span
                                title="Đạt tuyệt đối 8/8 tiêu chí Mark Minervini SEPA Trend Template (Stage 2 Uptrend)"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shadow-sm"
                              >
                                <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                                <span>8/8 CHUẨN STAGE 2</span>
                              </span>
                            ) : item.criteriaPassed === 7 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  title={
                                    item.failedCriteria?.length
                                      ? `Thiếu 1 tiêu chí: ${item.failedCriteria.join(', ')}`
                                      : 'Đạt 7/8 tiêu chí Trend Template'
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold"
                                >
                                  <span>7/8 TIỆM CẬN</span>
                                </span>
                                {item.failedCriteria && item.failedCriteria.length > 0 && (
                                  <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[125px]">
                                    Thiếu: {item.failedCriteria[0].replace(/^C\d:\s*/, '')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  title={
                                    item.failedCriteria?.length
                                      ? `Chưa đạt: ${item.failedCriteria.join(' | ')}`
                                      : `Đạt ${item.criteriaPassed}/8 tiêu chí`
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-mono"
                                >
                                  <span>{item.criteriaPassed}/8</span>
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStock(item.symbol);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-zinc-950 border border-amber-400/20 text-[11px] font-mono font-bold transition-all inline-flex items-center gap-1"
                            >
                              <span>Xem Chart</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
