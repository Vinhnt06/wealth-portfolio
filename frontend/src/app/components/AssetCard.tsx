'use client';

import { motion } from 'framer-motion';
import { TrendUp, TrendDown, Trash, PencilSimple } from '@phosphor-icons/react';

interface AssetCardProps {
    id: string;
    type: string;
    symbol: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
    currentPrice?: number;
    change24h?: number;
    changePercent?: number;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export function AssetCard({
    id,
    type,
    symbol,
    name,
    quantity,
    avgBuyPrice,
    currentPrice,
    change24h,
    changePercent,
    onEdit,
    onDelete,
}: AssetCardProps) {
    // Calculate P/L
    const totalCost = quantity * avgBuyPrice;
    const currentValue = currentPrice ? quantity * currentPrice : totalCost;
    const profitLoss = currentValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
    const isProfit = profitLoss >= 0;

    // Format numbers
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatNumber = (value: number, decimals = 4) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    };

    // Get icon based on asset type
    const getTypeIcon = () => {
        switch (type) {
            case 'CRYPTO':
                return '₿';
            case 'STOCK_US':
            case 'STOCK_VN':
                return '📈';
            case 'GOLD':
                return '🥇';
            case 'FOREX':
                return '💱';
            default:
                return '💰';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="relative bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/5 rounded-2xl p-5 overflow-hidden group"
        >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-xl">
                            {getTypeIcon()}
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-lg leading-tight">{symbol}</h3>
                            <p className="text-zinc-500 text-sm">{name}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(id)}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                            >
                                <PencilSimple size={16} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(id)}
                                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-zinc-400 hover:text-red-400"
                            >
                                <Trash size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Price Info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Current Price</p>
                        <p className="text-white font-semibold text-xl">
                            {currentPrice ? formatCurrency(currentPrice) : '—'}
                        </p>
                        {changePercent !== undefined && (
                            <div className={`flex items-center gap-1 text-sm ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {changePercent >= 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                                <span>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Your Position</p>
                        <p className="text-white font-semibold text-xl">{formatNumber(quantity)}</p>
                        <p className="text-zinc-500 text-sm">Avg: {formatCurrency(avgBuyPrice)}</p>
                    </div>
                </div>

                {/* P/L Section */}
                <div className="border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total Value</p>
                            <p className="text-white font-bold text-lg">{formatCurrency(currentValue)}</p>
                        </div>

                        <div className="text-right">
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">P/L</p>
                            <div className={`flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? <TrendUp size={14} /> : <TrendDown size={14} />}
                                <span className="font-bold text-lg">{isProfit ? '+' : ''}{formatCurrency(profitLoss)}</span>
                            </div>
                            <p className={`text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
