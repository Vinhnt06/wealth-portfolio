import { CandlestickData, Time } from 'lightweight-charts';

export interface FibPivotLevelConfig {
  id: string;
  name: string;
  ratio: number;
  color: string;
  style: 'Solid' | 'Dashed';
  defaultShow: boolean;
}

export const DEFAULT_FIBO_LEVELS: FibPivotLevelConfig[] = [
  { id: 'pp', name: '0', ratio: 0.0, color: '#787B86', style: 'Solid', defaultShow: true },
  { id: 'l1', name: '1', ratio: 0.236, color: '#9C27B0', style: 'Dashed', defaultShow: true },
  { id: 'l2', name: '2', ratio: 0.382, color: '#81C784', style: 'Solid', defaultShow: true },
  { id: 'l3', name: '3', ratio: 0.5, color: '#4CAF50', style: 'Dashed', defaultShow: true },
  { id: 'l4', name: '4', ratio: 0.618, color: '#009688', style: 'Solid', defaultShow: true },
  { id: 'l5', name: '5', ratio: 0.786, color: '#00BCD4', style: 'Dashed', defaultShow: true },
  { id: 'l6', name: '6', ratio: 1.0, color: '#2196F3', style: 'Solid', defaultShow: true },
  { id: 'l7', name: '7', ratio: 1.272, color: '#3F51B5', style: 'Dashed', defaultShow: true },
  { id: 'l8', name: '8', ratio: 1.618, color: '#673AB7', style: 'Solid', defaultShow: true },
  { id: 'l9', name: '9', ratio: 2.0, color: '#9C27B0', style: 'Dashed', defaultShow: true },
  { id: 'l10', name: '10', ratio: 2.618, color: '#E91E63', style: 'Dashed', defaultShow: true },
  { id: 'l11', name: '11', ratio: 3.618, color: '#F44336', style: 'Dashed', defaultShow: false },
  { id: 'l12', name: '12', ratio: 4.236, color: '#FF9800', style: 'Dashed', defaultShow: false },
  { id: 'l13', name: '13', ratio: 4.618, color: '#FFC107', style: 'Dashed', defaultShow: false },
];

export interface CalculatedPivotLevel {
  id: string;
  name: string;
  type: 'PP' | 'R' | 'S';
  ratio: number;
  price: number;
  color: string;
  style: 'Solid' | 'Dashed';
  label: string;
}

export interface FiboPivotPeriod {
  key: string;
  startIndex: number;
  endIndex: number;
  startTime: Time;
  endTime: Time;
  isCurrent: boolean;
  pp: number;
  range: number;
  levels: CalculatedPivotLevel[];
}

export type FiboTimeframeOption = 'Auto' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

export interface FiboPivotsSettings {
  enabled: boolean;
  timeframe: FiboTimeframeOption;
  maxPivotsBack: number;
  showLabels: boolean;
  showPrices: boolean;
  positionLabels: 'Left' | 'Right';
  lineWidth: number;
  lineLengthPct: number;
  enabledLevels: Record<string, boolean>;
}

/**
 * Format pivot price for display:
 * In Vietnam market, prices < 1000 are in thousands VND (e.g. 51.4 = 51400 VND).
 * Matches TradingView formatting like (51400) or (52300).
 */
export function formatPivotPrice(price: number): string {
  if (price <= 0) return '0';
  const val = price < 1000 ? Math.round(price * 1000) : Math.round(price);
  return val.toString();
}

export const DEFAULT_FIBO_SETTINGS: FiboPivotsSettings = {
  enabled: false,
  timeframe: 'Auto',
  maxPivotsBack: 1, // Default to 1 active period to keep chart clean and clear
  showLabels: true,
  showPrices: true,
  positionLabels: 'Right',
  lineWidth: 1,
  lineLengthPct: 100,
  enabledLevels: DEFAULT_FIBO_LEVELS.reduce((acc, lvl) => {
    acc[lvl.id] = lvl.defaultShow;
    return acc;
  }, {} as Record<string, boolean>),
};

/**
 * Determine the Higher Timeframe (HTF) anchor based on Pine Script auto rules
 */
export function resolvePivotAnchor(
  chartResolution: string,
  userChoice: FiboTimeframeOption
): '1D' | '1W' | '1M' | '3M' | '12M' {
  if (userChoice !== 'Auto') {
    switch (userChoice) {
      case 'Daily': return '1D';
      case 'Weekly': return '1W';
      case 'Monthly': return '1M';
      case 'Quarterly': return '3M';
      case 'Yearly': return '12M';
    }
  }

  // Pine Script auto rules:
  // Intraday <= 15 min -> 1D
  // Intraday 30-240 min -> 1W
  // Daily -> 1M
  // Weekly -> 3M
  // Monthly -> 12M
  if (chartResolution === '1m' || chartResolution === '5m' || chartResolution === '15m') return '1D';
  if (chartResolution === '1h') return '1W';
  if (chartResolution === '1D') return '1M';
  if (chartResolution === '1W') return '3M';
  return '12M';
}

/**
 * Helper to get calendar group key for a candle time
 */
