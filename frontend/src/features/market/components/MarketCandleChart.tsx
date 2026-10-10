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
  CrosshairMode,
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
  Magnet,
  PushPin,
  LockKey,
  Eye,
  EyeSlash,
  Copy,
  Scissors,
  Star,
  PaintBrush,
  Circle,
  Tag,
  Target,
  Rocket,
  DotsSixVertical,
  Waveform,
  Sliders,
  Check,
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
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
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
export type DrawingTool =
  | 'cursor'
  | 'dot'
  | 'arrow_pointer'
  | 'eraser'
  | 'trendline'
  | 'ray'
  | 'horizontal'
  | 'horizontal_ray'
  | 'vertical'
  | 'parallel_channel'
  | 'fibonacci'
  | 'fib_extension'
  | 'rectangle'
  | 'circle'
  | 'arrow_marker'
  | 'text'
  | 'price_label'
  | 'callout'
  | 'measure'
  | 'long_position'
  | 'short_position'
  | 'rocket';

export interface DrawingItem {
  id: string;
  type: DrawingTool;
  symbol: string;
  color: string;
  width: number;
  p1: { time: Time; price: number; logical?: number };
  p2?: { time: Time; price: number; logical?: number };
  p3?: { time: Time; price: number; logical?: number };
  mouseCoord?: { x: number; y: number };
  text?: string;
}

const TOOL_LABELS: Record<DrawingTool, string> = {
  cursor: 'Con trỏ chữ thập (Crosshair)',
  dot: 'Điểm chấm (Dot)',
  arrow_pointer: 'Con trỏ mũi tên (Arrow)',
  eraser: 'Cục tẩy nét vẽ (Eraser)',
  trendline: 'Đường xu hướng (Trend Line)',
  ray: 'Tia xu hướng (Ray)',
  horizontal: 'Đường ngang Hỗ trợ / Kháng cự',
  horizontal_ray: 'Tia ngang (Horizontal Ray)',
  vertical: 'Đường dọc (Vertical Line)',
  parallel_channel: 'Kênh giá song song (Channel)',
  fibonacci: 'Thoái lui Fibonacci (Retracement)',
  fib_extension: 'Mở rộng Fibonacci (Fib Extension)',
  rectangle: 'Hộp vùng giá (Supply / Demand)',
  circle: 'Đường tròn (Circle)',
  arrow_marker: 'Mũi tên đánh dấu (Arrow Marker)',
  text: 'Ghi chú văn bản (Text note)',
  price_label: 'Nhãn giá kỹ thuật (Price Label)',
  callout: 'Bong bóng ghi chú (Callout)',
  measure: 'Thước đo biến động (% & Nến)',
  long_position: 'Vị thế Mua (Long Position R:R)',
  short_position: 'Vị thế Bán (Short Position R:R)',
  rocket: 'Mục tiêu bứt phá (Rocket 🚀)',
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

// ── Technical Indicator Calculations (RSI, MACD, MFI, OBV) ──────────
export type SubIndicatorType = 'none' | 'rsi' | 'macd' | 'mfi' | 'obv';

function calculateRSI(candles: CandlestickData<Time>[], period = 14): LineData<Time>[] {
  if (!candles || candles.length <= period) return [];
  const results: LineData<Time>[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  results.push({ time: candles[period].time, value: Math.round(rsi * 100) / 100 });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    results.push({ time: candles[i].time, value: Math.round(rsi * 100) / 100 });
  }
  return results;
}

function calculateMACD(candles: CandlestickData<Time>[], fast = 12, slow = 26, signal = 9) {
  if (!candles || candles.length <= slow + signal) return { macd: [], signal: [], hist: [] };
  const closes = candles.map((c) => c.close);
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signal + 1);

  let emaFast = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
  let emaSlow = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow;

  const macdValues: number[] = [];
  const times: Time[] = [];

  for (let i = slow; i < candles.length; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
    emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
    const macdVal = emaFast - emaSlow;
    macdValues.push(macdVal);
    times.push(candles[i].time);
  }

  let signalEma = macdValues.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  const macdSeries: LineData<Time>[] = [];
  const signalSeries: LineData<Time>[] = [];
  const histSeries: HistogramData<Time>[] = [];

  for (let i = signal - 1; i < macdValues.length; i++) {
    if (i >= signal) {
      signalEma = macdValues[i] * kSignal + signalEma * (1 - kSignal);
    }
    const m = Math.round(macdValues[i] * 100) / 100;
    const s = Math.round(signalEma * 100) / 100;
    const h = Math.round((m - s) * 100) / 100;
    const t = times[i];

    macdSeries.push({ time: t, value: m });
    signalSeries.push({ time: t, value: s });
    histSeries.push({
      time: t,
      value: h,
      color: h >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)',
    });
  }

  return { macd: macdSeries, signal: signalSeries, hist: histSeries };
}

function calculateMFI(candles: CandlestickData<Time>[], volumes: HistogramData<Time>[], period = 14): LineData<Time>[] {
  if (!candles || candles.length <= period) return [];
  const volMap = new Map<Time, number>();
  volumes.forEach((v) => volMap.set(v.time, v.value));

  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const rmf = tp.map((price, i) => price * (volMap.get(candles[i].time) || 0));

  const results: LineData<Time>[] = [];
  for (let i = period; i < candles.length; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posFlow += rmf[j];
      else if (tp[j] < tp[j - 1]) negFlow += rmf[j];
    }
    const mfi = negFlow === 0 ? 100 : 100 - (100 / (1 + (posFlow / negFlow)));
    results.push({ time: candles[i].time, value: Math.round(mfi * 100) / 100 });
  }
  return results;
}

function calculateOBV(candles: CandlestickData<Time>[], volumes: HistogramData<Time>[]): LineData<Time>[] {
  if (!candles || candles.length === 0) return [];
  const volMap = new Map<Time, number>();
  volumes.forEach((v) => volMap.set(v.time, v.value));

  const results: LineData<Time>[] = [];
  let currentOBV = 0;
  results.push({ time: candles[0].time, value: 0 });

  for (let i = 1; i < candles.length; i++) {
    const vol = volMap.get(candles[i].time) || 0;
    if (candles[i].close > candles[i - 1].close) currentOBV += vol;
    else if (candles[i].close < candles[i - 1].close) currentOBV -= vol;
    results.push({ time: candles[i].time, value: Math.round(currentOBV) });
  }
  return results;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function aggregateCandles(
  candles: CandlestickData<Time>[],
  volumes: HistogramData<Time>[],
  type: '1M' | '3M' | '6M'
): { candles: CandlestickData<Time>[]; volumes: HistogramData<Time>[] } {
  if (!candles || candles.length === 0) return { candles: [], volumes: [] };

  const volMap = new Map<Time, number>();
  volumes.forEach((v) => volMap.set(v.time, v.value));

  const groups = new Map<
    string,
    { time: Time; open: number; high: number; low: number; close: number; volume: number }
  >();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const timeStr = typeof c.time === 'string' ? c.time : new Date(Number(c.time) * 1000).toISOString().split('T')[0];
    const parts = timeStr.split('-');
    const year = parts[0];
    const month = parseInt(parts[1] || '1', 10);

    let key = '';
    if (type === '1M') {
      key = `${year}-${String(month).padStart(2, '0')}`;
    } else if (type === '3M') {
      const q = Math.floor((month - 1) / 3) + 1;
      key = `${year}-Q${q}`;
    } else if (type === '6M') {
      const h = Math.floor((month - 1) / 6) + 1;
      key = `${year}-H${h}`;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: volMap.get(c.time) || 0,
      });
    } else {
      const g = groups.get(key)!;
      g.high = Math.max(g.high, c.high);
      g.low = Math.min(g.low, c.low);
      g.close = c.close;
      g.volume += volMap.get(c.time) || 0;
    }
  }

  const aggCandles: CandlestickData<Time>[] = [];
  const aggVolumes: HistogramData<Time>[] = [];

  groups.forEach((g) => {
    aggCandles.push({
      time: g.time,
      open: g.open,
      high: g.high,
      low: g.low,
      close: g.close,
    });
    aggVolumes.push({
      time: g.time,
      value: g.volume,
      color: g.close >= g.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
    });
  });

  return { candles: aggCandles, volumes: aggVolumes };
}

// Helper to map continuous logical bar indices to calendar dates / Time
function logicalToTime(logical: number, candles: CandlestickData<Time>[]): Time {
  if (candles.length === 0) return '' as Time;
  const roundedIdx = Math.round(logical);
  if (roundedIdx < 0) {
    const firstStr = String(candles[0].time);
    const firstDate = new Date(firstStr);
    if (!isNaN(firstDate.getTime())) {
      firstDate.setDate(firstDate.getDate() + roundedIdx);
      return firstDate.toISOString().split('T')[0] as Time;
    }
    return candles[0].time;
  }
  if (roundedIdx >= candles.length) {
    const lastStr = String(candles[candles.length - 1].time);
    const lastDate = new Date(lastStr);
    if (!isNaN(lastDate.getTime())) {
      const diffBars = roundedIdx - (candles.length - 1);
      lastDate.setDate(lastDate.getDate() + diffBars);
      return lastDate.toISOString().split('T')[0] as Time;
    }
    return candles[candles.length - 1].time;
  }
  return candles[roundedIdx].time;
}

