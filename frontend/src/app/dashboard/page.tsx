'use client';

import { useState, useEffect } from 'react';

import { DashboardLayout } from '../components/layout/DashboardLayout';
import { TradingViewChart } from '../components/TradingViewChart';
import { motion } from 'framer-motion';
import { CandlestickData } from 'lightweight-charts';
import { useLanguage } from '../components/LanguageContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { Shield, Target, Plus, TrendUp } from '@phosphor-icons/react';

// ── Data Configuration ──────────────────────────────────────
const generateMockData = (): CandlestickData[] => {
    const data: CandlestickData[] = [];
    let basePrice = 50000;
    const now = Math.floor(Date.now() / 1000);
    for (let i = 100; i >= 0; i--) {
        const time = (now - i * 86400) as any;
        const volatility = Math.random() * 2000;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const open = basePrice;
        const close = basePrice + (direction * volatility);
        const high = Math.max(open, close) + Math.random() * 500;
        const low = Math.min(open, close) - Math.random() * 500;
        data.push({ time, open, high, low, close });
        basePrice = close;
    }
    return data;
};

const PORTFOLIO = {
    totalNetWorth: 1242084.50,
    change24h: 12402.10,
    changePercent24h: 1.01,
    allTimeReturn: 34.2,
    assets: [
        { key: 'stocks', value: 171874, change: 1.2 },
        { key: 'bonds', value: 125000, change: 0.4 },
        { key: 'crypto', value: 840210, change: 5.4 },
        { key: 'metals', value: 105000, change: -0.2 },
    ],
};

const GOALS = [
    { nameKey: 'dash.goals.1.name', current: 1224, target: 2000, color: '#3B82F6' },
    { nameKey: 'dash.goals.2.name', current: 8750, target: 15000, color: '#10B981' },
    { nameKey: 'dash.goals.3.name', current: 3200, target: 25000, color: '#F59E0B' },
];

const HEALTH = {
    riskScore: 72,
    stabilityChange: 4,
    metrics: [
        { key: 'dash.health.diversification', value: 88, color: '#ffffff' },
        { key: 'dash.health.liquidity', value: 64, color: '#10B981' },
        { key: 'dash.health.volatility', value: 72, color: '#10B981' },
    ],
};

const TICKER_DATA = [
    { symbol: 'XAG/USD', name: 'Silver', price: 33.84, change: -0.12 },
    { symbol: 'XPT/USD', name: 'Platinum', price: 1018.10, change: 1.45 },
    { symbol: 'XAU/USD', name: 'Gold', price: 2732.45, change: 0.82 },
    { symbol: 'SPX', name: 'S&P 500', price: 5123.41, change: 1.12 },
    { symbol: 'BTC/USD', name: 'Bitcoin', price: 64210.00, change: 2.4 },
    { symbol: 'ETH/USD', name: 'Ethereum', price: 3400.50, change: -1.1 },
];

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#6366F1'];

// ── Formatters ──────────────────────────────────────────────
const fmtUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
const fmtPrice = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// ── Animation Variants ──────────────────────────────────────
const stagger = {
    container: { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } },
    item: {
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
    },
};

// ── SVG Gauge Component ─────────────────────────────────────
function GaugeArc({ current, target, color, size = 140 }: { current: number; target: number; color: string; size?: number }) {
    const percent = Math.min(current / target, 1);
    const radius = (size - 16) / 2;
    const cx = size / 2;
    const cy = size / 2;
    // Arc from 220deg to -40deg (260deg sweep)
    const startAngle = 220;
    const sweepAngle = 260;
    const endAngle = startAngle - sweepAngle * percent;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const startX = (cx + radius * Math.cos(toRad(startAngle))).toFixed(4);
    const startY = (cy - radius * Math.sin(toRad(startAngle))).toFixed(4);
    const endX = (cx + radius * Math.cos(toRad(startAngle - sweepAngle))).toFixed(4);
    const endY = (cy - radius * Math.sin(toRad(startAngle - sweepAngle))).toFixed(4);
    const fillX = (cx + radius * Math.cos(toRad(endAngle))).toFixed(4);
    const fillY = (cy - radius * Math.sin(toRad(endAngle))).toFixed(4);

    const largeArcBg = sweepAngle > 180 ? 1 : 0;
    const fillSweep = sweepAngle * percent;
    const largeArcFill = fillSweep > 180 ? 1 : 0;

    const bgPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcBg} 1 ${endX} ${endY}`;
    const fillPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFill} 1 ${fillX} ${fillY}`;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
            <path d={bgPath} fill="none" stroke="#27272a" strokeWidth={8} strokeLinecap="round" />
            <motion.path
                d={fillPath}
                fill="none"
                stroke={color}
                strokeWidth={8}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {/* Indicator dot */}
            <circle cx={fillX} cy={fillY} r={6} fill={color} />
            <circle cx={fillX} cy={fillY} r={3} fill="#0A0A0A" />
        </svg>
    );
}

