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
  Eye,
  EyeSlash,
  ChartLine,
  Sparkle,
  Cursor,
  Minus,
  Percent,
  Square,
  Ruler,
  ArrowCounterClockwise,
  Trash,
  Palette,
  X,
} from '@phosphor-icons/react';
import stockDatabase from '../data/stockDatabase.json';

const EXCHANGE_MAP = new Map<string, string>();
(stockDatabase as any[]).forEach((item) => {
  EXCHANGE_MAP.set(item.symbol.toUpperCase(), item.exchange);
});

// Timeframe Resolution Presets
const RESOLUTIONS = [
  { id: '1m', label: '1M' },
  { id: '5m', label: '5M' },
  { id: '15m', label: '15M' },
  { id: '1h', label: '1H' },
  { id: '1D', label: '1D' },
  { id: '1Mo', label: '1Tháng' },
  { id: '3Mo', label: '3Tháng' },
  { id: '6Mo', label: '6Tháng' },
  { id: '1Y', label: '1Năm' },
  { id: 'ALL', label: 'Tất cả' },
] as const;

type ResolutionId = typeof RESOLUTIONS[number]['id'];

// Drawing Tool Types & Schema
export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'fibonacci' | 'rectangle' | 'measure';

export interface DrawingItem {
  id: string;
  type: DrawingTool;
  symbol: string;
  color: string;
  width: number;
  p1: { time: Time; price: number };
  p2?: { time: Time; price: number };
}

const TOOL_LABELS: Record<DrawingTool, string> = {
  cursor: 'Con trỏ chuột',
  trendline: 'Đường xu hướng (Trendline)',
  horizontal: 'Đường ngang Hỗ trợ / Kháng cự',
  fibonacci: 'Thoái lui Fibonacci',
  rectangle: 'Hộp vùng giá (Supply / Demand)',
  measure: 'Thước đo biến động (% & Giá)',
};

const PALETTE = ['#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#f4f4f5'];

// Seeded PRNG for initial bar placeholder consistency
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate N trading day strings (YYYY-MM-DD) excluding weekends (Saturday/Sunday)
function getTradingDayStrings(count: number): string[] {
  const dates: string[] = [];
  const curr = new Date();

  while (dates.length < count) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) { // Exclude Sunday (0) & Saturday (6)
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    curr.setDate(curr.getDate() - 1);
  }
  return dates.reverse();
}

