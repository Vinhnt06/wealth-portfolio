'use client';

import React, { useState } from 'react';
import {
  X,
  Target,
  Sliders,
  Sparkle,
  ArrowRight,
  ChartLine,
  ArrowsDownUp,
  Percent,
} from '@phosphor-icons/react';
import {
  SuperTrendResult,
  SuperTrendSettings,
} from '../utils/superTrend';

interface SuperTrendStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  resolution?: string;
  result: SuperTrendResult | null;
  settings: SuperTrendSettings;
  onUpdateSettings: (newSettings: SuperTrendSettings) => void;
}

export const SuperTrendStrategyModal: React.FC<SuperTrendStrategyModalProps> = ({
  isOpen,
  onClose,
  symbol,
  resolution = '1D',
  result,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'settings'>('overview');
  const [tempPeriod, setTempPeriod] = useState<number>(settings.period);
  const [tempMultiplier, setTempMultiplier] = useState<number>(settings.multiplier);
  const [tempKamaPeriod, setTempKamaPeriod] = useState<number>(settings.kamaPeriod);

  if (!isOpen || !result) return null;

  const { backtest, latestSignal, currentTrend, currentValue, currentKama } = result;
  const isUp = currentTrend === 1;

  const handleSaveSettings = () => {
    onUpdateSettings({
      ...settings,
      period: Math.max(1, tempPeriod),
      multiplier: Math.max(0.5, tempMultiplier),
      kamaPeriod: Math.max(2, tempKamaPeriod),
    });
    setActiveTab('overview');
  };

  // Tính số vạch sóng hình học theo điểm sức mạnh (1 - 5 bars)
  const strengthBars = Math.min(
    5,
    Math.max(1, Math.round((backtest.strengthScore / 100) * 5))
  );

  const totalFinishedTrades = backtest.winningTrades + backtest.losingTrades;
  const winPercent = totalFinishedTrades > 0
    ? Math.round((backtest.winningTrades / totalFinishedTrades) * 100)
    : 0;
  const lossPercent = 100 - winPercent;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[94vw] max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[88vh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tối Giản */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ChartLine size={18} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-100 font-mono tracking-tight">
                  SUPERTREND PRO
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                  {symbol} • {resolution}
                </span>
                <span
                  className={`text-[9.5px] font-mono px-2 py-0.2 rounded-full font-bold flex items-center gap-1 ${
                    isUp
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
                  {isUp ? 'ST↑ TĂNG' : 'ST↓ GIẢM'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation Mini */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-zinc-800/60 bg-zinc-900/30 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Trực Quan R:R & Hiệu Suất
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`pb-2 px-3 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trades'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Nhật Ký Lệnh</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9.5px] text-zinc-300">
              {backtest.trades.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2 px-3 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders size={12} />
            <span>Cài Đặt</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 select-none">
          {activeTab === 'overview' && (
            <>
              {/* 1. THƯỚC ĐO HÌNH HỌC R:R CHIẾN LƯỢC (Geometric Risk-Reward Gauge) */}
              {latestSignal && (
                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-zinc-300 flex items-center gap-1.5">
                      <Target size={14} className="text-emerald-400" />
                      MÔ HÌNH HÌNH HỌC R:R (KẾ HOẠCH LỆNH)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Rủi ro (1R): <strong className="text-rose-400 font-bold">{Math.abs(latestSignal.entryPrice - latestSignal.stopLossPrice).toFixed(2)}</strong> ({latestSignal.riskPercent}%)
                    </span>
                  </div>

                  {/* Thanh Hình Học Trực Quan Phân Đoạn (R:R Geometry Bar) */}
                  <div className="relative pt-6 pb-2">
                    {/* Visual Segmented Progress Track */}
                    <div className="h-3 w-full rounded-full bg-zinc-950 flex overflow-hidden border border-zinc-800 shadow-inner">
                      {/* Vùng Rủi ro 1R (Đỏ) */}
                      <div className="w-[25%] bg-gradient-to-r from-rose-500/40 to-rose-500/80 border-r border-zinc-950 relative" />
                      {/* Vùng Lợi nhuận 1.5R (Cyan) */}
                      <div className="w-[37.5%] bg-gradient-to-r from-cyan-500/60 to-cyan-500/90 border-r border-zinc-950 relative" />
                      {/* Vùng Lợi nhuận 3.0R (Xanh ngọc) */}
                      <div className="w-[37.5%] bg-gradient-to-r from-emerald-500/60 to-emerald-500 relative" />
                    </div>

                    {/* Các Điểm Mốc Hình Học (Geometry Pins) */}
                    <div className="flex items-center justify-between text-center font-mono mt-2 text-[10px]">
                      {/* Pin Dừng Lỗ */}
                      <div className="flex flex-col items-center -ml-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 mb-1" />
                        <span className="text-rose-400 font-bold">DỪNG (SL)</span>
                        <span className="text-zinc-300 font-extrabold text-[11px]">{latestSignal.stopLossPrice.toFixed(2)}</span>
                        <span className="text-rose-400/80 text-[9px]">{latestSignal.riskPercent}%</span>
                      </div>

                      {/* Pin Vào Lệnh (Entry) */}
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-white ring-4 ring-white/20 mb-1" />
                        <span className="text-zinc-400 font-bold">VÀO</span>
                        <span className="text-white font-extrabold text-[11px]">{latestSignal.entryPrice.toFixed(2)}</span>
                        <span className="text-zinc-500 text-[9px]">Gốc 0R</span>
                      </div>

                      {/* Pin Chốt 1.5R */}
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/20 mb-1" />
                        <span className="text-cyan-400 font-bold">CHỐT 1.5R</span>
                        <span className="text-cyan-300 font-extrabold text-[11px]">{latestSignal.target1_5R.toFixed(2)}</span>
                        <span className="text-cyan-400/80 text-[9px]">+{Math.abs(Number(latestSignal.riskPercent) * 1.5).toFixed(1)}%</span>
                      </div>

                      {/* Pin Chốt 3.0R */}
                      <div className="flex flex-col items-center -mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 mb-1" />
                        <span className="text-emerald-400 font-bold">CHỐT 3R</span>
                        <span className="text-emerald-300 font-extrabold text-[11px]">{latestSignal.target3R.toFixed(2)}</span>
                        <span className="text-emerald-400/80 text-[9px]">+{Math.abs(Number(latestSignal.riskPercent) * 3).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Subline KAMA & Current ST value */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1.5 border-t border-zinc-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>KAMA: <strong className="text-amber-300">{currentKama ? currentKama.toFixed(2) : '--'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>Dải ST: <strong className={isUp ? 'text-emerald-400' : 'text-rose-400'}>{currentValue.toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ĐO LƯỜNG SỨC MẠNH & TỶ LỆ THẮNG HÌNH HỌC (Strength & Win Ratio Gauge) */}
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-zinc-300">
                      SỨC MẠNH CHIẾN LƯỢC:
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold ${
                        backtest.strengthScore >= 70
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : backtest.strengthScore >= 50
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {backtest.strengthRating} ({backtest.strengthScore}/100)
                    </span>
                  </div>

                  {/* Vạch sóng hình học 5 nấc (Signal Bars) */}
                  <div className="flex items-end gap-1 h-4">
                    {[1, 2, 3, 4, 5].map((bar) => (
                      <div
                        key={bar}
                        className={`w-1.5 rounded-sm transition-all ${
                          bar <= strengthBars
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                            : 'bg-zinc-800'
                        }`}
                        style={{ height: `${bar * 20}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Thanh Phân Bổ Hình Học Thắng / Thua (Win/Loss Proportion Bar) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      THẮNG: {backtest.winningTrades} lệnh ({winPercent}%)
                    </span>
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      THUA: {backtest.losingTrades} lệnh ({lossPercent}%)
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    </span>
                  </div>

                  {/* Visual Proportion Bar */}
                  <div className="h-2.5 w-full rounded-full bg-zinc-950 flex overflow-hidden border border-zinc-800">
                    <div
                      className="bg-emerald-500 transition-all duration-500"
                      style={{ width: `${winPercent}%` }}
                    />
                    <div
                      className="bg-rose-500 transition-all duration-500"
                      style={{ width: `${lossPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. BỐN CARD SỐ LIỆU TỐI GIẢN (Minimal Geometry Metrics) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[9.5px] text-zinc-500 block uppercase">WIN RATE</span>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {backtest.winRate}%
                  </div>
                  <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${backtest.winRate}%` }} />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[9.5px] text-zinc-500 block uppercase">PROFIT FACTOR</span>
                  <div className="text-lg font-black text-cyan-400 mt-0.5">
                    {backtest.profitFactor}x
                  </div>
                  <span className="text-[9px] text-zinc-500 block mt-1">Lãi / Lỗ ròng</span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[9.5px] text-zinc-500 block uppercase">KỲ VỌNG / LỆNH</span>
                  <div className={`text-lg font-black mt-0.5 ${backtest.totalReturnR >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {backtest.totalReturnR >= 0 ? `+${(backtest.totalReturnR / Math.max(1, totalFinishedTrades)).toFixed(2)}R` : `${(backtest.totalReturnR / Math.max(1, totalFinishedTrades)).toFixed(2)}R`}
                  </div>
                  <span className="text-[9px] text-zinc-500 block mt-1">
                    {backtest.totalReturnPct > 0 ? `+${backtest.totalReturnPct}%` : `${backtest.totalReturnPct}%`} ROI
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[9.5px] text-zinc-500 block uppercase">CHUỖI MAX</span>
                  <div className="text-lg font-black text-zinc-100 mt-0.5 flex items-baseline gap-1">
                    <span className="text-emerald-400 font-bold">+{backtest.maxConsecutiveWins}</span>
                    <span className="text-zinc-600 text-xs">/</span>
                    <span className="text-rose-400 text-sm">-{backtest.maxConsecutiveLosses}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 block mt-1">Thắng / Thua liên tiếp</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'trades' && (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/70 text-zinc-400 text-[10px]">
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">Thời gian</th>
                      <th className="py-2 px-2.5 text-right">Vào</th>
                      <th className="py-2 px-2.5 text-right">Dừng lỗ</th>
                      <th className="py-2 px-2.5 text-right">Mục tiêu (1.5R / 3R)</th>
                      <th className="py-2 px-2.5 text-center">Kết quả</th>
                      <th className="py-2 px-2.5 text-right">Lãi/Lỗ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                    {backtest.trades.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-zinc-500">
                          Chưa có lệnh nào trên khung nến hiện tại.
                        </td>
                      </tr>
                    ) : (
                      backtest.trades.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-1.5 px-2.5 text-zinc-500">{t.id}</td>
                          <td className="py-1.5 px-2.5 text-zinc-300">
                            {typeof t.entryDate === 'object' ? JSON.stringify(t.entryDate) : String(t.entryDate)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-zinc-100 font-bold">
                            {t.entryPrice.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-rose-400">
                            {t.stopLossPrice.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-zinc-300 text-[10px]">
                            <span className="text-cyan-400">{t.target1_5R.toFixed(2)}</span>
                            <span className="text-zinc-600 mx-1">/</span>
                            <span className="text-emerald-400">{t.target3R.toFixed(2)}</span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            {t.exitReason === 'TARGET_3R' && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                🎯 3.0R
                              </span>
                            )}
                            {t.exitReason === 'STOP_LOSS' && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                🛑 DỪNG
                              </span>
                            )}
                            {t.exitReason === 'TREND_REVERSAL' && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                                  t.pnlR > 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                ĐẢO ({t.pnlR > 0 ? `+${t.pnlR}R` : `${t.pnlR}R`})
                              </span>
                            )}
                            {t.exitReason === 'HOLDING' && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                GIỮ
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 text-right font-bold ${
                              t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {t.pnlPercent >= 0 ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <span className="text-[11px] font-bold text-zinc-200 block uppercase tracking-wider">
                  Tham Số Kỹ Thuật
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-400 block text-[11px]">Chu kỳ ATR:</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={tempPeriod}
                      onChange={(e) => setTempPeriod(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 block text-[11px]">Hệ số ATR:</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={10}
                      value={tempMultiplier}
                      onChange={(e) => setTempMultiplier(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 block text-[11px]">Chu kỳ KAMA:</label>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={tempKamaPeriod}
                      onChange={(e) => setTempKamaPeriod(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTempPeriod(10);
                    setTempMultiplier(3.0);
                    setTempKamaPeriod(10);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Mặc định
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>* Backtest nến thật {symbol}.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
};
