'use client';

import React from 'react';
import {
  GridFour,
  Camera,
  ArrowsOutSimple,
  ArrowsInSimple,
  X,
  CalendarBlank,
  ArrowsClockwise,
  Compass,
} from '@phosphor-icons/react';
import { RRGDataset } from '../../utils/rrgCalculator';

interface RRGControlBarProps {
  dataset: RRGDataset | null;
  timeframe: '1D' | '1W';
  onChangeTimeframe: (tf: '1D' | '1W') => void;
  tailLength: number;
  onChangeTailLength: (tail: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  onExportImage: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose?: () => void;
}

export const RRGControlBar: React.FC<RRGControlBarProps> = ({
  dataset,
  timeframe,
  onChangeTimeframe,
  tailLength,
  onChangeTailLength,
  showGrid,
  onToggleGrid,
  onExportImage,
  onRefresh,
  isLoading,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) => {
  const summary = dataset?.summary || {
    leading: 0,
    weakening: 0,
    lagging: 0,
    improving: 0,
    total: 16,
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-xl">
      {/* Left: Title, Stats Badges, Date Range */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
        {/* Main Title */}
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-3.5 h-3.5" weight="bold" />
          </div>
          <span className="font-bold text-sm text-zinc-100 tracking-tight">
            RRG — Market Watch
          </span>
        </div>

        {/* Timeframe Toggle */}
        <div className="flex items-center bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => onChangeTimeframe('1D')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              timeframe === '1D'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Khung ngày
          </button>
          <button
            onClick={() => onChangeTimeframe('1W')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              timeframe === '1W'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Khung tuần
          </button>
        </div>

        {/* Sectors count */}
        <span className="text-zinc-400 text-[11px]">16 ngành</span>
        <span className="text-zinc-700">·</span>

        {/* Tail selector */}
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 text-[11px]">Đuôi:</span>
          <select
            value={tailLength}
            onChange={(e) => onChangeTailLength(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-[11px] px-2 py-0.5 rounded focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value={3}>3 kỳ</option>
            <option value={4}>4 kỳ</option>
            <option value={8}>8 kỳ</option>
            <option value={12}>12 kỳ</option>
          </select>
        </div>
        <span className="text-zinc-700">·</span>

        {/* Quadrant Counts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Dẫn dắt {summary.leading}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Suy yếu {summary.weakening}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Tụt hậu {summary.lagging}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Cải thiện {summary.improving}
          </span>
        </div>

        {/* Date Range Display */}
        {dataset?.dateRange && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px]">
            <CalendarBlank className="w-3.5 h-3.5 text-zinc-500" />
            <span>{formatDateDisplay(dataset.dateRange.start)}</span>
            <span className="text-zinc-600">→</span>
            <span>{formatDateDisplay(dataset.dateRange.end)}</span>
          </div>
        )}

        {/* Live Data Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Realtime Data</span>
        </div>
      </div>

      {/* Right: Actions (Lưới, Ảnh, Refresh, Fullscreen/Close) */}
      <div className="flex items-center gap-2 self-end lg:self-auto">
        {/* Toggle Grid */}
        <button
          onClick={onToggleGrid}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
            showGrid
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
          title="Bật/Tắt hiển thị lưới tọa độ"
        >
          <GridFour className="w-3.5 h-3.5" />
          <span>Lưới</span>
        </button>

        {/* Export Image */}
        <button
          onClick={onExportImage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 transition-all"
          title="Xuất ảnh biểu đồ PNG"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Ảnh</span>
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-all disabled:opacity-50"
          title="Làm mới dữ liệu"
        >
          <ArrowsClockwise
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`}
          />
        </button>

        {/* Toggle Fullscreen Modal */}
        <button
          onClick={onToggleFullscreen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 transition-all"
          title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
        >
          {isFullscreen ? (
            <ArrowsInSimple className="w-3.5 h-3.5" />
          ) : (
            <ArrowsOutSimple className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </span>
        </button>

        {/* Close button if inside modal */}
        {isFullscreen && onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all font-bold ml-1"
          >
            <X className="w-3.5 h-3.5" weight="bold" />
            <span>Đóng</span>
          </button>
        )}
      </div>
    </div>
  );
};
