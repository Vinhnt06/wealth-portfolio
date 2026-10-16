'use client';

import React from 'react';
import { X, ArrowCounterClockwise, Sliders, Check } from '@phosphor-icons/react';
import {
  DEFAULT_VOLUME_PROFILE_SETTINGS,
  VolumeProfileSettings,
} from '../utils/volumeProfile';

interface VolumeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VolumeProfileSettings;
  onUpdateSettings: (settings: VolumeProfileSettings) => void;
}

const ROW_COUNT_OPTIONS = [
  { value: 24, label: 'Thưa (24 dòng)', desc: 'Tổng quan nhanh vùng thanh khoản lớn' },
  { value: 48, label: 'Tiêu chuẩn (48 dòng)', desc: 'Cân bằng tối ưu giữa độ chi tiết và độ mượt' },
  { value: 72, label: 'Mịn cao (72 dòng)', desc: 'Chi tiết cao từng nấc giá bước nhảy' },
  { value: 96, label: 'Siêu mịn (96 dòng)', desc: 'Phân giải tối đa cấu trúc khớp lệnh' },
];

const VA_PERCENT_OPTIONS = [
  { value: 68, label: '68% (1 Sigma chuẩn thống kê)' },
  { value: 70, label: '70% (Chuẩn TradingView & Market Profile)' },
  { value: 80, label: '80% (Vùng giá trị rộng)' },
];

const WIDTH_PERCENT_OPTIONS = [
  { value: 20, label: 'Gọn (20%)' },
  { value: 28, label: 'Tiêu chuẩn (28%)' },
  { value: 38, label: 'Rộng (38%)' },
];

export function VolumeProfileModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: VolumeProfileModalProps) {
  if (!isOpen) return null;

  const handleReset = () => {
    onUpdateSettings({ ...DEFAULT_VOLUME_PROFILE_SETTINGS, enabled: settings.enabled });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden font-mono text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Cài đặt Volume Profile Nâng cao</h2>
              <p className="text-[11px] text-zinc-400">Fixed/Session Range • POC • Value Area 70% • Delta Mua/Bán</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[72vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Row Count */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
              1. Độ mịn mức giá (Số lượng Dòng / Bins)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROW_COUNT_OPTIONS.map((opt) => {
                const isSelected = settings.rowCount === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateSettings({ ...settings, rowCount: opt.value })}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="font-bold flex items-center justify-between text-xs">
                      {opt.label}
                      {isSelected && <Check size={14} className="text-cyan-400" />}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 leading-snug">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value Area Percentage */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
              2. Tỷ lệ Vùng Giá Trị (Value Area %)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VA_PERCENT_OPTIONS.map((opt) => {
                const isSelected = settings.valueAreaPercent === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateSettings({ ...settings, valueAreaPercent: opt.value })}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Width Percentage */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
              3. Độ rộng hiển thị (% chiều ngang đồ thị)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WIDTH_PERCENT_OPTIONS.map((opt) => {
                const isSelected = settings.widthPercent === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateSettings({ ...settings, widthPercent: opt.value })}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Display Toggles */}
          <div className="pt-2 border-t border-zinc-800/80">
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
              4. Các đường mốc & Nhãn giá
            </label>
            <div className="space-y-2">
              {/* POC Line */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                  <span className="font-semibold text-zinc-200">Đường POC (Point of Control)</span>
                  <span className="text-[10px] text-zinc-500">• Mức giá có thanh khoản cao nhất</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.showPocLine}
                  onChange={(e) => onUpdateSettings({ ...settings, showPocLine: e.target.checked })}
                  className="rounded border-zinc-700 text-orange-500 focus:ring-0 bg-zinc-800 w-4 h-4"
                />
              </label>

              {/* VAH/VAL Lines */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="font-semibold text-zinc-200">Đường VAH / VAL (Value Area Boundaries)</span>
                  <span className="text-[10px] text-zinc-500">• Đỉnh và Đáy vùng giá trị</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.showVaLines}
                  onChange={(e) => onUpdateSettings({ ...settings, showVaLines: e.target.checked })}
                  className="rounded border-zinc-700 text-cyan-500 focus:ring-0 bg-zinc-800 w-4 h-4"
                />
              </label>

              {/* Price Labels */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-semibold text-zinc-200">Nhãn giá chi tiết (Price Badges)</span>
                  <span className="text-[10px] text-zinc-500">• Hiển thị số liệu giá trên mốc</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ ...settings, showLabels: e.target.checked })}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-0 bg-zinc-800 w-4 h-4"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/50">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 text-xs font-semibold transition-all"
          >
            <ArrowCounterClockwise size={13} />
            <span>Mặc định</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-bold transition-all shadow-sm"
          >
            Đóng & Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
