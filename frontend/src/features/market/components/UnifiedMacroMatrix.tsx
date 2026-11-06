'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe,
  ArrowsClockwise,
  Bank,
  Coins,
  Scales,
  CaretDown,
  CaretUp,
  ChartLineUp,
  WarningCircle,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { MacroChartModal, MacroIndicatorTarget } from './MacroChartModal';

const EconomicCycleWheel = dynamic(
  () => import('./EconomicCycleWheel').then((m) => m.EconomicCycleWheel),
  { ssr: false }
);

/* ───────────────────────────── Types ───────────────────────────── */

interface UsMarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit?: string;
}

interface CommodityItem {
  id: string;
  name: string;
  category: string;
  price: number | string;
  unit: string;
  change: number;
  changePercent?: number;
  buyPrice?: number;
  sellPrice?: number;
  spread?: number;
  brand?: string;
}

interface ExchangeRateItem {
  pair: string;
  name: string;
  sell: number;
  change: number;
  changePercent: number;
}

interface GdpPoint {
  period: string;
  growthRate: number;
  target: number;
}

interface CpiPoint {
  period: string;
  yoy: number;
  mom: number;
  target: number;
}

interface MacroIndicators {
  gdp?: GdpPoint;
  cpi?: CpiPoint;
  refiRate?: number;
  /** true only when the numbers come from the verified database (not the local baseline file) */
  verified: boolean;
  source: string;
}

type SectionKey = 'us' | 'commodities' | 'rates' | 'indicators' | 'bank';

/* ───────────────────────────── Helpers ───────────────────────────── */

// Which history ids exist in /api/macro/history (used for chart modal + sparklines)
const US_HISTORY_ID: Record<string, string> = {
  '^GSPC': 'sp500',
  '^IXIC': 'nasdaq',
  '^DJI': 'dow',
  '^TNX': 'us10y',
  'DX-Y.NYB': 'dxy',
  '^VIX': 'vix',
};

const SPARK_IDS = ['usdvnd', 'us10y', 'vix', 'sp500', 'nasdaq', 'dow', 'dxy', 'gold_world', 'silver', 'brent', 'wti'];

const BIG4_PATTERN = /vietcombank|bidv|vietinbank|agribank/i;

const viNum = (v: number, digits = 2) =>
  v.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const enNum = (v: number, digits = 2) =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const toMillion = (v?: number) => (v === undefined || v === null ? undefined : v / 1_000_000);

function periodKey(period: string): number {
  const m = period.match(/(\d{1,2})\s*\/\s*(\d{4})/);
  return m ? Number(m[2]) * 100 + Number(m[1]) : -1;
}

function latestByPeriod<T extends { period: string }>(list: T[] | undefined): T | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return [...list].sort((a, b) => periodKey(b.period) - periodKey(a.period))[0];
}

