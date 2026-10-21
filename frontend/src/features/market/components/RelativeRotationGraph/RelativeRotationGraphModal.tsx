'use client';

import React, { useEffect, useRef } from 'react';
import { RRGDataset } from '../../utils/rrgCalculator';
import { RRGControlBar } from './RRGControlBar';
import { RelativeRotationGraphCanvas, CanvasHandle } from './RelativeRotationGraphCanvas';
import { RRGSectorRankingTable } from './RRGSectorRankingTable';

interface RelativeRotationGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: RRGDataset | null;
  timeframe: '1D' | '1W';
  onChangeTimeframe: (tf: '1D' | '1W') => void;
  tailLength: number;
  onChangeTailLength: (tail: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  selectedSectorId: string | null;
  onSelectSector: (sectorId: string | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const RelativeRotationGraphModal: React.FC<RelativeRotationGraphModalProps> = ({
  isOpen,
  onClose,
  dataset,
  timeframe,
  onChangeTimeframe,
  tailLength,
  onChangeTailLength,
  showGrid,
  onToggleGrid,
  selectedSectorId,
  onSelectSector,
  onRefresh,
  isLoading,
}) => {
  const canvasRef = useRef<CanvasHandle>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16] flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Header / Control Bar */}
      <RRGControlBar
        dataset={dataset}
        timeframe={timeframe}
        onChangeTimeframe={onChangeTimeframe}
        tailLength={tailLength}
        onChangeTailLength={onChangeTailLength}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        onExportImage={() => canvasRef.current?.exportImage()}
        onRefresh={onRefresh}
        isLoading={isLoading}
        isFullscreen={true}
        onToggleFullscreen={onClose}
        onClose={onClose}
      />

      {/* 4 Quadrants Quick Guide Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-semibold">DẪN DẮT:</span>
          <span className="text-zinc-400 truncate">Vượt trội & Tăng tốc</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/20 border border-amber-900/30 text-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="font-semibold">SUY YẾU:</span>
          <span className="text-zinc-400 truncate">Vẫn mạnh nhưng giảm tốc</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/20 border border-rose-900/30 text-rose-300">
          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
          <span className="font-semibold">TỤT HẬU:</span>
          <span className="text-zinc-400 truncate">Yếu thế & Đuối sức</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/20 border border-sky-900/30 text-sky-300">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          <span className="font-semibold">CẢI THIỆN:</span>
          <span className="text-zinc-400 truncate">Hồi phục & Tăng xung lực</span>
        </div>
      </div>

      {/* Main Fullscreen Canvas Area */}
      <div className="flex-1 relative w-full h-full min-h-0 bg-[#090d16]">
        <RelativeRotationGraphCanvas
          ref={canvasRef}
          sectors={dataset?.sectors || []}
          showGrid={showGrid}
          selectedSectorId={selectedSectorId}
          onSelectSector={onSelectSector}
          height="100%"
          isModal={true}
        />
      </div>

      {/* Collapsible Bottom Ranking Table */}
      <RRGSectorRankingTable
        sectors={dataset?.sectors || []}
        selectedSectorId={selectedSectorId}
        onSelectSector={onSelectSector}
      />
    </div>
  );
};
