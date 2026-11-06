'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  LineStyle,
} from 'lightweight-charts';
import { X, Sparkle, CaretDown, Minus, ChartLine } from '@phosphor-icons/react';
import {
  calculateGeneralEvaluationDataset,
  GeneralEvaluationDataset,
} from '../utils/generalEvaluationIndicators';

export type GeneralEvaluationViewMode = 'all' | 'vortex' | 'macd' | 'ao' | 'rsi';

export interface SynchronizedCrosshairData {
  x: number | null;
  time: Time | null;
  dateStr: string | null;
  kamaVal?: number;
  viPlusVal?: number;
  viMinusVal?: number;
  macdVal?: number;
  signalVal?: number;
  histVal?: number;
  aoVal?: number;
  rsiVal?: number;
}

interface GeneralEvaluationSubChartProps {
  stockCandles: CandlestickData<Time>[];
  volumes?: HistogramData<Time>[];
  mainChart: IChartApi | null;
  onClose: () => void;
  selectedSymbol: string;
  initialView?: GeneralEvaluationViewMode;
  onCrosshairChange?: (data: SynchronizedCrosshairData | null) => void;
}

function formatDate(t: Time | null): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
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

export const GeneralEvaluationSubChart: React.FC<GeneralEvaluationSubChartProps> = ({
  stockCandles,
  volumes = [],
  mainChart,
  onClose,
  selectedSymbol,
  initialView = 'all',
  onCrosshairChange,
}) => {
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Pane container refs
  const containerVortexRef = useRef<HTMLDivElement>(null);
  const containerMacdRef = useRef<HTMLDivElement>(null);
  const containerAoRef = useRef<HTMLDivElement>(null);
  const containerRsiRef = useRef<HTMLDivElement>(null);

  // Chart API refs
  const chartVortexRef = useRef<IChartApi | null>(null);
  const chartMacdRef = useRef<IChartApi | null>(null);
  const chartAoRef = useRef<IChartApi | null>(null);
  const chartRsiRef = useRef<IChartApi | null>(null);

  // Series instances for coordinate calculations
  const seriesVortexPlusRef = useRef<any>(null);
  const seriesVortexMinusRef = useRef<any>(null);
  const seriesMacdRef = useRef<any>(null);
  const seriesSignalRef = useRef<any>(null);
  const seriesAoRef = useRef<any>(null);
  const seriesRsiRef = useRef<any>(null);

  const [dataset, setDataset] = useState<GeneralEvaluationDataset | null>(null);
  const [activeView, setActiveView] = useState<GeneralEvaluationViewMode>(initialView);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Live Hover Telemetry Values
  const [hoverValues, setHoverValues] = useState<{
    viPlus?: number;
    viMinus?: number;
    macd?: number;
    signal?: number;
    hist?: number;
    ao?: number;
    rsi?: number;
  }>({});

  // Overlay state for Synchronized Crosshair Guide Line & Marker Dots
  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    dateStr: string;
    dots: { id: string; y: number; color: string }[];
  } | null>(null);

  // 1. Calculate General Evaluation Dataset whenever candles or symbol change
  useEffect(() => {
    if (!stockCandles || stockCandles.length === 0) return;
    const ds = calculateGeneralEvaluationDataset(stockCandles, volumes);
    setDataset(ds);
    setHoverValues({
      viPlus: ds.currentVIPlus,
      viMinus: ds.currentVIMinus,
      macd: ds.currentMACD,
      signal: ds.currentSignal,
      hist: ds.currentHist,
      ao: ds.currentAO,
      rsi: ds.currentRSI,
    });
  }, [stockCandles, volumes, selectedSymbol]);

  // Sync activeView with initialView prop changes
  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  // 2. Initialize and Synchronize Sub-Chart Panes
  useEffect(() => {
    if (!dataset || isCollapsed) return;

    // Cleanup previous chart instances if any
    [chartVortexRef, chartMacdRef, chartAoRef, chartRsiRef].forEach((ref) => {
      if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
    });
    seriesVortexPlusRef.current = null;
    seriesVortexMinusRef.current = null;
    seriesMacdRef.current = null;
    seriesSignalRef.current = null;
    seriesAoRef.current = null;
    seriesRsiRef.current = null;

    const commonOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 255, 255, 0.25)',
          labelBackgroundColor: '#18181b',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.25)',
          labelBackgroundColor: '#18181b',
        },
      },
      timeScale: {
        visible: false,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignLabels: true,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
    };

    const subCharts: IChartApi[] = [];
    const isSingle = activeView !== 'all';
    const paneHeight = isSingle ? 140 : 66;

    // ── PANE 1: VORTEX INDICATOR (VI+, VI-) ────────────────────────────
    if (activeView === 'all' || activeView === 'vortex') {
      const c = containerVortexRef.current;
      if (c) {
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: paneHeight,
          timeScale: {
            ...commonOptions.timeScale,
            visible: activeView === 'vortex',
          },
        });
        chartVortexRef.current = chart;
        subCharts.push(chart);

        // Baseline 1.0
        const line1 = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.18)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line1.setData(dataset.viPlusPoints.map((d) => ({ time: d.time, value: 1.0 })));

        // VI- (Red / Rose)
        const viMinusSeries = chart.addSeries(LineSeries, {
          color: '#f43f5e',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: '#f43f5e',
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          title: 'VI-',
        });
        viMinusSeries.setData(dataset.viMinusPoints);
        seriesVortexMinusRef.current = viMinusSeries;

        // VI+ (Cyan / Teal)
        const viPlusSeries = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: '#06b6d4',
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          title: 'VI+',
        });
        viPlusSeries.setData(dataset.viPlusPoints);
        seriesVortexPlusRef.current = viPlusSeries;
      }
    }

    // ── PANE 2: MACD (MACD, Signal, Histogram) ─────────────────────────
    if (activeView === 'all' || activeView === 'macd') {
      const c = containerMacdRef.current;
      if (c) {
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: paneHeight,
          timeScale: {
            ...commonOptions.timeScale,
            visible: activeView === 'macd',
          },
        });
        chartMacdRef.current = chart;
        subCharts.push(chart);

        // Baseline 0.0
        const lineZero = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.18)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineZero.setData(dataset.macdPoints.map((d) => ({ time: d.time, value: 0 })));

        // Histogram
        const histSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: false,
          lastValueVisible: false,
        });
        histSeries.setData(dataset.histPoints);

        // Signal Line (Orange)
        const signalSeries = chart.addSeries(LineSeries, {
          color: '#fb923c',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          title: 'Sig',
        });
        signalSeries.setData(dataset.signalPoints);
        seriesSignalRef.current = signalSeries;

        // MACD Line (Blue)
        const macdSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: '#3b82f6',
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          title: 'MACD',
        });
        macdSeries.setData(dataset.macdPoints);
        seriesMacdRef.current = macdSeries;
      }
    }

    // ── PANE 3: AWESOME OSCILLATOR (AO) ────────────────────────────────
    if (activeView === 'all' || activeView === 'ao') {
      const c = containerAoRef.current;
      if (c) {
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: paneHeight,
          timeScale: {
            ...commonOptions.timeScale,
            visible: activeView === 'ao',
          },
        });
        chartAoRef.current = chart;
        subCharts.push(chart);

        // Baseline 0.0
        const lineZero = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.18)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineZero.setData(dataset.aoPoints.map((d) => ({ time: d.time, value: 0 })));

        // AO Histogram
        const aoSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: true,
          lastValueVisible: true,
          title: 'AO',
        });
        aoSeries.setData(dataset.aoPoints);
        seriesAoRef.current = aoSeries;
      }
    }

    // ── PANE 4: RSI (14) ───────────────────────────────────────────────
    if (activeView === 'all' || activeView === 'rsi') {
      const c = containerRsiRef.current;
      if (c) {
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: paneHeight,
          timeScale: {
            visible: true,
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        });
        chartRsiRef.current = chart;
        subCharts.push(chart);

        // Line 70 (Overbought)
        const line70 = chart.addSeries(LineSeries, {
          color: 'rgba(244, 63, 94, 0.35)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        // Line 50 (Midline)
        const line50 = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.12)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        // Line 30 (Oversold)
        const line30 = chart.addSeries(LineSeries, {
          color: 'rgba(16, 185, 129, 0.35)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        // RSI Line (Pink / Magenta)
        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#ec4899',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: true,
          lastValueVisible: true,
          priceLineColor: '#ec4899',
          title: 'RSI',
        });

        line70.setData(dataset.rsiPoints.map((d) => ({ time: d.time, value: 70 })));
        line50.setData(dataset.rsiPoints.map((d) => ({ time: d.time, value: 50 })));
        line30.setData(dataset.rsiPoints.map((d) => ({ time: d.time, value: 30 })));
        rsiSeries.setData(dataset.rsiPoints);

        seriesRsiRef.current = rsiSeries;
      }
    }

    if (subCharts.length === 0) return;

    // ── Synchronization: Bidirectional TimeScale with Main Chart ───────
    let isSyncing = false;
    const syncTimeScale = (sourceChart: IChartApi, targets: (IChartApi | null)[]) => {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        targets.forEach((target) => {
          if (target && target !== sourceChart) {
            try {
              target.timeScale().setVisibleLogicalRange(range);
            } catch {}
          }
        });
        isSyncing = false;
      });
    };

    if (mainChart) {
      syncTimeScale(mainChart, subCharts);
      subCharts.forEach((sc) => syncTimeScale(sc, [mainChart, ...subCharts]));

      // Align initial logical range immediately
      requestAnimationFrame(() => {
        const mainRange = mainChart.timeScale().getVisibleLogicalRange();
        if (mainRange) {
          subCharts.forEach((sc) => {
            try {
              sc.timeScale().setVisibleLogicalRange(mainRange);
            } catch {}
          });
        }
      });
    }

    // ── Synchronization: Crosshair Move with Coordinate Dots ───────────
    const handleCrosshairMove = (param: any) => {
      if (!param || !param.time || !containerWrapperRef.current) {
        setCrosshairPos(null);
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      // 1. Get pixel X
      let pixelX: number | null = null;
      if (param.point && typeof param.point.x === 'number') {
        pixelX = param.point.x;
      } else {
        const refChart = subCharts[0] || mainChart;
        if (refChart) {
          try {
            pixelX = refChart.timeScale().timeToCoordinate(param.time);
          } catch {}
        }
      }

      if (pixelX === null || pixelX < 0) {
        setCrosshairPos(null);
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      // 2. Extract values for this time
      const timeStr = String(param.time);
      const viPlusPoint = dataset.viPlusPoints.find((p) => String(p.time) === timeStr);
      const viMinusPoint = dataset.viMinusPoints.find((p) => String(p.time) === timeStr);
      const macdPoint = dataset.macdPoints.find((p) => String(p.time) === timeStr);
      const signalPoint = dataset.signalPoints.find((p) => String(p.time) === timeStr);
      const histPoint = dataset.histPoints.find((p) => String(p.time) === timeStr);
      const aoPoint = dataset.aoPoints.find((p) => String(p.time) === timeStr);
      const rsiPoint = dataset.rsiPoints.find((p) => String(p.time) === timeStr);
      const kamaPoint = dataset.kamaPoints.find((p) => String(p.time) === timeStr);

      const viPlusVal = viPlusPoint?.value;
      const viMinusVal = viMinusPoint?.value;
      const macdVal = macdPoint?.value;
      const signalVal = signalPoint?.value;
      const histVal = histPoint?.value;
      const aoVal = aoPoint?.value;
      const rsiVal = rsiPoint?.value;
      const kamaVal = kamaPoint?.value;

      setHoverValues({
        viPlus: viPlusVal ?? dataset.currentVIPlus,
        viMinus: viMinusVal ?? dataset.currentVIMinus,
        macd: macdVal ?? dataset.currentMACD,
        signal: signalVal ?? dataset.currentSignal,
        hist: histVal ?? dataset.currentHist,
        ao: aoVal ?? dataset.currentAO,
        rsi: rsiVal ?? dataset.currentRSI,
      });

      // 3. Compute Y coordinates for all indicator marker dots
      const dots: { id: string; y: number; color: string }[] = [];
      const wrapperRect = containerWrapperRef.current.getBoundingClientRect();

      const computeDot = (
        container: HTMLDivElement | null,
        series: any,
        val: number | undefined,
        id: string,
        color: string
      ) => {
        if (!container || !series || typeof val !== 'number') return;
        try {
          const coord = series.priceToCoordinate(val);
          if (coord !== null && !isNaN(coord)) {
            const cRect = container.getBoundingClientRect();
            const yOffset = cRect.top - wrapperRect.top;
            dots.push({ id, y: yOffset + coord, color });
          }
        } catch {}
      };

      computeDot(containerVortexRef.current, seriesVortexPlusRef.current, viPlusVal, 'vi_plus', '#06b6d4');
      computeDot(containerVortexRef.current, seriesVortexMinusRef.current, viMinusVal, 'vi_minus', '#f43f5e');
      computeDot(containerMacdRef.current, seriesMacdRef.current, macdVal, 'macd', '#3b82f6');
      computeDot(containerMacdRef.current, seriesSignalRef.current, signalVal, 'signal', '#fb923c');
      computeDot(containerAoRef.current, seriesAoRef.current, aoVal, 'ao', '#10b981');
      computeDot(containerRsiRef.current, seriesRsiRef.current, rsiVal, 'rsi', '#ec4899');

      const dateStr = formatDate(param.time);
      setCrosshairPos({
        x: pixelX,
        dateStr,
        dots,
      });

      if (onCrosshairChange) {
        onCrosshairChange({
          x: pixelX,
          time: param.time,
          dateStr,
          kamaVal,
          viPlusVal,
          viMinusVal,
          macdVal,
          signalVal,
          histVal,
          aoVal,
          rsiVal,
        });
      }
    };

    subCharts.forEach((sc) => sc.subscribeCrosshairMove(handleCrosshairMove));
    if (mainChart) {
      mainChart.subscribeCrosshairMove(handleCrosshairMove);
    }

    // Resize Observer for mounted panes
    const firstContainer =
      containerVortexRef.current ||
      containerMacdRef.current ||
      containerAoRef.current ||
      containerRsiRef.current;

    let resizeObserver: ResizeObserver | null = null;
    if (firstContainer) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            subCharts.forEach((sc) => sc.applyOptions({ width: w }));
            if (mainChart) {
              const range = mainChart.timeScale().getVisibleLogicalRange();
              if (range) {
                subCharts.forEach((sc) => {
                  try {
                    sc.timeScale().setVisibleLogicalRange(range);
                  } catch {}
                });
              }
            }
          }
        }
      });
      resizeObserver.observe(firstContainer);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      subCharts.forEach((sc) => sc.remove());
      chartVortexRef.current = null;
      chartMacdRef.current = null;
      chartAoRef.current = null;
      chartRsiRef.current = null;
    };
  }, [dataset, mainChart, activeView, isCollapsed]);

  return (
    <div
      ref={containerWrapperRef}
      className="w-full border-t border-zinc-800/80 bg-zinc-950 flex flex-col relative shrink-0 select-none"
    >
      {/* ── Top Header Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/90 border-b border-zinc-800/80 text-[11px] font-mono">
        {/* Left: Title + Current Values */}
        <div className="flex items-center gap-2">
          <Sparkle className="w-3.5 h-3.5 text-cyan-400 shrink-0" weight="fill" />
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            {activeView === 'all'
              ? '⚡ TEMPLATE ĐÁNH GIÁ CHUNG (4-IN-1)'
              : activeView === 'vortex'
              ? '⚡ VORTEX INDICATOR (VI+, VI-)'
              : activeView === 'macd'
              ? '⚡ MACD OSCILLATOR'
              : activeView === 'ao'
              ? '⚡ AWESOME OSCILLATOR (AO)'
              : '⚡ RELATIVE STRENGTH INDEX (RSI)'}
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">| {selectedSymbol}</span>
        </div>

        {/* Right: View Switcher Tabs + Minimize + Close */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800/80">
            <button
              onClick={() => setActiveView('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeView === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tất cả (4-in-1)
            </button>
            <button
              onClick={() => setActiveView('vortex')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeView === 'vortex'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Vortex
            </button>
            <button
              onClick={() => setActiveView('macd')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeView === 'macd'
                  ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              MACD
            </button>
            <button
              onClick={() => setActiveView('ao')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeView === 'ao'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              AO
            </button>
            <button
              onClick={() => setActiveView('rsi')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeView === 'rsi'
                  ? 'bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              RSI
            </button>
          </div>

          {/* Minimize / Expand Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title={isCollapsed ? 'Mở rộng' : 'Thu nhỏ'}
          >
            {isCollapsed ? <CaretDown size={14} /> : <Minus size={14} />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            title="Đóng Template Đánh Giá Chung"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Sub-Chart Panes Container ─────────────────────────────────── */}
      {!isCollapsed && (
        <div className="flex flex-col relative w-full bg-zinc-950 overflow-hidden">
          {/* ── PANE 1: VORTEX INDICATOR ──────────────────────────────── */}
          {(activeView === 'all' || activeView === 'vortex') && (
            <div className="w-full flex flex-col relative border-b border-zinc-900">
              <div className="absolute top-1.5 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono select-none px-2 py-0.5 rounded bg-zinc-950/85 backdrop-blur-md border border-zinc-800/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                <span className="font-bold text-zinc-400">Vortex</span>
                <span className="text-cyan-400 font-bold">
                  VI+ {hoverValues.viPlus !== undefined ? hoverValues.viPlus.toFixed(2) : '--'}
                </span>
                <span className="text-rose-400 font-bold">
                  VI- {hoverValues.viMinus !== undefined ? hoverValues.viMinus.toFixed(2) : '--'}
                </span>
              </div>
              <div
                ref={containerVortexRef}
                className={`w-full ${activeView === 'vortex' ? 'h-[140px]' : 'h-[66px]'}`}
              />
            </div>
          )}

          {/* ── PANE 2: MACD ──────────────────────────────────────────── */}
          {(activeView === 'all' || activeView === 'macd') && (
            <div className="w-full flex flex-col relative border-b border-zinc-900">
              <div className="absolute top-1.5 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono select-none px-2 py-0.5 rounded bg-zinc-950/85 backdrop-blur-md border border-zinc-800/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                <span className="font-bold text-zinc-400">MACD</span>
                <span className="text-zinc-300 font-bold">
                  hist {hoverValues.hist !== undefined ? hoverValues.hist.toFixed(2) : '--'}
                </span>
                <span className="text-blue-400 font-bold">
                  MACD {hoverValues.macd !== undefined ? hoverValues.macd.toFixed(2) : '--'}
                </span>
                <span className="text-amber-400 font-bold">
                  sig {hoverValues.signal !== undefined ? hoverValues.signal.toFixed(2) : '--'}
                </span>
              </div>
              <div
                ref={containerMacdRef}
                className={`w-full ${activeView === 'macd' ? 'h-[140px]' : 'h-[66px]'}`}
              />
            </div>
          )}

          {/* ── PANE 3: AWESOME OSCILLATOR (AO) ───────────────────────── */}
          {(activeView === 'all' || activeView === 'ao') && (
            <div className="w-full flex flex-col relative border-b border-zinc-900">
              <div className="absolute top-1.5 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono select-none px-2 py-0.5 rounded bg-zinc-950/85 backdrop-blur-md border border-zinc-800/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span className="font-bold text-zinc-400">Awesome Osc</span>
                <span
                  className={`font-bold ${
                    (hoverValues.ao ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  AO {hoverValues.ao !== undefined ? hoverValues.ao.toFixed(2) : '--'}
                </span>
              </div>
              <div
                ref={containerAoRef}
                className={`w-full ${activeView === 'ao' ? 'h-[140px]' : 'h-[66px]'}`}
              />
            </div>
          )}

          {/* ── PANE 4: RSI ───────────────────────────────────────────── */}
          {(activeView === 'all' || activeView === 'rsi') && (
            <div className="w-full flex flex-col relative">
              <div className="absolute top-1.5 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono select-none px-2 py-0.5 rounded bg-zinc-950/85 backdrop-blur-md border border-zinc-800/60 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
                <span className="font-bold text-zinc-400">RSI</span>
                <span className="text-pink-400 font-bold">
                  {hoverValues.rsi !== undefined ? hoverValues.rsi.toFixed(2) : '--'}
                </span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-bold border ${
                    (hoverValues.rsi ?? 50) >= 70
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : (hoverValues.rsi ?? 50) <= 30
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                  }`}
                >
                  {(hoverValues.rsi ?? 50) >= 70
                    ? 'Quá mua (>70)'
                    : (hoverValues.rsi ?? 50) <= 30
                    ? 'Quá bán (<30)'
                    : 'Cân bằng'}
                </span>
              </div>
              <div
                ref={containerRsiRef}
                className={`w-full ${activeView === 'rsi' ? 'h-[140px]' : 'h-[72px]'}`}
              />
            </div>
          )}

          {/* ── SYNCHRONIZED SVG OVERLAY: VERTICAL GUIDELINE & MARKER DOTS ── */}
          {crosshairPos && (
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
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />

              {/* Marker Dots on each Indicator */}
              {crosshairPos.dots.map((dot) => (
                <g key={dot.id}>
                  {/* Outer pulse glow */}
                  <circle
                    cx={crosshairPos.x}
                    cy={dot.y}
                    r={5}
                    fill={dot.color}
                    opacity={0.3}
                  />
                  {/* Solid center dot */}
                  <circle
                    cx={crosshairPos.x}
                    cy={dot.y}
                    r={3}
                    fill={dot.color}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                </g>
              ))}

              {/* Bottom Date Badge at foot of vertical crosshair line */}
              {crosshairPos.dateStr && (
                <g transform={`translate(${crosshairPos.x}, ${activeView === 'all' ? 260 : 130})`}>
                  <rect
                    x={-38}
                    y={-14}
                    width={76}
                    height={16}
                    rx={3}
                    fill="#18181b"
                    stroke="rgba(255, 255, 255, 0.35)"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={-3}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={9.5}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {crosshairPos.dateStr}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>
      )}
    </div>
  );
};
