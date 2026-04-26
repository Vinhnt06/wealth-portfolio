'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from './LanguageContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    CurrencyCircleDollar,
    CurrencyBtc,
    CurrencyEth,
    Drop,
    Coin,
    ArrowRight,
    TrendUp,
    TrendDown,
    Lightning,
} from '@phosphor-icons/react';

// ── Types ──────────────────────────────────────────────────
interface MarketAsset {
    symbol: string;
    ticker: string;
    name: string;
    price: number;
    change24h: number;     // absolute change
    changePercent: number; // percentage change
    marketCap: string;
    icon: React.ElementType;
    iconColor: string;
}

// ── Fallback Data ──────────────────────────────────────────
const FALLBACK_ASSETS: MarketAsset[] = [
    { symbol: 'XAU', ticker: 'Gold', name: 'Gold Futures', price: 2384.50, change24h: 10.02, changePercent: 0.42, marketCap: '$14.2T', icon: CurrencyCircleDollar, iconColor: 'text-yellow-500' },
    { symbol: 'BTC', ticker: 'Bitcoin', name: 'Bitcoin', price: 64281.40, change24h: 1542.18, changePercent: 2.45, marketCap: '$1.26T', icon: CurrencyBtc, iconColor: 'text-amber-500' },
    { symbol: 'WTI', ticker: 'Crude Oil', name: 'Crude Oil', price: 81.24, change24h: -0.94, changePercent: -1.15, marketCap: '$2.4B Vol', icon: Drop, iconColor: 'text-zinc-400' },
    { symbol: 'ETH', ticker: 'Ethereum', name: 'Ethereum', price: 3482.12, change24h: 38.72, changePercent: 1.12, marketCap: '$418.4B', icon: CurrencyEth, iconColor: 'text-blue-400' },
    { symbol: 'XAG', ticker: 'Silver', name: 'Silver Futures', price: 29.15, change24h: -0.25, changePercent: -0.84, marketCap: '$1.5T', icon: Coin, iconColor: 'text-slate-400' },
];

