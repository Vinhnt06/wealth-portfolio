'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Lightning,
  Scales,
  ArrowRight,
  ShieldCheck,
  CaretDown,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { HeroIndexChart, type Candle, type ChartKind } from './HeroIndexChart';
import { useLanguage } from '../../../app/components/LanguageContext';
import { sectorLabel, VALUATION_STATUS_EN } from '../i18n/sectors';
import vnindexCandles from '../data/vnindexHistory.json';
import lastScan from '../data/lastMinerviniScan.json';

interface IndexMeta {
  symbol: string;
  name: string;
  exchange: string;
  value: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  totalValue: number;
}

const DEFAULT_INDEXES: IndexMeta[] = [
  {
    symbol: 'VNINDEX',
    name: 'VN-Index',
    exchange: 'HOSE',
    value: 1759.82,
    change: -6.83,
    percentChange: -0.39,
    open: 1769.55,
    high: 1769.55,
    low: 1759.22,
    volume: 191331368,
    totalValue: 4383213554850,
  },
  {
    symbol: 'VN30',
    name: 'VN30-Index',
    exchange: 'HOSE',
    value: 1880.37,
    change: -9.85,
    percentChange: -0.52,
    open: 1893.34,
    high: 1893.39,
    low: 1877.69,
    volume: 75290352,
    totalValue: 2444740598400,
  },
  {
    symbol: 'HNX',
    name: 'HNX-Index',
    exchange: 'HNX',
    value: 258.29,
    change: -1.57,
    percentChange: -0.6,
    open: 260.65,
    high: 261.74,
    low: 257.77,
    volume: 8227560,
    totalValue: 130997978700,
  },
  {
    symbol: 'UPCOM',
    name: 'UPCOM-Index',
    exchange: 'UPCOM',
    value: 125.74,
    change: -0.35,
    percentChange: -0.28,
    open: 126.06,
    high: 126.44,
    low: 125.61,
    volume: 23744628,
    totalValue: 310500000000,
  },
];

