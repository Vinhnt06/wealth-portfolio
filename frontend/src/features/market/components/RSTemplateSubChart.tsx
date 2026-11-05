'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  LineStyle,
} from 'lightweight-charts';
import { X, Sparkle, TrendUp, TrendDown, Info } from '@phosphor-icons/react';
import { calculateRSTemplate, RSTemplateDataset } from '../utils/rsIndicators';

interface RSTemplateSubChartProps {
  stockCandles: CandlestickData<Time>[];
  mainChart: IChartApi | null;
  onClose: () => void;
  selectedSymbol: string;
  onSwitchIndicator?: (type: 'none' | 'rsi' | 'macd' | 'mfi' | 'obv' | 'rs_template') => void;
}

// Module-level cache for VNINDEX candles
let vnindexCandlesCache: CandlestickData<Time>[] | null = null;
let vnindexFetchPromise: Promise<CandlestickData<Time>[]> | null = null;

async function fetchVNIndexCandles(): Promise<CandlestickData<Time>[]> {
  if (vnindexCandlesCache && vnindexCandlesCache.length > 0) {
    return vnindexCandlesCache;
  }
  if (vnindexFetchPromise) {
    return vnindexFetchPromise;
  }

  vnindexFetchPromise = fetch('/api/market/history?symbol=VNINDEX&resolution=1D')
    .then((res) => res.json())
    .then((json) => {
      if (json.success && Array.isArray(json.data)) {
        const candles: CandlestickData<Time>[] = json.data.map((c: any) => ({
          time: new Date(c.time * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) as unknown as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candles.sort((a, b) => (a.time > b.time ? 1 : -1));
        const unique = candles.filter((item, idx, arr) => idx === 0 || item.time !== arr[idx - 1].time);
        vnindexCandlesCache = unique;
        return unique;
      }
      return [];
    })
    .catch((err) => {
      console.error('[RSTemplate] Failed to fetch VNINDEX candles:', err);
      return [];
    })
    .finally(() => {
      vnindexFetchPromise = null;
    });

  return vnindexFetchPromise;
}

export const RSTemplateSubChart: React.FC<RSTemplateSubChartProps> = ({
  stockCandles,
  mainChart,
  onClose,
  selectedSymbol,
  onSwitchIndicator,
}) => {
  const containerPane1Ref = useRef<HTMLDivElement>(null);
  const containerPane2Ref = useRef<HTMLDivElement>(null);
  const containerPane3Ref = useRef<HTMLDivElement>(null);

  const chartPane1Ref = useRef<IChartApi | null>(null);
  const chartPane2Ref = useRef<IChartApi | null>(null);
  const chartPane3Ref = useRef<IChartApi | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<RSTemplateDataset | null>(null);

  // Live Hover Inspection Values
  const [hoverValues, setHoverValues] = useState<{
    rs?: number;
    ma50?: number;
    mansfield?: number;
    oneil?: number;
  }>({});

  // 1. Fetch VNINDEX & Calculate Dataset
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    fetchVNIndexCandles().then((vniCandles) => {
      if (isCancelled) return;
      setIsLoading(false);

      if (vniCandles.length > 0 && stockCandles.length > 0) {
        const ds = calculateRSTemplate(stockCandles, vniCandles);
        setDataset(ds);
        setHoverValues({
          rs: ds.currentRS,
          ma50: ds.currentMA50,
          mansfield: ds.currentMansfield,
          oneil: ds.currentOneilScore,
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [stockCandles, selectedSymbol]);

  // 2. Initialize and Synchronize the 3 Sub-Chart Panes
  useEffect(() => {
    if (!dataset || isLoading) return;

    const c1 = containerPane1Ref.current;
    const c2 = containerPane2Ref.current;
    const c3 = containerPane3Ref.current;
    if (!c1 || !c2 || !c3) return;

    // Cleanup previous chart instances if any
    [chartPane1Ref, chartPane2Ref, chartPane3Ref].forEach((ref) => {
      if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
    });

    const commonOptions = {
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
      timeScale: {
        visible: false,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignLabels: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    };

    const width = c1.clientWidth || 600;
    const height = 90; // Compact pane height for clean 3-stack

    // ── Pane 1: RS Line vs VNINDEX (with MA50) ─────────────────────────
    const chart1 = createChart(c1, {
      ...commonOptions,
      width,
      height,
    });
    chartPane1Ref.current = chart1;

    // Dashed reference baseline
    const refLineSeries = chart1.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.15)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // MA50 of RS Line (Blue)
    const ma50Series = chart1.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
      title: 'MA50',
    });

    // RS Line (Yellow / Amber)
    const rsSeries = chart1.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: '#f59e0b',
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
      title: 'RS',
    });

    const rsLineData: LineData<Time>[] = dataset.rsPoints.map((p) => ({ time: p.time, value: p.rs }));
    const ma50LineData: LineData<Time>[] = dataset.rsPoints
      .filter((p) => p.ma50 !== undefined)
      .map((p) => ({ time: p.time, value: p.ma50 as number }));

    // Baseline reference (median or 100)
    const refBaselineData: LineData<Time>[] = rsLineData.map((d) => ({ time: d.time, value: 100 }));
    refLineSeries.setData(refBaselineData);
    ma50Series.setData(ma50LineData);
    rsSeries.setData(rsLineData);

    // ── Pane 2: Mansfield RS (Stan Weinstein Histogram) ────────────────
    const chart2 = createChart(c2, {
      ...commonOptions,
      width,
      height,
    });
    chartPane2Ref.current = chart2;

    const zeroRefSeries = chart2.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.2)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const mansfieldSeries = chart2.addSeries(HistogramSeries, {
      priceFormat: { type: 'custom', formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}` },
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: '#2dd4bf',
      title: 'Mansfield',
    });

    const mansfieldData: HistogramData<Time>[] = dataset.mansfieldPoints.map((p) => ({
      time: p.time,
      value: p.value,
      color: p.color,
    }));

    const zeroLineData: LineData<Time>[] = mansfieldData.map((d) => ({ time: d.time, value: 0 }));
    zeroRefSeries.setData(zeroLineData);
    mansfieldSeries.setData(mansfieldData);

    // ── Pane 3: RS Score (O'Neil 1-99) ─────────────────────────────────
    const chart3 = createChart(c3, {
      ...commonOptions,
      width,
      height,
      timeScale: {
        visible: false, // hidden time scale to keep alignment pristine
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
    });
    chartPane3Ref.current = chart3;

    // Guideline at 80 (Leader Threshold - Green)
    const line80 = chart3.addSeries(LineSeries, {
      color: 'rgba(16, 185, 129, 0.25)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Guideline at 70 (Minervini Stage 2 Threshold - Amber)
    const line70 = chart3.addSeries(LineSeries, {
      color: 'rgba(245, 158, 11, 0.25)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Guideline at 50 (Median Baseline - Gray)
    const line50 = chart3.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.12)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // O'Neil RS Score Line (Yellow / Golden)
    const oneilSeries = chart3.addSeries(LineSeries, {
      color: '#fbbf24',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(0) },
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: '#fbbf24',
      title: 'RS Score',
    });

    const oneilLineData: LineData<Time>[] = dataset.oneilPoints.map((p) => ({ time: p.time, value: p.score }));
    line80.setData(oneilLineData.map((d) => ({ time: d.time, value: 80 })));
    line70.setData(oneilLineData.map((d) => ({ time: d.time, value: 70 })));
    line50.setData(oneilLineData.map((d) => ({ time: d.time, value: 50 })));
    oneilSeries.setData(oneilLineData);

    // ── Synchronization: Bidirectional TimeScale with Main Chart ───────
    const subCharts = [chart1, chart2, chart3];

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

    // ── Synchronization: Crosshair Hover Data Inspection ───────────────
    const handleCrosshairMove = (param: any) => {
      if (!param || !param.time || !param.seriesData) return;

      const rsVal = param.seriesData.get(rsSeries)?.value;
      const ma50Val = param.seriesData.get(ma50Series)?.value;
      const mansfieldVal = param.seriesData.get(mansfieldSeries)?.value;
      const oneilVal = param.seriesData.get(oneilSeries)?.value;

      setHoverValues((prev) => ({
        rs: typeof rsVal === 'number' ? rsVal : prev.rs,
        ma50: typeof ma50Val === 'number' ? ma50Val : prev.ma50,
        mansfield: typeof mansfieldVal === 'number' ? mansfieldVal : prev.mansfield,
        oneil: typeof oneilVal === 'number' ? oneilVal : prev.oneil,
      }));
    };

    subCharts.forEach((sc) => sc.subscribeCrosshairMove(handleCrosshairMove));
    if (mainChart) {
      mainChart.subscribeCrosshairMove(handleCrosshairMove);
    }

    // Resize Observer for all 3 panes
    const resizeObserver = new ResizeObserver((entries) => {
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

    resizeObserver.observe(c1);

    return () => {
      resizeObserver.disconnect();
      subCharts.forEach((sc) => sc.remove());
      chartPane1Ref.current = null;
      chartPane2Ref.current = null;
      chartPane3Ref.current = null;
    };
  }, [dataset, isLoading, mainChart]);

  // Status badges
  const isAboveMA50 = (hoverValues.rs ?? 0) >= (hoverValues.ma50 ?? 0);
  const isMansfieldPositive = (hoverValues.mansfield ?? 0) >= 0;
  const isLeaderOneil = (hoverValues.oneil ?? 50) >= 80;

  return (
    <div className="w-full border-t border-zinc-800/80 bg-zinc-950 flex flex-col relative shrink-0 select-none">
      {/* Top Banner Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/90 border-b border-zinc-800/80 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <Sparkle className="w-4 h-4 text-amber-400" weight="fill" />
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            BỘ TEMPLATE RS (3-IN-1)
          </span>
          <span className="text-[10px] text-zinc-500 font-normal hidden sm:inline">
            • O'Neil & Stan Weinstein Leading Methodology vs VNINDEX
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchIndicator && (
            <div className="flex items-center gap-1 mr-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold mr-1 hidden md:inline">Chỉ báo:</span>
              {[
                { id: 'rs_template', label: '⚡ Template RS' },
                { id: 'rsi', label: 'RSI Phân kỳ' },
                { id: 'macd', label: 'MACD' },
                { id: 'mfi', label: 'MFI' },
                { id: 'obv', label: 'OBV' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onSwitchIndicator(tab.id as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    tab.id === 'rs_template'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Đóng Template RS"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[285px] w-full flex items-center justify-center text-xs font-mono text-zinc-500 animate-pulse">
          Đang đồng bộ nến VN-INDEX và tính toán bộ chỉ báo RS Template...
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-800/60">
          {/* ── PANE 1: RS Line vs VNINDEX (with MA50) ─────────────────── */}
          <div className="w-full flex flex-col bg-zinc-950/60">
            {/* Header Telemetry */}
            <div className="flex items-center justify-between px-3 py-0.5 text-[11px] font-mono bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="font-bold text-zinc-200 text-xs">RS Line vs VNINDEX</span>
                <span className="text-amber-400 font-bold ml-1">
                  RS: {hoverValues.rs !== undefined ? hoverValues.rs.toFixed(1) : '--'}
                </span>
                <span className="text-blue-400 font-bold ml-1">
                  MA50: {hoverValues.ma50 !== undefined ? hoverValues.ma50.toFixed(1) : '--'}
                </span>
              </div>
              <div>
                <span
                  className={`text-[9.5px] px-2 py-0.2 rounded font-bold border ${
                    isAboveMA50
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {isAboveMA50 ? '▲ VƯỢT MA50 (DẪN DẮT)' : '▼ DƯỚI MA50'}
                </span>
              </div>
            </div>
            {/* Chart Canvas */}
            <div ref={containerPane1Ref} className="w-full h-[90px]" />
          </div>

          {/* ── PANE 2: Mansfield RS (Stan Weinstein Histogram) ───────── */}
          <div className="w-full flex flex-col bg-zinc-950/60">
            {/* Header Telemetry */}
            <div className="flex items-center justify-between px-3 py-0.5 text-[11px] font-mono bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                <span className="font-bold text-zinc-200 text-xs">Mansfield RS</span>
                <span
                  className={`font-bold ml-1 ${
                    isMansfieldPositive ? 'text-teal-400' : 'text-teal-600'
                  }`}
                >
                  Mansfield:{' '}
                  {hoverValues.mansfield !== undefined
                    ? `${hoverValues.mansfield > 0 ? '+' : ''}${hoverValues.mansfield.toFixed(2)}`
                    : '--'}
                </span>
              </div>
              <div>
                <span
                  className={`text-[9.5px] px-2 py-0.2 rounded font-bold border ${
                    isMansfieldPositive
                      ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                  }`}
                >
                  {isMansfieldPositive ? '★ OUTPERFORM VNINDEX' : 'UNDERPERFORM VNINDEX'}
                </span>
              </div>
            </div>
            {/* Chart Canvas */}
            <div ref={containerPane2Ref} className="w-full h-[90px]" />
          </div>

          {/* ── PANE 3: RS Score (William O'Neil 1-99) ────────────────── */}
          <div className="w-full flex flex-col bg-zinc-950/60">
            {/* Header Telemetry */}
            <div className="flex items-center justify-between px-3 py-0.5 text-[11px] font-mono bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                <span className="font-bold text-zinc-200 text-xs">RS Score (O'Neil)</span>
                <span className="text-yellow-400 font-bold ml-1">
                  RS Score: {hoverValues.oneil !== undefined ? hoverValues.oneil.toFixed(0) : '--'}
                </span>
              </div>
              <div>
                <span
                  className={`text-[9.5px] px-2 py-0.2 rounded font-bold border ${
                    isLeaderOneil
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : (hoverValues.oneil ?? 50) >= 70
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                  }`}
                >
                  {isLeaderOneil
                    ? 'SIÊU CỔ PHIẾU (RS ≥ 80)'
                    : (hoverValues.oneil ?? 50) >= 70
                    ? 'MINERVINI STAGE 2 (RS ≥ 70)'
                    : 'BÌNH THƯỜNG'}
                </span>
              </div>
            </div>
            {/* Chart Canvas */}
            <div ref={containerPane3Ref} className="w-full h-[90px]" />
          </div>
        </div>
      )}
    </div>
  );
};
