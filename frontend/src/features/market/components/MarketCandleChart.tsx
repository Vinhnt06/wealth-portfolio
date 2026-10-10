'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
} from 'lightweight-charts';
import { useMarketStore } from '../store/marketStore';
import {
  TrendUp,
  TrendDown,
  Clock,
  ArrowsOutSimple,
  ChartLine,
  Cursor,
  Minus,
  Percent,
  Square,
  Ruler,
  ArrowCounterClockwise,
  ArrowClockwise,
  Trash,
  Palette,
  X,
  SpinnerGap,
  Function as FxIcon,
  TextT,
  ChartBar,
  ArrowsOut,
  ArrowsIn,
  Sparkle,
} from '@phosphor-icons/react';
import stockDatabase from '../data/stockDatabase.json';
import { getStockPriceColor } from '../utils/priceColors';

const STOCK_MAP = new Map<string, { name: string; exchange: string }>();
(stockDatabase as any[]).forEach((item) => {
  STOCK_MAP.set(item.symbol.toUpperCase(), { name: item.name, exchange: item.exchange });
});

// Timeframe Resolution Presets
const RESOLUTIONS = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '1D', label: 'D' },
  { id: '1W', label: 'W' },
] as const;

type ResolutionId = typeof RESOLUTIONS[number]['id'];

// Quick Date Ranges (TradingView bottom bar)
const DATE_RANGES = [
  { id: '1d', label: '1n', bars: 1 },
  { id: '5d', label: '5n', bars: 5 },
  { id: '1m', label: '1t', bars: 22 },
  { id: '3m', label: '3t', bars: 66 },
  { id: '6m', label: '6t', bars: 130 },
  { id: '1y', label: '1y', bars: 250 },
  { id: '5y', label: '5y', bars: 1250 },
  { id: 'all', label: 'Tất cả', bars: 99999 },
] as const;

// Drawing Tool Types & Schema
export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'fibonacci' | 'rectangle' | 'measure' | 'text';

export interface DrawingItem {
  id: string;
  type: DrawingTool;
  symbol: string;
  color: string;
  width: number;
  p1: { time: Time; price: number };
  p2?: { time: Time; price: number };
  text?: string;
}

const TOOL_LABELS: Record<DrawingTool, string> = {
  cursor: 'Con trỏ chuột (Crosshair)',
  trendline: 'Đường xu hướng (Trendline)',
  horizontal: 'Đường ngang Hỗ trợ / Kháng cự',
  fibonacci: 'Thoái lui Fibonacci (Tỷ lệ vàng)',
  rectangle: 'Hộp vùng giá (Supply / Demand)',
  measure: 'Thước đo biến động (% & Giá)',
  text: 'Ghi chú văn bản (Text note)',
};

const PALETTE = ['#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#f4f4f5'];

export interface TrendlineProResult {
  resistance: number;
  support: number;
  fib0618: number;
  fib1618: number;
  resP1: { time: Time; price: number };
  resP2: { time: Time; price: number };
  supP1: { time: Time; price: number };
  supP2: { time: Time; price: number };
}

export function calculateTrendlinePro(candles: CandlestickData<Time>[]): TrendlineProResult | null {
  if (!candles || candles.length < 10) return null;
  const windowCandles = candles.slice(-70);
  const n = windowCandles.length;

  const swingHighs: { idx: number; time: Time; price: number }[] = [];
  const swingLows: { idx: number; time: Time; price: number }[] = [];

  for (let i = 2; i < n - 2; i++) {
    const c = windowCandles[i];
    const isHigh =
      c.high >= windowCandles[i - 1].high &&
      c.high >= windowCandles[i - 2].high &&
      c.high >= windowCandles[i + 1].high &&
      c.high >= windowCandles[i + 2].high;

    const isLow =
      c.low <= windowCandles[i - 1].low &&
      c.low <= windowCandles[i - 2].low &&
      c.low <= windowCandles[i + 1].low &&
      c.low <= windowCandles[i + 2].low;

    if (isHigh) swingHighs.push({ idx: i, time: c.time, price: c.high });
    if (isLow) swingLows.push({ idx: i, time: c.time, price: c.low });
  }

  let resP1: { time: Time; price: number };
  let resP2: { time: Time; price: number };
  let supP1: { time: Time; price: number };
  let supP2: { time: Time; price: number };

  if (swingHighs.length >= 2) {
    const sortedHighs = [...swingHighs].sort((a, b) => b.price - a.price);
    const h1 = sortedHighs[0];
    const h2 = swingHighs.filter((s) => Math.abs(s.idx - h1.idx) >= 4).sort((a, b) => b.price - a.price)[0] || sortedHighs[1];
    const [pFirst, pSecond] = h1.idx < h2.idx ? [h1, h2] : [h2, h1];
    resP1 = { time: pFirst.time, price: pFirst.price };
    resP2 = { time: pSecond.time, price: pSecond.price };
  } else {
    let maxHigh = -Infinity;
    let maxHighIdx = 0;
    for (let i = 0; i < n; i++) {
      if (windowCandles[i].high > maxHigh) {
        maxHigh = windowCandles[i].high;
        maxHighIdx = i;
      }
    }
    const firstIdx = Math.max(0, maxHighIdx - 10);
    resP1 = { time: windowCandles[firstIdx].time, price: maxHigh };
    resP2 = { time: windowCandles[n - 1].time, price: maxHigh };
  }

  if (swingLows.length >= 2) {
    const sortedLows = [...swingLows].sort((a, b) => a.price - b.price);
    const l1 = sortedLows[0];
    const l2 = swingLows.filter((s) => Math.abs(s.idx - l1.idx) >= 4).sort((a, b) => a.price - b.price)[0] || sortedLows[1];
    const [pFirst, pSecond] = l1.idx < l2.idx ? [l1, l2] : [l2, l1];
    supP1 = { time: pFirst.time, price: pFirst.price };
    supP2 = { time: pSecond.time, price: pSecond.price };
  } else {
    let minLow = Infinity;
    let minLowIdx = 0;
    for (let i = 0; i < n; i++) {
      if (windowCandles[i].low < minLow) {
        minLow = windowCandles[i].low;
        minLowIdx = i;
      }
    }
    const firstIdx = Math.max(0, minLowIdx - 10);
    supP1 = { time: windowCandles[firstIdx].time, price: minLow };
    supP2 = { time: windowCandles[n - 1].time, price: minLow };
  }

  const resistance = Math.round(Math.max(resP1.price, resP2.price) * 100) / 100;
  const support = Math.round(Math.min(supP1.price, supP2.price) * 100) / 100;
  const delta = Math.max(0.1, resistance - support);
  const fib0618 = Math.round((support + delta * 0.618) * 100) / 100;
  const fib1618 = Math.round((support + delta * 1.618) * 100) / 100;

  return {
    resistance,
    support,
    fib0618,
    fib1618,
    resP1,
    resP2,
    supP1,
    supP2,
  };
}

