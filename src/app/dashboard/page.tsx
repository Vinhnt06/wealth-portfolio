'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { AssetCard } from '../components/AssetCard';
import { AddAssetModal } from '../components/AddAssetModal';
import { motion } from 'framer-motion';
import { Plus, TrendUp, TrendDown, Wallet, ChartLine } from '@phosphor-icons/react';
import { useLanguage } from '../components/LanguageContext';

interface Asset {
    id: string;
    type: string;
    symbol: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
    currentPrice?: number;
    change24h?: number;
    changePercent?: number;
}

export default function DashboardPage() {
    const { t } = useLanguage();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch user assets
    const fetchAssets = async () => {
        try {
            const response = await fetch('/api/assets');
            const data = await response.json();

            if (data.success) {
                // Fetch current prices for each asset
                const assetsWithPrices = await Promise.all(
                    data.data.map(async (asset: Asset) => {
                        try {
                            const price = await fetchCurrentPrice(asset.type, asset.symbol);
                            return { ...asset, ...price };
                        } catch (error) {
                            console.error(`Failed to fetch price for ${asset.symbol}:`, error);
                            return asset;
                        }
                    })
                );
                setAssets(assetsWithPrices);
            }
        } catch (error) {
            console.error('Failed to fetch assets:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch current price based on asset type
    const fetchCurrentPrice = async (type: string, symbol: string) => {
        try {
            let endpoint = '';

            switch (type) {
                case 'CRYPTO':
                    endpoint = `/api/market/crypto?symbols=${symbol}`;
                    break;
                case 'STOCK_US':
                    endpoint = `/api/market/stocks?symbols=${symbol}`;
                    break;
                case 'GOLD':
                    endpoint = '/api/market/stocks?gold=true';
                    break;
                case 'SILVER':
                    endpoint = '/api/market/stocks?silver=true';
                    break;
                case 'FOREX':
                    // For forex, we need to parse the symbol (e.g., USD/EUR)
                    const [base, target] = symbol.split('/');
                    endpoint = `/api/market/forex?base=${base}&symbols=${target}`;
                    break;
                default:
                    return {};
            }

            const response = await fetch(endpoint);
            const data = await response.json();

            if (!data.success) return {};

            // Parse response based on type
            if (type === 'CRYPTO') {
                return {
                    currentPrice: data.data.price,
                    change24h: data.data.change24h,
                    changePercent: data.data.changePercent,
                };
            } else if (type === 'STOCK_US' || type === 'GOLD' || type === 'SILVER') {
                return {
                    currentPrice: data.data.regularMarketPrice || data.data.price,
                    change24h: data.data.regularMarketChange || data.data.change,
                    changePercent: data.data.regularMarketChangePercent || data.data.changePercent,
                };
            } else if (type === 'FOREX') {
                const [, target] = symbol.split('/');
                return {
                    currentPrice: data.data.rates[target],
                    change24h: 0,
                    changePercent: 0,
                };
            }

            return {};
        } catch (error) {
            console.error('Failed to fetch price:', error);
            return {};
        }
    };

    // Add new asset
    const handleAddAsset = async (assetData: any) => {
        const response = await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assetData),
        });

        if (response.ok) {
            fetchAssets(); // Refresh assets
        }
    };

    // Delete asset
    const handleDeleteAsset = async (id: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;

        const response = await fetch(`/api/assets/${id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            setAssets(assets.filter(a => a.id !== id));
        }
    };

    // Calculate portfolio stats
    const calculateStats = () => {
        let totalValue = 0;
        let totalCost = 0;

        assets.forEach(asset => {
            const cost = asset.quantity * asset.avgBuyPrice;
            const value = asset.currentPrice ? asset.quantity * asset.currentPrice : cost;
            totalCost += cost;
            totalValue += value;
        });

        const profitLoss = totalValue - totalCost;
        const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

        return { totalValue, totalCost, profitLoss, profitLossPercent };
    };

    const stats = calculateStats();
    const isProfit = stats.profitLoss >= 0;

    // Auto-refresh every 30 seconds
    useEffect(() => {
        fetchAssets();
        const interval = setInterval(() => {
            setRefreshing(true);
            fetchAssets();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{t('dash.title')}</h1>
                        <p className="text-zinc-500">Track your portfolio in real-time</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all"
                    >
                        <Plus size={20} />
                        <span>Add Asset</span>
                    </button>
                </motion.div>

                {/* Portfolio Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Value */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/5 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <Wallet size={20} className="text-emerald-400" />
                            </div>
                            <p className="text-zinc-500 text-sm uppercase tracking-wider">Total Value</p>
                        </div>
                        <p className="text-white font-bold text-3xl">{formatCurrency(stats.totalValue)}</p>
                        {refreshing && <p className="text-xs text-zinc-600 mt-2">Updating...</p>}
                    </motion.div>

                    {/* Total P/L */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/5 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl ${isProfit ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30'} border flex items-center justify-center`}>
                                {isProfit ? <TrendUp size={20} className="text-emerald-400" /> : <TrendDown size={20} className="text-red-400" />}
                            </div>
                            <p className="text-zinc-500 text-sm uppercase tracking-wider">Total P/L</p>
                        </div>
                        <p className={`font-bold text-3xl ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{formatCurrency(stats.profitLoss)}
                        </p>
                        <p className={`text-sm mt-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{stats.profitLossPercent.toFixed(2)}%
                        </p>
                    </motion.div>

                    {/* Total Assets */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/5 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                <ChartLine size={20} className="text-blue-400" />
                            </div>
                            <p className="text-zinc-500 text-sm uppercase tracking-wider">Total Assets</p>
                        </div>
                        <p className="text-white font-bold text-3xl">{assets.length}</p>
                        <p className="text-zinc-500 text-sm mt-1">Across {new Set(assets.map(a => a.type)).size} types</p>
                    </motion.div>
                </div>

                {/* Assets Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-zinc-500">Loading assets...</div>
                    </div>
                ) : assets.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <Wallet size={32} className="text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No assets yet</h3>
                        <p className="text-zinc-500 mb-6">Start building your portfolio by adding your first asset</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all"
                        >
                            <Plus size={20} />
                            <span>Add Your First Asset</span>
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assets.map((asset, index) => (
                            <motion.div
                                key={asset.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <AssetCard
                                    {...asset}
                                    onDelete={handleDeleteAsset}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Asset Modal */}
            <AddAssetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddAsset}
            />
        </DashboardLayout>
    );
}