// Generate intraday timestamps (in seconds)
function getIntradayTimestamps(count: number, stepSec: number): number[] {
  const times: number[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const alignedNow = Math.floor(nowSec / stepSec) * stepSec;

  for (let i = count - 1; i >= 0; i--) {
    times.push(alignedNow - i * stepSec);
  }
  return times;
}

// ── Official TradingView Pro Embed Component ──────────────────────────
function TradingViewProEmbed({ symbol, onFallbackToNative }: { symbol: string; onFallbackToNative?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanSym = symbol.toUpperCase().trim();
  const exchange = EXCHANGE_MAP.get(cleanSym) || 'HOSE';
  const isUpcom = exchange === 'UPCOM';
  const isRestrictedByTV = isUpcom || cleanSym === 'TAL';
  const tvSymbol = cleanSym.includes(':') ? cleanSym : `${exchange}:${cleanSym}`;
  const containerId = useMemo(() => `tv_widget_${cleanSym.toLowerCase()}`, [cleanSym]);

  useEffect(() => {
    if (isRestrictedByTV) return;
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const createWidget = () => {
      if (typeof (window as any).TradingView !== 'undefined' && containerRef.current) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: 'D',
          timezone: 'Asia/Ho_Chi_Minh',
          theme: 'dark',
          style: '1',
          locale: 'vi',
          toolbar_bg: '#09090b',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          range: '12M',
          details: true,
          hotlist: false,
          calendar: false,
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'Volume@tv-basicstudies',
          ],
        });
      }
    };

    if (typeof (window as any).TradingView !== 'undefined') {
      createWidget();
    } else {
      const existingScript = document.getElementById('tradingview-tv-js');
      if (existingScript) {
        existingScript.addEventListener('load', createWidget);
      } else {
        const script = document.createElement('script');
        script.id = 'tradingview-tv-js';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = createWidget;
        document.head.appendChild(script);
      }
    }
  }, [tvSymbol, containerId, isRestrictedByTV]);

  if (isRestrictedByTV) {
    return (
      <div className="w-full h-[500px] min-h-[500px] rounded-xl flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-800 text-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mb-3">
          <Sparkle size={28} />
        </div>
        <h4 className="font-mono font-bold text-zinc-100 text-base mb-1">
          {cleanSym === 'TAL' ? `Mã ${cleanSym} bị TradingView giới hạn bản quyền ngoài web` : `Mã ${cleanSym} thuộc sàn UPCOM`}
        </h4>
        <p className="text-xs text-zinc-400 max-w-md mb-4 leading-relaxed">
          {cleanSym === 'TAL'
            ? 'TradingView quốc tế hiện không cấp phép nhúng iframe bên ngoài đối với mã TAL. Toàn bộ nến thật và chỉ báo kỹ thuật đã sẵn sàng 100% trên Native DNSE Lightspeed.'
            : 'Nền tảng TradingView quốc tế chưa hỗ trợ trực tiếp các mã sàn UPCOM Việt Nam. Vui lòng chuyển sang chế độ Native DNSE Lightspeed để xem toàn bộ nến thật thời gian thực.'}
        </p>
        {onFallbackToNative && (
          <button
            onClick={onFallbackToNative}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
          >
            <ChartLine size={14} weight="bold" />
            <span>Xem ngay trên Native DNSE (100% Khả Dụng)</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] min-h-[500px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-2xl relative">
      <div id={containerId} ref={containerRef} className="w-full h-full min-h-[500px]" />
    </div>
  );
}

// ── Main MarketCandleChart Component ─────────────────────────────────
export function MarketCandleChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lastCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);

  const { selectedSymbol, ticks } = useMarketStore();
  const exchange = EXCHANGE_MAP.get(selectedSymbol.toUpperCase()) || 'HOSE';

  // Default chart mode to 'native' as requested by user
  const [chartMode, setChartMode] = useState<'native' | 'tradingview'>('native');
  const [resolution, setResolution] = useState<ResolutionId>('1D');
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [activeColor, setActiveColor] = useState<string>('#10b981');
  const [activeWidth, setActiveWidth] = useState<number>(2);
  const [showPalette, setShowPalette] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<DrawingItem | null>(null);

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

  // Base reference prices in thousands
  const getBasePriceK = useCallback((sym: string) => {
    const defaultPricesK: Record<string, number> = {
      HPG: 28.5, VCB: 92.5, SSI: 34.2, VHM: 42.3, TCB: 23.8,
      FPT: 134.5, MBB: 24.1, MWG: 64.2, VNM: 67.8, VIC: 44.6,
      STB: 29.8, VPB: 19.2, BID: 49.5, NVL: 14.2, DIG: 26.5,
      PDR: 22.1, SHB: 11.5, ACB: 24.8, EIB: 18.5, LPB: 31.2,
      VCG: 25.0, GEX: 21.8, POW: 11.8, KBC: 29.5, DGC: 98.5,
    };
    if (defaultPricesK[sym]) return defaultPricesK[sym];
    if (currentTick?.price) return currentTick.price / 1000;
    return 25.0;
  }, [currentTick]);

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
    } catch {
      setDrawings([]);
    }
  }, [selectedSymbol]);

  const saveDrawings = (items: DrawingItem[]) => {
    try {
      localStorage.setItem(`yf_drawings_${selectedSymbol}`, JSON.stringify(items));
    } catch {}
  };

  // Keyboard shortcut listener: Esc cancels current drawing & returns to cursor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftDrawing(null);
        setActiveTool('cursor');
        setShowPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Seeded deterministic candle generator for placeholder
  const generateInitialData = useCallback((sym: string, res: ResolutionId) => {
    const candles: CandlestickData<Time>[] = [];
    const volumes: HistogramData<Time>[] = [];
    const ma20Data: LineData<Time>[] = [];
    const ma50Data: LineData<Time>[] = [];

    const baseK = getBasePriceK(sym);
    const targetK = currentTick?.price ? currentTick.price / 1000 : baseK;

    let count = 120;
    let isDaily = false;
    let stepSec = 900;

    switch (res) {
      case '1m': count = 120; stepSec = 60; break;
      case '5m': count = 120; stepSec = 300; break;
      case '15m': count = 120; stepSec = 900; break;
      case '1h': count = 120; stepSec = 3600; break;
      case '1D': count = 120; isDaily = true; break;
      case '1Mo': count = 30; isDaily = true; break;
      case '3Mo': count = 90; isDaily = true; break;
      case '6Mo': count = 150; isDaily = true; break;
      case '1Y': count = 250; isDaily = true; break;
      case 'ALL': count = 400; isDaily = true; break;
    }

    const timeList: Time[] = isDaily
      ? (getTradingDayStrings(count) as Time[])
      : (getIntradayTimestamps(count, stepSec) as unknown as Time[]);

    let seed = 0;
    for (let s = 0; s < sym.length; s++) seed += sym.charCodeAt(s);

    const rawCandles: { time: Time; open: number; high: number; low: number; close: number; volume: number }[] = [];
    let currPrice = targetK * (0.95 + seededRandom(seed++) * 0.05);

    for (let i = 0; i < count; i++) {
      const time = timeList[i];
      const isLast = (i === count - 1);
      const open = Math.round(currPrice * 100) / 100;

      let close: number;
      if (isLast) {
        close = Math.round(targetK * 100) / 100;
      } else {
        const wave = Math.sin(i / 8) * (targetK * 0.008);
        const meanRevert = (targetK - open) * 0.04;
        const noise = (seededRandom(seed++) - 0.495) * (targetK * 0.006);
        close = Math.round((open + wave + meanRevert + noise) * 100) / 100;
      }

      close = Math.max(targetK * 0.88, Math.min(targetK * 1.12, close));
      const wickPadding = Math.max(0.02, Math.abs(close - open) * 0.5 + targetK * 0.002);
      const high = Math.round((Math.max(open, close) + seededRandom(seed++) * wickPadding) * 100) / 100;
      const low = Math.round((Math.min(open, close) - seededRandom(seed++) * wickPadding) * 100) / 100;
      const volume = Math.floor(seededRandom(seed++) * 600000) + 120000;

      rawCandles.push({ time, open, high, low, close, volume });
      currPrice = close;
    }

    for (let i = 0; i < rawCandles.length; i++) {
      const item = rawCandles[i];
      candles.push({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      });

      volumes.push({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      });

      if (i >= 19) {
        const slice = rawCandles.slice(i - 19, i + 1);
        const sum = slice.reduce((acc, c) => acc + c.close, 0);
        ma20Data.push({ time: item.time, value: Math.round((sum / 20) * 100) / 100 });
      }

      if (i >= 49) {
        const slice = rawCandles.slice(i - 49, i + 1);
        const sum = slice.reduce((acc, c) => acc + c.close, 0);
        ma50Data.push({ time: item.time, value: Math.round((sum / 50) * 100) / 100 });
      }
    }

    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      lastCandleRef.current = {
        time: last.time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };
    }

    return { candles, volumes, ma20Data, ma50Data };
  }, [getBasePriceK, currentTick]);

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
          ctx.fillRect(w - 68, y - 10, 64, 20);
          ctx.fillStyle = '#09090b';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${item.p1.price.toFixed(2)}k`, w - 36, y);
        }
      } else if (item.type === 'trendline' && item.p2) {
        const c1 = toCoord(item.p1);
        const c2 = toCoord(item.p2);
        if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();

          // Anchor Dots
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

              // Fibonacci Level Label
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

          // Center HUD Pill
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
      }
      ctx.restore();
    });

    ctx.restore();
  }, [drawings, draftDrawing]);

  // Adjust canvas size to match container with High-DPI support
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

  // Trigger canvas redraw on drawing updates
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Mount Lightweight Chart for Native Mode
  useEffect(() => {
    if (chartMode !== 'native' || !chartContainerRef.current) return;
    const container = chartContainerRef.current;
    const isDaily = resolution === '1D' || resolution.includes('Mo') || resolution.includes('Y') || resolution === 'ALL';

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
      height: 480,
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

    const { candles, volumes, ma20Data, ma50Data } = generateInitialData(selectedSymbol, resolution);
    candlestickSeries.setData(candles);
    volumeSeries.setData(volumes);
    if (showMA20) ma20Series.setData(ma20Data);
    if (showMA50) ma50Series.setData(ma50Data);

    chart.timeScale().fitContent();

    // Hook chart panning & zooming to re-render overlay drawings instantly
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(redrawCanvas);
    });
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(redrawCanvas);
    });

    // Fetch real historical candles from DNSE API (days=0 returns full history since day 1)
    let isCancelled = false;
    let daysToFetch = 0; // 0 = Lấy từ phiên đầu tiên lên sàn
    if (resolution === '1m') daysToFetch = 2;
    else if (resolution === '5m') daysToFetch = 5;
    else if (resolution === '15m') daysToFetch = 14;
    else if (resolution === '1h') daysToFetch = 60;
    else if (resolution === '1Mo') daysToFetch = 30;
    else if (resolution === '3Mo') daysToFetch = 90;
    else if (resolution === '6Mo') daysToFetch = 180;
    else if (resolution === '1Y') daysToFetch = 365;
    else if (resolution === 'ALL' || resolution === '1D') daysToFetch = 0;

    fetch(`/api/market/history?symbol=${selectedSymbol}&resolution=${resolution}&days=${daysToFetch}`)
      .then((res) => res.json())
      .then((resData) => {
        if (isCancelled || !resData.success || !resData.data || resData.data.length === 0) return;
        const isDaily = resolution === '1D' || resolution.includes('Mo') || resolution.includes('Y') || resolution === 'ALL';

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

        const realMa20: LineData<Time>[] = [];
        const realMa50: LineData<Time>[] = [];
        for (let i = 0; i < uniqueCandles.length; i++) {
          if (i >= 19) {
            const sum20 = uniqueCandles.slice(i - 19, i + 1).reduce((acc, x) => acc + x.close, 0);
            realMa20.push({ time: uniqueCandles[i].time, value: Math.round((sum20 / 20) * 100) / 100 });
          }
          if (i >= 49) {
            const sum50 = uniqueCandles.slice(i - 49, i + 1).reduce((acc, x) => acc + x.close, 0);
            realMa50.push({ time: uniqueCandles[i].time, value: Math.round((sum50 / 50) * 100) / 100 });
          }
        }

        if (uniqueCandles.length > 0) {
          candlestickSeries.setData(uniqueCandles);
          volumeSeries.setData(uniqueVolumes);
          if (showMA20) ma20Series.setData(realMa20);
          if (showMA50) ma50Series.setData(realMa50);

          // Focus on recent 150 candles so bars look spacious, while user can scroll back to day 1
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

          requestAnimationFrame(redrawCanvas);
        }
      })
      .catch(() => {});

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
  }, [chartMode, resolution, selectedSymbol, generateInitialData, showMA20, showMA50, redrawCanvas, updateCanvasSize]);

  // Real-time tick update to candle
  useEffect(() => {
    if (chartMode !== 'native' || !currentTick?.price || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const livePriceK = Math.round((currentTick.price / 1000) * 100) / 100;
    const tickVol = currentTick.volume || 10000;

    if (lastCandleRef.current) {
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
  }, [chartMode, currentTick, redrawCanvas]);

  // Canvas Mouse Event Handlers for Interactive Drawing
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

    // 2-point tools
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
    const updated = drawings.slice(0, drawings.length - 1);
    setDrawings(updated);
    saveDrawings(updated);
  };

  const handleClearAll = () => {
    setDrawings([]);
    setDraftDrawing(null);
    saveDrawings([]);
  };

  const priceDisplayK = currentTick?.price ? (currentTick.price / 1000).toFixed(2) : '--';
  const changeK = currentTick?.change ? (currentTick.change / 1000).toFixed(2) : '0.00';
  const changePct = currentTick?.changePercent ? currentTick.changePercent.toFixed(2) : '0.00';
  const isPositive = currentTick ? currentTick.change >= 0 : true;

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/60 rounded-2xl p-4 backdrop-blur-xl flex flex-col h-full relative overflow-hidden">
      {/* Background Watermark Ticker Symbol */}
      <div className="absolute right-6 bottom-10 text-8xl font-mono font-black text-white/[0.02] select-none pointer-events-none tracking-tighter">
        {selectedSymbol}
      </div>

      {/* Chart Control Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3 mb-3 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            {isPositive ? <TrendUp size={18} weight="bold" /> : <TrendDown size={18} weight="bold" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-bold text-zinc-100 text-sm tracking-tight">{selectedSymbol}</h3>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                {exchange}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
              <span className="text-zinc-100 font-extrabold">{priceDisplayK}k</span>
              <span className={isPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isPositive ? '+' : ''}{changeK} ({isPositive ? '+' : ''}{changePct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Engine Switcher & Indicator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Engine Mode Toggle */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setChartMode('native')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                chartMode === 'native'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ChartLine size={12} weight="bold" />
              <span>Native Stream (Bộ vẽ Pro)</span>
            </button>

            <button
              onClick={() => setChartMode('tradingview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                chartMode === 'tradingview'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkle size={12} weight="bold" />
              <span>TradingView Pro</span>
            </button>
          </div>

          {/* Controls specific to Native mode */}
          {chartMode === 'native' && (
            <>
              <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
                <button
                  onClick={() => setShowMA20(!showMA20)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-semibold rounded-lg transition-colors ${
                    showMA20 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {showMA20 ? <Eye size={12} /> : <EyeSlash size={12} />}
                  <span>MA20</span>
                </button>

                <button
                  onClick={() => setShowMA50(!showMA50)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-semibold rounded-lg transition-colors ${
                    showMA50 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {showMA50 ? <Eye size={12} /> : <EyeSlash size={12} />}
                  <span>MA50</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 overflow-x-auto max-w-full">
                <Clock size={13} className="text-zinc-500 ml-1 mr-0.5 shrink-0" />
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setResolution(res.id)}
                    className={`px-2 py-1 text-[10px] font-mono font-medium rounded-lg transition-all shrink-0 ${
                      resolution === res.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
                <button
                  onClick={() => chartRef.current?.timeScale().fitContent()}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg ml-0.5 shrink-0"
                  title="Căn chỉnh biểu đồ"
                >
                  <ArrowsOutSimple size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Native Mode Crosshair Inspection Bar */}
      {chartMode === 'native' && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-1.5 mb-2 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-[11px] font-mono z-10 text-zinc-400">
          <div>O: <span className="text-zinc-200 font-bold">{hoveredData?.open ? hoveredData.open.toFixed(2) : priceDisplayK}</span></div>
          <div>H: <span className="text-emerald-400 font-bold">{hoveredData?.high ? hoveredData.high.toFixed(2) : (currentTick?.high ? (currentTick.high/1000).toFixed(2) : priceDisplayK)}</span></div>
          <div>L: <span className="text-rose-400 font-bold">{hoveredData?.low ? hoveredData.low.toFixed(2) : (currentTick?.low ? (currentTick.low/1000).toFixed(2) : priceDisplayK)}</span></div>
          <div>C: <span className="text-zinc-100 font-bold">{hoveredData?.close ? hoveredData.close.toFixed(2) : priceDisplayK}</span></div>
          {hoveredData?.changePct !== undefined && (
            <div className={hoveredData.changePct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hoveredData.changePct >= 0 ? '+' : ''}{hoveredData.changePct.toFixed(2)}%
            </div>
          )}
          {hoveredData?.volume && (
            <div className="ml-auto text-zinc-500">Vol: <span className="text-zinc-300 font-bold">{hoveredData.volume.toLocaleString()}</span></div>
          )}
        </div>
      )}

      {/* Main Chart Area with TradingView-Style Left Drawing Toolbar */}
      <div className="w-full flex-1 min-h-[480px] rounded-xl overflow-hidden z-10 flex border border-zinc-800/80 bg-zinc-950 relative">
        {chartMode === 'tradingview' ? (
          <TradingViewProEmbed
            key={selectedSymbol}
            symbol={selectedSymbol}
            onFallbackToNative={() => setChartMode('native')}
          />
        ) : (
          <>
            {/* Left Vertical Drawing Toolbar */}
            <div className="flex flex-col items-center gap-1.5 py-2.5 px-1.5 bg-zinc-950/90 border-r border-zinc-800/80 z-30 shrink-0">
              {/* Cursor / Select */}
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

              {/* Trendline */}
              <button
                onClick={() => { setActiveTool('trendline'); setDraftDrawing(null); }}
                title="Đường xu hướng (Trend Line)"
                className={`p-2 rounded-lg transition-all ${
                  activeTool === 'trendline'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <TrendUp size={16} weight="bold" />
              </button>

              {/* Horizontal Line */}
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

              {/* Fibonacci Retracement */}
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

              {/* Rectangle Zone */}
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

              {/* Measure */}
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

              {/* Color Palette Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowPalette(!showPalette)}
                  title="Chọn màu nét vẽ"
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 relative"
                >
                  <Palette size={16} weight="bold" />
                  <span
                    className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: activeColor }}
                  />
                </button>

                {showPalette && (
                  <div className="absolute left-full ml-2 top-0 bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col gap-2 z-40 shadow-2xl backdrop-blur-xl">
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

              {/* Undo */}
              <button
                onClick={handleUndo}
                title="Hoàn tác nét vẽ (Undo)"
                disabled={drawings.length === 0}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowCounterClockwise size={16} />
              </button>

              {/* Clear All */}
              <button
                onClick={handleClearAll}
                title="Xóa tất cả nét vẽ"
                disabled={drawings.length === 0}
                className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent mt-auto"
              >
                <Trash size={16} />
              </button>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 h-full min-h-[480px] relative overflow-hidden">
              <div ref={chartContainerRef} className="w-full h-full min-h-[480px]" />
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                className={`absolute inset-0 z-20 ${
                  activeTool === 'cursor' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
                }`}
              />

              {/* Floating Active Tool Banner */}
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
          </>
        )}
      </div>
    </div>
  );
}