function getPeriodKey(timeVal: Time, anchor: '1D' | '1W' | '1M' | '3M' | '12M'): string {
  let date: Date;
  if (typeof timeVal === 'number') {
    date = new Date(timeVal * 1000);
  } else if (typeof timeVal === 'string') {
    date = new Date(timeVal);
  } else if (typeof timeVal === 'object' && 'year' in timeVal) {
    date = new Date(timeVal.year, timeVal.month - 1, timeVal.day);
  } else {
    date = new Date();
  }

  // Use Vietnam timezone (UTC+7)
  const vnYear = date.getFullYear();
  const vnMonth = date.getMonth() + 1;
  const vnDay = date.getDate();

  switch (anchor) {
    case '1D':
      return `${vnYear}-${String(vnMonth).padStart(2, '0')}-${String(vnDay).padStart(2, '0')}`;
    case '1W': {
      // Find Monday of the current week
      const dayOfWeek = date.getDay(); // 0 is Sunday
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diffToMonday);
      return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + monday.getMonth() * 31) / 7)).padStart(2, '0')}`;
    }
    case '1M':
      return `${vnYear}-${String(vnMonth).padStart(2, '0')}`;
    case '3M': {
      const q = Math.floor((vnMonth - 1) / 3) + 1;
      return `${vnYear}-Q${q}`;
    }
    case '12M':
      return `${vnYear}`;
  }
}

/**
 * Calculate Fibonacci Pivot Points across historical and current periods
 */
export function calculateFibonacciPivots(
  candles: CandlestickData<Time>[],
  resolution: string,
  settings: FiboPivotsSettings
): FiboPivotPeriod[] {
  if (!candles || candles.length < 5 || !settings.enabled) return [];

  const anchor = resolvePivotAnchor(resolution, settings.timeframe);

  // 1. Group candles into HTF periods
  interface GroupData {
    key: string;
    startIndex: number;
    endIndex: number;
    high: number;
    low: number;
    close: number;
  }

  const groups: GroupData[] = [];
  let currentGroup: GroupData | null = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const key = getPeriodKey(c.time, anchor);

    if (!currentGroup || currentGroup.key !== key) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        key,
        startIndex: i,
        endIndex: i,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    } else {
      currentGroup.endIndex = i;
      currentGroup.high = Math.max(currentGroup.high, c.high);
      currentGroup.low = Math.min(currentGroup.low, c.low);
      currentGroup.close = c.close; // Latest close in group
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  if (groups.length < 2) return [];

  // 2. For each period from index 1 to groups.length - 1, calculate Pivots based on previous group
  const pivotPeriods: FiboPivotPeriod[] = [];
  const maxPivots = Math.max(1, Math.min(settings.maxPivotsBack || 5, 20));
  const startG = Math.max(1, groups.length - maxPivots);

  for (let g = startG; g < groups.length; g++) {
    const prev = groups[g - 1];
    const curr = groups[g];
    const isCurrent = g === groups.length - 1;

    const h = prev.high;
    const l = prev.low;
    const c = prev.close;

    const pp = Number(((h + l + c) / 3).toFixed(2));
    const range = Number((h - l).toFixed(2));

    const levels: CalculatedPivotLevel[] = [];

    // Evaluate each level from config
    DEFAULT_FIBO_LEVELS.forEach((cfg) => {
      const isEnabled = settings.enabledLevels?.[cfg.id] ?? cfg.defaultShow;
      if (!isEnabled) return;

      if (cfg.ratio === 0) {
        // Pivot Point (PP 0)
        const priceStr = formatPivotPrice(pp);
        levels.push({
          id: cfg.id,
          name: 'PP 0',
          type: 'PP',
          ratio: 0,
          price: pp,
          color: cfg.color,
          style: cfg.style,
          label: settings.showLabels
            ? `PP 0${settings.showPrices ? ` (${priceStr})` : ''}`
            : settings.showPrices
            ? `(${priceStr})`
            : '',
        });
      } else {
        // Resistance (R)
        const rPrice = Number((pp + range * cfg.ratio).toFixed(2));
        const rPriceStr = formatPivotPrice(rPrice);
        const ratioStr = cfg.ratio.toString();
        levels.push({
          id: `${cfg.id}_r`,
          name: `R${cfg.name}`,
          type: 'R',
          ratio: cfg.ratio,
          price: rPrice,
          color: cfg.color,
          style: cfg.style,
          label: settings.showLabels
            ? `R${cfg.name} PP ${ratioStr}${settings.showPrices ? ` (${rPriceStr})` : ''}`
            : settings.showPrices
            ? `(${rPriceStr})`
            : '',
        });

        // Support (S)
        const sPrice = Number((pp - range * cfg.ratio).toFixed(2));
        const sPriceStr = formatPivotPrice(sPrice);
        levels.push({
          id: `${cfg.id}_s`,
          name: `S${cfg.name}`,
          type: 'S',
          ratio: cfg.ratio,
          price: sPrice,
          color: cfg.color,
          style: cfg.style,
          label: settings.showLabels
            ? `S${cfg.name} PP ${ratioStr}${settings.showPrices ? ` (${sPriceStr})` : ''}`
            : settings.showPrices
            ? `(${sPriceStr})`
            : '',
        });
      }
    });

    pivotPeriods.push({
      key: curr.key,
      startIndex: curr.startIndex,
      endIndex: curr.endIndex,
      startTime: candles[curr.startIndex].time,
      endTime: candles[curr.endIndex].time,
      isCurrent,
      pp,
      range,
      levels,
    });
  }

  return pivotPeriods;
}