// Curated high-conviction real valuation gems from our live audited engine
const REAL_VALUATION_OPPORTUNITIES = [
  { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', sector: 'Thép', pe: 7.56, pb: 1.25, peg: 0.10, growth: 72.8, status: 'Rẻ' },
  { symbol: 'FPT', name: 'Tập đoàn FPT', sector: 'Công nghệ', pe: 10.72, pb: 2.69, peg: 0.67, growth: 16.1, status: 'Hấp dẫn' },
  { symbol: 'VCB', name: 'Vietcombank', sector: 'Ngân hàng', pe: 11.30, pb: 1.89, peg: 0.56, growth: 20.2, status: 'Tăng trưởng' },
  { symbol: 'MWG', name: 'Thế Giới Di Động', sector: 'Bán lẻ', pe: 10.06, pb: 2.38, peg: 0.11, growth: 92.4, status: 'Rẻ' },
  { symbol: 'VHM', name: 'Vinhomes', sector: 'Bất động sản', pe: 6.27, pb: 1.90, peg: 0.04, growth: 164.5, status: 'Chiết khấu' },
];


const TIMEFRAMES: { key: string; label: string; bars: number }[] = [
  { key: '1W', label: '1W', bars: 5 },
  { key: '1M', label: '1M', bars: 22 },
  { key: '3M', label: '3M', bars: 66 },
  { key: '6M', label: '6M', bars: 132 },
  { key: '1Y', label: '1Y', bars: 252 },
  { key: 'ALL', label: 'ALL', bars: Infinity },
];

type MinerviniSort = 'rs' | 'chg' | 'vol';
type ValuationSort = 'peg' | 'pe' | 'growth';

const LOCAL_VNINDEX: Candle[] = (vnindexCandles as any[]).map((c) => ({
  time: c.time,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
}));

const toVnDate = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

const fmtPrice = (p: number | undefined, locale: string) =>
  p ? (p < 1000 ? p * 1000 : p).toLocaleString(locale) : '--';

const pctCls = (v: number) => (v > 0 ? 'text-[#10b981]' : v < 0 ? 'text-[#e5484d]' : 'text-[#e5a93b]');

export const HeroMarketBento: React.FC = () => {
  const { tr, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'vi-VN';
  const [indexes, setIndexes] = useState<IndexMeta[]>(DEFAULT_INDEXES);
  const [selectedIndexSymbol, setSelectedIndexSymbol] = useState<string>('VNINDEX');
  const [tf, setTf] = useState<string>('3M');
  const [kind, setKind] = useState<ChartKind>('area');
  const [ma20, setMa20] = useState(false);
  const [ma50, setMa50] = useState(false);
  const [vol, setVol] = useState(false);
  const [hover, setHover] = useState<{ c: Candle; prev: Candle | null } | null>(null);
  const [history, setHistory] = useState<Record<string, Candle[]>>({ VNINDEX: LOCAL_VNINDEX });
  const [loadingHist, setLoadingHist] = useState(false);

  const [radarTab, setRadarTab] = useState<'minervini' | 'valuation'>('minervini');
  const [mSort, setMSort] = useState<MinerviniSort>('rs');
  const [vSort, setVSort] = useState<ValuationSort>('peg');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // ── Realtime quotes (15s) ──
  useEffect(() => {
    const fetchIndexes = async () => {
      try {
        const res = await fetch('/api/market/quotes');
        const json = await res.json();
        if (json.success && Array.isArray(json.indexes) && json.indexes.length > 0) {
          setIndexes(json.indexes);
        }
      } catch (err) {
        console.error('Failed to fetch realtime quotes:', err);
      }
    };
    fetchIndexes();
    const interval = setInterval(fetchIndexes, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Lịch sử theo chỉ số đang chọn (cache theo symbol) ──
  useEffect(() => {
    const sym = selectedIndexSymbol;
    let cancelled = false;
    // VNINDEX có sẵn dữ liệu local, vẫn thử làm mới nhẹ để có phiên mới nhất
    if (history[sym] && sym !== 'VNINDEX') return;
    if (sym !== 'VNINDEX') setLoadingHist(true);
    (async () => {
      try {
        const res = await fetch(`/api/market/history?symbol=${sym}&resolution=1D&days=1100`);
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data) || json.data.length < 10) return;
        const map = new Map<string, Candle>();
        json.data.forEach((d: any) => {
          const t = toVnDate(d.time);
          map.set(t, { time: t, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume });
        });
        const list = Array.from(map.values()).sort((a, b) => (a.time < b.time ? -1 : 1));
        if (!cancelled) setHistory((h) => ({ ...h, [sym]: list }));
      } catch {
        /* giữ dữ liệu local nếu có */
      } finally {
        if (!cancelled) setLoadingHist(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndexSymbol]);

  const activeIndex = indexes.find((i) => i.symbol === selectedIndexSymbol) || indexes[0];

  // ── Flash khi giá live đổi ──
  const prevVal = useRef(activeIndex.value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (prevVal.current !== activeIndex.value) {
      setFlash(activeIndex.value > prevVal.current ? 'up' : 'down');
      prevVal.current = activeIndex.value;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [activeIndex.value]);
  useEffect(() => {
    prevVal.current = activeIndex.value;
  }, [selectedIndexSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCandles = history[selectedIndexSymbol];
  const chartData = useMemo(() => {
    if (!allCandles) return [];
    const bars = TIMEFRAMES.find((t) => t.key === tf)?.bars ?? 66;
    return Number.isFinite(bars) ? allCandles.slice(-bars) : allCandles;
  }, [allCandles, tf]);

  // Hiệu suất của khoảng đang xem
  const rangePerf = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].close;
    const last = chartData[chartData.length - 1].close;
    const hi = Math.max(...chartData.map((c) => c.high));
    const lo = Math.min(...chartData.map((c) => c.low));
    return { pct: ((last - first) / first) * 100, hi, lo };
  }, [chartData]);

  // Header: nếu đang rê chuột trên chart thì hiện số liệu của phiên đó
  const shownValue = hover ? hover.c.close : activeIndex.value;
  const shownChange = hover
    ? hover.prev
      ? hover.c.close - hover.prev.close
      : 0
    : activeIndex.change;
  const shownPct = hover
    ? hover.prev
      ? (shownChange / hover.prev.close) * 100
      : 0
    : activeIndex.percentChange;
  const valCls = pctCls(shownChange);

  const formatBillion = (val: number) => {
    if (!val || val === 0) return '--';
    const n = (val / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 0 });
    return language === 'en' ? `${n}B VND` : `${n} tỷ`;
  };

  // ── Radar lists ──
  const leaders = useMemo(() => {
    const list = ((lastScan as any).data || []).filter((s: any) => s.isStage2 && s.rsRating >= 85);
    const key = mSort === 'rs' ? 'rsRating' : mSort === 'chg' ? 'changePct' : 'relVol';
    return [...list].sort((a: any, b: any) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  }, [mSort]);
  const leadersShown = showAll ? leaders.slice(0, 10) : leaders.slice(0, 5);

  const valuations = useMemo(() => {
    const list = [...REAL_VALUATION_OPPORTUNITIES];
    if (vSort === 'peg') list.sort((a, b) => a.peg - b.peg);
    else if (vSort === 'pe') list.sort((a, b) => a.pe - b.pe);
    else list.sort((a, b) => b.growth - a.growth);
    return list;
  }, [vSort]);

  const switchRadar = (t: 'minervini' | 'valuation') => {
    setRadarTab(t);
    setExpanded(null);
  };

  const Pill = ({
    active,
    onClick,
    children,
    title,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
        active
          ? 'bg-[#1a1a1a] text-white border-[#333]'
          : 'text-[#666] border-transparent hover:text-[#bbb]'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ── LEFT: Index chart ── */}
      <div className="lg:col-span-8 bg-[#111111] border border-[#1a1a1a] rounded-2xl p-5 flex flex-col space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
            <div className="flex items-center gap-1 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {indexes.map((idx) => {
                const isActive = idx.symbol === selectedIndexSymbol;
                return (
                  <button
                    key={idx.symbol}
                    onClick={() => {
                      setSelectedIndexSymbol(idx.symbol);
                      setHover(null);
                    }}
                    className={`relative px-3 py-1.5 text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap group ${
                      isActive ? 'text-white' : 'text-[#888888] hover:text-[#cccccc]'
                    }`}
                  >
                    <span>{idx.name}</span>
                    <span className={`ml-1.5 text-[10px] font-semibold ${pctCls(idx.change)} ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                      {idx.percentChange > 0 ? '+' : ''}
                      {idx.percentChange.toFixed(2)}%
                    </span>
                    {isActive && (
                      <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#10b981]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTf(t.key)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    tf === t.key
                      ? 'bg-[#222222] text-[#10b981] border border-[#333333]'
                      : 'text-[#777777] hover:text-[#bbbbbb] border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value + day extremes */}
          <div className="flex flex-wrap items-baseline justify-between gap-4 pt-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className={`text-3xl sm:text-4xl font-mono font-black tracking-tight tabular-nums transition-colors duration-500 rounded px-1 -mx-1 ${valCls} ${
                  flash === 'up' ? 'bg-[#10b981]/20' : flash === 'down' ? 'bg-[#e5484d]/20' : ''
                }`}
              >
                {shownValue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-mono font-bold ${valCls}`}>
                {shownChange > 0 ? '+' : ''}
                {shownChange.toFixed(2)} ({shownPct > 0 ? '+' : ''}
                {shownPct.toFixed(2)}%)
              </span>
              {hover && (
                <span className="text-[11px] font-mono text-[#777]">
                  {new Date(hover.c.time).toLocaleDateString(locale)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-[#888888]">
              <div>
                <span className="text-[#555555]">{tr('Đáy', 'Low')}: </span>
                <span className="text-[#e5484d] font-semibold">
                  {activeIndex.low.toLocaleString(locale, { minimumFractionDigits: 1 })}
                </span>
              </div>
              <div>
                <span className="text-[#555555]">{tr('Đỉnh', 'High')}: </span>
                <span className="text-[#10b981] font-semibold">
                  {activeIndex.high.toLocaleString(locale, { minimumFractionDigits: 1 })}
                </span>
              </div>
              <div>
                <span className="text-[#555555]">{tr('Khối lượng', 'Volume')}: </span>
                <span className="text-zinc-200 font-semibold">{(activeIndex.volume / 1_000_000).toFixed(1)}M {tr('cp', 'shares')}</span>
              </div>
              <div>
                <span className="text-[#555555]">{tr('Giá trị', 'Value')}: </span>
                <span className="text-zinc-200 font-semibold">{formatBillion(activeIndex.totalValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 -mb-1">
          <div className="flex items-center gap-1">
            <Pill active={kind === 'area'} onClick={() => setKind('area')}>{tr('Vùng', 'Area')}</Pill>
            <Pill active={kind === 'candle'} onClick={() => setKind('candle')}>{tr('Nến', 'Candles')}</Pill>
            <span className="w-px h-3.5 bg-[#222] mx-1" />
            <Pill active={ma20} onClick={() => setMa20((v) => !v)} title={tr('Đường trung bình 20 phiên', '20-session moving average')}>
              <span className="text-[#e5a93b]">●</span> MA20
            </Pill>
            <Pill active={ma50} onClick={() => setMa50((v) => !v)} title={tr('Đường trung bình 50 phiên', '50-session moving average')}>
              <span className="text-[#6aa9ff]">●</span> MA50
            </Pill>
            <Pill active={vol} onClick={() => setVol((v) => !v)}>{tr('KL', 'Vol')}</Pill>
          </div>
          {rangePerf && (
            <div className="text-[11px] font-mono text-[#777] flex items-center gap-3">
              <span>
                {tf}:{' '}
                <span className={`font-bold ${pctCls(rangePerf.pct)}`}>
                  {rangePerf.pct > 0 ? '+' : ''}
                  {rangePerf.pct.toFixed(2)}%
                </span>
              </span>
              <span className="hidden sm:inline">
                {tr('Cao', 'High')} <span className="text-zinc-300">{rangePerf.hi.toLocaleString(locale, { maximumFractionDigits: 1 })}</span>
              </span>
              <span className="hidden sm:inline">
                {tr('Thấp', 'Low')} <span className="text-zinc-300">{rangePerf.lo.toLocaleString(locale, { maximumFractionDigits: 1 })}</span>
              </span>
            </div>
          )}
        </div>

        <div className="relative w-full">
          {chartData.length > 0 ? (
            <HeroIndexChart
              candles={chartData}
              kind={kind}
              showMA20={ma20}
              showMA50={ma50}
              showVolume={vol}
              height={320}
              onHover={(c, prev) => setHover(c ? { c, prev } : null)}
            />
          ) : (
            <div className="h-[320px] flex items-center justify-center text-xs font-mono text-[#666]">
              {loadingHist ? tr('Đang nạp dữ liệu lịch sử...', 'Loading historical data...') : tr('Chưa có dữ liệu lịch sử cho chỉ số này', 'No historical data for this index')}
            </div>
          )}
          {loadingHist && chartData.length > 0 && (
            <div className="absolute inset-0 bg-[#111111]/60 flex items-center justify-center text-xs font-mono text-[#888] rounded-xl">
              {tr('Đang nạp...', 'Loading...')}
            </div>
          )}
        </div>
        <p className="text-[10px] font-mono text-[#555] -mt-2">
          {tr('Cuộn chuột để zoom · kéo để di chuyển · rê chuột để xem từng phiên', 'Scroll to zoom · drag to pan · hover to inspect each session')}
        </p>
      </div>

      {/* ── RIGHT: Radar ── */}
      <div className="lg:col-span-4 bg-[#111111] border border-[#1a1a1a] rounded-2xl p-5 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => switchRadar('minervini')}
                className={`relative px-2 py-1 text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  radarTab === 'minervini' ? 'text-white' : 'text-[#777777] hover:text-[#bbbbbb]'
                }`}
              >
                <Lightning className="w-3.5 h-3.5 text-[#10b981]" />
                <span>{tr('Top Tăng Trưởng', 'Top Growth')}</span>
                {radarTab === 'minervini' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#10b981]" />
                )}
              </button>
              <button
                onClick={() => switchRadar('valuation')}
                className={`relative px-2 py-1 text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  radarTab === 'valuation' ? 'text-white' : 'text-[#777777] hover:text-[#bbbbbb]'
                }`}
              >
                <Scales className="w-3.5 h-3.5 text-[#e5a93b]" />
                <span>{tr('Định Giá Rẻ (PEG)', 'Cheap Valuation (PEG)')}</span>
                {radarTab === 'valuation' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#e5a93b]" />
                )}
              </button>
            </div>
            <Link
              href="/market"
              className="text-[11px] font-mono text-[#888888] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>{tr('Xem hết', 'View all')}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 pt-2.5">
            <span className="text-[10px] font-mono text-[#555] mr-1">{tr('Sắp xếp', 'Sort by')}</span>
            {radarTab === 'minervini' ? (
              <>
                <Pill active={mSort === 'rs'} onClick={() => setMSort('rs')}>RS</Pill>
                <Pill active={mSort === 'chg'} onClick={() => setMSort('chg')}>{tr('% Giá', '% Price')}</Pill>
                <Pill active={mSort === 'vol'} onClick={() => setMSort('vol')}>{tr('KL vọt', 'Vol surge')}</Pill>
              </>
            ) : (
              <>
                <Pill active={vSort === 'peg'} onClick={() => setVSort('peg')}>PEG</Pill>
                <Pill active={vSort === 'pe'} onClick={() => setVSort('pe')}>P/E</Pill>
                <Pill active={vSort === 'growth'} onClick={() => setVSort('growth')}>{tr('LNST', 'Net profit')}</Pill>
              </>
            )}
          </div>

          <div className="divide-y divide-[#181818] pt-1" key={radarTab + (radarTab === 'minervini' ? mSort : vSort)}>
            {radarTab === 'minervini'
              ? leadersShown.map((s: any, i: number) => {
                  const open = expanded === s.symbol;
                  return (
                    <div key={s.symbol} className="animate-[fadeIn_.25s_ease-out_both]" style={{ animationDelay: `${i * 30}ms` }}>
                      <button
                        onClick={() => setExpanded(open ? null : s.symbol)}
                        className="w-full py-2.5 px-1.5 flex items-center justify-between hover:bg-[#161616] rounded-xl transition-colors group cursor-pointer text-left"
                        aria-expanded={open}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white group-hover:text-[#10b981] transition-colors">
                              {s.symbol}
                            </span>
                            <span className="px-1.5 rounded text-[10px] font-mono font-bold bg-[#1a2512] text-[#10b981]">
                              RS {s.rsRating}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#777777] font-sans block truncate max-w-[170px]">
                            {sectorLabel(s.sector, language) || s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-white tabular-nums">{fmtPrice(s.price, locale)}</div>
                            <span className={`text-xs font-bold ${pctCls(s.changePct)}`}>
                              {s.changePct > 0 ? '+' : ''}
                              {s.changePct?.toFixed(2)}%
                            </span>
                          </div>
                          <CaretDown className={`w-3 h-3 text-[#555] transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="mx-1.5 mb-2 rounded-lg bg-[#0d0d0d] border border-[#1c1c1c] p-3 grid grid-cols-3 gap-y-2 gap-x-3 text-[10px] font-mono">
                            <Stat k={tr('Hiệu suất 1T', '1M return')} v={s.perf1M} pct />
                            <Stat k={tr('Hiệu suất 1N', '1Y return')} v={s.perf1Y} pct />
                            <Stat k={tr('Cách đỉnh 52T', 'From 52W high')} v={s.distHigh} pct />
                            <Stat k={tr('KL / TB20', 'Vol / 20D avg')} v={s.relVol} suffix="x" />
                            <Stat k={tr('Điểm Minervini', 'Minervini score')} v={s.score} suffix="/8" plain />
                            <Stat k={tr('Vốn hoá', 'Market cap')} v={s.mktCapT ? s.mktCapT / 1000 : null} suffix={tr(' nghìn tỷ', 'T VND')} plain />
                            <Link
                              href={`/market?symbol=${s.symbol}`}
                              className="col-span-3 mt-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] font-bold transition-colors"
                            >
                              {tr('Mở phân tích', 'Open analysis for')} {s.symbol} <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              : valuations.map((s, i) => {
                  const open = expanded === s.symbol;
                  return (
                    <div key={s.symbol} className="animate-[fadeIn_.25s_ease-out_both]" style={{ animationDelay: `${i * 30}ms` }}>
                      <button
                        onClick={() => setExpanded(open ? null : s.symbol)}
                        className="w-full py-2.5 px-1.5 flex items-center justify-between hover:bg-[#161616] rounded-xl transition-colors group cursor-pointer text-left"
                        aria-expanded={open}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white group-hover:text-[#e5a93b] transition-colors">
                              {s.symbol}
                            </span>
                            <span className="px-1.5 rounded text-[10px] font-mono font-bold bg-[#2a2210] text-[#e5a93b]">
                              PEG {s.peg}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#777777] font-sans block truncate max-w-[170px]">
                            P/E {s.pe}x • P/B {s.pb}x
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right font-mono">
                            <div className="text-xs font-bold text-[#10b981]">{tr('LNST', 'Net profit')} +{s.growth}%</div>
                            <span className="text-[10px] text-[#888888] uppercase">{language === 'en' ? VALUATION_STATUS_EN[s.status] || s.status : s.status}</span>
                          </div>
                          <CaretDown className={`w-3 h-3 text-[#555] transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="mx-1.5 mb-2 rounded-lg bg-[#0d0d0d] border border-[#1c1c1c] p-3 text-[10px] font-mono space-y-2">
                            <div className="text-[#888]">{s.name} · {s.sector}</div>
                            {/* PEG gauge: 1.0 = định giá hợp lý theo Peter Lynch */}
                            <div>
                              <div className="flex justify-between text-[#666] mb-1">
                                <span>PEG {s.peg}</span>
                                <span>{tr('1.0 = hợp lý', '1.0 = fair value')}</span>
                              </div>
                              <div className="relative h-1.5 rounded bg-[#1a1a1a]">
                                <div
                                  className="absolute inset-y-0 left-0 rounded bg-[#e5a93b]"
                                  style={{ width: `${Math.min(100, (s.peg / 2) * 100)}%` }}
                                />
                                <div className="absolute -top-0.5 -bottom-0.5 w-px bg-[#666]" style={{ left: '50%' }} />
                              </div>
                            </div>
                            <Link
                              href={`/market?symbol=${s.symbol}`}
                              className="inline-flex w-full items-center justify-center gap-1 py-1.5 rounded-md bg-[#e5a93b]/10 hover:bg-[#e5a93b]/20 text-[#e5a93b] font-bold transition-colors"
                            >
                              {tr('Xem định giá', 'View valuation for')} {s.symbol} <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>

          {radarTab === 'minervini' && leaders.length > 5 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full mt-1 py-1.5 text-[11px] font-mono text-[#777] hover:text-white transition-colors cursor-pointer"
            >
              {showAll ? tr('Thu gọn', 'Show less') : tr(`Hiện thêm ${Math.min(10, leaders.length) - 5} mã`, `Show ${Math.min(10, leaders.length) - 5} more`)}
            </button>
          )}
        </div>

        <div className="pt-3 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-[#666666]">
          <span>{tr('Dữ liệu: DNSE & BCTC Kiểm toán', 'Data: DNSE & audited financials')}</span>
          <span className="text-[#10b981] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> {tr('100% Dữ liệu thật', '100% Real data')}
          </span>
        </div>
      </div>
    </div>
  );
};

const Stat = ({
  k,
  v,
  pct,
  suffix = '',
  plain,
}: {
  k: string;
  v: number | null | undefined;
  pct?: boolean;
  suffix?: string;
  plain?: boolean;
}) => (
  <div>
    <div className="text-[#555]">{k}</div>
    <div className={`font-bold ${v == null ? 'text-[#555]' : pct ? pctCls(v) : 'text-zinc-200'}`}>
      {v == null ? '--' : `${pct && v > 0 ? '+' : ''}${plain ? v : v.toFixed(pct ? 1 : 2)}${pct ? '%' : suffix}`}
    </div>
  </div>
);
