'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from '@phosphor-icons/react';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (asset: {
        type: string;
        symbol: string;
        name: string;
        quantity: number;
        avgBuyPrice: number;
    }) => Promise<void>;
}

const ASSET_TYPES = [
    { value: 'CRYPTO', label: 'Cryptocurrency', icon: '₿', example: 'BTCUSDT' },
    { value: 'STOCK_US', label: 'US Stock', icon: '📈', example: 'AAPL' },
    { value: 'GOLD', label: 'Gold', icon: '🥇', example: 'GC=F' },
    { value: 'SILVER', label: 'Silver', icon: '🪙', example: 'SI=F' },
    { value: 'FOREX', label: 'Forex', icon: '💱', example: 'USD/EUR' },
];

export function AddAssetModal({ isOpen, onClose, onAdd }: AddAssetModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'CRYPTO',
        symbol: '',
        name: '',
        quantity: '',
        avgBuyPrice: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onAdd({
                type: formData.type,
                symbol: formData.symbol.toUpperCase(),
                name: formData.name,
                quantity: parseFloat(formData.quantity),
                avgBuyPrice: parseFloat(formData.avgBuyPrice),
            });

            // Reset form
            setFormData({
                type: 'CRYPTO',
                symbol: '',
                name: '',
                quantity: '',
                avgBuyPrice: '',
            });
            onClose();
        } catch (error) {
            console.error('Failed to add asset:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0F0F0F] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <h2 className="text-xl font-bold text-white">Add New Asset</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                {/* Asset Type */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-3">
                                        Asset Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ASSET_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type: type.value })}
                                                className={`p-3 rounded-xl border transition-all ${formData.type === type.value
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                                        : 'bg-black/40 border-white/5 text-zinc-400 hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{type.icon}</span>
                                                    <span className="text-sm font-medium">{type.label}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Example: {ASSET_TYPES.find(t => t.value === formData.type)?.example}
                                    </p>
                                </div>

                                {/* Symbol */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Symbol
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.symbol}
                                        onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                        placeholder="e.g., BTCUSDT, AAPL"
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Bitcoin, Apple Inc"
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>

                                {/* Quantity & Price */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            step="any"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                                            Avg Buy Price
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            step="any"
                                            value={formData.avgBuyPrice}
                                            onChange={(e) => setFormData({ ...formData, avgBuyPrice: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <span>Adding...</span>
                                    ) : (
                                        <>
                                            <Plus size={20} />
                                            <span>Add Asset</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