// ── Native Stream MarketCandleChart Component ────────────────────────
export function MarketCandleChart() {
  const fullWrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma150SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lastCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);
  const loadedCandlesRef = useRef<CandlestickData<Time>[]>([]);

  const { selectedSymbol, ticks } = useMarketStore();
  const stockInfo = STOCK_MAP.get(selectedSymbol.toUpperCase()) || {
    name: `Công ty CP ${selectedSymbol}`,
    exchange: 'HOSE',
  };

  const [resolution, setResolution] = useState<ResolutionId>('1D');
  const [activeRange, setActiveRange] = useState<string>('all');
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Indicators toggle
  const [showIndicatorsModal, setShowIndicatorsModal] = useState(false);
  const [showMA20, setShowMA20] = useState(false);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA150, setShowMA150] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Trendline Pro State
  const [showTrendlinePro, setShowTrendlinePro] = useState(true);
  const [trendlineProData, setTrendlineProData] = useState<TrendlineProResult | null>(null);

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [activeColor, setActiveColor] = useState<string>('#10b981');
  const [activeWidth, setActiveWidth] = useState<number>(2);
  const [showPalette, setShowPalette] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<DrawingItem | null>(null);
  const [undoStack, setUndoStack] = useState<DrawingItem[][]>([]);
  const [chartMinervini, setChartMinervini] = useState<{
    rsRating?: number;
    isStage2Eligible?: boolean;
    passedCount?: number;
  } | null>(null);

  // Hovered Crosshair inspection data
  const [hoveredData, setHoveredData] = useState<{
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    change?: number;
    changePct?: number;
  } | null>(null);

  const currentTick = ticks[selectedSymbol];

  // Clock timer (Vietnam UTC+7)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
        }) + ' (UTC+7)'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load saved drawings per symbol from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`yf_drawings_${selectedSymbol}`);
      if (raw) {
        setDrawings(JSON.parse(raw));
      } else {
        setDrawings([]);
      }
      setDraftDrawing(null);
      setUndoStack([]);
    } catch {
      setDrawings([]);
    }
  }, [selectedSymbol]);

  const saveDrawings = (items: DrawingItem[]) => {
    try {
      localStorage.setItem(`yf_drawings_${selectedSymbol}`, JSON.stringify(items));
    } catch {}
  };

  // Fetch Minervini RS Rating & Stage 2 status for chart header
  useEffect(() => {
    if (!selectedSymbol) return;
    fetch(`/api/market/minervini/analysis?symbol=${selectedSymbol}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setChartMinervini({
            rsRating: d.data.rsRating,
            isStage2Eligible: d.data.isStage2Eligible,
            passedCount: d.data.passedCount,
          });
        }
      })
      .catch(() => {});
  }, [selectedSymbol]);

  // Listen to browser fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsExpanded(isFs);
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
          chartRef.current.timeScale().fitContent();
          updateCanvasSize();
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcut listener: Esc cancels current drawing or exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsExpanded(false);
        setDraftDrawing(null);
        setActiveTool('cursor');
        setShowPalette(false);
        setShowIndicatorsModal(false);
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            });
            chartRef.current.timeScale().fitContent();
            updateCanvasSize();
          }
        }, 80);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Redraw Canvas Drawings overlay
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) {
      ctx.restore();
      return;
    }

    const toCoord = (p: { time: Time; price: number }) => {
      const x = chart.timeScale().timeToCoordinate(p.time);
      const y = series.priceToCoordinate(p.price);
      return { x, y };
    };

    const allItems: DrawingItem[] = [...drawings];
    if (draftDrawing && draftDrawing.p2) {
      allItems.push(draftDrawing);
    }

    allItems.forEach((item) => {
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width || 2;
      ctx.fillStyle = item.color;

      if (item.type === 'horizontal') {
        const y = series.priceToCoordinate(item.p1.price);
        if (y !== null) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();

          // Price Tag on right axis
          ctx.setLineDash([]);
          ctx.fillStyle = item.color;
          ctx.fillRect(w - 72, y - 10, 68, 20);
          ctx.fillStyle = '#09090b';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${item.p1.price.toFixed(2)}k`, w - 38, y);
        }
      } else if (item.type === 'trendline' && item.p2) {
        const c1 = toCoord(item.p1);
        const c2 = toCoord(item.p2);
        if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(c1.x, c1.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(c2.x, c2.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.type === 'rectangle' && item.p2) {
        const c1 = toCoord(item.p1);
        const c2 = toCoord(item.p2);
        if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
          const minX = Math.min(c1.x, c2.x);
          const minY = Math.min(c1.y, c2.y);
          const boxW = Math.abs(c2.x - c1.x);
          const boxH = Math.abs(c2.y - c1.y);

          ctx.fillStyle = item.color + '26'; // 15% opacity fill
          ctx.fillRect(minX, minY, boxW, boxH);
          ctx.strokeRect(minX, minY, boxW, boxH);
        }
      } else if (item.type === 'fibonacci' && item.p2) {
        const c1 = toCoord(item.p1);
        const c2 = toCoord(item.p2);
        if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
          const startX = Math.min(c1.x, c2.x);
          const endX = Math.max(c1.x, c2.x, w - 80);
          const p1 = item.p1.price;
          const p2 = item.p2.price;
          const levels = [
            { ratio: 0, label: '0.0%', color: '#f43f5e' },
            { ratio: 0.236, label: '23.6%', color: '#f59e0b' },
            { ratio: 0.382, label: '38.2%', color: '#10b981' },
            { ratio: 0.5, label: '50.0%', color: '#06b6d4' },
            { ratio: 0.618, label: '61.8% (Golden)', color: '#eab308' },
            { ratio: 0.786, label: '78.6%', color: '#818cf8' },
            { ratio: 1.0, label: '100.0%', color: '#f43f5e' },
          ];

          levels.forEach((lvl) => {
            const priceLvl = p1 + (p2 - p1) * lvl.ratio;
            const y = series.priceToCoordinate(priceLvl);
            if (y !== null) {
              ctx.strokeStyle = lvl.color;
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(startX, y);
              ctx.lineTo(endX, y);
              ctx.stroke();

              ctx.fillStyle = lvl.color;
              ctx.font = '9px JetBrains Mono, monospace';
              ctx.textAlign = 'left';
              ctx.fillText(`${lvl.label} - ${priceLvl.toFixed(2)}k`, startX + 4, y - 3);
            }
          });
        }
      } else if (item.type === 'measure' && item.p2) {
        const c1 = toCoord(item.p1);
        const c2 = toCoord(item.p2);
        if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
          const minX = Math.min(c1.x, c2.x);
          const minY = Math.min(c1.y, c2.y);
          const boxW = Math.abs(c2.x - c1.x);
          const boxH = Math.abs(c2.y - c1.y);

          const deltaP = item.p2.price - item.p1.price;
          const deltaPct = item.p1.price !== 0 ? (deltaP / item.p1.price) * 100 : 0;
          const isUp = deltaP >= 0;

          ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
          ctx.fillRect(minX, minY, boxW, boxH);
          ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(minX, minY, boxW, boxH);

          const midX = minX + boxW / 2;
          const midY = minY + boxH / 2;
          ctx.setLineDash([]);
          ctx.fillStyle = '#09090b';
          ctx.fillRect(midX - 60, midY - 13, 120, 26);
          ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
          ctx.lineWidth = 1;
          ctx.strokeRect(midX - 60, midY - 13, 120, 26);

          ctx.fillStyle = isUp ? '#10b981' : '#f43f5e';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${isUp ? '+' : ''}${deltaP.toFixed(2)}k (${isUp ? '+' : ''}${deltaPct.toFixed(2)}%)`, midX, midY);
        }
      } else if (item.type === 'text' && item.text) {
        const c1 = toCoord(item.p1);
        if (c1.x !== null && c1.y !== null) {
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(item.text);
          ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
          ctx.fillRect(c1.x - 4, c1.y - 14, textMetrics.width + 8, 18);
          ctx.strokeStyle = item.color;
          ctx.strokeRect(c1.x - 4, c1.y - 14, textMetrics.width + 8, 18);

          ctx.fillStyle = item.color;
          ctx.textAlign = 'left';
          ctx.fillText(item.text, c1.x, c1.y);
        }
      }
      ctx.restore();
    });

    // ── Render Trendline Pro Overlays (Automated S/R & Fibonacci Channels) ────
    if (showTrendlinePro && trendlineProData) {
      ctx.save();

      // 1. Kháng cự (Resistance line - Green/Lime #84cc16)
      const resY = series.priceToCoordinate(trendlineProData.resistance);
      const rC1 = toCoord(trendlineProData.resP1);
      const rC2 = toCoord(trendlineProData.resP2);

      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      if (rC1.x !== null && rC1.y !== null && rC2.x !== null && rC2.y !== null && Math.abs(rC2.x - rC1.x) > 5) {
        const slope = (rC2.y - rC1.y) / (rC2.x - rC1.x);
        const endX = w - 75;
        const endY = rC1.y + slope * (endX - rC1.x);
        ctx.moveTo(rC1.x, rC1.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Tag Kháng cự at ray endpoint
        const tagY = Math.min(Math.max(endY, 14), h - 14);
        ctx.fillStyle = '#84cc16';
        ctx.fillRect(w - 76, tagY - 10, 72, 20);
        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Kháng cự: ${trendlineProData.resistance}`, w - 40, tagY);
      } else if (resY !== null) {
        ctx.moveTo(0, resY);
        ctx.lineTo(w - 75, resY);
        ctx.stroke();

        ctx.fillStyle = '#84cc16';
        ctx.fillRect(w - 76, resY - 10, 72, 20);
        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Kháng cự: ${trendlineProData.resistance}`, w - 40, resY);
      }

      // 2. Hỗ trợ (Support line - Red/Rose #ef4444)
      const supY = series.priceToCoordinate(trendlineProData.support);
      const sC1 = toCoord(trendlineProData.supP1);
      const sC2 = toCoord(trendlineProData.supP2);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      if (sC1.x !== null && sC1.y !== null && sC2.x !== null && sC2.y !== null && Math.abs(sC2.x - sC1.x) > 5) {
        const slope = (sC2.y - sC1.y) / (sC2.x - sC1.x);
        const endX = w - 75;
        const endY = sC1.y + slope * (endX - sC1.x);
        ctx.moveTo(sC1.x, sC1.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Tag Hỗ trợ at ray endpoint
        const tagY = Math.min(Math.max(endY, 14), h - 14);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w - 76, tagY - 10, 72, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Hỗ trợ: ${trendlineProData.support}`, w - 40, tagY);
      } else if (supY !== null) {
        ctx.moveTo(0, supY);
        ctx.lineTo(w - 75, supY);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w - 76, supY - 10, 72, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Hỗ trợ: ${trendlineProData.support}`, w - 40, supY);
      }

      // 3. Fibonacci 0.618 Golden Level (#eab308)
      const fib0618Y = series.priceToCoordinate(trendlineProData.fib0618);
      if (fib0618Y !== null) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, fib0618Y);
        ctx.lineTo(w - 75, fib0618Y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
        ctx.fillRect(w - 76, fib0618Y - 9, 72, 18);
        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Fib 0,618: ${trendlineProData.fib0618}`, w - 40, fib0618Y);
      }

      // 4. Fibonacci 1.618 Extension (#06b6d4)
      const fib1618Y = series.priceToCoordinate(trendlineProData.fib1618);
      if (fib1618Y !== null) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, fib1618Y);
        ctx.lineTo(w - 75, fib1618Y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
        ctx.fillRect(w - 76, fib1618Y - 9, 72, 18);
        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Fib 1,618: ${trendlineProData.fib1618}`, w - 40, fib1618Y);
      }

      ctx.restore();
    }

    ctx.restore();
  }, [drawings, draftDrawing, showTrendlinePro, trendlineProData]);

  // Adjust canvas size to match container
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Mount Lightweight Chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const isDaily = resolution === '1D' || resolution === '1W';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        vertLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
        horzLine: { color: '#10b981', labelBackgroundColor: '#18181b' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignLabels: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: !isDaily,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: 580,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    candleSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA20',
    });
    ma20SeriesRef.current = ma20Series;

    const ma50Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA50',
    });
    ma50SeriesRef.current = ma50Series;

    const ma150Series = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA150',
    });
    ma150SeriesRef.current = ma150Series;

    const ma200Series = chart.addSeries(LineSeries, {
      color: '#f43f5e',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA200',
    });
    ma200SeriesRef.current = ma200Series;

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'BB Upper',
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'BB Lower',
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(redrawCanvas);
    });
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(redrawCanvas);
    });

    let isCancelled = false;
    let daysToFetch = 0;
    if (resolution === '1m') daysToFetch = 2;
    else if (resolution === '5m') daysToFetch = 5;
    else if (resolution === '15m') daysToFetch = 14;
    else if (resolution === '1h') daysToFetch = 60;
    else if (resolution === '1D' || resolution === '1W') daysToFetch = 0; // Từ ngày đầu tiên niêm yết

    setIsLoading(true);
    fetch(`/api/market/history?symbol=${selectedSymbol}&resolution=${resolution}&days=${daysToFetch}`)
      .then((res) => res.json())
      .then((resData) => {
        if (isCancelled) return;
        setIsLoading(false);
        if (!resData.success || !resData.data || resData.data.length === 0) return;
        const isDaily = resolution === '1D' || resolution === '1W';

        const realCandles: CandlestickData<Time>[] = [];
        const realVolumes: HistogramData<Time>[] = [];

        resData.data.forEach((c: any) => {
          const timeVal = isDaily
            ? (new Date(c.time * 1000).toISOString().split('T')[0] as unknown as Time)
            : (c.time as unknown as Time);
          realCandles.push({
            time: timeVal,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          });
          realVolumes.push({
            time: timeVal,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
          });
        });

        realCandles.sort((a, b) => (a.time > b.time ? 1 : -1));
        const uniqueCandles = realCandles.filter((item, idx, arr) => idx === 0 || item.time !== arr[idx - 1].time);
        const uniqueVolumes = realVolumes.filter((item, idx, arr) => idx === 0 || item.time !== arr[idx - 1].time);
        loadedCandlesRef.current = uniqueCandles;
        const proData = calculateTrendlinePro(uniqueCandles);
        setTrendlineProData(proData);

        const realMa20: LineData<Time>[] = [];
        const realMa50: LineData<Time>[] = [];
        const realMa150: LineData<Time>[] = [];
        const realMa200: LineData<Time>[] = [];
        const bbUpperData: LineData<Time>[] = [];
        const bbLowerData: LineData<Time>[] = [];

        for (let i = 0; i < uniqueCandles.length; i++) {
          if (i >= 19) {
            const slice20 = uniqueCandles.slice(i - 19, i + 1);
            const sum20 = slice20.reduce((acc, x) => acc + x.close, 0);
            const mean20 = sum20 / 20;
            realMa20.push({ time: uniqueCandles[i].time, value: Math.round(mean20 * 100) / 100 });

            // Bollinger Bands (20, 2)
            const variance = slice20.reduce((acc, x) => acc + Math.pow(x.close - mean20, 2), 0) / 20;
            const std = Math.sqrt(variance);
            bbUpperData.push({ time: uniqueCandles[i].time, value: Math.round((mean20 + 2 * std) * 100) / 100 });
            bbLowerData.push({ time: uniqueCandles[i].time, value: Math.round((mean20 - 2 * std) * 100) / 100 });
          }
          if (i >= 49) {
            const sum50 = uniqueCandles.slice(i - 49, i + 1).reduce((acc, x) => acc + x.close, 0);
            realMa50.push({ time: uniqueCandles[i].time, value: Math.round((sum50 / 50) * 100) / 100 });
          }
          if (i >= 149) {
            const sum150 = uniqueCandles.slice(i - 149, i + 1).reduce((acc, x) => acc + x.close, 0);
            realMa150.push({ time: uniqueCandles[i].time, value: Math.round((sum150 / 150) * 100) / 100 });
          }
          if (i >= 199) {
            const sum200 = uniqueCandles.slice(i - 199, i + 1).reduce((acc, x) => acc + x.close, 0);
            realMa200.push({ time: uniqueCandles[i].time, value: Math.round((sum200 / 200) * 100) / 100 });
          }
        }

        if (uniqueCandles.length > 0) {
          candlestickSeries.setData(uniqueCandles);
          if (showVolume) volumeSeries.setData(uniqueVolumes);
          if (showMA20) ma20Series.setData(realMa20);
          if (showMA50) ma50Series.setData(realMa50);
          if (showMA150) ma150Series.setData(realMa150);
          if (showMA200) ma200Series.setData(realMa200);
          if (showBB) {
            bbUpperSeries.setData(bbUpperData);
            bbLowerSeries.setData(bbLowerData);
          }

          if (uniqueCandles.length > 150) {
            chart.timeScale().setVisibleLogicalRange({
              from: uniqueCandles.length - 140,
              to: uniqueCandles.length + 5,
            });
          } else {
            chart.timeScale().fitContent();
          }

          const last = uniqueCandles[uniqueCandles.length - 1];
          lastCandleRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          };

          // Synchronize store tick with the verified real candle close price
          const prevCandle = uniqueCandles.length > 1 ? uniqueCandles[uniqueCandles.length - 2] : last;
          const realCloseVnd = Math.round(last.close * 1000);
          const realPrevVnd = Math.round(prevCandle.close * 1000);
          const currentStoreTick = useMarketStore.getState().ticks[selectedSymbol];

          // If store tick is missing, or deviates by > 15% from the actual candle (e.g. stale fallback)
          if (!currentStoreTick || Math.abs(currentStoreTick.price - realCloseVnd) / (realCloseVnd || 1) > 0.15) {
            useMarketStore.getState().updateTick({
              symbol: selectedSymbol,
              price: realCloseVnd,
              referencePrice: realPrevVnd,
              open: Math.round(last.open * 1000),
              high: Math.round(last.high * 1000),
              low: Math.round(last.low * 1000),
              change: realCloseVnd - realPrevVnd,
              changePercent: realPrevVnd > 0 ? Number((((realCloseVnd - realPrevVnd) / realPrevVnd) * 100).toFixed(2)) : 0,
              volume: Math.round((uniqueVolumes[uniqueVolumes.length - 1]?.value || 100000) / 10),
              totalVolume: Math.round(uniqueVolumes[uniqueVolumes.length - 1]?.value || 100000),
              ceilingPrice: Math.round(realPrevVnd * 1.07),
              floorPrice: Math.round(realPrevVnd * 0.93),
              timestamp: Date.now(),
              matchType: 'B',
            });
          }

          requestAnimationFrame(redrawCanvas);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const candle = param.seriesData.get(candlestickSeries) as any;
      const vol = param.seriesData.get(volumeSeries) as any;
      if (candle) {
        const change = candle.close - candle.open;
        const changePct = candle.open ? (change / candle.open) * 100 : 0;
        setHoveredData({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value,
          change,
          changePct,
        });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        updateCanvasSize();
      }
    });
    resizeObserver.observe(container);
    updateCanvasSize();

    return () => {
      isCancelled = true;
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [resolution, selectedSymbol, showMA20, showMA50, showMA150, showMA200, showBB, showVolume, redrawCanvas, updateCanvasSize]);

  // Real-time tick update to candle
  useEffect(() => {
    if (!currentTick?.price || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const livePriceK = Math.round((currentTick.price / 1000) * 100) / 100;
    const tickVol = currentTick.volume || 10000;

    if (lastCandleRef.current) {
      // Guard against anomalous ticks (> 25% deviation from current candle close)
      const currentClose = lastCandleRef.current.close;
      if (currentClose > 0 && Math.abs(livePriceK - currentClose) / currentClose > 0.25) {
        return; // Don't distort chart with corrupted fallback ticks
      }

      const updatedHigh = Math.max(lastCandleRef.current.high, livePriceK);
      const updatedLow = Math.min(lastCandleRef.current.low, livePriceK);
      const updatedOpen = lastCandleRef.current.open;

      lastCandleRef.current = {
        ...lastCandleRef.current,
        high: updatedHigh,
        low: updatedLow,
        close: livePriceK,
      };

      candleSeriesRef.current.update({
        time: lastCandleRef.current.time,
        open: updatedOpen,
        high: updatedHigh,
        low: updatedLow,
        close: livePriceK,
      });

      volumeSeriesRef.current.update({
        time: lastCandleRef.current.time,
        value: tickVol,
        color: livePriceK >= updatedOpen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      });

      requestAnimationFrame(redrawCanvas);
    }
  }, [currentTick, redrawCanvas]);

  // Switch Quick Date Ranges instantaneously
  const handleRangeSelect = (rangeId: string, bars: number) => {
    setActiveRange(rangeId);
    const chart = chartRef.current;
    const total = loadedCandlesRef.current.length;
    if (!chart || total === 0) return;

    if (rangeId === 'all') {
      chart.timeScale().fitContent();
    } else {
      const fromIdx = Math.max(0, total - bars);
      chart.timeScale().setVisibleLogicalRange({
        from: fromIdx,
        to: total + 5,
      });
    }
  };

  // Fullscreen / True Expand Handler
  const toggleFullscreen = async () => {
    const el = fullWrapperRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Fallback to pure CSS viewport fullscreen
    }

    setIsExpanded((prev) => {
      const next = !prev;
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
          chartRef.current.timeScale().fitContent();
          updateCanvasSize();
        }
      }, 100);
      return next;
    });
  };

  // Interactive Drawing Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'cursor') return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (!time || price === null) return;

    const point = { time, price: Math.round(price * 100) / 100 };

    if (activeTool === 'horizontal') {
      setUndoStack((prev) => [...prev, drawings]);
      const newDrawing: DrawingItem = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'horizontal',
        symbol: selectedSymbol,
        color: activeColor,
        width: activeWidth,
        p1: point,
      };
      const updated = [...drawings, newDrawing];
      setDrawings(updated);
      saveDrawings(updated);
      return;
    }

    if (activeTool === 'text') {
      const note = window.prompt('Nhập ghi chú giá:', 'Vùng cản kỹ thuật');
      if (note) {
        setUndoStack((prev) => [...prev, drawings]);
        const newDrawing: DrawingItem = {
          id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'text',
          symbol: selectedSymbol,
          color: activeColor,
          width: activeWidth,
          p1: point,
          text: note,
        };
        const updated = [...drawings, newDrawing];
        setDrawings(updated);
        saveDrawings(updated);
      }
      setActiveTool('cursor');
      return;
    }

    if (!draftDrawing) {
      setDraftDrawing({
        id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: activeTool,
        symbol: selectedSymbol,
        color: activeColor,
        width: activeWidth,
        p1: point,
        p2: point,
      });
    } else {
      setUndoStack((prev) => [...prev, drawings]);
      const finalDrawing: DrawingItem = {
        ...draftDrawing,
        p2: point,
      };
      const updated = [...drawings, finalDrawing];
      setDrawings(updated);
      saveDrawings(updated);
      setDraftDrawing(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draftDrawing) return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (price === null) return;

    setDraftDrawing((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        p2: {
          time: time || prev.p1.time,
          price: Math.round(price * 100) / 100,
        },
      };
    });
  };

  const handleUndo = () => {
    if (drawings.length === 0) return;
    const last = drawings[drawings.length - 1];
    setUndoStack((prev) => [...prev, [last]]);
    const updated = drawings.slice(0, drawings.length - 1);
    setDrawings(updated);
    saveDrawings(updated);
  };

  const handleClearAll = () => {
    if (drawings.length === 0) return;
    setUndoStack((prev) => [...prev, drawings]);
    setDrawings([]);
    setDraftDrawing(null);
    saveDrawings([]);
  };

  const priceDisplayK = currentTick?.price ? (currentTick.price / 1000).toFixed(2) : '--';
  const changeK = currentTick?.change ? (currentTick.change / 1000).toFixed(2) : '0.00';
  const changePct = currentTick?.changePercent ? currentTick.changePercent.toFixed(2) : '0.00';
  const isPositive = currentTick ? currentTick.change >= 0 : true;

  const activePrice = hoveredData?.close ? hoveredData.close * 1000 : currentTick?.price;
  const activeChange = hoveredData?.change ? hoveredData.change * 1000 : currentTick?.change;
  const activeChangePct = hoveredData?.changePct !== undefined ? hoveredData.changePct : currentTick?.changePercent;
  const priceColor = getStockPriceColor({
    price: activePrice,
    change: activeChange,
    changePercent: activeChangePct,
    exchange: stockInfo.exchange,
  });

  return (
    <div
      ref={fullWrapperRef}
      className={`border border-zinc-800/80 flex flex-col relative select-none transition-all duration-200 ${
        isExpanded
          ? 'fixed inset-0 z-[99999] w-screen h-screen rounded-none p-2 sm:p-3 shadow-2xl !bg-zinc-950'
          : 'bg-zinc-950 w-full h-[480px] lg:h-[500px] rounded-2xl shadow-xl overflow-hidden'
      }`}
    >
      {/* ── TradingView-Style Top Navigation & Header Bar ────────── */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-zinc-800/70 bg-zinc-950 text-zinc-300 text-xs gap-2 z-30">
        {/* Left: Ticker & Live Legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-sans">
            <span className="font-bold text-zinc-100 text-sm tracking-tight">{stockInfo.name}</span>
            <span className="text-zinc-500">·</span>
            <span className={`font-mono font-extrabold text-xs px-1.5 py-0.5 rounded border ${priceColor.badgeBgClass}`}>
              {selectedSymbol}
            </span>
            <span className="text-zinc-500">·</span>
            <span className="font-mono text-zinc-400 text-xs">{resolution}</span>
            <span className="text-zinc-500">·</span>
            <span className="font-mono text-zinc-400 text-xs">{stockInfo.exchange}</span>

            {/* Minervini Live RS Rating on Chart Bar */}
            {chartMinervini?.rsRating !== undefined && (
              <>
                <span className="text-zinc-500">·</span>
                <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center gap-1.5">
                  <Sparkle weight="fill" className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] text-amber-300/90 uppercase font-bold tracking-wider">RS</span>
                  <span className="text-sm font-black text-amber-300">{chartMinervini.rsRating}</span>
                  <span className="text-[10px] text-amber-400/60 font-semibold">/99</span>
                </span>
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border hidden sm:inline-block ${
                    chartMinervini.isStage2Eligible
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  {chartMinervini.isStage2Eligible ? 'Stage 2 (8/8)' : `${chartMinervini.passedCount || 0}/8`}
                </span>
              </>
            )}
          </div>

          {/* Real-time OHLC Legend */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-zinc-400 ml-2">
            <div>O <span className="text-zinc-200 font-bold">{hoveredData?.open ? hoveredData.open.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.open.toFixed(2) : priceDisplayK)}</span></div>
            <div>H <span className="text-emerald-400 font-bold">{hoveredData?.high ? hoveredData.high.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.high.toFixed(2) : priceDisplayK)}</span></div>
            <div>L <span className="text-rose-400 font-bold">{hoveredData?.low ? hoveredData.low.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.low.toFixed(2) : priceDisplayK)}</span></div>
            <div>C <span className="text-zinc-100 font-bold">{hoveredData?.close ? hoveredData.close.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.close.toFixed(2) : priceDisplayK)}</span></div>
            <div className={`font-bold ${priceColor.colorClass}`}>
              {hoveredData?.change ? (
                `${hoveredData.change >= 0 ? '+' : ''}${hoveredData.change.toFixed(2)} (${hoveredData.changePct?.toFixed(2)}%)`
              ) : lastCandleRef.current ? (
                `${lastCandleRef.current.close >= lastCandleRef.current.open ? '+' : ''}${(lastCandleRef.current.close - lastCandleRef.current.open).toFixed(2)} (${(((lastCandleRef.current.close - lastCandleRef.current.open) / (lastCandleRef.current.open || 1)) * 100).toFixed(2)}%)`
              ) : (
                `${isPositive ? '+' : ''}${changeK} (${isPositive ? '+' : ''}${changePct}%)`
              )}
            </div>
            {(hoveredData?.volume || lastCandleRef.current) && (
              <div className="text-zinc-500 ml-1">
                Vol: <span className="text-zinc-300 font-bold">{(hoveredData?.volume || (loadedCandlesRef.current.length > 0 ? (currentTick?.totalVolume || 0) : 0)).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Indicators, Resolutions, Actions */}
        <div className="flex items-center gap-1.5">
          {/* Resolution buttons */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {RESOLUTIONS.map((res) => (
              <button
                key={res.id}
                onClick={() => setResolution(res.id)}
                className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded transition-all ${
                  resolution === res.id
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-zinc-800 mx-0.5" />

          {/* Indicators Button */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorsModal(!showIndicatorsModal)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-lg transition-all"
            >
              <FxIcon size={14} className="text-emerald-400" />
              <span>Các chỉ báo</span>
            </button>

            {/* Indicators Popover */}
            {showIndicatorsModal && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2 px-1">Chỉ báo kỹ thuật</div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setShowMA20(!showMA20)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Đường MA20
                    </span>
                    <span className={`text-[10px] ${showMA20 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showMA20 ? 'BẬT' : 'TẮT'}</span>
                  </button>

                  <button
                    onClick={() => setShowMA50(!showMA50)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      Đường MA50 (Minervini)
                    </span>
                    <span className={`text-[10px] ${showMA50 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showMA50 ? 'BẬT' : 'TẮT'}</span>
                  </button>

                  <button
                    onClick={() => setShowMA150(!showMA150)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      Đường MA150 (Minervini)
                    </span>
                    <span className={`text-[10px] ${showMA150 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showMA150 ? 'BẬT' : 'TẮT'}</span>
                  </button>

                  <button
                    onClick={() => setShowMA200(!showMA200)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Đường MA200 (Minervini)
                    </span>
                    <span className={`text-[10px] ${showMA200 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showMA200 ? 'BẬT' : 'TẮT'}</span>
                  </button>

                  <button
                    onClick={() => setShowBB(!showBB)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                      Bollinger Bands
                    </span>
                    <span className={`text-[10px] ${showBB ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showBB ? 'BẬT' : 'TẮT'}</span>
                  </button>

                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <ChartBar size={12} className="text-zinc-400" />
                      Khối lượng (Volume)
                    </span>
                    <span className={`text-[10px] ${showVolume ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showVolume ? 'BẬT' : 'TẮT'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trendline Pro Toggle Button */}
          <button
            onClick={() => setShowTrendlinePro(!showTrendlinePro)}
            title="Tự động kẻ Trendline Pro & Kênh Fibonacci đa tầng"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
              showTrendlinePro
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendUp size={14} className={showTrendlinePro ? 'text-amber-400' : 'text-zinc-500'} />
            <span className="hidden sm:inline">Trendline Pro</span>
            {showTrendlinePro && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-0.5" />

          {/* Undo / Redo for drawings */}
          <button
            onClick={handleUndo}
            disabled={drawings.length === 0}
            title="Hoàn tác nét vẽ (Undo)"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg disabled:opacity-30"
          >
            <ArrowCounterClockwise size={14} />
          </button>

          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            title="Căn chỉnh dữ liệu nến vừa khung (Fit Content)"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg"
          >
            <ArrowsOutSimple size={14} />
          </button>

          <button
            onClick={toggleFullscreen}
            title={isExpanded ? 'Thu nhỏ biểu đồ (Esc)' : 'Phóng to toàn bộ màn hình (Fullscreen)'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              isExpanded
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40'
            }`}
          >
            {isExpanded ? (
              <>
                <ArrowsIn size={14} weight="bold" />
                <span>Thu nhỏ</span>
              </>
            ) : (
              <>
                <ArrowsOut size={14} weight="bold" />
                <span className="hidden sm:inline">Toàn màn hình</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Sub-header: Live Trendline Pro Summary Bar (VN Terminal Pro Style) ── */}
      {showTrendlinePro && trendlineProData && (
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/80 text-[11px] font-mono text-zinc-300 overflow-x-auto scrollbar-none z-20">
          <span className="flex items-center gap-1.5 font-bold text-amber-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            * Trendline Pro
          </span>
          <span className="text-zinc-600 shrink-0">|</span>
          <span className="shrink-0 flex items-center gap-1.5">
            <span className="text-zinc-400">Kháng cự:</span>
            <span className="px-1.5 py-0.5 rounded bg-lime-500/15 text-lime-400 font-bold border border-lime-500/30">
              {trendlineProData.resistance.toFixed(2)}
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1.5">
            <span className="text-zinc-400">Hỗ trợ:</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">
              {trendlineProData.support.toFixed(2)}
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1.5">
            <span className="text-zinc-400">Fib 0,618:</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
              {trendlineProData.fib0618.toFixed(2)}
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1.5">
            <span className="text-zinc-400">Fib 1,618:</span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
              {trendlineProData.fib1618.toFixed(2)}
            </span>
          </span>
        </div>
      )}

      {/* ── Main Chart Body with Left Drawing Toolbar ─────────────── */}
      <div className={`w-full flex-1 flex relative bg-zinc-950 overflow-hidden ${
        isExpanded ? 'h-[calc(100vh-100px)] min-h-0' : 'h-[420px] lg:h-[440px] min-h-[360px]'
      }`}>
        {/* Left Vertical Drawing Toolbar (TradingView Style) */}
        <div className="flex flex-col items-center gap-1 py-2 px-1 bg-zinc-950 border-r border-zinc-800/70 z-30 shrink-0">
          <button
            onClick={() => { setActiveTool('cursor'); setDraftDrawing(null); }}
            title="Con trỏ chuột (Crosshair)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'cursor'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <Cursor size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('trendline'); setDraftDrawing(null); }}
            title="Đường xu hướng (Trendline)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'trendline'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <TrendUp size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('horizontal'); setDraftDrawing(null); }}
            title="Đường ngang (Hỗ trợ / Kháng cự)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'horizontal'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <Minus size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('fibonacci'); setDraftDrawing(null); }}
            title="Thoái lui Fibonacci"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'fibonacci'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <Percent size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('rectangle'); setDraftDrawing(null); }}
            title="Vùng giá (Hộp Supply / Demand)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'rectangle'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <Square size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('text'); setDraftDrawing(null); }}
            title="Ghi chú văn bản (Text Annotation)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'text'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <TextT size={16} weight="bold" />
          </button>

          <button
            onClick={() => { setActiveTool('measure'); setDraftDrawing(null); }}
            title="Thước đo biên độ & %"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'measure'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
          >
            <Ruler size={16} weight="bold" />
          </button>

          <div className="w-4 h-px bg-zinc-800 my-1" />

          {/* Palette popover */}
          <div className="relative">
            <button
              onClick={() => setShowPalette(!showPalette)}
              title="Chọn màu nét vẽ"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 relative"
            >
              <Palette size={16} weight="bold" />
              <span
                className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: activeColor }}
              />
            </button>

            {showPalette && (
              <div className="absolute left-full ml-2 top-0 bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col gap-2 z-50 shadow-2xl backdrop-blur-xl">
                <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider px-1">Màu sắc</div>
                <div className="flex items-center gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setActiveColor(c); setShowPalette(false); }}
                      className={`w-5 h-5 rounded-md border transition-transform ${
                        activeColor === c ? 'border-white scale-110 shadow' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider px-1 mt-1">Độ dày</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((w) => (
                    <button
                      key={w}
                      onClick={() => { setActiveWidth(w); setShowPalette(false); }}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                        activeWidth === w ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleClearAll}
            title="Xóa tất cả nét vẽ"
            disabled={drawings.length === 0}
            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent mt-auto mb-1"
          >
            <Trash size={16} />
          </button>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex-1 h-full w-full min-h-0 relative overflow-hidden">
          <div ref={chartContainerRef} className="w-full h-full min-h-0" />
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            className={`absolute inset-0 z-20 ${
              activeTool === 'cursor' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
            }`}
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-30">
              <SpinnerGap size={28} className="text-emerald-400 animate-spin mb-2" />
              <p className="text-xs font-mono text-zinc-300">Đang đồng bộ nến lịch sử DNSE từ ngày đầu tiên...</p>
            </div>
          )}

          {/* Active Tool Floating Banner */}
          {activeTool !== 'cursor' && (
            <div className="absolute top-3 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 border border-emerald-500/30 rounded-xl text-[11px] font-mono text-emerald-400 backdrop-blur-md shadow-xl">
              <span className="font-bold">{TOOL_LABELS[activeTool]}</span>
              <span className="text-zinc-400 text-[10px]">
                ({draftDrawing ? 'Nhấp điểm thứ 2 để chốt' : 'Nhấp điểm trên nến để bắt đầu'})
              </span>
              <button
                onClick={() => { setDraftDrawing(null); setActiveTool('cursor'); }}
                className="ml-1 p-0.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                title="Hủy vẽ (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── TradingView-Style Bottom Range Selector Bar ──────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800/70 bg-zinc-950 text-zinc-400 text-xs font-mono z-30">
        <div className="flex items-center gap-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => handleRangeSelect(r.id, r.bars)}
              className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                activeRange === r.id
                  ? 'text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20'
                  : 'hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-zinc-500">{currentTimeStr}</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            DNSE Realtime
          </span>
        </div>
      </div>
    </div>
  );
}
