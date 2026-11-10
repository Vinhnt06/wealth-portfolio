'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  HistogramData,
  Time,
  LineStyle,
} from 'lightweight-charts';
import { X, CaretDown, Minus } from '@phosphor-icons/react';
import {
  calculateGeneralEvaluationDataset,
  evaluateConfluenceState,
  GeneralEvaluationConfluence,
  GeneralEvaluationDataset,
} from '../utils/generalEvaluationIndicators';

export type GeneralEvaluationViewMode = 'all' | 'vortex' | 'macd' | 'ao' | 'rsi';

export interface SynchronizedCrosshairData {
  x: number | null;
  time: Time | null;
  dateStr: string | null;
  closeVal?: number;
  kamaVal?: number;
  viPlusVal?: number;
  viMinusVal?: number;
  macdVal?: number;
  signalVal?: number;
  histVal?: number;
  aoVal?: number;
  aoRising?: boolean;
  rsiVal?: number;
  confluence?: GeneralEvaluationConfluence;
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

function getTimeKey(t: Time | null | undefined): string {
  if (t === null || t === undefined) return '';
  if (typeof t === 'string' || typeof t === 'number') return String(t);
  if (typeof t === 'object' && 'year' in t) {
    const bd = t as { year: number; month: number; day: number };
    return `${bd.year}-${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
  }
  return String(t);
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

  const lastCandleTimeKey =
    stockCandles && stockCandles.length > 0
      ? getTimeKey(stockCandles[stockCandles.length - 1].time)
      : '';
  const lastCandleClose =
    stockCandles && stockCandles.length > 0
      ? stockCandles[stockCandles.length - 1].close
      : 0;

  // Live Hover Telemetry Values
  const [hoverValues, setHoverValues] = useState<{
    close?: number;
    kama?: number;
    viPlus?: number;
    viMinus?: number;
    macd?: number;
    signal?: number;
    hist?: number;
    ao?: number;
    aoRising?: boolean;
    rsi?: number;
    confluence?: GeneralEvaluationConfluence;
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
      close: ds.currentClose,
      kama: ds.currentKAMA,
      viPlus: ds.currentVIPlus,
      viMinus: ds.currentVIMinus,
      macd: ds.currentMACD,
      signal: ds.currentSignal,
      hist: ds.currentHist,
      ao: ds.currentAO,
      aoRising: ds.currentAORising,
      rsi: ds.currentRSI,
      confluence: ds.confluence,
    });
  }, [stockCandles, stockCandles.length, lastCandleTimeKey, lastCandleClose, volumes, selectedSymbol]);

  // O(1) Lookup Maps keyed by normalized timeKey
  const lookupMaps = useMemo(() => {
    const closeMap = new Map<string, number>();
    const kamaMap = new Map<string, number>();
    const viPlusMap = new Map<string, number>();
    const viMinusMap = new Map<string, number>();
    const macdMap = new Map<string, number>();
    const signalMap = new Map<string, number>();
    const histMap = new Map<string, number>();
    const aoMap = new Map<string, { value: number; isRising: boolean }>();
    const rsiMap = new Map<string, number>();

    stockCandles.forEach((c) => closeMap.set(getTimeKey(c.time), c.close));
    if (dataset) {
      dataset.kamaPoints.forEach((p) => kamaMap.set(getTimeKey(p.time), p.value));
      dataset.viPlusPoints.forEach((p) => viPlusMap.set(getTimeKey(p.time), p.value));
      dataset.viMinusPoints.forEach((p) => viMinusMap.set(getTimeKey(p.time), p.value));
      dataset.macdPoints.forEach((p) => macdMap.set(getTimeKey(p.time), p.value));
      dataset.signalPoints.forEach((p) => signalMap.set(getTimeKey(p.time), p.value));
      dataset.histPoints.forEach((p) => histMap.set(getTimeKey(p.time), p.value));
      dataset.aoPoints.forEach((p, idx) => {
        const prev = idx > 0 ? dataset.aoPoints[idx - 1].value : p.value;
        aoMap.set(getTimeKey(p.time), { value: p.value, isRising: p.value >= prev });
      });
      dataset.rsiPoints.forEach((p) => rsiMap.set(getTimeKey(p.time), p.value));
    }

    return {
      closeMap,
      kamaMap,
      viPlusMap,
      viMinusMap,
      macdMap,
      signalMap,
      histMap,
      aoMap,
      rsiMap,
    };
  }, [dataset, stockCandles]);

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
        vertLines: { color: 'rgba(255, 255, 255, 0.025)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.035)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 255, 255, 0.22)',
          labelBackgroundColor: '#18181b',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.22)',
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
        minimumWidth: 68,
        scaleMargins: { top: 0.14, bottom: 0.14 },
      },
    };

    const subCharts: IChartApi[] = [];
    const isSingle = activeView !== 'all';
    const basePaneHeight = isSingle ? 132 : 64;
    const timeAxisHeight = 22;

    // Pad warmup bars with WhitespaceData ({ time }) so every sub-chart has the exact
    // same logical bar count (0 .. stockCandles.length - 1) as mainChart for 1:1 parallel sync.
    const padLineSeries = (points: { time: Time; value: number }[]) => {
      const map = new Map<string, number>();
      points.forEach((p) => map.set(getTimeKey(p.time), p.value));
      return stockCandles.map((c) => {
        const val = map.get(getTimeKey(c.time));
        return val !== undefined ? { time: c.time as Time, value: val } : { time: c.time as Time };
      });
    };

    const padHistogramSeries = (points: { time: Time; value: number; color?: string }[]) => {
      const map = new Map<string, { value: number; color?: string }>();
      points.forEach((p) => map.set(getTimeKey(p.time), { value: p.value, color: p.color }));
      return stockCandles.map((c) => {
        const entry = map.get(getTimeKey(c.time));
        return entry !== undefined
          ? { time: c.time as Time, value: entry.value, color: entry.color }
          : { time: c.time as Time };
      });
    };

    const padConstantLine = (constantValue: number) =>
      stockCandles.map((c) => ({ time: c.time as Time, value: constantValue }));

    // ── PANE 1: VORTEX INDICATOR (VI+, VI-) ────────────────────────────
    if (activeView === 'all' || activeView === 'vortex') {
      const c = containerVortexRef.current;
      if (c) {
        const showTimeAxis = activeView === 'vortex';
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: basePaneHeight + (showTimeAxis ? timeAxisHeight : 0),
          timeScale: {
            ...commonOptions.timeScale,
            visible: showTimeAxis,
          },
        });
        chartVortexRef.current = chart;
        subCharts.push(chart);

        // Baseline 1.0
        const line1 = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.16)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line1.setData(padConstantLine(1.0));

        // VI- (Rose)
        const viMinusSeries = chart.addSeries(LineSeries, {
          color: '#f43f5e',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        viMinusSeries.setData(padLineSeries(dataset.viMinusPoints));
        seriesVortexMinusRef.current = viMinusSeries;

        // VI+ (Cyan)
        const viPlusSeries = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        viPlusSeries.setData(padLineSeries(dataset.viPlusPoints));
        seriesVortexPlusRef.current = viPlusSeries;
      }
    }

    // ── PANE 2: MACD (MACD, Signal, Histogram) ─────────────────────────
    if (activeView === 'all' || activeView === 'macd') {
      const c = containerMacdRef.current;
      if (c) {
        const showTimeAxis = activeView === 'macd';
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: basePaneHeight + (showTimeAxis ? timeAxisHeight : 0),
          timeScale: {
            ...commonOptions.timeScale,
            visible: showTimeAxis,
          },
        });
        chartMacdRef.current = chart;
        subCharts.push(chart);

        // Baseline 0.0
        const lineZero = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.16)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineZero.setData(padConstantLine(0));

        // Histogram (4-phase momentum colors)
        const histSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: false,
          lastValueVisible: false,
        });
        histSeries.setData(padHistogramSeries(dataset.histPoints));

        // Signal Line (Orange)
        const signalSeries = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        signalSeries.setData(padLineSeries(dataset.signalPoints));
        seriesSignalRef.current = signalSeries;

        // MACD Line (Blue)
        const macdSeries = chart.addSeries(LineSeries, {
          color: '#38bdf8',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        macdSeries.setData(padLineSeries(dataset.macdPoints));
        seriesMacdRef.current = macdSeries;
      }
    }

    // ── PANE 3: AWESOME OSCILLATOR (AO) ────────────────────────────────
    if (activeView === 'all' || activeView === 'ao') {
      const c = containerAoRef.current;
      if (c) {
        const showTimeAxis = activeView === 'ao';
        const width = c.clientWidth || 600;
        const chart = createChart(c, {
          ...commonOptions,
          width,
          height: basePaneHeight + (showTimeAxis ? timeAxisHeight : 0),
          timeScale: {
            ...commonOptions.timeScale,
            visible: showTimeAxis,
          },
        });
        chartAoRef.current = chart;
        subCharts.push(chart);

        // Baseline 0.0
        const lineZero = chart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.16)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineZero.setData(padConstantLine(0));

        // AO Histogram
        const aoSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: false,
          lastValueVisible: true,
        });
        aoSeries.setData(padHistogramSeries(dataset.aoPoints));
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
          height: basePaneHeight + timeAxisHeight,
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
          color: 'rgba(255, 255, 255, 0.14)',
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

        // RSI Line (Amber/Gold instead of cliché magenta, high contrast on dark ground)
        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#eab308',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceLineVisible: false,
          lastValueVisible: true,
        });

        line70.setData(padConstantLine(70));
        line50.setData(padConstantLine(50));
        line30.setData(padConstantLine(30));
        rsiSeries.setData(padLineSeries(dataset.rsiPoints));

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

    // ── Synchronization: Crosshair Move with O(1) Coordinate Dots ──────
    const handleCrosshairMove = (param: any) => {
      if (!param || !param.time || !containerWrapperRef.current) {
        setCrosshairPos(null);
        setHoverValues({
          close: dataset.currentClose,
          kama: dataset.currentKAMA,
          viPlus: dataset.currentVIPlus,
          viMinus: dataset.currentVIMinus,
          macd: dataset.currentMACD,
          signal: dataset.currentSignal,
          hist: dataset.currentHist,
          ao: dataset.currentAO,
          aoRising: dataset.currentAORising,
          rsi: dataset.currentRSI,
          confluence: dataset.confluence,
        });
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      // 1. Get exact snapped bar-center pixel X so marker dots sit squarely on the indicator curve
      let pixelX: number | null = null;
      const refChart = subCharts[0] || mainChart;
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
        setCrosshairPos(null);
        if (onCrosshairChange) onCrosshairChange(null);
        return;
      }

      // 2. Extract values in O(1) using normalized time key
      const tKey = getTimeKey(param.time);
      const closeVal = lookupMaps.closeMap.get(tKey) ?? dataset.currentClose;
      const kamaVal = lookupMaps.kamaMap.get(tKey);
      const viPlusVal = lookupMaps.viPlusMap.get(tKey);
      const viMinusVal = lookupMaps.viMinusMap.get(tKey);
      const macdVal = lookupMaps.macdMap.get(tKey);
      const signalVal = lookupMaps.signalMap.get(tKey);
      const histVal = lookupMaps.histMap.get(tKey);
      const aoEntry = lookupMaps.aoMap.get(tKey);
      const aoVal = aoEntry?.value;
      const aoRising = aoEntry?.isRising;
      const rsiVal = lookupMaps.rsiMap.get(tKey);

      const hoveredConfluence = evaluateConfluenceState({
        close: closeVal,
        kama: kamaVal ?? dataset.currentKAMA,
        viPlus: viPlusVal ?? dataset.currentVIPlus,
        viMinus: viMinusVal ?? dataset.currentVIMinus,
        macd: macdVal ?? dataset.currentMACD,
        signal: signalVal ?? dataset.currentSignal,
        hist: histVal ?? dataset.currentHist,
        ao: aoVal ?? dataset.currentAO,
        aoRising: aoRising ?? dataset.currentAORising,
        rsi: rsiVal ?? dataset.currentRSI,
      });

      setHoverValues({
        close: closeVal,
        kama: kamaVal ?? dataset.currentKAMA,
        viPlus: viPlusVal ?? dataset.currentVIPlus,
        viMinus: viMinusVal ?? dataset.currentVIMinus,
        macd: macdVal ?? dataset.currentMACD,
        signal: signalVal ?? dataset.currentSignal,
        hist: histVal ?? dataset.currentHist,
        ao: aoVal ?? dataset.currentAO,
        aoRising: aoRising ?? dataset.currentAORising,
        rsi: rsiVal ?? dataset.currentRSI,
        confluence: hoveredConfluence,
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
      computeDot(containerMacdRef.current, seriesMacdRef.current, macdVal, 'macd', '#38bdf8');
      computeDot(containerMacdRef.current, seriesSignalRef.current, signalVal, 'signal', '#f59e0b');
      computeDot(
        containerAoRef.current,
        seriesAoRef.current,
        aoVal,
        'ao',
        aoRising ? '#10b981' : '#f43f5e'
      );
      computeDot(containerRsiRef.current, seriesRsiRef.current, rsiVal, 'rsi', '#eab308');

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
          closeVal,
          kamaVal,
          viPlusVal,
          viMinusVal,
          macdVal,
          signalVal,
          histVal,
          aoVal,
          aoRising,
          rsiVal,
          confluence: hoveredConfluence,
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
      if (mainChart) {
        try {
          mainChart.unsubscribeCrosshairMove(handleCrosshairMove);
        } catch {}
      }
      subCharts.forEach((sc) => sc.remove());
      chartVortexRef.current = null;
      chartMacdRef.current = null;
      chartAoRef.current = null;
      chartRsiRef.current = null;
    };
  }, [dataset, lookupMaps, mainChart, activeView, isCollapsed, onCrosshairChange]);

  const activeConfluence = hoverValues.confluence ?? dataset?.confluence;
  const viBull =
    hoverValues.viPlus !== undefined &&
    hoverValues.viMinus !== undefined &&
    hoverValues.viPlus > hoverValues.viMinus;
  const macdBull =
    hoverValues.macd !== undefined &&
    hoverValues.signal !== undefined &&
    hoverValues.macd > hoverValues.signal;
  const aoBull = (hoverValues.ao ?? 0) >= 0;
  const rsiVal = hoverValues.rsi ?? 50;

  const verdictBadgeClass =
    activeConfluence?.verdict === 'MUA MẠNH' || activeConfluence?.verdict === 'TÍCH CỰC'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : activeConfluence?.verdict === 'ÁP LỰC BÁN'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
      : activeConfluence?.verdict === 'THẬN TRỌNG'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <div
      ref={containerWrapperRef}
      className="w-full border-t border-zinc-800 bg-[#09090b] flex flex-col relative shrink-0 select-none"
    >
      {/* ── Data-Terminal Unified Confluence Header Bar ───────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 py-1 bg-[#111113] border-b border-zinc-800/90 text-[11px] font-mono">
        {/* Left: Title + 5-Factor Confluence Verdict + Quick Factor Matrix */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-3.5 bg-cyan-400 inline-block" />
            <span className="font-bold text-zinc-100 tracking-tight text-[11px]">
              {activeView === 'all'
                ? 'HỆ THỐNG ĐÁNH GIÁ KỸ THUẬT'
                : activeView === 'vortex'
                ? 'VORTEX (14)'
                : activeView === 'macd'
                ? 'MACD (12,26,9)'
                : activeView === 'ao'
                ? 'AWESOME OSC (5,34)'
                : 'RSI (14)'}
            </span>
          </div>

          {activeConfluence && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border tabular-nums ${verdictBadgeClass}`}
                title={activeConfluence.summaryText}
              >
                ĐỒNG THUẬN: {activeConfluence.bullishCount}/{activeConfluence.totalCount} CHỈ BÁO TĂNG • {activeConfluence.verdict}
              </span>

              {/* 5-Factor Signal Matrix Strip (Visible on Desktop) */}
              <div className="hidden lg:flex items-center divide-x divide-zinc-800 border border-zinc-800 bg-zinc-950 rounded-sm text-[9.5px] tabular-nums">
                <span
                  className={`px-1.5 py-0.5 font-semibold ${
                    activeConfluence.factors.kamaBull ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  title="Xu hướng giá so với KAMA (30, 60)"
                >
                  KAMA {activeConfluence.factors.kamaBull ? '▲' : '▼'}
                </span>
                <span
                  className={`px-1.5 py-0.5 font-semibold ${
                    activeConfluence.factors.vortexBull ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  title="Vortex Indicator (VI+ so với VI-)"
                >
                  VI {activeConfluence.factors.vortexBull ? '▲' : '▼'}
                </span>
                <span
                  className={`px-1.5 py-0.5 font-semibold ${
                    activeConfluence.factors.macdBull ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  title="MACD so với đường tín hiệu Signal"
                >
                  MACD {activeConfluence.factors.macdBull ? '▲' : '▼'}
                </span>
                <span
                  className={`px-1.5 py-0.5 font-semibold ${
                    activeConfluence.factors.aoBull ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  title="Awesome Oscillator (Gia tốc động lượng)"
                >
                  AO {activeConfluence.factors.aoBull ? '▲' : '▼'}
                </span>
                <span
                  className={`px-1.5 py-0.5 font-semibold ${
                    activeConfluence.factors.rsiBull ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                  title="Sức mạnh tương đối RSI(14)"
                >
                  RSI {hoverValues.rsi !== undefined ? hoverValues.rsi.toFixed(1) : '--'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Segmented View Switcher + Collapse + Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-sm border border-zinc-800">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'vortex', label: 'Vortex' },
                { id: 'macd', label: 'MACD' },
                { id: 'ao', label: 'AO' },
                { id: 'rsi', label: 'RSI' },
              ] as { id: GeneralEvaluationViewMode; label: string }[]
            ).map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 border-b border-cyan-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer"
            title={isCollapsed ? 'Mở rộng' : 'Thu nhỏ'}
          >
            {isCollapsed ? <CaretDown size={13} /> : <Minus size={13} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-sm transition-colors cursor-pointer"
            title="Đóng Template Đánh Giá Chung"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Sub-Chart Panes Container ─────────────────────────────────── */}
      {!isCollapsed && (
        <div className="flex flex-col relative w-full bg-[#09090b] overflow-hidden">
          {/* ── PANE 1: VORTEX INDICATOR ──────────────────────────────── */}
          {(activeView === 'all' || activeView === 'vortex') && (
            <div className="w-full flex flex-col relative border-b border-zinc-800/80">
              <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono tabular-nums select-none px-1.5 py-0.5 rounded-sm bg-[#09090b]/90 border border-zinc-800">
                <span className="font-bold text-zinc-300">VORTEX(14)</span>
                <span className="text-cyan-400 font-semibold">
                  VI+ {hoverValues.viPlus !== undefined ? hoverValues.viPlus.toFixed(3) : '--'}
                </span>
                <span className="text-rose-400 font-semibold">
                  VI- {hoverValues.viMinus !== undefined ? hoverValues.viMinus.toFixed(3) : '--'}
                </span>
                <span
                  className={`px-1 rounded-sm text-[9px] font-bold ${
                    viBull ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                  }`}
                >
                  {viBull ? 'XU HƯỚNG TĂNG' : 'XU HƯỚNG GIẢM'}
                </span>
              </div>
              <div
                ref={containerVortexRef}
                className={`w-full ${activeView === 'vortex' ? 'h-[154px]' : 'h-[64px]'}`}
              />
            </div>
          )}

          {/* ── PANE 2: MACD ──────────────────────────────────────────── */}
          {(activeView === 'all' || activeView === 'macd') && (
            <div className="w-full flex flex-col relative border-b border-zinc-800/80">
              <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono tabular-nums select-none px-1.5 py-0.5 rounded-sm bg-[#09090b]/90 border border-zinc-800">
                <span className="font-bold text-zinc-300">MACD(12,26,9)</span>
                <span
                  className={`font-semibold ${
                    (hoverValues.hist ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  Hist {hoverValues.hist !== undefined ? (hoverValues.hist >= 0 ? `+${hoverValues.hist.toFixed(2)}` : hoverValues.hist.toFixed(2)) : '--'}
                </span>
                <span className="text-sky-400 font-semibold">
                  MACD {hoverValues.macd !== undefined ? hoverValues.macd.toFixed(2) : '--'}
                </span>
                <span className="text-amber-400 font-semibold">
                  Sig {hoverValues.signal !== undefined ? hoverValues.signal.toFixed(2) : '--'}
                </span>
                <span
                  className={`px-1 rounded-sm text-[9px] font-bold ${
                    macdBull ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                  }`}
                >
                  {macdBull ? 'CẮT LÊN' : 'CẮT XUỐNG'}
                </span>
              </div>
              <div
                ref={containerMacdRef}
                className={`w-full ${activeView === 'macd' ? 'h-[154px]' : 'h-[64px]'}`}
              />
            </div>
          )}

          {/* ── PANE 3: AWESOME OSCILLATOR (AO) ───────────────────────── */}
          {(activeView === 'all' || activeView === 'ao') && (
            <div className="w-full flex flex-col relative border-b border-zinc-800/80">
              <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono tabular-nums select-none px-1.5 py-0.5 rounded-sm bg-[#09090b]/90 border border-zinc-800">
                <span className="font-bold text-zinc-300">AO(5,34)</span>
                <span
                  className={`font-semibold ${
                    aoBull ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {hoverValues.ao !== undefined ? (hoverValues.ao >= 0 ? `+${hoverValues.ao.toFixed(2)}` : hoverValues.ao.toFixed(2)) : '--'}
                </span>
                <span
                  className={`px-1 rounded-sm text-[9px] font-bold ${
                    hoverValues.aoRising
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-rose-400 bg-rose-500/10'
                  }`}
                >
                  {hoverValues.aoRising ? 'ĐỘNG LƯỢNG TĂNG ▲' : 'ĐỘNG LƯỢNG GIẢM ▼'}
                </span>
              </div>
              <div
                ref={containerAoRef}
                className={`w-full ${activeView === 'ao' ? 'h-[154px]' : 'h-[64px]'}`}
              />
            </div>
          )}

          {/* ── PANE 4: RSI ───────────────────────────────────────────── */}
          {(activeView === 'all' || activeView === 'rsi') && (
            <div className="w-full flex flex-col relative">
              <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono tabular-nums select-none px-1.5 py-0.5 rounded-sm bg-[#09090b]/90 border border-zinc-800">
                <span className="font-bold text-zinc-300">RSI(14)</span>
                <span className="text-yellow-400 font-bold">
                  {hoverValues.rsi !== undefined ? hoverValues.rsi.toFixed(2) : '--'}
                </span>
                <span
                  className={`text-[9px] px-1 rounded-sm font-bold ${
                    rsiVal >= 70
                      ? 'bg-rose-500/15 text-rose-400'
                      : rsiVal <= 30
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : rsiVal >= 50
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {rsiVal >= 70
                    ? 'QUÁ MUA (>70)'
                    : rsiVal <= 30
                    ? 'QUÁ BÁN (<30)'
                    : rsiVal >= 50
                    ? 'VÙNG MẠNH (≥50)'
                    : 'VÙNG YẾU (<50)'}
                </span>
              </div>
              <div
                ref={containerRsiRef}
                className={`w-full ${activeView === 'rsi' ? 'h-[154px]' : 'h-[86px]'}`}
              />
            </div>
          )}

          {/* ── SYNCHRONIZED SVG OVERLAY: VERTICAL GUIDELINE & MARKER DOTS ── */}
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

                {/* Marker Dots on each Indicator */}
                {crosshairPos.dots.map((dot) => (
                  <g key={dot.id}>
                    <circle
                      cx={crosshairPos.x}
                      cy={dot.y}
                      r={4.5}
                      fill={dot.color}
                      opacity={0.28}
                    />
                    <circle
                      cx={crosshairPos.x}
                      cy={dot.y}
                      r={2.75}
                      fill={dot.color}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  </g>
                ))}
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