function parsePercentText(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return raw;
  const n = parseFloat(raw.replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function vixSentiment(vix: number): { label: string; tone: 'gain' | 'warn' | 'loss' } {
  if (vix < 15) return { label: 'Tâm lý lạc quan', tone: 'gain' };
  if (vix < 20) return { label: 'Tâm lý ổn định', tone: 'gain' };
  if (vix < 30) return { label: 'Thận trọng', tone: 'warn' };
  return { label: 'Hoảng loạn', tone: 'loss' };
}

function assessCycle(gdp?: GdpPoint, cpi?: CpiPoint): string | null {
  if (!gdp || !cpi) return null;
  const growthOk = gdp.growthRate >= gdp.target;
  const inflationOk = cpi.yoy <= cpi.target;
  if (growthOk && inflationOk) return 'Tăng trưởng vượt mục tiêu, lạm phát trong tầm kiểm soát';
  if (growthOk) return 'Tăng trưởng vượt mục tiêu, lạm phát vượt trần';
  if (inflationOk) return 'Tăng trưởng dưới mục tiêu, lạm phát thấp';
  return 'Tăng trưởng dưới mục tiêu, lạm phát vượt trần';
}

const TONE_TEXT = { gain: 'text-emerald-400', warn: 'text-amber-300', loss: 'text-rose-400' } as const;

/* ───────────────────────────── Small UI parts ───────────────────────────── */

function Sparkline({ values, width = 72, height = 26 }: { values?: number[]; width?: number; height?: number }) {
  if (!values || values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#10b981' : '#f43f5e'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Delta({ pct }: { pct?: number | null }) {
  if (pct === undefined || pct === null || Number.isNaN(pct)) {
    return <span className="font-mono text-[11px] text-zinc-600">—</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
        up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
      }`}
    >
      {up ? <CaretUp size={9} weight="fill" /> : <CaretDown size={9} weight="fill" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-800/60 ${className}`} />;
}

function PanelHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-zinc-200">
        <span className="text-zinc-500">{icon}</span>
        {title}
      </div>
      {right}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
      <WarningCircle size={14} className="shrink-0 text-zinc-600" />
      {children}
    </div>
  );
}

interface KpiTileProps {
  id: string;
  label: string;
  hint: string;
  value?: string;
  unit?: string;
  pct?: number;
  spark?: number[];
  loading: boolean;
  onClick?: () => void;
  footnote?: React.ReactNode;
}

