'use client';

import React from 'react';
import { X, ArrowCounterClockwise, Check } from '@phosphor-icons/react';
import {
  DEFAULT_FIBO_LEVELS,
  DEFAULT_FIBO_SETTINGS,
  FiboPivotsSettings,
  FiboTimeframeOption,
} from '../utils/fibonacciPivots';

interface FiboPivotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FiboPivotsSettings;
  onUpdateSettings: (settings: FiboPivotsSettings) => void;
}

const TIMEFRAME_OPTIONS: { id: FiboTimeframeOption; label: string; desc: string }[] = [
  { id: 'Auto', label: 'Tự động (Auto)', desc: 'Tự gán HTF theo độ phân giải nến: <=15m -> Ngày, 1D -> Tháng, 1W -> Quý' },
  { id: 'Daily', label: 'Hàng ngày (Daily)', desc: 'Tính pivot từ ngày hôm trước' },
  { id: 'Weekly', label: 'Hàng tuần (Weekly)', desc: 'Tính pivot từ tuần trước' },
  { id: 'Monthly', label: 'Hàng tháng (Monthly)', desc: 'Tính pivot từ tháng trước (Phù hợp biểu đồ 1D)' },
  { id: 'Quarterly', label: 'Hàng quý (Quarterly)', desc: 'Tính pivot từ quý trước (3 tháng)' },
  { id: 'Yearly', label: 'Hàng năm (Yearly)', desc: 'Tính pivot từ năm trước (12 tháng)' },
];

export function FiboPivotsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: FiboPivotsModalProps) {
  if (!isOpen) return null;

  const handleToggleLevel = (levelId: string) => {
    const current = settings.enabledLevels[levelId] ?? true;
    onUpdateSettings({
      ...settings,
      enabledLevels: {
        ...settings.enabledLevels,
        [levelId]: !current,
      },
    });
  };

  const applyPreset = (preset: 'compact' | 'standard' | 'extended' | 'all') => {
    const updated: Record<string, boolean> = {};
    DEFAULT_FIBO_LEVELS.forEach((lvl) => {
      if (preset === 'compact') {
        // Only PP and levels up to 0.618 (Golden Ratio) - Removes far lines
        updated[lvl.id] = ['pp', 'l1', 'l2', 'l3', 'l4'].includes(lvl.id);
      } else if (preset === 'standard') {
        // Up to 1.0
        updated[lvl.id] = ['pp', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'].includes(lvl.id);
      } else if (preset === 'extended') {
        // Up to 2.618
        updated[lvl.id] = ['pp', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'].includes(lvl.id);
      } else {
        updated[lvl.id] = true;
      }
    });
    onUpdateSettings({
      ...settings,
      enabledLevels: updated,
    });
  };

  const handleReset = () => {
    onUpdateSettings({
      ...DEFAULT_FIBO_SETTINGS,
      enabled: settings.enabled, // Keep active state
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-teal-400 via-indigo-400 to-amber-400 shadow-sm" />
            <div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-zinc-100 tracking-tight">
                FIBONACCI PIVOT POINTS (13 LEVELS)
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                PineScript v6 • 13 tỷ lệ Fibonacci chuẩn xác • Auto Timeframe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Đóng bảng cấu hình"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-mono">
          {/* Section 1: Timeframe Anchor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
                1. Khung thời gian Pivot (Pivots Timeframe)
              </label>
              <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                {settings.timeframe}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, timeframe: opt.id })}
                  className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                    settings.timeframe === opt.id
                      ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-bold text-[11px]">{opt.label}</span>
                  <span className="text-[9px] text-zinc-500 line-clamp-1 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Display & Appearance */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/80">
            <label className="text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
              2. Tùy chọn hiển thị & Nhãn giá
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Number of Pivots Back */}
              <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/80 space-y-1.5">
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Số kỳ lịch sử (Pivots Back)</span>
                  <span className="text-teal-400 font-bold">{settings.maxPivotsBack}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={settings.maxPivotsBack}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, maxPivotsBack: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-teal-500 bg-zinc-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>1 kỳ (Hiện tại • chuẩn TradingView)</span>
                  <span>5 kỳ</span>
                  <span>15 kỳ</span>
                </div>
              </div>

              {/* Label Position */}
              <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/80 space-y-2">
                <span className="text-zinc-300">Vị trí nhãn giá (Labels Position)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['Left', 'Right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, positionLabels: pos })}
                      className={`py-1.5 px-3 rounded-lg border text-center font-bold text-[11px] transition-all ${
                        settings.positionLabels === pos
                          ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                          : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {pos === 'Left' ? 'Bên trái (Left)' : 'Bên phải (Right)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Toggle checkboxes */}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ ...settings, showLabels: e.target.checked })}
                  className="rounded border-zinc-700 text-teal-500 focus:ring-teal-500"
                />
                <span>Hiển thị tên Level (R1, S1, PP)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={settings.showPrices}
                  onChange={(e) => onUpdateSettings({ ...settings, showPrices: e.target.checked })}
                  className="rounded border-zinc-700 text-teal-500 focus:ring-teal-500"
                />
                <span>Hiển thị giá số cụ thể</span>
              </label>
            </div>
          </div>

          {/* Section 3: 13 Fibonacci Levels Selection */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
                3. Danh sách 13 tỷ lệ Fibonacci Levels
              </label>
              <span className="text-[10px] text-zinc-500">Tick chọn để bật/tắt từng level</span>
            </div>

            {/* Quick Presets for Easy Filtering */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 font-bold mr-1">Phím nhanh:</span>
              <button
                type="button"
                onClick={() => applyPreset('compact')}
                className="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 font-bold text-[10px] transition-colors"
                title="Chỉ giữ các đường gần (PP đến 0.618 Golden)"
              >
                Gọn gàng (≤ 0.618)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[10px] transition-colors"
                title="Tiêu chuẩn (PP đến 1.0)"
              >
                Tiêu chuẩn (≤ 1.0)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('extended')}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[10px] transition-colors"
                title="Mở rộng (PP đến 2.618)"
              >
                Mở rộng (≤ 2.618)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[10px] transition-colors"
                title="Bật toàn bộ 13 mức"
              >
                Tất cả (13 Levels)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DEFAULT_FIBO_LEVELS.map((lvl) => {
                const isChecked = settings.enabledLevels[lvl.id] ?? lvl.defaultShow;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleToggleLevel(lvl.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${
                      isChecked
                        ? 'bg-zinc-900/90 border-zinc-800 text-zinc-200'
                        : 'bg-zinc-900/30 border-zinc-900 text-zinc-600 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border border-black/40 shadow-sm"
                        style={{ backgroundColor: lvl.color }}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[11px] text-zinc-100">
                            {lvl.id === 'pp' ? 'PP 0 (Pivot Point)' : `Level ${lvl.name} (R${lvl.name} / S${lvl.name})`}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Tỷ lệ: {lvl.ratio} • {lvl.style === 'Solid' ? 'Nét liền' : 'Nét đứt'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
                          : 'border-zinc-800 bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check size={12} weight="bold" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/60 font-mono">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors text-xs"
          >
            <ArrowCounterClockwise size={13} />
            <span>Mặc định</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