// ── Formatters ─────────────────────────────────────────────
const fmtPrice = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const fmtPercent = (v: number) =>
    `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// ── Animation Variants ─────────────────────────────────────
const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06 },
    },
};

const rowVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 120, damping: 22 },
    },
};

// ── Skeleton Row ───────────────────────────────────────────
function SkeletonRow() {
    return (
        <div className="flex items-center px-6 md:px-8 py-5 gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
                <div className="w-24 h-4 bg-zinc-800 rounded" />
                <div className="w-12 h-3 bg-zinc-800/60 rounded" />
            </div>
            <div className="w-28 h-5 bg-zinc-800 rounded" />
            <div className="w-16 h-5 bg-zinc-800 rounded" />
        </div>
    );
}

// ── Live Dot ────────────────────────────────────────────────
function LiveDot() {
    return (
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export function MarketSection() {
    const { t } = useLanguage();
    const { status } = useSession();
    const isAuthenticated = status === 'authenticated';
    const [assets, setAssets] = useState<MarketAsset[]>(FALLBACK_ASSETS);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'crypto' | 'commodities'>('all');

    const fetchMarketData = useCallback(async () => {
        try {
            // Fetch crypto 24h tickers (BTC, ETH) - these return changePercent
            const [btcRes, ethRes] = await Promise.all([
                fetch('/api/market/crypto?symbols=BTCUSDT'),
                fetch('/api/market/crypto?symbols=ETHUSDT'),
            ]);
            const btcData = await btcRes.json();
            const ethData = await ethRes.json();

            // Fetch commodities (Gold, Silver, Crude Oil) - these return changePercent
            const [goldRes, silverRes, oilRes] = await Promise.all([
                fetch('/api/market/stocks?gold=true'),
                fetch('/api/market/stocks?silver=true'),
                fetch('/api/market/stocks?symbols=CL=F'),
            ]);
            const goldData = await goldRes.json();
            const silverData = await silverRes.json();
            const oilData = await oilRes.json();

            const updatedAssets: MarketAsset[] = [
                {
                    symbol: 'XAU',
                    ticker: 'Gold',
                    name: 'Gold Futures',
                    price: goldData.success ? goldData.data.price : FALLBACK_ASSETS[0].price,
                    change24h: goldData.success ? goldData.data.change : FALLBACK_ASSETS[0].change24h,
                    changePercent: goldData.success ? goldData.data.changePercent : FALLBACK_ASSETS[0].changePercent,
                    marketCap: '$14.2T',
                    icon: CurrencyCircleDollar,
                    iconColor: 'text-yellow-500',
                },
                {
                    symbol: 'BTC',
                    ticker: 'Bitcoin',
                    name: 'Bitcoin',
                    price: btcData.success ? btcData.data.price : FALLBACK_ASSETS[1].price,
                    change24h: btcData.success ? btcData.data.change24h : FALLBACK_ASSETS[1].change24h,
                    changePercent: btcData.success ? btcData.data.changePercent : FALLBACK_ASSETS[1].changePercent,
                    marketCap: '$1.26T',
                    icon: CurrencyBtc,
                    iconColor: 'text-amber-500',
                },
                {
                    symbol: 'WTI',
                    ticker: 'Crude Oil',
                    name: 'Crude Oil',
                    price: oilData.success ? oilData.data.regularMarketPrice : FALLBACK_ASSETS[2].price,
                    change24h: oilData.success ? oilData.data.regularMarketChange : FALLBACK_ASSETS[2].change24h,
                    changePercent: oilData.success ? oilData.data.regularMarketChangePercent : FALLBACK_ASSETS[2].changePercent,
                    marketCap: '$2.4B Vol',
                    icon: Drop,
                    iconColor: 'text-zinc-400',
                },
                {
                    symbol: 'ETH',
                    ticker: 'Ethereum',
                    name: 'Ethereum',
                    price: ethData.success ? ethData.data.price : FALLBACK_ASSETS[3].price,
                    change24h: ethData.success ? ethData.data.change24h : FALLBACK_ASSETS[3].change24h,
                    changePercent: ethData.success ? ethData.data.changePercent : FALLBACK_ASSETS[3].changePercent,
                    marketCap: '$418.4B',
                    icon: CurrencyEth,
                    iconColor: 'text-blue-400',
                },
                {
                    symbol: 'XAG',
                    ticker: 'Silver',
                    name: 'Silver Futures',
                    price: silverData.success ? silverData.data.price : FALLBACK_ASSETS[4].price,
                    change24h: silverData.success ? silverData.data.change : FALLBACK_ASSETS[4].change24h,
                    changePercent: silverData.success ? silverData.data.changePercent : FALLBACK_ASSETS[4].changePercent,
                    marketCap: '$1.5T',
                    icon: Coin,
                    iconColor: 'text-slate-400',
                },
            ];

            setAssets(updatedAssets);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error('Market data fetch failed:', error);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMarketData();
        // Auto-refresh every 15 seconds for real-time feel
        const interval = setInterval(fetchMarketData, 15000);
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    // Filter assets by tab
    const filteredAssets = assets.filter((asset) => {
        if (activeTab === 'crypto') return ['BTC', 'ETH'].includes(asset.symbol);
        if (activeTab === 'commodities') return ['XAU', 'XAG', 'WTI'].includes(asset.symbol);
        return true;
    });

    const tabs = [
        { key: 'all' as const, label: t('market.tab.all') || 'All Assets' },
        { key: 'crypto' as const, label: t('market.tab.crypto') || 'Crypto' },
        { key: 'commodities' as const, label: t('market.tab.commodities') || 'Commodities' },
    ];

    return (
        <section className="relative min-h-[70vh] w-full px-6 py-24 md:px-12 lg:px-24">
            {/* Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end mb-16">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <Lightning size={16} weight="fill" className="text-zinc-400" />
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-zinc-400 uppercase mt-[1px]">
                            {t('market.label') || 'Realtime Access'}
                        </p>
                        <LiveDot />
                    </div>
                    <h3 className="text-3xl md:text-5xl font-semibold tracking-tighter mb-4">
                        {t('market.title') || 'Global Multi-Asset Market'}
                    </h3>
                    <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
                        {t('market.subtitle') || 'Institutional-grade real-time pricing across crypto, precious metals, and energy commodities.'}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
                    className="flex flex-col items-start md:items-end gap-4"
                >
                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-zinc-900/80 rounded-xl border border-white/5">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-5 py-2 text-xs font-bold tracking-wider rounded-lg transition-all duration-300 active:scale-[0.97] ${activeTab === tab.key
                                    ? 'bg-white text-black shadow-sm'
                                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Last Updated */}
                    {lastUpdated && (
                        <p className="text-[10px] font-mono text-zinc-600 tracking-wider">
                            {t('market.updated') || 'Updated'}: {lastUpdated.toLocaleTimeString()}
                        </p>
                    )}
                </motion.div>
            </div>

            {/* Market Table */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 22 }}
                className="bg-zinc-900/40 rounded-2xl overflow-hidden border border-white/[0.06]"
            >
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase border-b border-white/[0.04]">
                    <div className="col-span-4">Asset</div>
                    <div className="col-span-3">Price</div>
                    <div className="col-span-2 text-right">24h Change</div>
                    <div className="col-span-2 text-right">Market Cap</div>
                    <div className="col-span-1 text-right">Action</div>
                </div>

                {/* Table Body */}
                {loading ? (
                    <div className="divide-y divide-white/[0.03]">
                        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="divide-y divide-white/[0.03]"
                    >
                        {filteredAssets.map((asset) => {
                            const isPositive = asset.changePercent >= 0;
                            const Icon = asset.icon;

                            return (
                                <motion.div
                                    key={asset.symbol}
                                    variants={rowVariants}
                                    className="grid grid-cols-12 gap-4 items-center px-6 md:px-8 py-5 group cursor-pointer
                                               transition-colors duration-300 hover:bg-white/[0.03]
                                               active:scale-[0.998]"
                                >
                                    {/* Asset */}
                                    <div className="col-span-6 md:col-span-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-white/5 flex items-center justify-center
                                                        group-hover:border-white/10 transition-colors">
                                            <Icon size={20} weight="duotone" className={asset.iconColor} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-white text-sm tracking-tight group-hover:text-white transition-colors">
                                                {asset.ticker}
                                            </div>
                                            <div className="text-[10px] text-zinc-600 font-bold tracking-wider uppercase">
                                                {asset.symbol}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="col-span-6 md:col-span-3 text-right md:text-left">
                                        <span className="font-mono text-sm font-semibold text-white tabular-nums tracking-tight">
                                            {fmtPrice(asset.price)}
                                        </span>
                                    </div>

                                    {/* 24h Change - hidden on mobile, shown below price */}
                                    <div className="col-span-6 md:col-span-2 flex items-center gap-1.5 md:justify-end">
                                        {isPositive ? (
                                            <TrendUp size={14} weight="bold" className="text-emerald-500" />
                                        ) : (
                                            <TrendDown size={14} weight="bold" className="text-rose-500" />
                                        )}
                                        <span className={`text-sm font-bold font-mono tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'
                                            }`}>
                                            {fmtPercent(asset.changePercent)}
                                        </span>
                                    </div>

                                    {/* Market Cap */}
                                    <div className="hidden md:block col-span-2 text-right">
                                        <span className="text-xs text-zinc-500 font-medium">
                                            {asset.marketCap}
                                        </span>
                                    </div>

                                    {/* Action Button */}
                                    <div className="col-span-6 md:col-span-1 flex justify-end">
                                        <button className="px-3.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold uppercase tracking-wider
                                                           text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/20
                                                           transition-all duration-300 active:scale-[0.95]">
                                            {t('market.add') || 'Add'}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Table Footer */}
                <div className="px-8 py-5 border-t border-white/[0.04] flex items-center justify-between">
                    <p className="text-[10px] text-zinc-600 font-mono tracking-wider">
                        {t('market.disclaimer') || 'Prices refresh every 15s. Data provided for informational purposes only.'}
                    </p>
                    <Link
                        href={isAuthenticated ? '/dashboard' : '/login'}
                        className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors group"
                    >
                        {t('market.view_all') || 'View All Assets'}
                        <ArrowRight size={14} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </motion.div>
        </section>
    );
}