// Universal Point to Screen Coordinate Resolver (Handles past candles, live candles, and future projections)
function resolvePointCoordinate(
  chart: IChartApi | null,
  series: ISeriesApi<'Candlestick'> | null,
  point?: { time: Time; price: number; logical?: number },
  candles: CandlestickData<Time>[] = []
): { x: number | null; y: number | null } {
  if (!chart || !series || !point) return { x: null, y: null };
  const timeScale = chart.timeScale();
  let x: number | null = null;

  // 1. If point has high-precision continuous logical coordinate
  if (point.logical !== undefined && point.logical !== null) {
    if (candles.length > 0 && point.time) {
      const cIdx = candles.findIndex((c) => c.time === point.time);
      if (cIdx !== -1) {
        // If logical is aligned with current candles, use logical for silky-smooth sub-bar dragging
        if (Math.abs(point.logical - cIdx) < 3) {
          x = timeScale.logicalToCoordinate(point.logical as any);
        } else {
          // If timeframe or data shifted significantly, fallback to timeToCoordinate
          x = timeScale.timeToCoordinate(point.time);
        }
      } else {
        // Target is future/past or off-candle: logicalToCoordinate smoothly resolves it
        x = timeScale.logicalToCoordinate(point.logical as any);
      }
    } else {
      x = timeScale.logicalToCoordinate(point.logical as any);
    }
  }

  // 2. If x is still null, fallback to timeToCoordinate
  if (x === null && point.time) {
    x = timeScale.timeToCoordinate(point.time);
  }

  // 3. Fallback for future or past projection beyond loaded candle dataset
  if (x === null && candles.length > 0 && point.time) {
    const lastCandle = candles[candles.length - 1];
    const pStr = String(point.time);
    const lastStr = String(lastCandle.time);
    if (pStr > lastStr) {
      const pDate = new Date(pStr).getTime();
      const lDate = new Date(lastStr).getTime();
      const diffDays = !isNaN(pDate) && !isNaN(lDate)
        ? Math.max(1, Math.round((pDate - lDate) / (24 * 60 * 60 * 1000)))
        : 1;
      const targetLogical = candles.length - 1 + diffDays;
      x = timeScale.logicalToCoordinate(targetLogical as any);
    } else {
      const pDate = new Date(pStr).getTime();
      const fDate = new Date(String(candles[0].time)).getTime();
      if (!isNaN(pDate) && !isNaN(fDate) && pDate < fDate) {
        const diffDays = Math.max(1, Math.round((fDate - pDate) / (24 * 60 * 60 * 1000)));
        x = timeScale.logicalToCoordinate((-diffDays) as any);
      }
    }
  }

  const y = series.priceToCoordinate(point.price);
  return { x, y };
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
  const redrawCanvasRef = useRef<() => void>(() => {});
  const candleCacheRef = useRef<Map<string, {
    candles: CandlestickData<Time>[];
    volumes: HistogramData<Time>[];
    ma20: LineData<Time>[];
    ma50: LineData<Time>[];
    ma150: LineData<Time>[];
    ma200: LineData<Time>[];
    bbUpper: LineData<Time>[];
    bbLower: LineData<Time>[];
    proData: TrendlineProResult | null;
  }>>(new Map());

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

  // Sub-Chart Indicators (RSI, MACD, MFI, OBV)
  const [activeSubIndicator, setActiveSubIndicator] = useState<SubIndicatorType>('none');
  const [subIndicatorValues, setSubIndicatorValues] = useState<{
    rsi?: number;
    macd?: number;
    signal?: number;
    hist?: number;
    mfi?: number;
    obv?: number;
  }>({});
  const [dataVersion, setDataVersion] = useState<number>(0);
  const subChartContainerRef = useRef<HTMLDivElement>(null);
  const subChartRef = useRef<IChartApi | null>(null);
  const loadedVolumesRef = useRef<HistogramData<Time>[]>([]);

  // Trendline Pro State
  const [showTrendlinePro, setShowTrendlinePro] = useState(true);
  const [trendlineProData, setTrendlineProData] = useState<TrendlineProResult | null>(null);

  // Drawing Tools State (TradingView Style)
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const activeToolRef = useRef<DrawingTool>('cursor');
  activeToolRef.current = activeTool;

  const [activeColor, setActiveColor] = useState<string>('#10b981');
  const [activeWidth, setActiveWidth] = useState<number>(2);
  const [showPalette, setShowPalette] = useState<boolean>(false);

  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const drawingsRef = useRef<DrawingItem[]>([]);
  drawingsRef.current = drawings;

  const [draftDrawing, setDraftDrawing] = useState<DrawingItem | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const selectedDrawingIdRef = useRef<string | null>(null);
  const [editingDrawing, setEditingDrawing] = useState<DrawingItem | null>(null);
  const findHitDrawingRef = useRef<(x: number, y: number) => DrawingItem | null>(() => null);
  const [undoStack, setUndoStack] = useState<DrawingItem[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingItem[][]>([]);
  const [isMagnetMode, setIsMagnetMode] = useState<boolean>(false); // Smart magnet snap to OHLC (off by default like TradingView)
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);

  const [lockDrawings, setLockDrawings] = useState<boolean>(false);
  const lockDrawingsRef = useRef<boolean>(false);
  lockDrawingsRef.current = lockDrawings;

  const isDraggingRef = useRef<boolean>(false);
  const [hideDrawings, setHideDrawings] = useState<boolean>(false);
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [palettePos, setPalettePos] = useState<{ top: number; left: number } | null>(null);

  const triggerFlyout = (groupId: string, targetEl: HTMLElement) => {
    if (activeFlyout === groupId) {
      setActiveFlyout(null);
      setFlyoutPos(null);
    } else {
      const rect = targetEl.getBoundingClientRect();
      const top = Math.max(10, Math.min(rect.top, window.innerHeight - 320));
      setFlyoutPos({ top, left: rect.right + 8 });
      setActiveFlyout(groupId);
    }
  };
  const [hoverSnapPoint, setHoverSnapPoint] = useState<{ x: number; y: number; price: number } | null>(null);
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
    ma20?: number;
    ma50?: number;
    ma150?: number;
    ma200?: number;
  } | null>(null);

  // Latest calculated Moving Average values for indicator legend
  const [latestMA, setLatestMA] = useState<{
    ma20?: number;
    ma50?: number;
    ma150?: number;
    ma200?: number;
  }>({});

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

  const handleDeleteDrawing = (id: string) => {
    setDrawings((prev) => {
      const itemToRemove = prev.find((d) => d.id === id);
      if (itemToRemove) {
        setUndoStack((u) => [...u, [itemToRemove]]);
        setRedoStack([]);
      }
      const updated = prev.filter((d) => d.id !== id);
      saveDrawings(updated);
      return updated;
    });
    setSelectedDrawingId(null);
    setEditingDrawing(null);
    setTimeout(() => redrawCanvasRef.current(), 0);
  };

  const handleUpdateDrawingColor = (id: string, color: string) => {
    setDrawings((prev) => {
      const updated = prev.map((d) => (d.id === id ? { ...d, color } : d));
      saveDrawings(updated);
      return updated;
    });
    if (editingDrawing && editingDrawing.id === id) {
      setEditingDrawing((prev) => (prev ? { ...prev, color } : null));
    }
  };

  const handleUpdateDrawingWidth = (id: string, width: number) => {
    setDrawings((prev) => {
      const updated = prev.map((d) => (d.id === id ? { ...d, width } : d));
      saveDrawings(updated);
      return updated;
    });
    if (editingDrawing && editingDrawing.id === id) {
      setEditingDrawing((prev) => (prev ? { ...prev, width } : null));
    }
  };

  const handleDuplicateDrawing = (id: string) => {
    const item = drawings.find((d) => d.id === id);
    if (!item) return;
    const offsetPrice = (item.p1.price * 0.01) || 0.5;
    const duplicated: DrawingItem = {
      ...item,
      id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      p1: { ...item.p1, price: Math.round((item.p1.price + offsetPrice) * 100) / 100 },
      p2: item.p2 ? { ...item.p2, price: Math.round((item.p2.price + offsetPrice) * 100) / 100 } : undefined,
    };
    const updated = [...drawings, duplicated];
    setDrawings(updated);
    saveDrawings(updated);
    setSelectedDrawingId(duplicated.id);
  };

  const handleSaveDrawingCoords = (updatedItem: DrawingItem) => {
    setDrawings((prev) => {
      const updated = prev.map((d) => (d.id === updatedItem.id ? updatedItem : d));
      saveDrawings(updated);
      return updated;
    });
    setSelectedDrawingId(updatedItem.id);
    setEditingDrawing(null);
    setTimeout(() => redrawCanvasRef.current(), 0);
  };

  // Synchronize crosshair visibility with active cursor tool to prevent frozen crosshairs
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const hideCrosshair = activeTool === 'arrow_pointer';
    chart.applyOptions({
      crosshair: {
        mode: hideCrosshair ? CrosshairMode.Hidden : CrosshairMode.Normal,
        vertLine: { visible: !hideCrosshair },
        horzLine: { visible: !hideCrosshair },
      },
    });
    if (chartContainerRef.current) {
      chartContainerRef.current.style.cursor = hideCrosshair ? 'default' : 'crosshair';
    }
  }, [activeTool]);

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

  useEffect(() => {
    selectedDrawingIdRef.current = selectedDrawingId;
  }, [selectedDrawingId]);

  // Keyboard shortcut listener: Delete/Backspace deletes selected drawing, Esc cancels current drawing or exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        const selId = selectedDrawingIdRef.current;
        if (selId) {
          e.preventDefault();
          setDrawings((prev) => {
            const itemToRemove = prev.find((d) => d.id === selId);
            if (itemToRemove) {
              setUndoStack((u) => [...u, [itemToRemove]]);
              setRedoStack([]);
            }
            const updated = prev.filter((d) => d.id !== selId);
            saveDrawings(updated);
            return updated;
          });
          setSelectedDrawingId(null);
          setTimeout(() => {
            redrawCanvasRef.current();
          }, 0);
          return;
        }
      }

      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsExpanded(false);
        setDraftDrawing(null);
        setSelectedDrawingId(null);
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

  // Smart Magnet Snapping function (Snaps to Nearest Candle O/H/L/C with TradingView-style proximity gate)
  const snapToCandle = useCallback(
    (rawTime: Time | null, rawPrice: number, screenX?: number, screenY?: number) => {
      if (!isMagnetMode || loadedCandlesRef.current.length === 0 || !chartRef.current || !candleSeriesRef.current) {
        return { time: rawTime, price: Math.round(rawPrice * 100) / 100, isSnapped: false };
      }

      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      const candles = loadedCandlesRef.current;
      let targetCandle: CandlestickData<Time> | null = null;

      if (rawTime) {
        const idx = candles.findIndex((c) => c.time === rawTime);
        if (idx !== -1) {
          targetCandle = candles[idx];
        }
      }

      if (!targetCandle && screenX !== undefined) {
        let closestDist = Infinity;
        for (let i = 0; i < candles.length; i++) {
          const coord = chart.timeScale().timeToCoordinate(candles[i].time);
          if (coord !== null) {
            const dist = Math.abs(coord - screenX);
            if (dist < closestDist && dist <= 24) {
              closestDist = dist;
              targetCandle = candles[i];
            }
          }
        }
      }

      if (!targetCandle) {
        return { time: rawTime, price: Math.round(rawPrice * 100) / 100, isSnapped: false };
      }

      // Check horizontal distance
      const candleX = chart.timeScale().timeToCoordinate(targetCandle.time);
      if (candleX !== null && screenX !== undefined && Math.abs(candleX - screenX) > 24) {
        return { time: rawTime, price: Math.round(rawPrice * 100) / 100, isSnapped: false };
      }

      // Check OHLC points for vertical proximity
      const ohlc = [targetCandle.high, targetCandle.low, targetCandle.open, targetCandle.close];
      let bestPrice = rawPrice;
      let minPixDiff = Infinity;
      let foundSnap = false;

      for (let i = 0; i < ohlc.length; i++) {
        const pY = series.priceToCoordinate(ohlc[i]);
        if (pY !== null && screenY !== undefined) {
          const pixDiff = Math.abs(pY - screenY);
          if (pixDiff < minPixDiff && pixDiff <= 28) {
            minPixDiff = pixDiff;
            bestPrice = ohlc[i];
            foundSnap = true;
          }
        }
      }

      if (!foundSnap) {
        return { time: targetCandle.time, price: Math.round(rawPrice * 100) / 100, isSnapped: false };
      }

      return {
        time: targetCandle.time,
        price: Math.round(bestPrice * 100) / 100,
        isSnapped: true,
      };
    },
    [isMagnetMode]
  );

  // Find drawing hit at screen coordinates (x, y) for selection & deletion
  const findHitDrawing = useCallback(
    (x: number, y: number): DrawingItem | null => {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!chart || !series || drawings.length === 0) return null;

      const toCoord = (p?: { time: Time; price: number; logical?: number }) => {
        return resolvePointCoordinate(chart, series, p, loadedCandlesRef.current);
      };

      for (let i = drawings.length - 1; i >= 0; i--) {
        const item = drawings[i];
        const c1 = toCoord(item.p1);
        const c2 = item.p2 ? toCoord(item.p2) : null;
        const c3 = item.p3 ? toCoord(item.p3) : null;

        if (item.type === 'horizontal') {
          const yCoord = series.priceToCoordinate(item.p1.price);
          if (yCoord !== null && Math.abs(y - yCoord) <= 12) return item;
        } else if (item.type === 'horizontal_ray') {
          const yCoord = series.priceToCoordinate(item.p1.price);
          if (yCoord !== null && Math.abs(y - yCoord) <= 12) {
            if (c1.x === null || x >= c1.x - 12) return item;
          }
        } else if (item.type === 'vertical') {
          if (c1.x !== null && Math.abs(x - c1.x) <= 12) return item;
        } else if (
          item.type === 'trendline' ||
          item.type === 'ray' ||
          item.type === 'arrow_pointer' ||
          item.type === 'arrow_marker' ||
          item.type === 'measure'
        ) {
          if (c1.x !== null && c1.y !== null && c2 && c2.x !== null && c2.y !== null) {
            if (distToSegment(x, y, c1.x, c1.y, c2.x, c2.y) <= 18) return item;
            if (Math.hypot(x - c1.x, y - c1.y) <= 20 || Math.hypot(x - c2.x, y - c2.y) <= 20) return item;
            if (item.type === 'ray') {
              const dx = c2.x - c1.x;
              const dy = c2.y - c1.y;
              if (dx !== 0) {
                const slope = dy / dx;
                const extY = c1.y + slope * (x - c1.x);
                const isForward = dx > 0 ? x >= c1.x - 10 : x <= c1.x + 10;
                if (isForward && Math.abs(y - extY) <= 14) return item;
              }
            }
          }
        } else if (item.type === 'fibonacci' && item.p2) {
          if (c1.x !== null && c1.y !== null && c2 && c2.x !== null && c2.y !== null) {
            if (distToSegment(x, y, c1.x, c1.y, c2.x, c2.y) <= 14) return item;
            if (Math.hypot(x - c1.x, y - c1.y) <= 18 || Math.hypot(x - c2.x, y - c2.y) <= 18) return item;

            const p1 = item.p1.price;
            const p2 = item.p2.price;
            const minX = Math.min(c1.x, c2.x);
            const maxX = Math.max(c1.x, c2.x);
            const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618];

            // Inside fibonacci bounding box
            if (x >= minX - 10 && x <= maxX + 10) {
              const yCoords: number[] = [];
              for (const r of fibRatios) {
                const yc = series.priceToCoordinate(p1 + (p2 - p1) * r);
                if (yc !== null) yCoords.push(yc as number);
              }
              if (yCoords.length > 0) {
                const minY = Math.min(...yCoords);
                const maxY = Math.max(...yCoords);
                if (y >= minY - 8 && y <= maxY + 8) return item;
              }
            }
          }
        } else if (item.type === 'fib_extension' && item.p2) {
          if (c1.x !== null && c1.y !== null && c2 && c2.x !== null && c2.y !== null) {
            // Hit on base trendline (sóng đẩy c1 -> c2) or anchor handles
            if (distToSegment(x, y, c1.x, c1.y, c2.x, c2.y) <= 16) return item;
            if (Math.hypot(x - c1.x, y - c1.y) <= 18 || Math.hypot(x - c2.x, y - c2.y) <= 18) return item;

            // Hit on retracement line (sóng hồi c2 -> c3) or anchor handle c3
            if (c3 && c3.x !== null && c3.y !== null) {
              if (distToSegment(x, y, c2.x, c2.y, c3.x, c3.y) <= 16) return item;
              if (Math.hypot(x - c3.x, y - c3.y) <= 18) return item;
            }

            const p1 = item.p1.price;
            const p2 = item.p2.price;
            const p3 = item.p3 ? item.p3.price : p2;
            const waveDelta = p2 - p1;
            const startX = c3 && c3.x !== null ? Math.min(c1.x, c2.x, c3.x) : Math.min(c1.x, c2.x);
            const endX = Math.max(c1.x, c2.x, c3 && c3.x !== null ? c3.x : 0) + 240;
            const extRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.0, 2.618];

            if (x >= startX - 10 && x <= endX + 10) {
              const yCoords: number[] = [];
              for (const r of extRatios) {
                const yc = series.priceToCoordinate(p3 + waveDelta * r);
                if (yc !== null) yCoords.push(yc as number);
              }
              if (yCoords.length > 0) {
                const minY = Math.min(...yCoords);
                const maxY = Math.max(...yCoords);
                if (y >= minY - 8 && y <= maxY + 8) return item;
              }
            }
          }
        } else if (item.type === 'rectangle' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const minX = Math.min(c1.x, c2.x);
            const maxX = Math.max(c1.x, c2.x);
            const minY = Math.min(c1.y, c2.y);
            const maxY = Math.max(c1.y, c2.y);
            if (x >= minX - 8 && x <= maxX + 8 && y >= minY - 8 && y <= maxY + 8) return item;
          }
        } else if (item.type === 'circle' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const radius = Math.hypot(c2.x - c1.x, c2.y - c1.y);
            const dToCenter = Math.hypot(x - c1.x, y - c1.y);
            if (Math.abs(dToCenter - radius) <= 14 || dToCenter <= 16) return item;
          }
        } else if (item.type === 'parallel_channel' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const dy = 40;
            if (distToSegment(x, y, c1.x, c1.y, c2.x, c2.y) <= 14) return item;
            if (distToSegment(x, y, c1.x, c1.y - dy, c2.x, c2.y - dy) <= 14) return item;
          }
        } else if (item.type === 'long_position' || item.type === 'short_position') {
          if (c1.x !== null && c1.y !== null && c2 && c2.x !== null && c2.y !== null) {
            const leftX = Math.min(c1.x, c2.x);
            const rightX = Math.max(c1.x, c2.x) + 60;
            if (x >= leftX - 10 && x <= rightX + 10 && Math.abs(y - c1.y) <= 50) return item;
          }
        } else {
          // Dot, Text, Rocket, Price Label, Callout
          if (c1.x !== null && c1.y !== null && Math.hypot(x - c1.x, y - c1.y) <= 24) return item;
        }
      }
      return null;
    },
    [drawings]
  );

  findHitDrawingRef.current = findHitDrawing;

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

    const toCoord = (p: { time: Time; price: number; logical?: number }, isDraft = false) => {
      if (isDraft && draftDrawing?.mouseCoord) {
        return { x: draftDrawing.mouseCoord.x, y: draftDrawing.mouseCoord.y };
      }
      return resolvePointCoordinate(chart, series, p, loadedCandlesRef.current);
    };

    // ── Render User Drawings (Respect Hide Drawings Toggle) ──
    if (!hideDrawings) {
      const allItems: DrawingItem[] = [...drawings];
      if (draftDrawing && draftDrawing.p2) {
        allItems.push(draftDrawing);
      }

      allItems.forEach((item) => {
        ctx.save();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width || 2;
        ctx.fillStyle = item.color;

        const isDraft = item === draftDrawing;
        const isFibExtStep3 = isDraft && item.type === 'fib_extension' && Boolean(draftDrawing?.p3);
        const c1 = toCoord(item.p1, false);
        const c2 = item.p2 ? toCoord(item.p2, isDraft && !isFibExtStep3) : null;
        const c3 = item.p3 ? toCoord(item.p3, isDraft && isFibExtStep3) : null;

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
        } else if (item.type === 'horizontal_ray') {
          if (c1.x !== null && c1.y !== null) {
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(w, c1.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(c1.x, c1.y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.setLineDash([]);
            ctx.fillStyle = item.color;
            ctx.fillRect(w - 72, c1.y - 10, 68, 20);
            ctx.fillStyle = '#09090b';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${item.p1.price.toFixed(2)}k`, w - 38, c1.y);
          }
        } else if (item.type === 'vertical') {
          if (c1.x !== null) {
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(c1.x, 0);
            ctx.lineTo(c1.x, h);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.fillStyle = item.color;
            ctx.fillRect(c1.x - 30, h - 20, 60, 18);
            ctx.fillStyle = '#09090b';
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(item.p1.time).slice(5), c1.x, h - 11);
          }
        } else if (item.type === 'trendline' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(c1.x, c1.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(c2.x, c2.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (item.type === 'ray' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const endX = dx >= 0 ? w : 0;
            const endY = dx !== 0 ? c1.y + (dy / dx) * (endX - c1.x) : (dy > 0 ? h : 0);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(c1.x, c1.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (item.type === 'parallel_channel' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const dyChannel = 28;
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.lineTo(c2.x, c2.y - dyChannel);
            ctx.lineTo(c1.x, c1.y - dyChannel);
            ctx.closePath();
            ctx.fillStyle = item.color + '20';
            ctx.fill();
            ctx.stroke();

            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y - dyChannel / 2);
            ctx.lineTo(c2.x, c2.y - dyChannel / 2);
            ctx.stroke();
          }
        } else if (item.type === 'rectangle' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const minX = Math.min(c1.x, c2.x);
            const minY = Math.min(c1.y, c2.y);
            const boxW = Math.abs(c2.x - c1.x);
            const boxH = Math.abs(c2.y - c1.y);

            ctx.fillStyle = item.color + '26'; // 15% opacity fill
            ctx.fillRect(minX, minY, boxW, boxH);
            ctx.strokeRect(minX, minY, boxW, boxH);
          }
        } else if (item.type === 'circle' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const radius = Math.hypot(c2.x - c1.x, c2.y - c1.y);
            ctx.beginPath();
            ctx.arc(c1.x, c1.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = item.color + '20';
            ctx.fill();
            ctx.stroke();
          }
        } else if (item.type === 'arrow_marker' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();

            const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
            const headlen = 10;
            ctx.beginPath();
            ctx.moveTo(c2.x, c2.y);
            ctx.lineTo(c2.x - headlen * Math.cos(angle - Math.PI / 6), c2.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(c2.x - headlen * Math.cos(angle + Math.PI / 6), c2.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();
          }
        } else if (item.type === 'fibonacci' && c2 && item.p2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const minX = Math.min(c1.x, c2.x);
            const maxX = Math.max(c1.x, c2.x);
            const renderWidth = Math.max(maxX - minX, 40);
            const p1 = item.p1.price;
            const p2 = isDraft && series && draftDrawing?.mouseCoord
              ? (series.coordinateToPrice(draftDrawing.mouseCoord.y) ?? item.p2.price)
              : item.p2.price;

            // 1. Diagonal dashed trendline connecting c1 and c2 (as in reference image)
            ctx.save();
            ctx.strokeStyle = 'rgba(212, 212, 216, 0.65)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();
            ctx.restore();

            // 2. Fibonacci Retracement Levels matching reference image
            const fibLevels = [
              { ratio: 0, color: '#a1a1aa', bg: 'rgba(239, 68, 68, 0.13)' },
              { ratio: 0.236, color: '#ef4444', bg: 'rgba(245, 158, 11, 0.13)' },
              { ratio: 0.382, color: '#f59e0b', bg: 'rgba(34, 197, 94, 0.13)' },
              { ratio: 0.5, color: '#22c55e', bg: 'rgba(6, 182, 212, 0.13)' },
              { ratio: 0.618, color: '#06b6d4', bg: 'rgba(14, 165, 233, 0.13)' },
              { ratio: 0.786, color: '#0ea5e9', bg: 'rgba(161, 161, 170, 0.13)' },
              { ratio: 1.0, color: '#a1a1aa', bg: 'rgba(59, 130, 246, 0.15)' },
              { ratio: 1.618, color: '#3b82f6', bg: 'rgba(244, 63, 94, 0.13)' },
              { ratio: 2.618, color: '#f43f5e', bg: 'transparent' },
            ];

            const levelCoords = fibLevels.map((lvl) => {
              const priceLvl = p1 + (p2 - p1) * lvl.ratio;
              const yCoord = series.priceToCoordinate(priceLvl);
              return { ...lvl, priceLvl, yCoord };
            });

            // 3. Colored background bands between adjacent levels
            ctx.save();
            for (let i = 0; i < levelCoords.length - 1; i++) {
              const curr = levelCoords[i];
              const next = levelCoords[i + 1];
              if (curr.yCoord !== null && next.yCoord !== null && curr.bg !== 'transparent') {
                const topY = Math.min(curr.yCoord, next.yCoord);
                const bandH = Math.abs(curr.yCoord - next.yCoord);
                ctx.fillStyle = curr.bg;
                ctx.fillRect(minX, topY, renderWidth, bandH);
              }
            }
            ctx.restore();

            // 4. Horizontal lines and left-aligned labels formatted as "0.236 (54,300)"
            levelCoords.forEach((lvl) => {
              if (lvl.yCoord !== null) {
                ctx.save();
                ctx.strokeStyle = lvl.color;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(minX, lvl.yCoord);
                ctx.lineTo(minX + renderWidth, lvl.yCoord);
                ctx.stroke();

                const val = lvl.priceLvl < 500 ? lvl.priceLvl * 1000 : lvl.priceLvl;
                const formattedPrice = Math.round(val).toLocaleString('en-US');
                const labelText = `${lvl.ratio} (${formattedPrice})`;

                ctx.fillStyle = lvl.color;
                ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(labelText, minX + 5, lvl.yCoord - 3);
                ctx.restore();
              }
            });
          }
        } else if (item.type === 'fib_extension' && c2 && item.p2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const p1 = item.p1.price;
            const p2 = isDraft && !isFibExtStep3 && series && draftDrawing?.mouseCoord
              ? (series.coordinateToPrice(draftDrawing.mouseCoord.y) ?? item.p2.price)
              : item.p2.price;
            const p3 = item.p3
              ? (isDraft && isFibExtStep3 && series && draftDrawing?.mouseCoord
                  ? (series.coordinateToPrice(draftDrawing.mouseCoord.y) ?? item.p3.price)
                  : item.p3.price)
              : p2;

            // 1. Kéo đường thẳng sóng cơ sở (Base Wave Trendline c1 -> c2)
            ctx.save();
            ctx.strokeStyle = item.color || '#06b6d4';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();

            // Mũi tên chỉ hướng sóng cơ sở tại c2
            const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
            const headlen = 11;
            ctx.beginPath();
            ctx.moveTo(c2.x, c2.y);
            ctx.lineTo(c2.x - headlen * Math.cos(angle - Math.PI / 6), c2.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(c2.x - headlen * Math.cos(angle + Math.PI / 6), c2.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = item.color || '#06b6d4';
            ctx.fill();

            // 2 điểm chốt tròn c1, c2
            [c1, c2].forEach((pt) => {
              if (pt.x !== null && pt.y !== null) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = item.color || '#06b6d4';
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            });
            ctx.restore();

            // 2. Nhịp hồi sóng (Retracement c2 -> c3) nếu đã có c3 hoặc đang ở bước 3
            if (c3 && c3.x !== null && c3.y !== null && (item.p3 || isFibExtStep3)) {
              ctx.save();
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
              ctx.lineWidth = 1.6;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(c2.x, c2.y);
              ctx.lineTo(c3.x, c3.y);
              ctx.stroke();

              // Điểm chốt tròn c3
              ctx.beginPath();
              ctx.arc(c3.x, c3.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.restore();
            }

            // 3. Các mức Fibo mở rộng (Chỉ vẽ khi đã có điểm 3 hoặc đang kéo điểm 3, hoặc drawing đã hoàn tất)
            const shouldRenderLevels = (Boolean(item.p3) && !isDraft) || isFibExtStep3;
            if (shouldRenderLevels && c3 && c3.x !== null) {
              const waveDelta = p2 - p1;
              const extLevels = [
                { ratio: 0, label: '0.0 (Nhịp hồi)', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.08)' },
                { ratio: 0.236, label: '0.236 (23.6%)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' },
                { ratio: 0.382, label: '0.382 (38.2%)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.09)' },
                { ratio: 0.5, label: '0.5 (50%)', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.09)' },
                { ratio: 0.618, label: '0.618 (61.8%)', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
                { ratio: 0.786, label: '0.786 (78.6%)', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.10)' },
                { ratio: 1.0, label: '1.0 (100% Sóng cơ sở)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
                { ratio: 1.272, label: '1.272 (127.2%)', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
                { ratio: 1.618, label: '1.618 (161.8% Mục tiêu chính)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' },
                { ratio: 2.0, label: '2.0 (200% Sóng đôi)', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
                { ratio: 2.618, label: '2.618 (261.8% Siêu mục tiêu)', color: '#f43f5e', bg: 'transparent' },
              ];

              const extStartX = Math.min(c2.x, c3.x);
              const extEndX = Math.max(extStartX + 260, w - 80);
              const extWidth = extEndX - extStartX;

              const levelCoords = extLevels.map((lvl) => {
                const priceLvl = p3 + waveDelta * lvl.ratio;
                const yCoord = series.priceToCoordinate(priceLvl);
                return { ...lvl, priceLvl, yCoord };
              });

              // Dải màu nền mờ cho Fibo mở rộng
              ctx.save();
              for (let i = 0; i < levelCoords.length - 1; i++) {
                const curr = levelCoords[i];
                const next = levelCoords[i + 1];
                if (curr.yCoord !== null && next.yCoord !== null && curr.bg !== 'transparent') {
                  const topY = Math.min(curr.yCoord, next.yCoord);
                  const bandH = Math.abs(curr.yCoord - next.yCoord);
                  ctx.fillStyle = curr.bg;
                  ctx.fillRect(extStartX, topY, extWidth, bandH);
                }
              }
              ctx.restore();

              // Các đường ngang và nhãn mục tiêu Fibo mở rộng
              levelCoords.forEach((lvl) => {
                if (lvl.yCoord !== null) {
                  ctx.save();
                  ctx.strokeStyle = lvl.color;
                  ctx.lineWidth = 1.2;
                  ctx.setLineDash([4, 3]);
                  ctx.beginPath();
                  ctx.moveTo(extStartX, lvl.yCoord);
                  ctx.lineTo(extEndX, lvl.yCoord);
                  ctx.stroke();

                  const val = lvl.priceLvl < 500 ? lvl.priceLvl * 1000 : lvl.priceLvl;
                  const formattedPrice = Math.round(val).toLocaleString('en-US');
                  const labelText = `${lvl.label}: ${formattedPrice}`;

                  ctx.fillStyle = lvl.color;
                  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                  ctx.textAlign = 'left';
                  ctx.textBaseline = 'bottom';
                  ctx.fillText(labelText, extStartX + 8, lvl.yCoord - 3);
                  ctx.restore();
                }
              });
            }
          }
        } else if (item.type === 'measure' && c2 && item.p2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const minX = Math.min(c1.x, c2.x);
            const minY = Math.min(c1.y, c2.y);
            const boxW = Math.abs(c2.x - c1.x);
            const boxH = Math.abs(c2.y - c1.y);

            const p2Price = isDraft && series && draftDrawing?.mouseCoord ? (series.coordinateToPrice(draftDrawing.mouseCoord.y) ?? item.p2.price) : item.p2.price;
            const deltaP = p2Price - item.p1.price;
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
        } else if (item.type === 'price_label') {
          if (c1.x !== null && c1.y !== null) {
            const labelText = `${item.p1.price.toFixed(2)}k`;
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            const tw = ctx.measureText(labelText).width;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c1.x + 8, c1.y - 10);
            ctx.lineTo(c1.x + 12 + tw, c1.y - 10);
            ctx.lineTo(c1.x + 12 + tw, c1.y + 10);
            ctx.lineTo(c1.x + 8, c1.y + 10);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#09090b';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, c1.x + 10, c1.y);
          }
        } else if (item.type === 'callout' && c2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.stroke();

            const calloutText = item.text || 'Ghi chú kỹ thuật';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            const tw = ctx.measureText(calloutText).width;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.fillRect(c2.x - tw / 2 - 8, c2.y - 12, tw + 16, 24);
            ctx.strokeRect(c2.x - tw / 2 - 8, c2.y - 12, tw + 16, 24);

            ctx.fillStyle = item.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(calloutText, c2.x, c2.y);
          }
        } else if ((item.type === 'long_position' || item.type === 'short_position') && c2 && item.p2) {
          if (c1.x !== null && c1.y !== null && c2.x !== null && c2.y !== null) {
            const entryPrice = item.p1.price;
            const targetPrice = isDraft && series && draftDrawing?.mouseCoord ? (series.coordinateToPrice(draftDrawing.mouseCoord.y) ?? item.p2.price) : item.p2.price;
            const isLong = item.type === 'long_position';
            const riskPrice = isLong ? entryPrice - Math.abs(targetPrice - entryPrice) * 0.5 : entryPrice + Math.abs(targetPrice - entryPrice) * 0.5;
            const riskY = series.priceToCoordinate(riskPrice);

            const leftX = Math.min(c1.x, c2.x);
            const rightX = Math.max(c1.x, c2.x) + 60;
            const boxW = Math.max(80, rightX - leftX);

            const pY = c2.y;
            const eY = c1.y;
            ctx.fillStyle = isLong ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';
            ctx.fillRect(leftX, Math.min(eY, pY), boxW, Math.abs(pY - eY));
            ctx.strokeStyle = isLong ? '#10b981' : '#f43f5e';
            ctx.strokeRect(leftX, Math.min(eY, pY), boxW, Math.abs(pY - eY));

            if (riskY !== null) {
              ctx.fillStyle = isLong ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)';
              ctx.fillRect(leftX, Math.min(eY, riskY), boxW, Math.abs(riskY - eY));
              ctx.strokeStyle = isLong ? '#f43f5e' : '#10b981';
              ctx.strokeRect(leftX, Math.min(eY, riskY), boxW, Math.abs(riskY - eY));
            }

            const profitDiff = Math.abs(targetPrice - entryPrice);
            const lossDiff = Math.abs(entryPrice - riskPrice);
            const rrRatio = lossDiff > 0 ? (profitDiff / lossDiff).toFixed(2) : '2.00';
            ctx.fillStyle = '#09090b';
            ctx.fillRect(leftX + boxW / 2 - 40, eY - 11, 80, 22);
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(leftX + boxW / 2 - 40, eY - 11, 80, 22);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`R:R = 1 : ${rrRatio}`, leftX + boxW / 2, eY);
          }
        } else if (item.type === 'rocket') {
          if (c1.x !== null && c1.y !== null) {
            ctx.font = '18px sans-serif';
            ctx.fillText('🚀', c1.x - 9, c1.y + 6);

            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.fillStyle = '#10b981';
            ctx.fillRect(c1.x + 14, c1.y - 9, 70, 18);
            ctx.fillStyle = '#09090b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Target ${item.p1.price.toFixed(2)}k`, c1.x + 49, c1.y);
          }
        }

        if (item.id === selectedDrawingId) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 10;

          if (c1.x !== null && c1.y !== null) {
            ctx.beginPath();
            ctx.arc(c1.x, c1.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          if (c2 && c2.x !== null && c2.y !== null) {
            ctx.beginPath();
            ctx.arc(c2.x, c2.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          if (c3 && c3.x !== null && c3.y !== null) {
            ctx.beginPath();
            ctx.arc(c3.x, c3.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          if (item.type === 'horizontal') {
            const y = series.priceToCoordinate(item.p1.price);
            if (y !== null) {
              [w * 0.25, w * 0.75].forEach((hx) => {
                ctx.beginPath();
                ctx.arc(hx, y, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              });
            }
          }
          ctx.restore();
        }

        ctx.restore();
      });
    }

    // ── Visual Magnet Snap Indicator (Glowing Blue Ring on Candlestick Point) ──
    if (isMagnetMode && hoverSnapPoint && activeTool !== 'cursor') {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hoverSnapPoint.x, hoverSnapPoint.y, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(hoverSnapPoint.x, hoverSnapPoint.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Small price pill
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(hoverSnapPoint.x + 9, hoverSnapPoint.y - 9, 58, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${hoverSnapPoint.price.toFixed(2)}k`, hoverSnapPoint.x + 38, hoverSnapPoint.y);
      ctx.restore();
    }

    // ── Render Trendline Pro Overlays (Automated S/R & Fibonacci Channels) ────
    if (showTrendlinePro && trendlineProData) {
      ctx.save();

      // 1. Kháng cự (Resistance line - Green/Lime #84cc16)
      const resY = series.priceToCoordinate(trendlineProData.resistance);
      const rC1 = toCoord(trendlineProData.resP1);
      const rC2 = toCoord(trendlineProData.resP2);

      // Local pivot segment between the 2 swing highs
      if (rC1.x !== null && rC1.y !== null && rC2.x !== null && rC2.y !== null) {
        ctx.strokeStyle = '#84cc1680';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(rC1.x, rC1.y);
        ctx.lineTo(rC2.x, rC2.y);
        ctx.stroke();

        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(rC1.x, rC1.y, 3, 0, Math.PI * 2);
        ctx.arc(rC2.x, rC2.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Horizontal resistance zone ray
      if (resY !== null) {
        const startX = rC1.x !== null ? Math.min(rC1.x, w * 0.4) : 0;
        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, resY);
        ctx.lineTo(w - 75, resY);
        ctx.stroke();

        ctx.setLineDash([]);
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

      // Local pivot segment between the 2 swing lows
      if (sC1.x !== null && sC1.y !== null && sC2.x !== null && sC2.y !== null) {
        ctx.strokeStyle = '#ef444480';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sC1.x, sC1.y);
        ctx.lineTo(sC2.x, sC2.y);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sC1.x, sC1.y, 3, 0, Math.PI * 2);
        ctx.arc(sC2.x, sC2.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Horizontal support zone ray
      if (supY !== null) {
        const startX = sC1.x !== null ? Math.min(sC1.x, w * 0.4) : 0;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, supY);
        ctx.lineTo(w - 75, supY);
        ctx.stroke();

        ctx.setLineDash([]);
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
  }, [drawings, draftDrawing, showTrendlinePro, trendlineProData, hideDrawings, isMagnetMode, hoverSnapPoint, activeTool, selectedDrawingId]);

  // Keep decoupled ref for chart and window callbacks
  redrawCanvasRef.current = redrawCanvas;

  // Adjust canvas size to match container without re-creating functions
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
    redrawCanvasRef.current();
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ── 1. Mount Lightweight Chart ONCE per lifecycle ────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

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
        scaleMargins: {
          top: 0.12,
          bottom: 0.14,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 9,
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
      visible: showMA20,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20SeriesRef.current = ma20Series;

    const ma50Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA50',
      visible: showMA50,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma50SeriesRef.current = ma50Series;

    const ma150Series = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA150',
      visible: showMA150,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma150SeriesRef.current = ma150Series;

    const ma200Series = chart.addSeries(LineSeries, {
      color: '#f43f5e',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'MA200',
      visible: showMA200,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma200SeriesRef.current = ma200Series;

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'BB Upper',
      visible: showBB,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
      title: 'BB Lower',
      visible: showBB,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(() => redrawCanvasRef.current());
    });
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(() => redrawCanvasRef.current());
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const candle = param.seriesData.get(candlestickSeries) as any;
      const vol = param.seriesData.get(volumeSeries) as any;
      const ma20 = ma20Series ? (param.seriesData.get(ma20Series) as any) : undefined;
      const ma50 = ma50Series ? (param.seriesData.get(ma50Series) as any) : undefined;
      const ma150 = ma150Series ? (param.seriesData.get(ma150Series) as any) : undefined;
      const ma200 = ma200Series ? (param.seriesData.get(ma200Series) as any) : undefined;
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
          ma20: ma20?.value,
          ma50: ma50?.value,
          ma150: ma150?.value,
          ma200: ma200?.value,
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

    const getHandleAt = (x: number, y: number, selId: string | null) => {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!chart || !series) return null;
      const candles = loadedCandlesRef.current;

      // Only check handles of currently selected drawing
      if (selId) {
        const item = drawingsRef.current.find((d) => d.id === selId);
        if (item) {
          const c1 = resolvePointCoordinate(chart, series, item.p1, candles);
          if (c1.x !== null && c1.y !== null && Math.hypot(x - c1.x, y - c1.y) <= 18) {
            return { item, part: 'p1' as const };
          }
          if (item.p2) {
            const c2 = resolvePointCoordinate(chart, series, item.p2, candles);
            if (c2.x !== null && c2.y !== null && Math.hypot(x - c2.x, y - c2.y) <= 18) {
              return { item, part: 'p2' as const };
            }
          }
          if (item.p3) {
            const c3 = resolvePointCoordinate(chart, series, item.p3, candles);
            if (c3.x !== null && c3.y !== null && Math.hypot(x - c3.x, y - c3.y) <= 18) {
              return { item, part: 'p3' as const };
            }
          }
        }
      }

      return null;
    };

    let downPt: { x: number; y: number } | null = null;
    const onContainerMouseDown = (e: MouseEvent) => {
      downPt = { x: e.clientX, y: e.clientY };

      if (lockDrawingsRef.current || (activeToolRef.current !== 'cursor' && activeToolRef.current !== 'arrow_pointer')) {
        return;
      }

      const canvas = canvasRef.current;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!canvas || !chart || !series) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 1. Check if user clicked an anchor handle of the selected drawing
      const handleHit = getHandleAt(clickX, clickY, selectedDrawingIdRef.current);
      if (handleHit) {
        e.stopPropagation();
        e.preventDefault();
        setSelectedDrawingId(handleHit.item.id);
        isDraggingRef.current = true;
        const dragItem = handleHit.item;

        const onWindowMouseMove = (moveEvent: MouseEvent) => {
          const moveX = moveEvent.clientX - rect.left;
          const moveY = moveEvent.clientY - rect.top;
          let curPrice: number | null = series.coordinateToPrice(moveY) as any;
          let curLogical: number | null = chart.timeScale().coordinateToLogical(moveX) as any;

          if (curPrice === null) {
            const topP = series.coordinateToPrice(10) as number | null;
            const botP = series.coordinateToPrice(rect.height - 30) as number | null;
            curPrice = moveY < 10 ? (topP ?? 0) : (botP ?? 0);
          }
          if (curLogical === null) {
            const leftL = (chart.timeScale().coordinateToLogical(0) ?? 0) as number;
            const rightL = (chart.timeScale().coordinateToLogical(rect.width) ?? 0) as number;
            curLogical = moveX < 0 ? leftL : rightL;
          }
          if (curPrice === null || curLogical === null) return;

          const candles = loadedCandlesRef.current;
          const curTime = logicalToTime(curLogical, candles);
          const safePrice = Math.round(curPrice * 100) / 100;
          const safeLogical = Math.round(curLogical * 100) / 100;

          setDrawings((prev) => {
            const next = prev.map((d) => {
              if (d.id !== dragItem.id) return d;
              if (handleHit.part === 'p1') {
                return {
                  ...d,
                  p1: {
                    ...d.p1,
                    price: safePrice,
                    time: curTime,
                    logical: safeLogical,
                  },
                };
              } else if (handleHit.part === 'p2' && d.p2) {
                return {
                  ...d,
                  p2: {
                    ...d.p2,
                    price: safePrice,
                    time: curTime,
                    logical: safeLogical,
                  },
                };
              } else if (handleHit.part === 'p3' && d.p3) {
                return {
                  ...d,
                  p3: {
                    ...d.p3,
                    price: safePrice,
                    time: curTime,
                    logical: safeLogical,
                  },
                };
              }
              return d;
            });
            drawingsRef.current = next;
            return next;
          });
        };

        const onWindowMouseUp = () => {
          isDraggingRef.current = false;
          window.removeEventListener('mousemove', onWindowMouseMove, { capture: true });
          window.removeEventListener('mouseup', onWindowMouseUp, { capture: true });
          saveDrawings(drawingsRef.current);
        };

        window.addEventListener('mousemove', onWindowMouseMove, { capture: true });
        window.addEventListener('mouseup', onWindowMouseUp, { capture: true });
        return;
      }

      // 2. Check if user clicked on any drawing body to move it
      const hit = findHitDrawingRef.current(clickX, clickY);
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        setSelectedDrawingId(hit.id);
        isDraggingRef.current = true;

        const candles = loadedCandlesRef.current;
        const startRawPrice = series.coordinateToPrice(clickY) ?? hit.p1.price;
        const startLogical = chart.timeScale().coordinateToLogical(clickX) ?? 0;

        // Compute current exact logical and price positions for p1, p2, and p3 at click time
        const c1 = resolvePointCoordinate(chart, series, hit.p1, candles);
        const p1BaseLogical = (c1.x !== null ? chart.timeScale().coordinateToLogical(c1.x) : null)
          ?? (hit.p1.logical !== undefined ? hit.p1.logical : startLogical);
        const p1BasePrice = hit.p1.price;

        let p2BaseLogical: number | null = null;
        let p2BasePrice: number | null = null;
        if (hit.p2) {
          const c2 = resolvePointCoordinate(chart, series, hit.p2, candles);
          p2BaseLogical = (c2.x !== null ? chart.timeScale().coordinateToLogical(c2.x) : null)
            ?? (hit.p2.logical !== undefined ? hit.p2.logical : (startLogical + 5));
          p2BasePrice = hit.p2.price;
        }

        let p3BaseLogical: number | null = null;
        let p3BasePrice: number | null = null;
        if (hit.p3) {
          const c3 = resolvePointCoordinate(chart, series, hit.p3, candles);
          p3BaseLogical = (c3.x !== null ? chart.timeScale().coordinateToLogical(c3.x) : null)
            ?? (hit.p3.logical !== undefined ? hit.p3.logical : (startLogical + 8));
          p3BasePrice = hit.p3.price;
        }

        const onWindowMouseMove = (moveEvent: MouseEvent) => {
          const moveX = moveEvent.clientX - rect.left;
          const moveY = moveEvent.clientY - rect.top;
          let curPrice: number | null = series.coordinateToPrice(moveY) as any;
          let curLogical: number | null = chart.timeScale().coordinateToLogical(moveX) as any;

          if (curPrice === null) {
            const topP = series.coordinateToPrice(10) as number | null;
            const botP = series.coordinateToPrice(rect.height - 30) as number | null;
            curPrice = moveY < 10 ? (topP ?? 0) : (botP ?? 0);
          }
          if (curLogical === null) {
            const leftL = (chart.timeScale().coordinateToLogical(0) ?? 0) as number;
            const rightL = (chart.timeScale().coordinateToLogical(rect.width) ?? 0) as number;
            curLogical = moveX < 0 ? leftL : rightL;
          }
          if (curPrice === null || curLogical === null) return;

          const dPrice = curPrice - startRawPrice;
          const dLogical = curLogical - startLogical;
          const currentCandles = loadedCandlesRef.current;

          const newP1Logical = Math.round((p1BaseLogical + dLogical) * 100) / 100;
          const newP1Price = Math.round((p1BasePrice + dPrice) * 100) / 100;
          const newP1Time = logicalToTime(newP1Logical, currentCandles);

          let newP2Logical: number | null = null;
          let newP2Price: number | null = null;
          let newP2Time: Time | null = null;
          if (p2BaseLogical !== null && p2BasePrice !== null) {
            newP2Logical = Math.round((p2BaseLogical + dLogical) * 100) / 100;
            newP2Price = Math.round((p2BasePrice + dPrice) * 100) / 100;
            newP2Time = logicalToTime(newP2Logical, currentCandles);
          }

          let newP3Logical: number | null = null;
          let newP3Price: number | null = null;
          let newP3Time: Time | null = null;
          if (p3BaseLogical !== null && p3BasePrice !== null) {
            newP3Logical = Math.round((p3BaseLogical + dLogical) * 100) / 100;
            newP3Price = Math.round((p3BasePrice + dPrice) * 100) / 100;
            newP3Time = logicalToTime(newP3Logical, currentCandles);
          }

          setDrawings((prev) => {
            const next = prev.map((d) => {
              if (d.id !== hit.id) return d;
              const updated: DrawingItem = {
                ...d,
                p1: { ...d.p1, price: newP1Price, time: newP1Time, logical: newP1Logical },
              };
              if (d.p2 && newP2Logical !== null && newP2Price !== null && newP2Time !== null) {
                updated.p2 = { ...d.p2, price: newP2Price, time: newP2Time, logical: newP2Logical };
              }
              if (d.p3 && newP3Logical !== null && newP3Price !== null && newP3Time !== null) {
                updated.p3 = { ...d.p3, price: newP3Price, time: newP3Time, logical: newP3Logical };
              }
              return updated;
            });
            drawingsRef.current = next;
            return next;
          });
        };

        const onWindowMouseUp = () => {
          isDraggingRef.current = false;
          window.removeEventListener('mousemove', onWindowMouseMove, { capture: true });
          window.removeEventListener('mouseup', onWindowMouseUp, { capture: true });
          saveDrawings(drawingsRef.current);
        };

        window.addEventListener('mousemove', onWindowMouseMove, { capture: true });
        window.addEventListener('mouseup', onWindowMouseUp, { capture: true });
        return;
      }
    };

    const onContainerMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (lockDrawingsRef.current || (activeToolRef.current !== 'cursor' && activeToolRef.current !== 'arrow_pointer' && activeToolRef.current !== 'dot')) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const handleHit = getHandleAt(mx, my, selectedDrawingIdRef.current);
      if (handleHit) {
        container.style.cursor = 'grab';
        container.querySelectorAll('canvas').forEach((c) => (c.style.cursor = 'grab'));
        return;
      }
      const hit = findHitDrawingRef.current(mx, my);
      if (hit) {
        container.style.cursor = 'move';
        container.querySelectorAll('canvas').forEach((c) => (c.style.cursor = 'move'));
        return;
      }
      const defaultCur = activeToolRef.current === 'arrow_pointer' ? 'default' : 'crosshair';
      container.style.cursor = defaultCur;
      container.querySelectorAll('canvas').forEach((c) => (c.style.cursor = defaultCur));
    };

    const onContainerMouseLeave = () => {
      if (chartContainerRef.current) {
        const defaultCur = activeToolRef.current === 'arrow_pointer' ? 'default' : 'crosshair';
        chartContainerRef.current.style.cursor = defaultCur;
        chartContainerRef.current.querySelectorAll('canvas').forEach((c) => (c.style.cursor = defaultCur));
      }
    };

    const onContainerMouseUp = (e: MouseEvent) => {
      if (!downPt) return;
      const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
      downPt = null;
      if (dist > 6) return; // Ignore drag / pan

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check handle first so clicking a handle does not deselect
      const handleHit = getHandleAt(clickX, clickY, selectedDrawingIdRef.current);
      if (handleHit) {
        setSelectedDrawingId(handleHit.item.id);
        return;
      }

      const hit = findHitDrawingRef.current(clickX, clickY);
      if (hit) {
        setSelectedDrawingId(hit.id);
      } else {
        setSelectedDrawingId(null);
      }
    };

    container.addEventListener('mousedown', onContainerMouseDown, { capture: true });
    container.addEventListener('mousemove', onContainerMouseMove);
    container.addEventListener('mouseleave', onContainerMouseLeave);
    container.addEventListener('mouseup', onContainerMouseUp, { capture: true });

    return () => {
      container.removeEventListener('mousedown', onContainerMouseDown, { capture: true });
      container.removeEventListener('mousemove', onContainerMouseMove);
      container.removeEventListener('mouseleave', onContainerMouseLeave);
      container.removeEventListener('mouseup', onContainerMouseUp, { capture: true });
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma50SeriesRef.current = null;
      ma150SeriesRef.current = null;
      ma200SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
    };
  }, [updateCanvasSize]);

  // ── 2. Toggle Indicators instantly without re-fetching data ──────────────
  useEffect(() => {
    ma20SeriesRef.current?.applyOptions({ visible: showMA20 });
  }, [showMA20]);

  useEffect(() => {
    ma50SeriesRef.current?.applyOptions({ visible: showMA50 });
  }, [showMA50]);

  useEffect(() => {
    ma150SeriesRef.current?.applyOptions({ visible: showMA150 });
  }, [showMA150]);

  useEffect(() => {
    ma200SeriesRef.current?.applyOptions({ visible: showMA200 });
  }, [showMA200]);

  useEffect(() => {
    bbUpperSeriesRef.current?.applyOptions({ visible: showBB });
    bbLowerSeriesRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // ── 3. Fetch DNSE History ONLY when symbol or resolution changes ──────────
  useEffect(() => {
    const chart = chartRef.current;
    const candlestickSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const ma20Series = ma20SeriesRef.current;
    const ma50Series = ma50SeriesRef.current;
    const ma150Series = ma150SeriesRef.current;
    const ma200Series = ma200SeriesRef.current;
    const bbUpperSeries = bbUpperSeriesRef.current;
    const bbLowerSeries = bbLowerSeriesRef.current;

    if (!chart || !candlestickSeries || !volumeSeries) return;

    const isDaily = resolution === '1D' || resolution === '1W' || resolution === '1M' || resolution === '3M' || resolution === '6M';
    chart.applyOptions({
      timeScale: {
        timeVisible: !isDaily,
      },
    });

    const cacheKey = `${selectedSymbol}_${resolution}`;
    const cached = candleCacheRef.current.get(cacheKey);

    if (cached) {
      // Instant render from memory (0ms lag, no flashing!)
      candlestickSeries.setData(cached.candles);
      volumeSeries.setData(cached.volumes);
      ma20Series?.setData(cached.ma20);
      ma50Series?.setData(cached.ma50);
      ma150Series?.setData(cached.ma150);
      ma200Series?.setData(cached.ma200);
      bbUpperSeries?.setData(cached.bbUpper);
      bbLowerSeries?.setData(cached.bbLower);
      loadedCandlesRef.current = cached.candles;
      loadedVolumesRef.current = cached.volumes;
      setDataVersion((v) => v + 1);
      setTrendlineProData(cached.proData);
      setLatestMA({
        ma20: cached.ma20.length > 0 ? cached.ma20[cached.ma20.length - 1]?.value : undefined,
        ma50: cached.ma50.length > 0 ? cached.ma50[cached.ma50.length - 1]?.value : undefined,
        ma150: cached.ma150.length > 0 ? cached.ma150[cached.ma150.length - 1]?.value : undefined,
        ma200: cached.ma200.length > 0 ? cached.ma200[cached.ma200.length - 1]?.value : undefined,
      });

      if (cached.candles.length > 150) {
        chart.timeScale().setVisibleLogicalRange({
          from: cached.candles.length - 140,
          to: cached.candles.length + 5,
        });
      } else {
        chart.timeScale().fitContent();
      }

      if (cached.candles.length > 0) {
        const last = cached.candles[cached.candles.length - 1];
        lastCandleRef.current = {
          time: last.time,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        };
      }
      requestAnimationFrame(() => redrawCanvasRef.current());
      return;
    }

    let isCancelled = false;
    let daysToFetch = 0;
    if (resolution === '1m') daysToFetch = 2;
    else if (resolution === '5m') daysToFetch = 5;
    else if (resolution === '15m') daysToFetch = 14;
    else if (resolution === '1h') daysToFetch = 60;
    else if (
      resolution === '1D' ||
      resolution === '1W' ||
      resolution === '1M' ||
      resolution === '3M' ||
      resolution === '6M'
    )
      daysToFetch = 0;

    setIsLoading(true);
    fetch(`/api/market/history?symbol=${selectedSymbol}&resolution=${resolution}&days=${daysToFetch}`)
      .then((res) => res.json())
      .then((resData) => {
        if (isCancelled) return;
        setIsLoading(false);
        if (!resData.success || !resData.data || resData.data.length === 0) return;

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
        loadedVolumesRef.current = uniqueVolumes;
        setDataVersion((v) => v + 1);
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

        // Cache the processed dataset
        candleCacheRef.current.set(cacheKey, {
          candles: uniqueCandles,
          volumes: uniqueVolumes,
          ma20: realMa20,
          ma50: realMa50,
          ma150: realMa150,
          ma200: realMa200,
          bbUpper: bbUpperData,
          bbLower: bbLowerData,
          proData,
        });

        if (uniqueCandles.length > 0) {
          candlestickSeries.setData(uniqueCandles);
          volumeSeries.setData(uniqueVolumes);
          ma20Series?.setData(realMa20);
          ma50Series?.setData(realMa50);
          ma150Series?.setData(realMa150);
          ma200Series?.setData(realMa200);
          bbUpperSeries?.setData(bbUpperData);
          bbLowerSeries?.setData(bbLowerData);
          setLatestMA({
            ma20: realMa20.length > 0 ? realMa20[realMa20.length - 1]?.value : undefined,
            ma50: realMa50.length > 0 ? realMa50[realMa50.length - 1]?.value : undefined,
            ma150: realMa150.length > 0 ? realMa150[realMa150.length - 1]?.value : undefined,
            ma200: realMa200.length > 0 ? realMa200[realMa200.length - 1]?.value : undefined,
          });

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

          const prevCandle = uniqueCandles.length > 1 ? uniqueCandles[uniqueCandles.length - 2] : last;
          const realCloseVnd = Math.round(last.close * 1000);
          const realPrevVnd = Math.round(prevCandle.close * 1000);
          const currentStoreTick = useMarketStore.getState().ticks[selectedSymbol];

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

          requestAnimationFrame(() => redrawCanvasRef.current());
        }
      })
      .catch(() => {
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [resolution, selectedSymbol]);

  // ── 4. 60fps Real-Time WebSocket Tick Update (Smooth & No Re-fetch) ────────
  useEffect(() => {
    if (!currentTick?.price || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const livePriceK = Math.round((currentTick.price / 1000) * 100) / 100;
    const tickVol = currentTick.volume || 10000;

    if (lastCandleRef.current) {
      const currentClose = lastCandleRef.current.close;
      if (currentClose > 0 && Math.abs(livePriceK - currentClose) / currentClose > 0.25) {
        return;
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

      requestAnimationFrame(() => redrawCanvasRef.current());
    }
  }, [currentTick]);

  // ── 5. Sub-Chart Mount and Sync (RSI, MACD, MFI, OBV) ───────────────────
  useEffect(() => {
    if (activeSubIndicator === 'none') {
      if (subChartRef.current) {
        subChartRef.current.remove();
        subChartRef.current = null;
      }
      return;
    }

    const container = subChartContainerRef.current;
    if (!container) return;

    if (subChartRef.current) {
      subChartRef.current.remove();
      subChartRef.current = null;
    }

    const candles = loadedCandlesRef.current;
    const volumes = loadedVolumesRef.current;
    if (!candles || candles.length === 0) return;

    const subChart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 116,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
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
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignLabels: true,
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        visible: false,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
    });

    subChartRef.current = subChart;

    if (activeSubIndicator === 'rsi') {
      const rsiData = calculateRSI(candles, 14);
      if (rsiData.length > 0) {
        const obSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(244, 63, 94, 0.35)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const midSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.15)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const osSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(16, 185, 129, 0.35)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const rsiSeries = subChart.addSeries(LineSeries, {
          color: '#a855f7',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
        });

        obSeries.setData(rsiData.map((d) => ({ time: d.time, value: 70 })));
        midSeries.setData(rsiData.map((d) => ({ time: d.time, value: 50 })));
        osSeries.setData(rsiData.map((d) => ({ time: d.time, value: 30 })));
        rsiSeries.setData(rsiData);

        const lastVal = rsiData[rsiData.length - 1]?.value;
        setSubIndicatorValues({ rsi: lastVal });

        subChart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.seriesData) return;
          const val = param.seriesData.get(rsiSeries) as LineData<Time> | undefined;
          if (val && typeof val.value === 'number') {
            setSubIndicatorValues({ rsi: val.value });
          }
        });
      }
    } else if (activeSubIndicator === 'macd') {
      const macdRes = calculateMACD(candles, 12, 26, 9);
      if (macdRes.macd.length > 0) {
        const histSeries = subChart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
          priceScaleId: 'right',
        });
        const macdLineSeries = subChart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        const signalLineSeries = subChart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        });
        const zeroSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.15)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        histSeries.setData(macdRes.hist);
        macdLineSeries.setData(macdRes.macd);
        signalLineSeries.setData(macdRes.signal);
        zeroSeries.setData(macdRes.macd.map((d: LineData<Time>) => ({ time: d.time, value: 0 })));

        const lastMacd = macdRes.macd[macdRes.macd.length - 1]?.value;
        const lastSignal = macdRes.signal[macdRes.signal.length - 1]?.value;
        const lastHist = macdRes.hist[macdRes.hist.length - 1]?.value;
        setSubIndicatorValues({ macd: lastMacd, signal: lastSignal, hist: lastHist });

        subChart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.seriesData) return;
          const mVal = param.seriesData.get(macdLineSeries) as LineData<Time> | undefined;
          const sVal = param.seriesData.get(signalLineSeries) as LineData<Time> | undefined;
          const hVal = param.seriesData.get(histSeries) as HistogramData<Time> | undefined;
          if (mVal || sVal || hVal) {
            setSubIndicatorValues({
              macd: mVal?.value,
              signal: sVal?.value,
              hist: hVal?.value,
            });
          }
        });
      }
    } else if (activeSubIndicator === 'mfi') {
      const mfiData = calculateMFI(candles, volumes, 14);
      if (mfiData.length > 0) {
        const obSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(244, 63, 94, 0.35)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const midSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.15)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const osSeries = subChart.addSeries(LineSeries, {
          color: 'rgba(16, 185, 129, 0.35)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const mfiSeries = subChart.addSeries(LineSeries, {
          color: '#10b981',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
        });

        obSeries.setData(mfiData.map((d) => ({ time: d.time, value: 80 })));
        midSeries.setData(mfiData.map((d) => ({ time: d.time, value: 50 })));
        osSeries.setData(mfiData.map((d) => ({ time: d.time, value: 20 })));
        mfiSeries.setData(mfiData);

        const lastMfi = mfiData[mfiData.length - 1]?.value;
        setSubIndicatorValues({ mfi: lastMfi });

        subChart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.seriesData) return;
          const val = param.seriesData.get(mfiSeries) as LineData<Time> | undefined;
          if (val && typeof val.value === 'number') {
            setSubIndicatorValues({ mfi: val.value });
          }
        });
      }
    } else if (activeSubIndicator === 'obv') {
      const obvData = calculateOBV(candles, volumes);
      if (obvData.length > 0) {
        const obvSeries = subChart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (v: number) => {
              if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
              if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
              return v.toLocaleString();
            },
          },
        });

        const obvMaData: LineData<Time>[] = [];
        for (let i = 0; i < obvData.length; i++) {
          if (i >= 19) {
            const slice = obvData.slice(i - 19, i + 1);
            const sum = slice.reduce((acc, curr) => acc + curr.value, 0);
            obvMaData.push({ time: obvData[i].time, value: Math.round(sum / 20) });
          }
        }
        const obvMaSeries = subChart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        obvSeries.setData(obvData);
        obvMaSeries.setData(obvMaData);

        const lastObv = obvData[obvData.length - 1]?.value;
        setSubIndicatorValues({ obv: lastObv });

        subChart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.seriesData) return;
          const val = param.seriesData.get(obvSeries) as LineData<Time> | undefined;
          if (val && typeof val.value === 'number') {
            setSubIndicatorValues({ obv: val.value });
          }
        });
      }
    }

    // Bidirectional timeScale synchronization between main chart and subChart
    const mainChart = chartRef.current;
    let isSyncing = false;

    if (mainChart) {
      const initialRange = mainChart.timeScale().getVisibleLogicalRange();
      if (initialRange) {
        try {
          subChart.timeScale().setVisibleLogicalRange(initialRange);
        } catch {}
      }

      const handleMainRangeChange = (range: any) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        try {
          subChart.timeScale().setVisibleLogicalRange(range);
        } catch {}
        isSyncing = false;
      };

      const handleSubRangeChange = (range: any) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        try {
          mainChart.timeScale().setVisibleLogicalRange(range);
        } catch {}
        isSyncing = false;
      };

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(handleMainRangeChange);
      subChart.timeScale().subscribeVisibleLogicalRangeChange(handleSubRangeChange);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        subChart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      subChart.remove();
      subChartRef.current = null;
    };
  }, [activeSubIndicator, dataVersion, selectedSymbol, resolution]);

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
  // Interactive Drawing Handlers (TradingView Magnet & Multi-Tool Engine)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'cursor' || lockDrawings) return;
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'arrow_pointer') {
      const hit = findHitDrawing(x, y);
      if (hit) {
        setSelectedDrawingId(hit.id);
      } else {
        setSelectedDrawingId(null);
      }
      return;
    }

    // Eraser Tool: Click on or near drawing to remove it
    if (activeTool === 'eraser') {
      let foundIdx = -1;
      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        const c1X = chart.timeScale().timeToCoordinate(d.p1.time);
        const c1Y = series.priceToCoordinate(d.p1.price);
        if (c1X !== null && c1Y !== null && Math.hypot(c1X - x, c1Y - y) < 28) {
          foundIdx = i;
          break;
        }
        if (d.p2) {
          const c2X = chart.timeScale().timeToCoordinate(d.p2.time);
          const c2Y = series.priceToCoordinate(d.p2.price);
          if (c2X !== null && c2Y !== null && Math.hypot(c2X - x, c2Y - y) < 28) {
            foundIdx = i;
            break;
          }
        }
      }
      if (foundIdx !== -1) {
        const removed = drawings[foundIdx];
        setUndoStack((prev) => [...prev, [removed]]);
        setRedoStack([]);
        const updated = drawings.filter((_, idx) => idx !== foundIdx);
        setDrawings(updated);
        saveDrawings(updated);
      }
      return;
    }

    const timeScale = chart.timeScale();
    const logicalIndex = timeScale.coordinateToLogical(x);
    let rawTime = timeScale.coordinateToTime(x);
    let rawPrice = series.coordinateToPrice(y) as number | null;

    if (rawPrice === null) {
      const topP = series.coordinateToPrice(10) as number | null;
      const botP = series.coordinateToPrice(canvas.height / (window.devicePixelRatio || 1) - 30) as number | null;
      rawPrice = y < 10 ? (topP ?? 0) : (botP ?? 0);
    }

    const candles = loadedCandlesRef.current;
    if (!rawTime && logicalIndex !== null && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      if (logicalIndex >= candles.length) {
        const diffBars = Math.round(logicalIndex) - (candles.length - 1);
        const lastDate = new Date(lastCandle.time as string);
        lastDate.setDate(lastDate.getDate() + diffBars);
        rawTime = lastDate.toISOString().split('T')[0] as Time;
      } else {
        const clampedIdx = Math.max(0, Math.min(candles.length - 1, Math.round(logicalIndex)));
        rawTime = candles[clampedIdx].time;
      }
    }

    if (rawPrice === null) return;

    // Smart Magnet Snapping
    const snapped = snapToCandle(rawTime, rawPrice, x, y);
    const point = {
      time: snapped.time || rawTime || (candles.length > 0 ? candles[candles.length - 1].time : ('' as Time)),
      price: snapped.price,
      logical: logicalIndex ?? undefined,
    };

    // 1-Click Tools
    if (
      activeTool === 'horizontal' ||
      activeTool === 'horizontal_ray' ||
      activeTool === 'vertical' ||
      activeTool === 'price_label' ||
      activeTool === 'rocket'
    ) {
      setUndoStack((prev) => [...prev, drawings]);
      setRedoStack([]);
      const newDrawing: DrawingItem = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: activeTool,
        symbol: selectedSymbol,
        color: activeColor,
        width: activeWidth,
        p1: point,
      };
      const updated = [...drawings, newDrawing];
      setDrawings(updated);
      saveDrawings(updated);
      setSelectedDrawingId(newDrawing.id);
      if (!stayInDrawingMode) {
        setActiveTool('arrow_pointer');
      }
      return;
    }

    // Text Annotation Tool
    if (activeTool === 'text') {
      const note = window.prompt('Nhập ghi chú kỹ thuật:', 'Vùng cản / Hỗ trợ quan trọng');
      if (note && note.trim()) {
        setUndoStack((prev) => [...prev, drawings]);
        setRedoStack([]);
        const newDrawing: DrawingItem = {
          id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'text',
          symbol: selectedSymbol,
          color: activeColor,
          width: activeWidth,
          p1: point,
          text: note.trim(),
        };
        const updated = [...drawings, newDrawing];
        setDrawings(updated);
        saveDrawings(updated);
        setSelectedDrawingId(newDrawing.id);
      }
      if (!stayInDrawingMode) {
        setActiveTool('arrow_pointer');
      }
      return;
    }

    // 2-Click Tools (Trendline, Fib, Channels, Shapes, R:R Measure) & 3-Click Fib Extension
    if (!draftDrawing) {
      setDraftDrawing({
        id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: activeTool,
        symbol: selectedSymbol,
        color: activeColor,
        width: activeWidth,
        p1: point,
        p2: point,
        mouseCoord: { x, y },
        text: activeTool === 'callout' ? 'Ghi chú kỹ thuật' : undefined,
      });
    } else if (draftDrawing.type === 'fib_extension' && !draftDrawing.p3) {
      // Bước 2: Chốt sóng đẩy P2, chuyển sang chọn điểm nhịp hồi P3
      setDraftDrawing({
        ...draftDrawing,
        p2: point,
        p3: point,
        mouseCoord: { x, y },
      });
    } else {
      // Bước cuối: Hoàn tất vẽ nét
      setUndoStack((prev) => [...prev, drawings]);
      setRedoStack([]);
      const finalDrawing: DrawingItem = {
        ...draftDrawing,
        ...(draftDrawing.type === 'fib_extension' && draftDrawing.p3 ? { p3: point } : { p2: point }),
        mouseCoord: undefined,
      };
      const updated = [...drawings, finalDrawing];
      setDrawings(updated);
      saveDrawings(updated);
      setDraftDrawing(null);
      setSelectedDrawingId(finalDrawing.id);
      if (!stayInDrawingMode) {
        setActiveTool('arrow_pointer');
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !chart || !series) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeScale = chart.timeScale();
    const logicalIndex = timeScale.coordinateToLogical(x);
    let rawTime = timeScale.coordinateToTime(x);
    let rawPrice = series.coordinateToPrice(y) as number | null;

    if (rawPrice === null) {
      const topP = series.coordinateToPrice(10) as number | null;
      const botP = series.coordinateToPrice(canvas.height / (window.devicePixelRatio || 1) - 30) as number | null;
      rawPrice = y < 10 ? (topP ?? 0) : (botP ?? 0);
    }

    const candles = loadedCandlesRef.current;
    if (!rawTime && logicalIndex !== null && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      if (logicalIndex >= candles.length) {
        const diffBars = Math.round(logicalIndex) - (candles.length - 1);
        const lastDate = new Date(lastCandle.time as string);
        lastDate.setDate(lastDate.getDate() + diffBars);
        rawTime = lastDate.toISOString().split('T')[0] as Time;
      } else {
        const clampedIdx = Math.max(0, Math.min(candles.length - 1, Math.round(logicalIndex)));
        rawTime = candles[clampedIdx].time;
      }
    }

    // Live magnet snap point feedback
    if (isMagnetMode && activeTool !== 'cursor' && rawPrice !== null) {
      const snapped = snapToCandle(rawTime, rawPrice, x, y);
      if (snapped.isSnapped) {
        const snapX = snapped.time ? chart.timeScale().timeToCoordinate(snapped.time) : x;
        const snapY = series.priceToCoordinate(snapped.price);
        if (snapX !== null && snapY !== null) {
          setHoverSnapPoint({ x: snapX, y: snapY, price: snapped.price });
        }
      } else {
        setHoverSnapPoint(null);
      }
    } else if (hoverSnapPoint) {
      setHoverSnapPoint(null);
    }

    // Update draft drawing line preview
    if (!draftDrawing) return;

    const snapped = isMagnetMode && rawPrice !== null
      ? snapToCandle(rawTime, rawPrice, x, y)
      : { time: rawTime, price: rawPrice !== null ? Math.round(rawPrice * 100) / 100 : draftDrawing.p1.price, isSnapped: false };

    setDraftDrawing((prev) => {
      if (!prev) return null;
      if (prev.type === 'fib_extension' && prev.p3) {
        // Đang ở bước 3: p1 và p2 đã chốt cố định, chuột đang kéo điểm hồi p3
        return {
          ...prev,
          p3: {
            time: snapped.time || rawTime || (prev.p2 ? prev.p2.time : prev.p1.time),
            price: snapped.price,
            logical: logicalIndex ?? undefined,
          },
          mouseCoord: { x, y },
        };
      }
      return {
        ...prev,
        p2: {
          time: snapped.time || rawTime || prev.p1.time,
          price: snapped.price,
          logical: logicalIndex ?? undefined,
        },
        mouseCoord: { x, y },
      };
    });
  };

  const handleUndo = () => {
    if (drawings.length === 0) return;
    const last = drawings[drawings.length - 1];
    setRedoStack((prev) => [...prev, [last]]);
    const updated = drawings.slice(0, drawings.length - 1);
    setDrawings(updated);
    saveDrawings(updated);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, drawings]);
    const updated = [...drawings, ...restored];
    setDrawings(updated);
    saveDrawings(updated);
  };

  const handleCloneLast = () => {
    if (drawings.length === 0) return;
    const last = drawings[drawings.length - 1];
    const cloned: DrawingItem = {
      ...last,
      id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      p1: { ...last.p1, price: Math.round(last.p1.price * 1.01 * 100) / 100 },
      p2: last.p2 ? { ...last.p2, price: Math.round(last.p2.price * 1.01 * 100) / 100 } : undefined,
    };
    setUndoStack((prev) => [...prev, drawings]);
    setRedoStack([]);
    const updated = [...drawings, cloned];
    setDrawings(updated);
    saveDrawings(updated);
  };

  const handleClearAll = () => {
    if (drawings.length === 0) return;
    setUndoStack((prev) => [...prev, drawings]);
    setRedoStack([]);
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

  const activeMA20 = hoveredData?.ma20 !== undefined ? hoveredData.ma20 : latestMA.ma20;
  const activeMA50 = hoveredData?.ma50 !== undefined ? hoveredData.ma50 : latestMA.ma50;
  const activeMA150 = hoveredData?.ma150 !== undefined ? hoveredData.ma150 : latestMA.ma150;
  const activeMA200 = hoveredData?.ma200 !== undefined ? hoveredData.ma200 : latestMA.ma200;

  return (
    <div
      ref={fullWrapperRef}
      className={`border border-zinc-800/80 flex flex-col relative select-none transition-all duration-200 ${
        isExpanded
          ? 'fixed inset-0 z-[99999] w-screen h-screen rounded-none p-2 sm:p-3 shadow-2xl !bg-zinc-950'
          : 'bg-zinc-950 w-full h-[550px] lg:h-[580px] rounded-2xl shadow-xl overflow-hidden'
      }`}
    >
      {/* ── TradingView-Style Single-Row Controls Bar (Zero Scroll / Always 1-Screen) ────────── */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/80 bg-[#131722] text-zinc-300 text-xs gap-1.5 z-30 overflow-hidden whitespace-nowrap select-none">
        {/* Left: Ticker & Timeframe & Indicators */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
          {/* Symbol Badge */}
          <div className="flex items-center font-sans shrink-0">
            <span
              className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border shadow-sm cursor-default ${priceColor.badgeBgClass}`}
              title={`${stockInfo.name} (${stockInfo.exchange})`}
            >
              {selectedSymbol}
            </span>
          </div>

          <div className="w-px h-3.5 bg-zinc-800/80 shrink-0 mx-0.5" />

          {/* Timeframe Resolution buttons (Ultra Compact) */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shrink-0">
            {RESOLUTIONS.map((res) => (
              <button
                key={res.id}
                onClick={() => setResolution(res.id)}
                className={`px-1.5 py-0.5 text-[10.5px] font-mono font-medium rounded whitespace-nowrap transition-all ${
                  resolution === res.id
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>

          <div className="w-px h-3.5 bg-zinc-800/80 shrink-0 mx-0.5" />

          {/* Indicators Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowIndicatorsModal(!showIndicatorsModal)}
              title="Danh mục các chỉ báo kỹ thuật (Indicators)"
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold border rounded-lg whitespace-nowrap transition-all ${
                activeSubIndicator !== 'none'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200'
              }`}
            >
              <FxIcon size={13} className={activeSubIndicator !== 'none' ? 'text-emerald-400 shrink-0' : 'text-zinc-400 shrink-0'} />
              <span>Chỉ báo</span>
              {activeSubIndicator !== 'none' && (
                <span className="text-[9px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                  {activeSubIndicator}
                </span>
              )}
            </button>

            {/* Indicators Popover */}
            {showIndicatorsModal && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowIndicatorsModal(false)}
                />
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-64 bg-zinc-900/95 border border-zinc-800 rounded-xl p-2.5 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in max-h-[85vh] overflow-y-auto">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 px-1 font-bold">1. Xu hướng & Nền giá</div>
                  <div className="flex flex-col gap-1 mb-2">
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
                        <ChartBar size={13} className="text-zinc-400" />
                        Khối lượng (Volume)
                      </span>
                      <span className={`text-[10px] ${showVolume ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{showVolume ? 'BẬT' : 'TẮT'}</span>
                    </button>
                  </div>

                  <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400 mb-1.5 px-1 pt-2 border-t border-zinc-800/80 font-bold">2. Động lượng & Dao động</div>
                  <div className="flex flex-col gap-1 mb-2">
                    <button
                      onClick={() => setActiveSubIndicator(activeSubIndicator === 'rsi' ? 'none' : 'rsi')}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        RSI (14) - Sức mạnh tương đối
                      </span>
                      <span className={`text-[10px] ${activeSubIndicator === 'rsi' ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {activeSubIndicator === 'rsi' ? 'BẬT' : 'TẮT'}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveSubIndicator(activeSubIndicator === 'macd' ? 'none' : 'macd')}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        MACD (12, 26, 9)
                      </span>
                      <span className={`text-[10px] ${activeSubIndicator === 'macd' ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {activeSubIndicator === 'macd' ? 'BẬT' : 'TẮT'}
                      </span>
                    </button>
                  </div>

                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 mb-1.5 px-1 pt-2 border-t border-zinc-800/80 font-bold">3. Dòng tiền thông minh</div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSubIndicator(activeSubIndicator === 'mfi' ? 'none' : 'mfi')}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        MFI (14) - Chỉ số Dòng tiền
                      </span>
                      <span className={`text-[10px] ${activeSubIndicator === 'mfi' ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {activeSubIndicator === 'mfi' ? 'BẬT' : 'TẮT'}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveSubIndicator(activeSubIndicator === 'obv' ? 'none' : 'obv')}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-200 hover:bg-zinc-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        OBV - Dòng tiền cá mập gom/xả
                      </span>
                      <span className={`text-[10px] ${activeSubIndicator === 'obv' ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {activeSubIndicator === 'obv' ? 'BẬT' : 'TẮT'}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trendline Pro Toggle Button */}
          <button
            onClick={() => setShowTrendlinePro(!showTrendlinePro)}
            title="Đường tự động Trendline Pro & Kháng cự/Hỗ trợ/Fibonacci (Bấm để Bật/Tắt các đường tự động)"
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold rounded-lg whitespace-nowrap shrink-0 transition-all ${
              showTrendlinePro
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendUp size={13} className={showTrendlinePro ? 'text-amber-400 shrink-0' : 'text-zinc-500 shrink-0'} />
            <span>Trendline</span>
            {showTrendlinePro && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>
        </div>

        {/* Right: Minervini RS Rating & Stage 2 Criteria, Fit & Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {chartMinervini && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Highlighted RS Rating */}
              <div
                title={`Chỉ số Sức Mạnh Tương Đối (Minervini RS Rating): ${chartMinervini.rsRating ?? '--'}/99`}
                className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center gap-1.5 shrink-0 cursor-default"
              >
                <Sparkle weight="fill" className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider">RS</span>
                <span className="text-xs font-black text-amber-300">{chartMinervini.rsRating ?? '--'}</span>
              </div>

              {/* Highlighted Minervini Criteria Count */}
              <div
                title={`Mark Minervini Trend Template: Đạt ${chartMinervini.passedCount ?? 0}/8 tiêu chí mẫu hình tăng trưởng Stage 2`}
                className={`font-mono text-xs px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1.5 shrink-0 shadow-sm cursor-default ${
                  (chartMinervini.passedCount ?? 0) >= 6
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-zinc-800/90 text-zinc-300 border-zinc-700/70'
                }`}
              >
                <Target size={13} className={(chartMinervini.passedCount ?? 0) >= 6 ? 'text-emerald-400 shrink-0' : 'text-zinc-400 shrink-0'} />
                <span className="text-[10px] text-zinc-400 uppercase font-bold hidden sm:inline">STAGE 2:</span>
                <span className="font-mono font-black text-white">
                  {chartMinervini.passedCount ?? 0}/8 Tiêu chí
                </span>
              </div>
            </div>
          )}

          <div className="w-px h-3.5 bg-zinc-800 shrink-0 mx-0.5" />

          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            title="Căn chỉnh dữ liệu nến vừa khung (Fit Content)"
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg shrink-0"
          >
            <ArrowsOutSimple size={13} />
          </button>

          <button
            onClick={toggleFullscreen}
            title={isExpanded ? 'Thu nhỏ biểu đồ (Esc)' : 'Toàn màn hình (Fullscreen)'}
            className={`p-1 rounded-lg shrink-0 transition-all ${
              isExpanded
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            {isExpanded ? <ArrowsIn size={14} weight="bold" /> : <ArrowsOut size={14} weight="bold" />}
          </button>
        </div>
      </div>

      {/* ── Main Chart Body with Left Drawing Toolbar ─────────────── */}
      <div className={`w-full flex-1 flex relative bg-zinc-950 overflow-hidden ${
        isExpanded ? 'h-[calc(100vh-100px)] min-h-0' : 'h-[480px] lg:h-[510px] min-h-[400px]'
      }`}>
        {/* Left Vertical Drawing Toolbar (Complete TradingView Style) */}
        <div className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 px-1 bg-[#131722]/95 border-r border-zinc-800/80 z-30 shrink-0 w-10 sm:w-11 select-none overflow-visible relative h-full">
          {/* 1. Grip Handle */}
          <div className="text-zinc-600 py-0.5 flex justify-center cursor-grab active:cursor-grabbing hover:text-zinc-400 transition-colors">
            <DotsSixVertical size={16} />
          </div>

          {/* 2. Star (Favorites) */}
          <button
            title="Công cụ ưa thích (Favorites)"
            className="w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-300 rounded-lg hover:bg-zinc-800/70 transition-colors"
          >
            <Star size={16} weight="fill" />
          </button>

          {/* 3. Seven Drawing Tool Groups with Flyout Sub-menus */}
          {[
            {
              id: 'cursor_group',
              defaultIcon: Cursor,
              tools: [
                { id: 'cursor' as DrawingTool, label: 'Con trỏ chữ thập (Crosshair)', icon: Cursor },
                { id: 'dot' as DrawingTool, label: 'Điểm chấm (Dot)', icon: Circle },
                { id: 'arrow_pointer' as DrawingTool, label: 'Mũi tên (Arrow)', icon: Cursor },
                { id: 'eraser' as DrawingTool, label: 'Cục tẩy nét vẽ (Eraser)', icon: Scissors },
              ],
            },
            {
              id: 'lines_group',
              defaultIcon: TrendUp,
              tools: [
                { id: 'trendline' as DrawingTool, label: 'Đường xu hướng (Trend Line)', icon: TrendUp },
                { id: 'ray' as DrawingTool, label: 'Tia xu hướng (Ray)', icon: TrendUp },
                { id: 'horizontal' as DrawingTool, label: 'Đường ngang Hỗ trợ / Kháng cự', icon: Minus },
                { id: 'horizontal_ray' as DrawingTool, label: 'Tia ngang (Horizontal Ray)', icon: Minus },
                { id: 'vertical' as DrawingTool, label: 'Đường dọc (Vertical Line)', icon: Minus },
                { id: 'parallel_channel' as DrawingTool, label: 'Kênh giá song song (Channel)', icon: Waveform },
              ],
            },
            {
              id: 'fib_group',
              defaultIcon: Percent,
              tools: [
                { id: 'fibonacci' as DrawingTool, label: 'Thoái lui Fibonacci (Retracement)', icon: Percent },
                { id: 'fib_extension' as DrawingTool, label: 'Mở rộng Fibonacci (Fib Extension)', icon: Waveform },
              ],
            },
            {
              id: 'shapes_group',
              defaultIcon: Square,
              tools: [
                { id: 'rectangle' as DrawingTool, label: 'Vùng giá (Hộp Supply / Demand)', icon: Square },
                { id: 'circle' as DrawingTool, label: 'Đường tròn (Circle)', icon: Circle },
                { id: 'arrow_marker' as DrawingTool, label: 'Mũi tên đánh dấu (Arrow Marker)', icon: TrendUp },
              ],
            },
            {
              id: 'text_group',
              defaultIcon: TextT,
              tools: [
                { id: 'text' as DrawingTool, label: 'Ghi chú văn bản (Text note)', icon: TextT },
                { id: 'price_label' as DrawingTool, label: 'Nhãn giá kỹ thuật (Price Label)', icon: Tag },
                { id: 'callout' as DrawingTool, label: 'Bong bóng ghi chú (Callout)', icon: TextT },
              ],
            },
            {
              id: 'measure_group',
              defaultIcon: Target,
              tools: [
                { id: 'long_position' as DrawingTool, label: 'Vị thế Mua (Long Position R:R)', icon: Target },
                { id: 'short_position' as DrawingTool, label: 'Vị thế Bán (Short Position R:R)', icon: Target },
                { id: 'measure' as DrawingTool, label: 'Thước đo biến động (% & Nến)', icon: Ruler },
              ],
            },
            {
              id: 'sticker_group',
              defaultIcon: Rocket,
              tools: [
                { id: 'rocket' as DrawingTool, label: 'Mục tiêu bứt phá (Rocket 🚀)', icon: Rocket },
              ],
            },
          ].map((group) => {
            const isGroupActive = group.tools.some((t) => t.id === activeTool);
            const activeToolInGroup = group.tools.find((t) => t.id === activeTool);
            const GroupIcon = activeToolInGroup ? activeToolInGroup.icon : group.defaultIcon;

            return (
              <div key={group.id} className="relative group/tool">
                <button
                  onClick={(e) => {
                    const toolToActivate = activeToolInGroup ? activeToolInGroup.id : group.tools[0].id;
                    setActiveTool(toolToActivate);
                    setDraftDrawing(null);
                    if (group.tools.length > 1) {
                      triggerFlyout(group.id, e.currentTarget);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    triggerFlyout(group.id, e.currentTarget);
                  }}
                  title={activeToolInGroup ? TOOL_LABELS[activeToolInGroup.id] : group.tools[0].label}
                  className={`w-8 h-8 flex items-center justify-center relative rounded-lg transition-all ${
                    isGroupActive
                      ? 'bg-[#2962ff] text-white shadow-md shadow-blue-500/30 font-bold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                  }`}
                >
                  <GroupIcon size={16} weight={isGroupActive ? 'bold' : 'regular'} />
                  {/* TradingView corner triangle indicator (Enlarged and clearly interactive) */}
                  {group.tools.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const btn = e.currentTarget.closest('button');
                        if (btn) triggerFlyout(group.id, btn);
                      }}
                      title="Mở rộng danh sách công cụ"
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 flex items-end justify-end cursor-pointer p-0.5 text-zinc-400 hover:text-white"
                    >
                      <svg className="w-2.5 h-2.5 opacity-70 group-hover/tool:opacity-100" viewBox="0 0 6 6" fill="currentColor">
                        <polygon points="6,0 6,6 0,6" />
                      </svg>
                    </span>
                  )}
                </button>

                {/* Submenu Flyout (Fixed viewport position to prevent clipping) */}
                {activeFlyout === group.id && flyoutPos && (
                  <>
                    <div
                      className="fixed inset-0 z-[9990] bg-transparent"
                      onClick={() => {
                        setActiveFlyout(null);
                        setFlyoutPos(null);
                      }}
                    />
                    <div
                      style={{ top: `${flyoutPos.top}px`, left: `${flyoutPos.left}px` }}
                      className="fixed z-[9999] bg-[#1e222d] border border-zinc-700/80 rounded-xl shadow-2xl p-1.5 min-w-[240px] backdrop-blur-xl animate-in fade-in zoom-in-95 flex flex-col gap-0.5"
                    >
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider px-2 py-1 border-b border-zinc-800/80 mb-0.5 flex items-center justify-between">
                        <span>Chọn công cụ</span>
                        <span className="text-[9px] text-zinc-500 font-bold">{group.tools.length} tùy chọn</span>
                      </div>
                      {group.tools.map((t) => {
                        const ToolItemIcon = t.icon;
                        const isSelected = activeTool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveTool(t.id);
                              setDraftDrawing(null);
                              setActiveFlyout(null);
                              setFlyoutPos(null);
                            }}
                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-sans text-left transition-all ${
                              isSelected
                                ? 'bg-[#2962ff] text-white font-semibold shadow-sm'
                                : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80'
                            }`}
                          >
                            <ToolItemIcon size={16} weight={isSelected ? 'bold' : 'regular'} className="shrink-0" />
                            <span className="truncate flex-1">{t.label}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <div className="w-5 h-px bg-zinc-800/80 my-1" />

          {/* 4. Utility Buttons: Magnet Mode (Exact Blue highlighted box from user screenshot!) */}
          <div className="relative">
            <button
              onClick={() => setIsMagnetMode(!isMagnetMode)}
              title={isMagnetMode ? 'Chế độ nam châm: BẬT (Tự động hít đỉnh/đáy nến thông minh)' : 'Chế độ nam châm: TẮT'}
              className={`w-8 h-8 flex items-center justify-center relative rounded-lg transition-all ${
                isMagnetMode
                  ? 'bg-[#2962ff] text-white shadow-md shadow-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
              }`}
            >
              <Magnet size={17} weight={isMagnetMode ? 'fill' : 'regular'} />
              <svg className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 opacity-60" viewBox="0 0 6 6" fill="currentColor">
                <polygon points="6,0 6,6 0,6" />
              </svg>
            </button>
          </div>

          {/* 5. Stay in Drawing Mode (Pin 📌) */}
          <button
            onClick={() => setStayInDrawingMode(!stayInDrawingMode)}
            title={stayInDrawingMode ? 'Ghim chế độ vẽ: BẬT (Vẽ liên tục nhiều nét)' : 'Ghim chế độ vẽ: TẮT (Tự đổi về con trỏ)'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              stayInDrawingMode
                ? 'bg-zinc-800 text-blue-400 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
            }`}
          >
            <PushPin size={16} weight={stayInDrawingMode ? 'fill' : 'regular'} />
          </button>

          {/* 6. Hide / Show Drawings (Eye 👁️) */}
          <button
            onClick={() => setHideDrawings(!hideDrawings)}
            title={hideDrawings ? 'Hiện tất cả nét vẽ' : 'Ẩn tất cả nét vẽ'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              hideDrawings
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
            }`}
          >
            {hideDrawings ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} />}
          </button>

          {/* 7. Lock Drawings (Lock 🔒) */}
          <button
            onClick={() => setLockDrawings(!lockDrawings)}
            title={lockDrawings ? 'Khóa nét vẽ: BẬT (Bảo vệ không bị sửa/xóa)' : 'Khóa nét vẽ: TẮT'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              lockDrawings
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
            }`}
          >
            <LockKey size={16} weight={lockDrawings ? 'fill' : 'regular'} />
          </button>

          <div className="w-5 h-px bg-zinc-800/80 my-1" />

          {/* 8. Undo & Redo */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={handleUndo}
              disabled={drawings.length === 0}
              title="Hoàn tác nét vẽ (Undo)"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <ArrowCounterClockwise size={15} />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Làm lại nét vẽ (Redo)"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <ArrowClockwise size={15} />
            </button>
          </div>

          {/* 9. Color Palette & Line Width */}
          <div className="relative">
            <button
              onClick={(e) => {
                if (showPalette) {
                  setShowPalette(false);
                  setPalettePos(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPalettePos({ top: Math.max(10, rect.top - 80), left: rect.right + 8 });
                  setShowPalette(true);
                }
              }}
              title="Bảng màu & Độ dày nét vẽ"
              className="w-8 h-8 flex items-center justify-center relative rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80"
            >
              <span
                className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: activeColor }}
              />
            </button>

            {showPalette && palettePos && (
              <>
                <div
                  className="fixed inset-0 z-[9990] bg-transparent"
                  onClick={() => {
                    setShowPalette(false);
                    setPalettePos(null);
                  }}
                />
                <div
                  style={{ top: `${palettePos.top}px`, left: `${palettePos.left}px` }}
                  className="fixed bg-[#1e222d] border border-zinc-700/80 rounded-xl p-2.5 flex flex-col gap-2 z-[9999] shadow-2xl backdrop-blur-xl min-w-[170px] animate-in fade-in"
                >
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider px-1">Màu sắc nét vẽ</div>
                  <div className="flex items-center gap-1.5">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setActiveColor(c); setShowPalette(false); }}
                        className={`w-6 h-6 rounded-md border transition-transform ${
                          activeColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider px-1 mt-1">Độ dày nét</div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        onClick={() => { setActiveWidth(w); setShowPalette(false); }}
                        className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition-all ${
                          activeWidth === w
                            ? 'bg-[#2962ff] text-white font-bold shadow'
                            : 'text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 10. Clone / Duplicate */}
          <button
            onClick={handleCloneLast}
            disabled={drawings.length === 0}
            title="Nhân bản nét vẽ vừa tạo (Duplicate / Clone)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          >
            <Copy size={16} />
          </button>

          {/* 11. Clear / Trash */}
          <button
            onClick={handleClearAll}
            disabled={drawings.length === 0}
            title="Xóa tất cả nét vẽ trên biểu đồ (Clear all)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          >
            <Trash size={16} />
          </button>
        </div>

        {/* Chart Canvas Area & Sub Indicator Pane */}
        <div className="flex-1 h-full w-full min-h-0 relative overflow-hidden flex flex-col">
          <div className="flex-1 w-full min-h-0 relative overflow-hidden">
            <div ref={chartContainerRef} className="w-full h-full min-h-0" />
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverSnapPoint(null)}
              onContextMenu={(e) => {
                if (draftDrawing) {
                  e.preventDefault();
                  setDraftDrawing(null);
                }
              }}
              className={`absolute inset-0 z-20 ${
                activeTool === 'cursor' || activeTool === 'arrow_pointer' || activeTool === 'dot'
                  ? 'pointer-events-none'
                  : 'pointer-events-auto cursor-crosshair'
              }`}
            />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-30">
                <SpinnerGap size={28} className="text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-mono text-zinc-300">Đang đồng bộ nến lịch sử DNSE từ ngày đầu tiên...</p>
              </div>
            )}

            {/* ── TradingView In-Chart Legend (Top-Left Canvas Overlay - Screenshot 2 style) ────────── */}
            <div className="absolute top-2 left-3 z-20 pointer-events-none flex flex-col gap-0.5 select-none font-mono text-[11px] leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {/* Row 1: Realtime OHLC */}
              <div className="flex items-center gap-1.5 flex-wrap text-zinc-300">
                <span className="text-zinc-400 font-bold">{resolution}</span>
                <span className="text-zinc-700">|</span>
                <span>O <strong className="text-zinc-100 font-bold">{hoveredData?.open ? hoveredData.open.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.open.toFixed(2) : priceDisplayK)}</strong></span>
                <span>H <strong className="text-emerald-400 font-bold">{hoveredData?.high ? hoveredData.high.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.high.toFixed(2) : priceDisplayK)}</strong></span>
                <span>L <strong className="text-rose-400 font-bold">{hoveredData?.low ? hoveredData.low.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.low.toFixed(2) : priceDisplayK)}</strong></span>
                <span>C <strong className="text-zinc-100 font-bold">{hoveredData?.close ? hoveredData.close.toFixed(2) : (lastCandleRef.current ? lastCandleRef.current.close.toFixed(2) : priceDisplayK)}</strong></span>
                <span className={`font-bold ${priceColor.colorClass}`}>
                  {hoveredData?.change ? (
                    `${hoveredData.change >= 0 ? '+' : ''}${hoveredData.change.toFixed(2)} (${hoveredData.changePct?.toFixed(2)}%)`
                  ) : lastCandleRef.current ? (
                    `${lastCandleRef.current.close >= lastCandleRef.current.open ? '+' : ''}${(lastCandleRef.current.close - lastCandleRef.current.open).toFixed(2)} (${(((lastCandleRef.current.close - lastCandleRef.current.open) / (lastCandleRef.current.open || 1)) * 100).toFixed(2)}%)`
                  ) : (
                    `${isPositive ? '+' : ''}${changeK} (${isPositive ? '+' : ''}${changePct}%)`
                  )}
                </span>
              </div>

              {/* Row 2: Volume 20 (Screenshot 2: Vol 20 3.38M) */}
              {showVolume && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>Vol 20</span>
                  <span className="text-emerald-400 font-bold">
                    {(hoveredData?.volume || (loadedCandlesRef.current.length > 0 ? (currentTick?.totalVolume || 0) : 0)).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Row 3: SMA 20 50 150 200 (Matches Screenshot 2: SMA 20 50 150 200 ...) */}
              {(showMA20 || showMA50 || showMA150 || showMA200) && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">SMA 20 50 150 200</span>
                  {showMA20 && activeMA20 !== undefined && (
                    <span className="text-[#f59e0b] font-bold">{activeMA20.toFixed(2)}</span>
                  )}
                  {showMA50 && activeMA50 !== undefined && (
                    <span className="text-[#06b6d4] font-bold">{activeMA50.toFixed(2)}</span>
                  )}
                  {showMA150 && activeMA150 !== undefined && (
                    <span className="text-[#f97316] font-bold">{activeMA150.toFixed(2)}</span>
                  )}
                  {showMA200 && activeMA200 !== undefined && (
                    <span className="text-[#f43f5e] font-bold">{activeMA200.toFixed(2)}</span>
                  )}
                </div>
              )}

              {/* Row 4: Trendline Pro Support / Resistance */}
              {showTrendlinePro && trendlineProData && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-amber-400/90 font-bold">Trendline Pro</span>
                  <span className="text-lime-400">Kháng cự: <strong>{trendlineProData.resistance.toFixed(2)}</strong></span>
                  <span className="text-rose-400">Hỗ trợ: <strong>{trendlineProData.support.toFixed(2)}</strong></span>
                  <span className="text-amber-300">Fib 0.618: <strong>{trendlineProData.fib0618.toFixed(2)}</strong></span>
                </div>
              )}
            </div>

            {/* Active Tool Floating Banner (Only for actual drawing tools, never for cursor tools) */}
            {activeTool !== 'cursor' && activeTool !== 'arrow_pointer' && activeTool !== 'dot' && activeTool !== 'eraser' && (
              <div className="absolute top-3 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 border border-emerald-500/30 rounded-xl text-[11px] font-mono text-emerald-400 backdrop-blur-md shadow-xl">
                <span className="font-bold">{TOOL_LABELS[activeTool]}</span>
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

          {/* Sub Indicator Pane (RSI, MACD, MFI, OBV) */}
          {activeSubIndicator !== 'none' && (
            <div className="h-[148px] w-full border-t border-zinc-800/80 bg-zinc-950/95 flex flex-col relative shrink-0">
              {/* Header Bar */}
              <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/70 border-b border-zinc-800/60 text-[11px] font-mono select-none">
                {/* Left: Quick Switcher Tabs */}
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold mr-1">Chỉ báo phụ:</span>
                  {(
                    [
                      { id: 'rsi', label: 'RSI (14)' },
                      { id: 'macd', label: 'MACD (12,26,9)' },
                      { id: 'mfi', label: 'MFI (14) - Dòng tiền' },
                      { id: 'obv', label: 'OBV - Cá mập gom' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubIndicator(tab.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        activeSubIndicator === tab.id
                          ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Center / Right: Live Numeric Values & Close Button */}
                <div className="flex items-center gap-3">
                  {activeSubIndicator === 'rsi' && (
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">
                        RSI(14): <strong className="text-zinc-100">{subIndicatorValues.rsi !== undefined ? subIndicatorValues.rsi.toFixed(1) : '--'}</strong>
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        (subIndicatorValues.rsi ?? 50) >= 70
                          ? 'bg-rose-500/20 text-rose-400'
                          : (subIndicatorValues.rsi ?? 50) <= 30
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {(subIndicatorValues.rsi ?? 50) >= 70 ? 'Quá mua (>70)' : (subIndicatorValues.rsi ?? 50) <= 30 ? 'Quá bán (<30)' : 'Cân bằng'}
                      </span>
                    </div>
                  )}

                  {activeSubIndicator === 'macd' && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-medium">
                        MACD: <strong className="text-zinc-100 font-bold">{subIndicatorValues.macd !== undefined ? subIndicatorValues.macd.toFixed(2) : '--'}</strong>
                      </span>
                      <span className="text-orange-400 font-medium">
                        Signal: <strong className="text-zinc-100 font-bold">{subIndicatorValues.signal !== undefined ? subIndicatorValues.signal.toFixed(2) : '--'}</strong>
                      </span>
                      <span className={`font-medium ${
                        (subIndicatorValues.hist ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        Hist: <strong className="font-bold">{(subIndicatorValues.hist ?? 0) >= 0 ? '+' : ''}{subIndicatorValues.hist !== undefined ? subIndicatorValues.hist.toFixed(2) : '--'}</strong>
                      </span>
                    </div>
                  )}

                  {activeSubIndicator === 'mfi' && (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">
                        MFI(14): <strong className="text-zinc-100">{subIndicatorValues.mfi !== undefined ? subIndicatorValues.mfi.toFixed(1) : '--'}</strong>
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        (subIndicatorValues.mfi ?? 50) >= 80
                          ? 'bg-rose-500/20 text-rose-400'
                          : (subIndicatorValues.mfi ?? 50) <= 20
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {(subIndicatorValues.mfi ?? 50) >= 80 ? 'Dòng tiền nóng (>80)' : (subIndicatorValues.mfi ?? 20) <= 20 ? 'Dòng tiền gom đáy (<20)' : 'Dòng tiền ổn định'}
                      </span>
                    </div>
                  )}

                  {activeSubIndicator === 'obv' && (
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-bold">
                        OBV: <strong className="text-zinc-100">
                          {subIndicatorValues.obv !== undefined
                            ? Math.abs(subIndicatorValues.obv) >= 1_000_000
                              ? `${(subIndicatorValues.obv / 1_000_000).toFixed(2)}M cp`
                              : `${(subIndicatorValues.obv / 1_000).toFixed(1)}K cp`
                            : '--'}
                        </strong>
                      </span>
                      <span className="text-amber-400 text-[10px] hidden sm:inline">Cam: EMA20 OBV</span>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveSubIndicator('none')}
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                    title="Đóng chỉ báo phụ"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Sub-chart container */}
              <div ref={subChartContainerRef} className="w-full flex-1 min-h-0" />
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
