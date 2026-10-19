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