function KpiTile({ id, label, hint, value, unit, pct, spark, loading, onClick, footnote }: KpiTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
          <div className="text-[11px] text-zinc-600">{hint}</div>
        </div>
        {onClick && (
          <ChartLineUp size={14} className="text-zinc-700 transition-colors group-hover:text-emerald-400" />
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <div className="font-mono text-[22px] font-semibold leading-none tracking-tight text-zinc-50 tabular-nums">
              {value ?? '—'}
              {value && unit && <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span>}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            {loading ? <Skeleton className="h-5 w-16" /> : <Delta pct={pct} />}
            {footnote}
          </div>
        </div>
        <Sparkline values={spark} />
      </div>
    </>
  );

  const base =
    'group w-full rounded-xl border border-white/[0.08] bg-[#111113] p-4 text-left transition-colors';

  return onClick ? (
    <button id={id} type="button" onClick={onClick} className={`${base} hover:border-emerald-500/30 hover:bg-[#141417]`}>
      {body}
    </button>
  ) : (
    <div id={id} className={base}>
      {body}
    </div>
  );
}

function MetricBar({ value, target, tone }: { value: number; target: number; tone: 'gain' | 'warn' | 'loss' }) {
  const scaleMax = Math.max(value, target) * 1.25 || 1;
  const fill = Math.max(0, Math.min(100, (value / scaleMax) * 100));
  const tick = Math.max(0, Math.min(100, (target / scaleMax) * 100));
  const color = tone === 'gain' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="relative mt-2 h-1.5 w-full rounded-full bg-zinc-800" aria-hidden="true">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${fill}%` }} />
      <div className="absolute -top-1 h-3.5 w-px bg-zinc-300" style={{ left: `${tick}%` }} />
    </div>
  );
}

/* ───────────────────────────── Main component ───────────────────────────── */

export const UnifiedMacroMatrix: React.FC = () => {
  const [usData, setUsData] = useState<UsMarketItem[]>([]);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [rates, setRates] = useState<ExchangeRateItem[]>([]);
  const [indicators, setIndicators] = useState<MacroIndicators | null>(null);
  const [big4Range, setBig4Range] = useState<{ min: number; max: number } | null>(null);
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [failed, setFailed] = useState<Partial<Record<SectionKey, boolean>>>({});

  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [showCycleDeepDive, setShowCycleDeepDive] = useState(false);
  const [activeChartIndicator, setActiveChartIndicator] = useState<MacroIndicatorTarget | null>(null);
  const [goldTab, setGoldTab] = useState<'vn_gold' | 'world_comm'>('vn_gold');

  const fetchAllMacro = useCallback(async () => {
    setLoading(true);
    const nextFailed: Partial<Record<SectionKey, boolean>> = {};

    const getJson = async (url: string, key: SectionKey) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!json.success) throw new Error('not-success');
        return json;
      } catch {
        nextFailed[key] = true;
        return null;
      }
    };

    const [us, comm, fx, ind, bank] = await Promise.all([
      getJson('/api/macro/us-global', 'us'),
      getJson('/api/macro/commodities', 'commodities'),
      getJson('/api/macro/exchange-rate', 'rates'),
      getJson('/api/macro/indicators', 'indicators'),
      getJson('/api/macro/bank-rates', 'bank'),
    ]);

    if (us && Array.isArray(us.indices)) setUsData(us.indices);
    if (comm && Array.isArray(comm.data)) setCommodities(comm.data);
    if (fx && Array.isArray(fx.data)) setRates(fx.data);

    if (ind?.data) {
      const refi = (ind.data.interestRate as Array<{ bank: string; rate: string }> | undefined)?.find((r) =>
        /tái cấp vốn/i.test(r.bank)
      );
      setIndicators({
        gdp: latestByPeriod<GdpPoint>(ind.data.gdp),
        cpi: latestByPeriod<CpiPoint>(ind.data.cpi),
        refiRate: parsePercentText(refi?.rate),
        verified: ind.source === 'supabase',
        source: ind.data.source || 'GSO & SBV',
      });
    }

    if (bank?.data?.counter) {
      const values = (bank.data.counter as Array<{ bank: string; rate12M: string }>)
        .filter((r) => BIG4_PATTERN.test(r.bank))
        .map((r) => parsePercentText(r.rate12M))
        .filter((v): v is number => v !== undefined);
      setBig4Range(values.length ? { min: Math.min(...values), max: Math.max(...values) } : null);
    }

    setFailed(nextFailed);
    setLastRefreshed(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
    setHasLoaded(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllMacro();
    const timer = setInterval(fetchAllMacro, 45000);
    return () => clearInterval(timer);
  }, [fetchAllMacro]);

  // Sparklines: real 1-month history from Yahoo via /api/macro/history, loaded once
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        SPARK_IDS.map(async (id) => {
          try {
            const res = await fetch(`/api/macro/history?id=${id}&range=1mo`);
            if (!res.ok) return null;
            const json = await res.json();
            if (!json.success || !Array.isArray(json.points)) return null;
            return [id, (json.points as Array<{ value: number }>).map((p) => p.value)] as const;
          } catch {
            return null;
          }
        })
      );
      if (!alive) return;
      const map: Record<string, number[]> = {};
      entries.forEach((e) => {
        if (e) map[e[0]] = e[1];
      });
      setSparks(map);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ── Derived data (all from live responses; nothing hardcoded) ── */
  const us = (symbol: string) => usData.find((i) => i.symbol === symbol);
  const usdVnd = rates.find((r) => r.pair === 'USD/VND');
  const vixItem = us('^VIX');
  const us10y = us('^TNX');
  const vnGold = useMemo(() => commodities.filter((c) => c.category === 'gold_vn'), [commodities]);
  const sjc = vnGold.find((g) => g.id === 'gold_sjc') ?? vnGold.find((g) => g.brand === 'SJC');
  const worldRows = ['gold_world', 'silver', 'brent', 'wti']
    .map((id) => commodities.find((c) => c.id === id))
    .filter((c): c is CommodityItem => Boolean(c));
  const cycleText = assessCycle(indicators?.gdp, indicators?.cpi);

  const usTarget = (idx: UsMarketItem): MacroIndicatorTarget => ({
    id: US_HISTORY_ID[idx.symbol] ?? idx.symbol,
    symbol: idx.symbol,
    name: idx.name,
    category: idx.symbol === 'DX-Y.NYB' ? 'currency' : idx.symbol === '^TNX' ? 'yield' : 'equity',
    price: idx.price,
    unit: idx.unit === '%' ? '%' : 'điểm',
    change: idx.change,
    changePercent: idx.changePercent,
  });

  const commodityTarget = (c: CommodityItem): MacroIndicatorTarget => ({
    id: c.id,
    name: c.name,
    category: c.id === 'silver' ? 'metal' : c.id === 'gold_world' ? 'gold_world' : 'oil',
    price: c.price,
    unit: c.unit,
    change: c.change,
    changePercent: c.changePercent,
  });

  const sjcSellM = toMillion(sjc?.sellPrice);
  const sjcChangePct = sjc?.changePercent;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0e]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Vĩ mô &amp; Thị trường toàn cầu</h2>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span>{lastRefreshed ? `Cập nhật ${lastRefreshed}` : 'Đang đồng bộ...'}</span>
          <button
            id="macro-refresh"
            type="button"
            onClick={fetchAllMacro}
            disabled={loading}
            className="rounded-md p-1.5 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
            aria-label="Làm mới dữ liệu vĩ mô"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            id="kpi-usdvnd"
            label="USD/VND"
            hint="Tỷ giá thị trường"
            loading={!hasLoaded}
            value={usdVnd ? viNum(usdVnd.sell, 0) : undefined}
            unit="đ"
            pct={usdVnd?.changePercent}
            spark={sparks.usdvnd}
            onClick={
              usdVnd
                ? () =>
                    setActiveChartIndicator({
                      id: 'usdvnd',
                      symbol: 'USDVND=X',
                      name: 'Tỷ giá USD/VND',
                      category: 'currency',
                      price: usdVnd.sell,
                      unit: 'VNĐ',
                      change: usdVnd.change,
                      changePercent: usdVnd.changePercent,
                    })
                : undefined
            }
          />
          <KpiTile
            id="kpi-sjc"
            label="Vàng SJC"
            hint="Bán ra · triệu đồng/lượng"
            loading={!hasLoaded}
            value={sjcSellM !== undefined ? viNum(sjcSellM, 1) : undefined}
            unit="Tr"
            pct={sjcChangePct}
          />
          <KpiTile
            id="kpi-vix"
            label="VIX"
            hint="Chỉ số sợ hãi"
            loading={!hasLoaded}
            value={vixItem ? enNum(vixItem.price) : undefined}
            pct={vixItem?.changePercent}
            spark={sparks.vix}
            onClick={vixItem ? () => setActiveChartIndicator(usTarget(vixItem)) : undefined}
            footnote={
              vixItem && (
                <span className={`text-[11px] font-medium ${TONE_TEXT[vixSentiment(vixItem.price).tone]}`}>
                  {vixSentiment(vixItem.price).label}
                </span>
              )
            }
          />
          <KpiTile
            id="kpi-us10y"
            label="US 10Y"
            hint="Lợi suất trái phiếu Mỹ"
            loading={!hasLoaded}
            value={us10y ? enNum(us10y.price) : undefined}
            unit="%"
            pct={us10y?.changePercent}
            spark={sparks.us10y}
            onClick={us10y ? () => setActiveChartIndicator(usTarget(us10y)) : undefined}
          />
        </div>

        {/* ── Panels (asymmetric: wide global markets, two narrower columns) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Global markets */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0f0f11] p-4 lg:col-span-5" aria-label="Thị trường quốc tế">
            <PanelHeader icon={<Globe size={15} />} title="Thị trường quốc tế" />
            {!hasLoaded ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : usData.length === 0 ? (
              <EmptyNote>{failed.us ? 'Không tải được dữ liệu thị trường quốc tế.' : 'Chưa có dữ liệu.'}</EmptyNote>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {usData
                  .filter((i) => i.symbol !== '^VIX' && i.symbol !== '^TNX')
                  .map((idx) => (
                    <li key={idx.symbol}>
                      <button
                        type="button"
                        onClick={() => setActiveChartIndicator(usTarget(idx))}
                        className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                        aria-label={`Xem biểu đồ ${idx.name}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-zinc-200 group-hover:text-emerald-400">
                            {idx.name}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-600">{idx.symbol}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Sparkline values={sparks[US_HISTORY_ID[idx.symbol]]} width={56} height={22} />
                          <div className="w-[88px] text-right font-mono text-[13px] font-semibold text-zinc-100 tabular-nums">
                            {enNum(idx.price, idx.price < 1000 ? 2 : 1)}
                          </div>
                          <div className="w-[72px] text-right">
                            <Delta pct={idx.changePercent} />
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Vietnam macro */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0f0f11] p-4 lg:col-span-3" aria-label="Vĩ mô Việt Nam">
            <PanelHeader
              icon={<Bank size={15} />}
              title="Vĩ mô Việt Nam"
              right={
                indicators && !indicators.verified ? (
                  <span
                    className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                    title="Số liệu lấy từ file cơ sở nội bộ, chưa được đối chiếu tự động với GSO/NHNN"
                  >
                    Chưa đối chiếu
                  </span>
                ) : undefined
              }
            />
            {!hasLoaded ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !indicators ? (
              <EmptyNote>{failed.indicators ? 'Không tải được chỉ số vĩ mô.' : 'Chưa có dữ liệu.'}</EmptyNote>
            ) : (
              <div className="space-y-4">
                {indicators.gdp && (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-zinc-300">Tăng trưởng GDP</span>
                      <span className="font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                        {viNum(indicators.gdp.growthRate)}%
                      </span>
                    </div>
                    <MetricBar
                      value={indicators.gdp.growthRate}
                      target={indicators.gdp.target}
                      tone={indicators.gdp.growthRate >= indicators.gdp.target ? 'gain' : 'warn'}
                    />
                    <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500">
                      <span>Kỳ {indicators.gdp.period}</span>
                      <span>Mục tiêu {viNum(indicators.gdp.target, 1)}%</span>
                    </div>
                  </div>
                )}

                {indicators.cpi && (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-zinc-300">Lạm phát CPI (YoY)</span>
                      <span className="font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                        {viNum(indicators.cpi.yoy)}%
                      </span>
                    </div>
                    <MetricBar
                      value={indicators.cpi.yoy}
                      target={indicators.cpi.target}
                      tone={indicators.cpi.yoy <= indicators.cpi.target ? 'gain' : 'loss'}
                    />
                    <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500">
                      <span>Kỳ {indicators.cpi.period}</span>
                      <span>Trần {viNum(indicators.cpi.target, 1)}%</span>
                    </div>
                  </div>
                )}

                {indicators.refiRate !== undefined && (
                  <div className="flex items-baseline justify-between border-t border-white/[0.05] pt-3">
                    <span className="text-[13px] text-zinc-300">Lãi suất tái cấp vốn</span>
                    <span className="font-mono text-lg font-semibold text-amber-300 tabular-nums">
                      {viNum(indicators.refiRate)}%
                    </span>
                  </div>
                )}

                <div className="border-t border-white/[0.05] pt-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-600">Đánh giá nhanh</div>
                  <div className="mt-1 text-xs leading-relaxed text-zinc-300">
                    {cycleText ?? 'Chưa đủ dữ liệu để đánh giá.'}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-600">Nguồn: {indicators.source}</div>
                </div>
              </div>
            )}
          </section>

          {/* Gold & commodities */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0f0f11] p-4 lg:col-span-4" aria-label="Vàng và hàng hóa">
            <PanelHeader
              icon={<Coins size={15} />}
              title="Vàng & hàng hóa"
              right={
                <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#09090b] p-0.5">
                  {([
                    ['vn_gold', 'Vàng VN'],
                    ['world_comm', 'Thế giới'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      id={`gold-tab-${key}`}
                      type="button"
                      onClick={() => setGoldTab(key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        goldTab === key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            />

            {!hasLoaded ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : goldTab === 'vn_gold' ? (
              vnGold.length === 0 ? (
                <EmptyNote>{failed.commodities ? 'Không tải được giá vàng trong nước.' : 'Chưa có dữ liệu giá vàng.'}</EmptyNote>
              ) : (
                <ul className="max-h-[264px] divide-y divide-white/[0.05] overflow-y-auto pr-1">
                  {vnGold.slice(0, 8).map((g) => {
                    const sell = toMillion(g.sellPrice);
                    const buy = toMillion(g.buyPrice);
                    return (
                      <li key={g.id} className="px-1 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              {g.brand}
                            </span>
                            <span className="truncate text-[13px] text-zinc-200">{g.name}</span>
                          </div>
                          <span className="shrink-0 font-mono text-[13px] font-semibold text-amber-300 tabular-nums">
                            {sell !== undefined ? viNum(sell, 1) : '—'}
                            <span className="ml-1 text-[10px] font-normal text-zinc-500">Tr</span>
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between pl-1 font-mono text-[10px] text-zinc-500">
                          <span>
                            Mua {buy !== undefined ? viNum(buy, 1) : '—'} · Bán {sell !== undefined ? viNum(sell, 1) : '—'}
                          </span>
                          <Delta pct={g.changePercent} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : worldRows.length === 0 ? (
              <EmptyNote>{failed.commodities ? 'Không tải được giá hàng hóa thế giới.' : 'Chưa có dữ liệu.'}</EmptyNote>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {worldRows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveChartIndicator(commodityTarget(c))}
                      className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                      aria-label={`Xem biểu đồ ${c.name}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-zinc-200 group-hover:text-amber-300">
                          {c.name}
                        </div>
                        <div className="text-[10px] text-zinc-600">{c.unit}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Sparkline values={sparks[c.id]} width={48} height={22} />
                        <div className="w-[72px] text-right font-mono text-[13px] font-semibold text-zinc-100 tabular-nums">
                          {enNum(Number(c.price))}
                        </div>
                        <div className="w-[66px] text-right">
                          <Delta pct={c.changePercent} />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[11px] text-zinc-500">
              <span>Lãi suất tiền gửi 12T (Big 4)</span>
              <span className="font-mono font-semibold text-amber-300 tabular-nums">
                {big4Range
                  ? big4Range.min === big4Range.max
                    ? `${viNum(big4Range.min)}%`
                    : `${viNum(big4Range.min)}% – ${viNum(big4Range.max)}%`
                  : '—'}
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* ── Collapsible deep dive: Economic cycle wheel ── */}
      <div className="border-t border-white/[0.06] bg-[#0a0a0c]">
        <button
          id="macro-cycle-toggle"
          type="button"
          onClick={() => setShowCycleDeepDive((prev) => !prev)}
          className="flex w-full items-center justify-between px-5 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <span className="flex items-center gap-2">
            <Scales size={15} className="text-emerald-400" />
            Mô hình chu kỳ kinh tế &amp; phân bổ tài sản
          </span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            {showCycleDeepDive ? 'Thu gọn' : 'Xem chi tiết'}
            {showCycleDeepDive ? <CaretUp size={13} /> : <CaretDown size={13} />}
          </span>
        </button>
        {showCycleDeepDive && (
          <div className="animate-in fade-in border-t border-white/[0.06] p-5 duration-200">
            <EconomicCycleWheel />
          </div>
        )}
      </div>

      <MacroChartModal indicator={activeChartIndicator} onClose={() => setActiveChartIndicator(null)} />
    </div>
  );
};

UnifiedMacroMatrix.displayName = 'UnifiedMacroMatrix';
