'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  Time,
  LineStyle,
  ISeriesApi,
} from 'lightweight-charts';
import {
  X,
  Minus,
  Gear,
  Sparkle,
  TrendUp,
  Sliders,
  CaretDown,
} from '@phosphor-icons/react';
import {
  calculateMCDX,
  DEFAULT_MCDX_SETTINGS,
  MCDXDataset,
  MCDXPoint,
  MCDXSettings,
} from '../utils/mcdxIndicator';

export interface MCDXCrosshairData {
  x: number | null;
  time: Time | null;
  dateStr: string | null;
  banker?: number;
  hotMoney?: number;
  retailer?: number;
  bankerMA?: number;
}

interface MCDXSubChartProps {
  stockCandles: CandlestickData<Time>[];
  mainChart: IChartApi | null;
  onClose: () => void;
  selectedSymbol: string;
  onCrosshairChange?: (data: MCDXCrosshairData | null) => void;
}

function formatDate(t: Time | null): string {
  if (!t) return '';
  if (typeof t === 'string') {
    const parts = t.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return t;
  }
  if (typeof t === 'number') {
    return new Date(t * 1000).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }
  if (typeof t === 'object' && t !== null && 'year' in t) {
    const y = (t as any).year;
    const m = String((t as any).month).padStart(2, '0');
    const d = String((t as any).day).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  return String(t);
}

export const MCDXSubChart: React.FC<MCDXSubChartProps> = ({
  stockCandles,
  mainChart,
  onClose,
  selectedSymbol,
  onCrosshairChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<MCDXSettings>(DEFAULT_MCDX_SETTINGS);

  // Overlay state for Synchronized Crosshair Guide Line & Banker MA Dot
  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    dateStr: string;
    dotBankerMA?: number;
  } | null>(null);

  // Compute dataset
  const dataset: MCDXDataset = useMemo(() => {
    return calculateMCDX(stockCandles, settings);
  }, [stockCandles, settings]);

  // Live hover point
  const [hoveredPoint, setHoveredPoint] = useState<MCDXPoint | null>(null);

  // Active point to display in header (hovered or latest)
  const activePoint = hoveredPoint || dataset.latest;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || dataset.points.length === 0 || isCollapsed) return;

    let isDisposed = false;
    let rafId: number | null = null;
    const cleanups: Array<() => void> = [];

    const width = container.clientWidth || 600;
    const height = 148;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: LineStyle.Dotted,
          labelVisible: false,
        },
        horzLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: LineStyle.Dotted,
          labelVisible: true,
        },
      },
      timeScale: {
        visible: false, // Hidden to save space and align cleanly under main candle chart
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.02, bottom: 0.0 },
        autoScale: false,
        mode: 0,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartInstanceRef.current = chart;

    // Fixed price scale range: 0 to 20
    try {
      chart.priceScale('right').applyOptions({
        autoScale: false,
      });
    } catch {}

    // ── SERIES 1: Retailer (Green background ceiling - value 20.00) ───────
    const retailerSeries = chart.addSeries(HistogramSeries, {
      color: '#22c55e', // Bright green for small retail crowd
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    });

    // ── SERIES 2: Hot Money (Yellow / Speculator - value hotMoney) ────────
    const hotMoneySeries = chart.addSeries(HistogramSeries, {
      color: '#eab308', // Amber yellow for short-term speculative waves
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    });

    // ── SERIES 3: Banker (Red / Smart Money - value banker) ───────────────
    const bankerSeries = chart.addSeries(HistogramSeries, {
      color: '#ef4444', // Red for big institutional smart money
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    });

    // ── SERIES 4: Banker Moving Average Line (Lime Dotted Line) ───────────
    const bankerMASeries = chart.addSeries(LineSeries, {
      color: '#84cc16', // Lime green dotted line
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
      priceLineVisible: false,
      lastValueVisible: true,
      priceLineColor: '#84cc16',
    });

    // Populate Data
    const retailerData = dataset.points.map((p) => ({ time: p.time, value: 20.0 }));
    const hotMoneyData = dataset.points.map((p) => ({ time: p.time, value: p.hotMoney }));
    const bankerData = dataset.points.map((p) => ({ time: p.time, value: p.banker }));
    const bankerMAData = dataset.points.map((p) => ({ time: p.time, value: p.bankerMA }));

    retailerSeries.setData(retailerData);
    hotMoneySeries.setData(hotMoneyData);
    bankerSeries.setData(bankerData);
    bankerMASeries.setData(bankerMAData);

    // Add Reference Horizontal Lines: 15 (75%), 10 (50%), 5 (25%)
    try {
      bankerSeries.createPriceLine({
        price: 15,
        color: 'rgba(217, 70, 239, 0.35)', // 75% Dominance
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '75%',
      });
      bankerSeries.createPriceLine({
        price: 10,
        color: 'rgba(59, 130, 246, 0.45)', // 50% Markup threshold
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '50%',
      });
      bankerSeries.createPriceLine({
        price: 5,
        color: 'rgba(234, 179, 8, 0.35)', // 25% Accumulation
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '25%',
      });
    } catch {}

    // Point lookup map for O(1) crosshair queries
    const pointMap = new Map<string, MCDXPoint>();
    dataset.points.forEach((p) => {
      const key = typeof p.time === 'object' && 'year' in (p.time as any)
        ? `${(p.time as any).year}-${String((p.time as any).month).padStart(2, '0')}-${String((p.time as any).day).padStart(2, '0')}`
        : String(p.time);
      pointMap.set(key, p);
    });

    // ── Synchronization: Bidirectional TimeScale with Main Chart ───────
    let isSyncing = false;
    const syncTimeScale = (sourceChart: IChartApi, targetChart: IChartApi) => {
      const handler = (range: any) => {
        if (isDisposed || isSyncing || !range) return;
        isSyncing = true;
        try {
          targetChart.timeScale().setVisibleLogicalRange(range);
        } catch {}
        isSyncing = false;
      };

      try {
        sourceChart.timeScale().subscribeVisibleLogicalRangeChange(handler);
        cleanups.push(() => {
          try {
            sourceChart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
          } catch {}
        });
      } catch {}
    };

    if (mainChart) {
      syncTimeScale(mainChart, chart);
      syncTimeScale(chart, mainChart);

      // Align initial logical range immediately
      rafId = requestAnimationFrame(() => {
        if (isDisposed) return;
        try {
          const mainRange = mainChart.timeScale().getVisibleLogicalRange();
          if (mainRange) {
            chart.timeScale().setVisibleLogicalRange(mainRange);
          }
        } catch {}
      });
    }

    // ── Crosshair Hover Sync ───────────────────────────────────────────
    const handleCrosshairMove = (param: any) => {
      if (isDisposed || !containerRef.current) return;
      if (!param || !param.time) {
        setHoveredPoint(null);
        setCrosshairPos(null);
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      // 1. Get exact snapped bar-center pixel X
      let pixelX: number | null = null;
      const refChart = chart || mainChart;
      if (refChart) {
        try {
          const snappedX = refChart.timeScale().timeToCoordinate(param.time);
          if (snappedX !== null && !isNaN(snappedX)) {
            pixelX = snappedX;
          }
        } catch {}
      }
      if (pixelX === null && param.point && typeof param.point.x === 'number') {
        pixelX = param.point.x;
      }

      if (pixelX === null || pixelX < 0) {
        setHoveredPoint(null);
        setCrosshairPos(null);
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      const key = typeof param.time === 'object' && 'year' in (param.time as any)
        ? `${(param.time as any).year}-${String((param.time as any).month).padStart(2, '0')}-${String((param.time as any).day).padStart(2, '0')}`
        : String(param.time);
      const found = pointMap.get(key);
      if (found) {
        setHoveredPoint(found);

        let dotBankerMA: number | undefined;
        try {
          const coord = bankerMASeries.priceToCoordinate(found.bankerMA);
          if (coord !== null && !isNaN(coord)) {
            dotBankerMA = coord;
          }
        } catch {}

        const dateStr = formatDate(param.time);
        setCrosshairPos({
          x: pixelX,
          dateStr,
          dotBankerMA,
        });

        if (onCrosshairChange) {
          onCrosshairChange({
            x: pixelX,
            time: param.time,
            dateStr,
            banker: found.banker,
            hotMoney: found.hotMoney,
            retailer: found.retailer,
            bankerMA: found.bankerMA,
          });
        }
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    cleanups.push(() => {
      try {
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
      } catch {}
    });

    if (mainChart) {
      mainChart.subscribeCrosshairMove(handleCrosshairMove);
      cleanups.push(() => {
        try {
          mainChart.unsubscribeCrosshairMove(handleCrosshairMove);
        } catch {}
      });
    }

    // ── Responsive Resize Observer ─────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      if (isDisposed) return;
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          chart.applyOptions({ width: w });
        }
      }
    });
    ro.observe(container);
    cleanups.push(() => ro.disconnect());

    return () => {
      isDisposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      cleanups.forEach((c) => c());
      try {
        chart.remove();
      } catch {}
      chartInstanceRef.current = null;
    };
  }, [dataset, isCollapsed, mainChart]);

  return (
    <div
      className={`w-full border-t border-zinc-800/80 bg-zinc-950/95 flex flex-col relative shrink-0 transition-all ${
        isCollapsed ? 'h-[28px]' : 'h-[176px]'
      }`}
    >
      {/* ── Top Header / Legend Bar (Matches 24HMoney MCDX) ──────────── */}
      <div className="flex items-center justify-between px-3 h-7 bg-zinc-900/70 border-b border-zinc-800/60 select-none text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Title tag */}
          <div className="flex items-center gap-1 font-bold text-zinc-200 shrink-0">
            <span className="text-amber-400">24HMoney - MCDX</span>
            {activePoint && (
              <span className="text-[10px] text-zinc-500 font-normal ml-0.5">
                ({formatDate(activePoint.time)})
              </span>
            )}
          </div>

          {/* 4 Standard Values with 24HMoney Exact Color Palette */}
          {activePoint && (
            <div className="flex items-center gap-2 text-[11px] shrink-0 font-mono">
              {/* 1. Retailer (Green) */}
              <span className="text-emerald-400 font-bold">
                {activePoint.retailer.toFixed(2)}
              </span>

              {/* 2. Hot Money (Yellow) */}
              <span className="text-yellow-400 font-bold">
                {activePoint.hotMoney.toFixed(2)}
              </span>

              {/* 3. Banker (Red) */}
              <span className="text-rose-500 font-bold">
                {activePoint.banker.toFixed(2)}
              </span>

              {/* 4. Banker MA (Lime Dotted) */}
              <span className="text-lime-400 font-bold border-b border-dotted border-lime-400">
                {activePoint.bankerMA.toFixed(2)}
              </span>

              {/* Participant Breakdown Badges */}
              <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-800 text-[10px]">
                <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Tạo lập: {activePoint.bankerPct}%
                </span>
                <span className="px-1.5 py-0.2 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                  Đầu cơ: {activePoint.hotMoneyPct}%
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Nhỏ lẻ: {activePoint.retailerPct}%
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    activePoint.phase === 'dominance'
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                      : activePoint.phase === 'markup'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : activePoint.phase === 'accumulation'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : activePoint.phase === 'speculative'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {activePoint.phaseLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Cài đặt thông số MCDX"
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          >
            <Gear size={12} weight={showSettings ? 'fill' : 'regular'} />
          </button>

          {/* Collapse/Expand */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          >
            <Minus size={12} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Đóng chỉ báo MCDX"
            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Settings Popover Modal ────────────────────────────────────── */}
      {showSettings && (
        <div className="absolute right-3 top-8 z-50 w-72 bg-zinc-900/95 border border-zinc-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono text-zinc-200 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sliders size={14} /> Cài đặt MCDX
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X size={12} />
            </button>
          </div>

          {/* Banker Inputs */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
              1. Banker (Tạo lập / Tiền lớn)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] text-zinc-400 block">RSI Period</label>
                <input
                  type="number"
                  value={settings.bankerPeriod}
                  onChange={(e) =>
                    setSettings({ ...settings, bankerPeriod: Number(e.target.value) || 50 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block">Base</label>
                <input
                  type="number"
                  value={settings.bankerBase}
                  onChange={(e) =>
                    setSettings({ ...settings, bankerBase: Number(e.target.value) || 50 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block">Hệ số (Sens)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.bankerSens}
                  onChange={(e) =>
                    setSettings({ ...settings, bankerSens: Number(e.target.value) || 1.5 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 block">Banker MA Chu kỳ</label>
              <input
                type="number"
                value={settings.bankerMaPeriod}
                onChange={(e) =>
                  setSettings({ ...settings, bankerMaPeriod: Number(e.target.value) || 10 })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
              />
            </div>
          </div>

          {/* Hot Money Inputs */}
          <div className="space-y-1.5 border-t border-zinc-800/60 pt-2">
            <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
              2. Hot Money (Đầu cơ lướt sóng)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] text-zinc-400 block">RSI Period</label>
                <input
                  type="number"
                  value={settings.hotPeriod}
                  onChange={(e) =>
                    setSettings({ ...settings, hotPeriod: Number(e.target.value) || 40 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block">Base</label>
                <input
                  type="number"
                  value={settings.hotBase}
                  onChange={(e) =>
                    setSettings({ ...settings, hotBase: Number(e.target.value) || 30 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-400 block">Hệ số (Sens)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.hotSens}
                  onChange={(e) =>
                    setSettings({ ...settings, hotSens: Number(e.target.value) || 0.7 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Reset button */}
          <div className="pt-2 border-t border-zinc-800 flex justify-end">
            <button
              onClick={() => setSettings(DEFAULT_MCDX_SETTINGS)}
              className="text-[10px] text-zinc-400 hover:text-amber-400"
            >
              Khôi phục mặc định (24HMoney)
            </button>
          </div>
        </div>
      )}

      {/* ── Chart Container ───────────────────────────────────────────── */}
      {!isCollapsed && (
        <div ref={containerRef} className="w-full flex-1 min-h-0 relative">
          {crosshairPos && (
            <>
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-30"
                style={{ overflow: 'visible' }}
              >
                {/* Vertical Dashed Guideline */}
                <line
                  x1={crosshairPos.x}
                  y1={0}
                  x2={crosshairPos.x}
                  y2="100%"
                  stroke="rgba(255, 255, 255, 0.38)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />

                {/* Marker Dot on Banker MA Lime Line */}
                {crosshairPos.dotBankerMA !== undefined && (
                  <g>
                    <circle
                      cx={crosshairPos.x}
                      cy={crosshairPos.dotBankerMA}
                      r={4.5}
                      fill="#84cc16"
                      opacity={0.28}
                    />
                    <circle
                      cx={crosshairPos.x}
                      cy={crosshairPos.dotBankerMA}
                      r={2.75}
                      fill="#84cc16"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  </g>
                )}
              </svg>

              {/* Bottom Date Pill anchored cleanly on the Time Axis Bar */}
              {crosshairPos.dateStr && (
                <div
                  className="absolute bottom-0.5 z-30 pointer-events-none -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-[#18181b] border border-zinc-600 text-[9.5px] font-mono font-semibold text-zinc-100 tabular-nums whitespace-nowrap"
                  style={{ left: crosshairPos.x }}
                >
                  {crosshairPos.dateStr}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
