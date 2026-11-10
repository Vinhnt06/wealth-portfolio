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
import { X, Sparkle, CaretDown, Minus } from '@phosphor-icons/react';
import { calculateRSTemplate, RSTemplateDataset } from '../utils/rsIndicators';

export type RSTemplateViewMode = 'all' | 'rs_line' | 'mansfield' | 'oneil';

interface RSTemplateSubChartProps {
  stockCandles: CandlestickData<Time>[];
  mainChart: IChartApi | null;
  onClose: () => void;
  selectedSymbol: string;
  initialView?: RSTemplateViewMode;
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
  initialView = 'all',
}) => {
  const containerPane1Ref = useRef<HTMLDivElement>(null);
  const containerPane2Ref = useRef<HTMLDivElement>(null);
  const containerPane3Ref = useRef<HTMLDivElement>(null);

  const chartPane1Ref = useRef<IChartApi | null>(null);
  const chartPane2Ref = useRef<IChartApi | null>(null);
  const chartPane3Ref = useRef<IChartApi | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<RSTemplateDataset | null>(null);
  const [activeView, setActiveView] = useState<RSTemplateViewMode>(initialView);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync activeView with initialView prop changes
  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);

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

  // 2. Initialize and Synchronize Sub-Chart Panes
  useEffect(() => {
    if (!dataset || isLoading || isCollapsed) return;

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

    const subCharts: IChartApi[] = [];
    let rsSeriesInstance: any = null;
    let ma50SeriesInstance: any = null;
    let mansfieldSeriesInstance: any = null;
    let oneilSeriesInstance: any = null;

    const paneHeight = activeView === 'all' ? 72 : 105;

    // ── PANE 1: RS Line vs VNINDEX (with MA50) ─────────────────────────
    if (activeView === 'all' || activeView === 'rs_line') {
      const c1 = containerPane1Ref.current;
      if (c1) {
        const width = c1.clientWidth || 600;
        const chart1 = createChart(c1, {
          ...commonOptions,
          width,
          height: paneHeight,
        });
        chartPane1Ref.current = chart1;
        subCharts.push(chart1);

        const refLineSeries = chart1.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.15)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const ma50Series = chart1.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
          title: 'MA50',
        });

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

        const refBaselineData: LineData<Time>[] = rsLineData.map((d) => ({ time: d.time, value: 100 }));
        refLineSeries.setData(refBaselineData);
        ma50Series.setData(ma50LineData);
        rsSeries.setData(rsLineData);

        rsSeriesInstance = rsSeries;
        ma50SeriesInstance = ma50Series;
      }
    }

    // ── PANE 2: Mansfield RS (Stan Weinstein Histogram) ───────────────
    if (activeView === 'all' || activeView === 'mansfield') {
      const c2 = containerPane2Ref.current;
      if (c2) {
        const width = c2.clientWidth || 600;
        const chart2 = createChart(c2, {
          ...commonOptions,
          width,
          height: paneHeight,
        });
        chartPane2Ref.current = chart2;
        subCharts.push(chart2);

        const zeroRefSeries = chart2.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.2)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const mansfieldSeries = chart2.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
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

        mansfieldSeriesInstance = mansfieldSeries;
      }
    }

    // ── PANE 3: RS Score (William O'Neil 1-99) ──────────────────────────
    if (activeView === 'all' || activeView === 'oneil') {
      const c3 = containerPane3Ref.current;
      if (c3) {
        const width = c3.clientWidth || 600;
        const chart3 = createChart(c3, {
          ...commonOptions,
          width,
          height: paneHeight,
          timeScale: {
            visible: true,
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        });
        chartPane3Ref.current = chart3;
        subCharts.push(chart3);

        const line80 = chart3.addSeries(LineSeries, {
          color: 'rgba(16, 185, 129, 0.4)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const line70 = chart3.addSeries(LineSeries, {
          color: 'rgba(245, 158, 11, 0.35)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const line50 = chart3.addSeries(LineSeries, {
          color: 'rgba(255, 255, 255, 0.15)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
        });

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

        oneilSeriesInstance = oneilSeries;
      }
    }

    if (subCharts.length === 0) return;

    let isDisposed = false;
    let rafId: number | null = null;
    const cleanups: Array<() => void> = [];

    // ── Synchronization: Bidirectional TimeScale with Main Chart ───────
    let isSyncing = false;
    const syncTimeScale = (sourceChart: IChartApi, targets: (IChartApi | null)[]) => {
      const handler = (range: any) => {
        if (isDisposed || isSyncing || !range) return;
        isSyncing = true;
        targets.forEach((target) => {
          if (target && target !== sourceChart && !isDisposed) {
            try {
              target.timeScale().setVisibleLogicalRange(range);
            } catch {}
          }
        });
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
      syncTimeScale(mainChart, subCharts);
      subCharts.forEach((sc) => syncTimeScale(sc, [mainChart, ...subCharts]));

      // Align initial logical range immediately
      rafId = requestAnimationFrame(() => {
        if (isDisposed) return;
        try {
          const mainRange = mainChart.timeScale().getVisibleLogicalRange();
          if (mainRange) {
            subCharts.forEach((sc) => {
              try {
                sc.timeScale().setVisibleLogicalRange(mainRange);
              } catch {}
            });
          }
        } catch {}
      });
    }

    // ── Synchronization: Crosshair Hover Data Inspection ───────────────
    const handleCrosshairMove = (param: any) => {
      if (isDisposed || !param || !param.time || !param.seriesData) return;

      try {
        const rsVal = rsSeriesInstance ? param.seriesData.get(rsSeriesInstance)?.value : undefined;
        const ma50Val = ma50SeriesInstance ? param.seriesData.get(ma50SeriesInstance)?.value : undefined;
        const mansfieldVal = mansfieldSeriesInstance ? param.seriesData.get(mansfieldSeriesInstance)?.value : undefined;
        const oneilVal = oneilSeriesInstance ? param.seriesData.get(oneilSeriesInstance)?.value : undefined;

        setHoverValues((prev) => ({
          rs: typeof rsVal === 'number' ? rsVal : prev.rs,
          ma50: typeof ma50Val === 'number' ? ma50Val : prev.ma50,
          mansfield: typeof mansfieldVal === 'number' ? mansfieldVal : prev.mansfield,
          oneil: typeof oneilVal === 'number' ? oneilVal : prev.oneil,
        }));
      } catch {}
    };

    subCharts.forEach((sc) => {
      try {
        sc.subscribeCrosshairMove(handleCrosshairMove);
        cleanups.push(() => {
          try {
            sc.unsubscribeCrosshairMove(handleCrosshairMove);
          } catch {}
        });
      } catch {}
    });

    if (mainChart) {
      try {
        mainChart.subscribeCrosshairMove(handleCrosshairMove);
        cleanups.push(() => {
          try {
            mainChart.unsubscribeCrosshairMove(handleCrosshairMove);
          } catch {}
        });
      } catch {}
    }

    // Resize Observer for mounted panes
    const firstContainer = containerPane1Ref.current || containerPane2Ref.current || containerPane3Ref.current;
    let resizeObserver: ResizeObserver | null = null;
    if (firstContainer) {
      resizeObserver = new ResizeObserver((entries) => {
        if (isDisposed) return;
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            subCharts.forEach((sc) => {
              if (!isDisposed) {
                try {
                  sc.applyOptions({ width: w });
                } catch {}
              }
            });
            if (mainChart && !isDisposed) {
              try {
                const range = mainChart.timeScale().getVisibleLogicalRange();
                if (range) {
                  subCharts.forEach((sc) => {
                    try {
                      sc.timeScale().setVisibleLogicalRange(range);
                    } catch {}
                  });
                }
              } catch {}
            }
          }
        }
      });
      resizeObserver.observe(firstContainer);
    }

    return () => {
      isDisposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      subCharts.forEach((sc) => {
        try {
          sc.remove();
        } catch {}
      });
      chartPane1Ref.current = null;
      chartPane2Ref.current = null;
      chartPane3Ref.current = null;
    };
  }, [dataset, isLoading, mainChart, activeView, isCollapsed]);

  // Status badges & Consensus Calculation
  const isAboveMA50 = (hoverValues.rs ?? 0) >= (hoverValues.ma50 ?? 0);
  const isMansfieldPositive = (hoverValues.mansfield ?? 0) >= 0;
  const isLeaderOneil = (hoverValues.oneil ?? 50) >= 80;
  const isStrongOneil = (hoverValues.oneil ?? 50) >= 70;
  const isOneilBull = (hoverValues.oneil ?? 50) >= 70;

  const rsFactors = [
    { id: 'rs_line', name: 'RS > MA50', bull: isAboveMA50, desc: isAboveMA50 ? 'VƯỢT MA50' : 'DƯỚI MA50' },
    { id: 'mansfield', name: 'MANSFIELD RS', bull: isMansfieldPositive, desc: isMansfieldPositive ? 'OUTPERFORM' : 'UNDERPERFORM' },
    { id: 'oneil', name: "O'NEIL SCORE", bull: isOneilBull, desc: isLeaderOneil ? 'RS ≥ 80' : isStrongOneil ? 'RS ≥ 70' : 'RS < 70' },
  ];
  const rsBullCount = rsFactors.filter((f) => f.bull).length;

  const rsVerdictText =
    rsBullCount === 3
      ? 'SIÊU DẪN DẮT'
      : rsBullCount === 2
      ? 'MẠNH HƠN THỊ TRƯỜNG'
      : rsBullCount === 1
      ? 'PHÂN HOÁ'
      : 'YẾU HƠN THỊ TRƯỜNG';

  const rsVerdictClass =
    rsBullCount === 3
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
      : rsBullCount === 2
      ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
      : rsBullCount === 1
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

  return (
    <div className="w-full border-t border-zinc-800/80 bg-zinc-950 flex flex-col relative shrink-0 select-none">
      {/* ── Top Header Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/90 border-b border-zinc-800/80 text-[11px] font-mono">
        {/* Left: Title + Consensus Badge + Telemetry */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkle className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="fill" />
            <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
              {activeView === 'all'
                ? '⚡ SỨC MẠNH GIÁ RS'
                : activeView === 'rs_line'
                ? '⚡ RS LINE VS VNINDEX'
                : activeView === 'mansfield'
                ? '⚡ MANSFIELD RS HISTOGRAM'
                : '⚡ O\'NEIL RS SCORE (1-99)'}
            </span>
          </div>

          {/* Consensus Count Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border tabular-nums ${rsVerdictClass}`}
              title="Đánh giá tổng quan độ đồng thuận của 3 chỉ báo sức mạnh giá RS (RS Line, Mansfield RS, O'Neil Score)"
            >
              ĐỒNG THUẬN: {rsBullCount}/3 CHỈ BÁO TĂNG • {rsVerdictText}
            </span>

            {/* 3-Factor Signal Matrix Strip (Desktop) */}
            <div className="hidden xl:flex items-center divide-x divide-zinc-800 border border-zinc-800 bg-zinc-950 rounded text-[9.5px] tabular-nums">
              {rsFactors.map((f) => (
                <span
                  key={f.id}
                  className={`px-1.5 py-0.5 font-semibold ${f.bull ? 'text-emerald-400' : 'text-rose-400'}`}
                  title={`${f.name}: ${f.desc}`}
                >
                  {f.name} {f.bull ? '▲' : '▼'}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Telemetry Summary when in single-pane or collapsed */}
          <div className="hidden 2xl:flex items-center gap-2 ml-1 text-[10.5px]">
            {(activeView === 'all' || activeView === 'rs_line') && (
              <span className="text-amber-400 font-bold">
                RS: {hoverValues.rs !== undefined ? hoverValues.rs.toFixed(1) : '--'}
                <span className="text-blue-400 font-normal ml-1">
                  (MA50: {hoverValues.ma50 !== undefined ? hoverValues.ma50.toFixed(1) : '--'})
                </span>
              </span>
            )}
            {(activeView === 'all' || activeView === 'mansfield') && (
              <span className={`font-bold ${isMansfieldPositive ? 'text-teal-400' : 'text-teal-600'}`}>
                Mansfield: {hoverValues.mansfield !== undefined ? `${hoverValues.mansfield > 0 ? '+' : ''}${hoverValues.mansfield.toFixed(2)}` : '--'}
              </span>
            )}
            {(activeView === 'all' || activeView === 'oneil') && (
              <span className="text-yellow-400 font-bold">
                RS Score: {hoverValues.oneil !== undefined ? hoverValues.oneil.toFixed(0) : '--'}
              </span>
            )}
          </div>
        </div>

        {/* Center: View Switcher Pills */}
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 text-[9.5px] uppercase font-bold mr-1 hidden md:inline">Chế độ:</span>
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'rs_line', label: 'RS Line' },
              { id: 'mansfield', label: 'Mansfield' },
              { id: 'oneil', label: 'RS Score' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveView(tab.id);
                setIsCollapsed(false);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                activeView === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Minimize & Close Controls */}
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title={isCollapsed ? 'Mở rộng đồ thị RS' : 'Thu gọn đồ thị RS để phóng to chart chính'}
          >
            {isCollapsed ? <CaretDown size={14} /> : <Minus size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Đóng Template RS"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Sub-Chart Body ────────────────────────────────────────────── */}
      {isCollapsed ? null : isLoading ? (
        <div className="h-[120px] w-full flex items-center justify-center text-xs font-mono text-zinc-500 animate-pulse">
          Đang đồng bộ nến VN-INDEX và tính toán bộ chỉ báo RS Template...
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-800/60">
          {/* PANE 1: RS Line vs VNINDEX (with MA50) */}
          {(activeView === 'all' || activeView === 'rs_line') && (
            <div className="w-full flex flex-col bg-zinc-950/60">
              <div className="flex items-center justify-between px-3 py-0.5 text-[10.5px] font-mono bg-zinc-900/40">
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
              <div ref={containerPane1Ref} className={`w-full ${activeView === 'all' ? 'h-[72px]' : 'h-[105px]'}`} />
            </div>
          )}

          {/* PANE 2: Mansfield RS (Stan Weinstein Histogram) */}
          {(activeView === 'all' || activeView === 'mansfield') && (
            <div className="w-full flex flex-col bg-zinc-950/60">
              <div className="flex items-center justify-between px-3 py-0.5 text-[10.5px] font-mono bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                  <span className="font-bold text-zinc-200 text-xs">Mansfield RS</span>
                  <span className={`font-bold ml-1 ${isMansfieldPositive ? 'text-teal-400' : 'text-teal-600'}`}>
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
              <div ref={containerPane2Ref} className={`w-full ${activeView === 'all' ? 'h-[72px]' : 'h-[105px]'}`} />
            </div>
          )}

          {/* PANE 3: RS Score (William O'Neil 1-99) */}
          {(activeView === 'all' || activeView === 'oneil') && (
            <div className="w-full flex flex-col bg-zinc-950/60">
              <div className="flex items-center justify-between px-3 py-0.5 text-[10.5px] font-mono bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                  <span className="font-bold text-zinc-200 text-xs">RS Score (O'Neil)</span>
                  <span className="text-yellow-400 font-bold ml-1">
                    Score: {hoverValues.oneil !== undefined ? hoverValues.oneil.toFixed(0) : '--'}
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
              <div ref={containerPane3Ref} className={`w-full ${activeView === 'all' ? 'h-[72px]' : 'h-[105px]'}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
