import { CandlestickData, HistogramData, Time } from 'lightweight-charts';

export interface VolumeProfileBin {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isVA: boolean; // True if within Value Area (70%)
}

export interface VolumeProfileResult {
  pocPrice: number;
  pocIndex: number;
  vahPrice: number;
  valPrice: number;
  maxBinVolume: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  bins: VolumeProfileBin[];
}

export interface VolumeProfileSettings {
  enabled: boolean;
  rowCount: number; // default: 48
  valueAreaPercent: number; // default: 70
  widthPercent: number; // default: 28 (% of chart width)
  showPocLine: boolean; // default: true
  showVaLines: boolean; // default: true
  showLabels: boolean; // default: true
  showDeltaDeltaStats: boolean; // default: true
}

export const DEFAULT_VOLUME_PROFILE_SETTINGS: VolumeProfileSettings = {
  enabled: false,
  rowCount: 48,
  valueAreaPercent: 70,
  widthPercent: 28,
  showPocLine: true,
  showVaLines: true,
  showLabels: true,
  showDeltaDeltaStats: true,
};

/**
 * Calculates the Advanced Volume Profile (Fixed/Session Range) using real candle and volume data.
 * Adheres strictly to Zero Mock Data rule: all calculations stem from real price and volume arrays.
 * 
 * @param candles Historical candlestick data with open, high, low, close
 * @param volumes Historical histogram volume data
 * @param settings Configuration for row count, value area %, etc.
 */
export function calculateVolumeProfile(
  candles: CandlestickData<Time>[],
  volumes: HistogramData<Time>[],
  settings: VolumeProfileSettings = DEFAULT_VOLUME_PROFILE_SETTINGS
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;

  const n = candles.length;
  // Build fast volume lookup map by time
  const volMap = new Map<any, number>();
  if (volumes && volumes.length > 0) {
    for (let i = 0; i < volumes.length; i++) {
      volMap.set(volumes[i].time, volumes[i].value);
    }
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }

  if (!isFinite(minPrice) || !isFinite(maxPrice) || maxPrice <= minPrice) {
    return null;
  }

  const rowCount = Math.max(12, Math.min(100, settings.rowCount || 48));
  const priceRange = maxPrice - minPrice;
  const step = priceRange / rowCount;

  // Initialize bins from minPrice to maxPrice
  const bins: VolumeProfileBin[] = [];
  for (let k = 0; k < rowCount; k++) {
    const priceLow = minPrice + k * step;
    const priceHigh = minPrice + (k + 1) * step;
    bins.push({
      priceLow,
      priceHigh,
      priceMid: (priceLow + priceHigh) / 2,
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      isVA: false,
    });
  }

  let totalVolume = 0;
  let totalBuyVolume = 0;
  let totalSellVolume = 0;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const vol = volMap.get(c.time) ?? volumes[i]?.value ?? 0;
    if (vol <= 0) continue;

    const candleRange = c.high - c.low;

    // Estimate Buy vs Sell volume using intra-candle price action
    let buyRatio: number;
    if (candleRange <= 0.00001) {
      buyRatio = 0.5;
    } else {
      buyRatio = (c.close - c.low) / candleRange;
      if (c.close >= c.open) {
        // Bullish candle: buyers in control
        buyRatio = Math.max(buyRatio, 0.55);
      } else {
        // Bearish candle: sellers in control
        buyRatio = Math.min(buyRatio, 0.45);
      }
    }
    // Clamp to realistic bounds [0.05, 0.95]
    buyRatio = Math.max(0.05, Math.min(0.95, buyRatio));

    const candleBuy = vol * buyRatio;
    const candleSell = vol * (1 - buyRatio);

    totalVolume += vol;
    totalBuyVolume += candleBuy;
    totalSellVolume += candleSell;

    // Distribute candle across overlapping price bins
    if (candleRange <= 0.00001) {
      let k = Math.floor((c.close - minPrice) / step);
      if (k < 0) k = 0;
      if (k >= rowCount) k = rowCount - 1;
      bins[k].buyVolume += candleBuy;
      bins[k].sellVolume += candleSell;
      bins[k].totalVolume += vol;
    } else {
      let startK = Math.floor((c.low - minPrice) / step);
      let endK = Math.floor((c.high - minPrice) / step);
      if (startK < 0) startK = 0;
      if (endK >= rowCount) endK = rowCount - 1;

      for (let k = startK; k <= endK; k++) {
        const overlapStart = Math.max(c.low, bins[k].priceLow);
        const overlapEnd = Math.min(c.high, bins[k].priceHigh);
        const overlapLen = Math.max(0, overlapEnd - overlapStart);
        if (overlapLen <= 0) continue;

        const weight = overlapLen / candleRange;
        const bVol = candleBuy * weight;
        const sVol = candleSell * weight;
        const tVol = vol * weight;

        bins[k].buyVolume += bVol;
        bins[k].sellVolume += sVol;
        bins[k].totalVolume += tVol;
      }
    }
  }

  if (totalVolume <= 0) {
    return null;
  }

  // Find POC (Point of Control) = highest volume bin
  let maxBinVolume = 0;
  let pocIndex = 0;
  for (let k = 0; k < rowCount; k++) {
    if (bins[k].totalVolume > maxBinVolume) {
      maxBinVolume = bins[k].totalVolume;
      pocIndex = k;
    }
  }

  const pocPrice = bins[pocIndex].priceMid;

  // Calculate Value Area (default 70% of total volume)
  const vaTarget = ((settings.valueAreaPercent || 70) / 100) * totalVolume;
  let currentVaVol = bins[pocIndex].totalVolume;
  bins[pocIndex].isVA = true;

  let up = pocIndex + 1;
  let down = pocIndex - 1;

  while (currentVaVol < vaTarget && (up < rowCount || down >= 0)) {
    const upVol = up < rowCount ? bins[up].totalVolume : -1;
    const downVol = down >= 0 ? bins[down].totalVolume : -1;

    if (upVol >= downVol && up < rowCount) {
      bins[up].isVA = true;
      currentVaVol += bins[up].totalVolume;
      up++;
    } else if (down >= 0) {
      bins[down].isVA = true;
      currentVaVol += bins[down].totalVolume;
      down--;
    } else if (up < rowCount) {
      bins[up].isVA = true;
      currentVaVol += bins[up].totalVolume;
      up++;
    } else {
      break;
    }
  }

  // Determine VAH (Value Area High) and VAL (Value Area Low)
  let minVaIdx = rowCount - 1;
  let maxVaIdx = 0;
  for (let k = 0; k < rowCount; k++) {
    if (bins[k].isVA) {
      if (k < minVaIdx) minVaIdx = k;
      if (k > maxVaIdx) maxVaIdx = k;
    }
  }

  const valPrice = bins[minVaIdx].priceLow;
  const vahPrice = bins[maxVaIdx].priceHigh;

  return {
    pocPrice,
    pocIndex,
    vahPrice,
    valPrice,
    maxBinVolume,
    totalVolume,
    totalBuyVolume,
    totalSellVolume,
    bins,
  };
}