// ── Health Progress Bar ─────────────────────────────────────
function HealthBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">{label}</span>
                <span className="text-sm font-bold font-mono tabular-nums text-zinc-300">{value}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
export default function DashboardPage() {
    const { t } = useLanguage();
    const mockData = generateMockData();

    // Real-time data state
    const [tickerData, setTickerData] = useState(TICKER_DATA);
    const [loading, setLoading] = useState(true);

    // Fetch real-time market data
    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                // Fetch crypto 24h tickers (BTC, ETH) - use individual 24hr ticker for proper change%
                const [btcRes, ethRes] = await Promise.all([
                    fetch('/api/market/crypto?symbols=BTCUSDT'),
                    fetch('/api/market/crypto?symbols=ETHUSDT'),
                ]);
                const btcData = await btcRes.json();
                const ethData = await ethRes.json();

                // Fetch stocks (SPX via S&P 500 ETF)
                const stockRes = await fetch('/api/market/stocks?symbols=SPY');
                const stockData = await stockRes.json();

                // Fetch gold and silver
                const goldRes = await fetch('/api/market/stocks?gold=true');
                const goldData = await goldRes.json();

                const silverRes = await fetch('/api/market/stocks?silver=true');
                const silverData = await silverRes.json();

                // Update ticker data with real prices
                const newTickerData = [
                    {
                        symbol: 'XAG/USD',
                        name: 'Silver',
                        price: silverData.success ? silverData.data.price : 33.84,
                        change: silverData.success ? silverData.data.changePercent : -0.12
                    },
                    {
                        symbol: 'XAU/USD',
                        name: 'Gold',
                        price: goldData.success ? goldData.data.price : 2732.45,
                        change: goldData.success ? goldData.data.changePercent : 0.82
                    },
                    {
                        symbol: 'SPX',
                        name: 'S&P 500',
                        price: stockData.success ? stockData.data.regularMarketPrice * 10 : 5123.41,
                        change: stockData.success ? stockData.data.regularMarketChangePercent : 1.12
                    },
                    {
                        symbol: 'BTC/USD',
                        name: 'Bitcoin',
                        price: btcData.success ? btcData.data.price : 64210.00,
                        change: btcData.success ? btcData.data.changePercent : 2.4
                    },
                    {
                        symbol: 'ETH/USD',
                        name: 'Ethereum',
                        price: ethData.success ? ethData.data.price : 3400.50,
                        change: ethData.success ? ethData.data.changePercent : -1.1
                    },
                ];

                setTickerData(newTickerData);
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch market data:', error);
                setLoading(false);
            }
        };

        fetchMarketData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchMarketData, 30000);
        return () => clearInterval(interval);
    }, []);

    const assetLabels: Record<string, string> = {
        stocks: t('assets.stocks'),
        bonds: t('assets.bonds'),
        crypto: t('assets.crypto'),
        metals: t('assets.precious_metals'),
    };

    const barData = PORTFOLIO.assets.map(a => ({ name: assetLabels[a.key], value: a.value, change: a.change }));
    const pieData = PORTFOLIO.assets.map(a => ({ name: assetLabels[a.key], value: a.value }));
    const timeframes = ['1D', '1W', '1M', '1Y', 'ALL'];

    return (
        <DashboardLayout>
            <div className="space-y-10 max-w-[1440px] mx-auto">

                {/* ── Net Worth Hero ── */}
                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 22 }}
                    className="flex flex-col md:flex-row md:items-end justify-between pt-4 pb-6"
                >
                    <div className="relative">
                        <div className="absolute -inset-12 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
                        <p className="text-zinc-500 text-[11px] font-bold tracking-[0.25em] uppercase mb-3">
                            {t('dash.total_value')}
                        </p>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter font-mono tabular-nums">
                            {fmtPrice(PORTFOLIO.totalNetWorth)}
                        </h1>
                    </div>
                    <div className="flex items-center gap-10 mt-8 md:mt-0">
                        <div className="text-right">
                            <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5">{t('dash.today_pl')}</p>
                            <p className="text-lg font-semibold font-mono tabular-nums flex items-center justify-end gap-2">
                                +{fmtPrice(PORTFOLIO.change24h)}
                                <span className="text-emerald-500 text-xs font-bold">+{PORTFOLIO.changePercent24h}%</span>
                            </p>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden md:block" />
                        <div className="text-right">
                            <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5">{t('dash.risk_score')}</p>
                            <p className="text-lg font-semibold font-mono tabular-nums">+{PORTFOLIO.allTimeReturn}%</p>
                        </div>
                    </div>
                </motion.section>

                {/* ── Ticker Banner ── */}
                <div className="bg-[#0D0D0D] border border-white/5 overflow-hidden rounded-xl relative">
                    <div className="absolute left-0 inset-y-0 w-12 bg-gradient-to-r from-[#0D0D0D] to-transparent z-10" />
                    <div className="absolute right-0 inset-y-0 w-12 bg-gradient-to-l from-[#0D0D0D] to-transparent z-10" />
                    <div className="flex animate-marquee gap-14 px-6 py-3 items-center hover:[animation-play-state:paused]">
                        {[...tickerData, ...tickerData].map((tk, i) => (
                            <div key={`tick-${i}`} className="flex items-center gap-2.5 text-[11px] font-medium tracking-wider uppercase whitespace-nowrap">
                                <span className="text-zinc-600">{tk.name} ({tk.symbol})</span>
                                <span className="text-white font-mono tabular-nums">{fmtPrice(tk.price)}</span>
                                <span className={`font-bold ${tk.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {tk.change >= 0 ? '+' : ''}{tk.change.toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Asset Cards + Performance Chart ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <motion.div className="lg:col-span-3 space-y-3" variants={stagger.container} initial="hidden" animate="visible">
                        {PORTFOLIO.assets.map((asset) => (
                            <motion.div
                                key={asset.key}
                                variants={stagger.item}
                                className="bg-[#111] border border-white/5 rounded-xl p-5 cursor-pointer group
                                           hover:border-white/10 hover:bg-white/[0.03] transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase group-hover:text-zinc-400 transition-colors">
                                        {assetLabels[asset.key]}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${asset.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                        }`}>
                                        {asset.change >= 0 ? '+' : ''}{asset.change}%
                                    </span>
                                </div>
                                <p className="text-xl font-bold tracking-tight font-mono tabular-nums">{fmtUSD(asset.value)}</p>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 20 }}
                        className="lg:col-span-9 bg-[#111] border border-white/5 rounded-2xl p-6 md:p-8"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight mb-1">{t('dash.perf.title')}</h2>
                                <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">{t('dash.perf.desc')}</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-black/60 p-1 rounded-lg border border-white/5 mt-4 sm:mt-0">
                                {timeframes.map((tf) => (
                                    <button key={tf} className={`px-3.5 py-1.5 text-[10px] font-bold tracking-wider rounded-md transition-all ${tf === '1M' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                        }`}>{tf}</button>
                                ))}
                            </div>
                        </div>
                        <TradingViewChart data={mockData} chartType="area" height={380} />
                    </motion.div>
                </div>

                {/* ── Goals Tracker + Portfolio Health ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Goals Tracker */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, type: 'spring', stiffness: 100, damping: 20 }}
                        className="bg-[#111] border border-white/5 rounded-2xl p-6 md:p-8"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Target size={18} className="text-blue-400" weight="duotone" />
                                </div>
                                <h2 className="text-lg font-bold tracking-tight">{t('dash.goals.title')}</h2>
                            </div>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold tracking-wider uppercase text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-[0.97]">
                                <Plus size={12} weight="bold" />
                                {t('dash.goals.add')}
                            </button>
                        </div>

                        <div className="space-y-6">
                            {GOALS.map((goal, i) => {
                                const percent = Math.round((goal.current / goal.target) * 100);
                                const onTrack = percent >= 50;
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + i * 0.1, type: 'spring' as const, stiffness: 120, damping: 20 }}
                                        className="bg-zinc-900/60 border border-white/5 rounded-xl p-5 flex items-center gap-5"
                                    >
                                        <GaugeArc current={goal.current} target={goal.target} color={goal.color} size={100} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <h3 className="text-sm font-bold tracking-tight truncate">{t(goal.nameKey)}</h3>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${onTrack ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                    {onTrack ? t('dash.goals.on_track') : t('dash.goals.behind')}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-[10px] font-bold tracking-[0.15em] uppercase mb-1">{t('dash.goals.target')}</p>
                                            <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
                                                {fmtUSD(goal.current)}
                                                <span className="text-sm text-zinc-600 font-normal ml-1">/ {fmtUSD(goal.target)}</span>
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Portfolio Health */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, type: 'spring', stiffness: 100, damping: 20 }}
                        className="bg-[#111] border border-white/5 rounded-2xl p-6 md:p-8"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Shield size={18} className="text-emerald-400" weight="duotone" />
                            </div>
                            <h2 className="text-lg font-bold tracking-tight">{t('dash.health.title')}</h2>
                        </div>

                        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-6 md:p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                {/* Risk Score */}
                                <div>
                                    <p className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-4">
                                        {t('dash.health.risk_score')}
                                    </p>
                                    <div className="flex items-baseline gap-1 mb-3">
                                        <motion.span
                                            className="text-6xl font-bold tracking-tighter font-mono tabular-nums"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                                        >
                                            {HEALTH.riskScore}
                                        </motion.span>
                                        <span className="text-xl text-zinc-600 font-medium">/100</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-5">
                                        <TrendUp size={14} className="text-emerald-500" weight="bold" />
                                        <span className="text-emerald-500 text-sm font-semibold">
                                            {t('dash.health.stability')} +{HEALTH.stabilityChange}%
                                        </span>
                                    </div>
                                    <p className="text-zinc-500 text-xs leading-relaxed max-w-[320px]">
                                        {t('dash.health.desc')}
                                    </p>
                                </div>

                                {/* Health Metrics */}
                                <div className="space-y-5 pt-2">
                                    {HEALTH.metrics.map((metric) => (
                                        <HealthBar
                                            key={metric.key}
                                            label={t(metric.key)}
                                            value={metric.value}
                                            color={metric.color}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ── Bar Chart + Pie Chart ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
                        className="bg-[#111] border border-white/5 rounded-2xl p-6 md:p-8"
                    >
                        <h2 className="text-lg font-bold tracking-tight mb-1">{t('dash.ai.title')}</h2>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase mb-6">{t('dash.ai.div.title')}</p>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barData} barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: '#1f1f1f' }} tickLine={false} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12, color: '#fff' }}
                                    formatter={(value: any) => [fmtUSD(Number(value)), '']}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                    {barData.map((_, i) => (<Cell key={`bar-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                                    <LabelList
                                        dataKey="value"
                                        content={(props: any) => {
                                            const { x, y, width, value } = props;
                                            const total = PORTFOLIO.assets.reduce((sum, a) => sum + a.value, 0);
                                            const percent = (value / total) * 100;
                                            if (percent < 5 || y === undefined || x === undefined) return null;
                                            return (
                                                <text x={x + width / 2} y={y + 16} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} pointerEvents="none" letterSpacing="0.02em">
                                                    {`$${(value / 1000).toFixed(1)}k`}
                                                </text>
                                            );
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, type: 'spring', stiffness: 100, damping: 20 }}
                        className="bg-[#111] border border-white/5 rounded-2xl p-6 md:p-8"
                    >
                        <h2 className="text-lg font-bold tracking-tight mb-1">{t('dash.ai.risk.title')}</h2>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase mb-6">{t('dash.ai.div.title')}</p>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={3} dataKey="value" stroke="none"
                                    labelLine={false}
                                    label={(props: any) => {
                                        const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
                                        const RADIAN = Math.PI / 180;
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                        const total = PORTFOLIO.assets.reduce((sum, a) => sum + a.value, 0);
                                        const percent = (value / total) * 100;
                                        if (percent < 5) return null;
                                        return (
                                            <text x={x} y={y} fill="#111111" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} pointerEvents="none">
                                                {percent.toFixed(1)}%
                                            </text>
                                        );
                                    }}
                                >
                                    {pieData.map((_, i) => (<Cell key={`pie-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                                </Pie>
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value) => (
                                        <span style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}>{value}</span>
                                    )}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12, color: '#fff' }}
                                    formatter={(value: any) => [fmtUSD(Number(value)), '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>
                </div>

            </div>
        </DashboardLayout>
    );
}
