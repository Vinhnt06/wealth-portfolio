'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RRGDataset } from '../../utils/rrgCalculator';
import { RRGControlBar } from './RRGControlBar';
import { RelativeRotationGraphCanvas, CanvasHandle } from './RelativeRotationGraphCanvas';
import { RRGSectorRankingTable } from './RRGSectorRankingTable';
import { RelativeRotationGraphModal } from './RelativeRotationGraphModal';
import { Compass, WarningCircle } from '@phosphor-icons/react';

interface RelativeRotationGraphCardProps {
  className?: string;
  defaultHeight?: number;
}

export const RelativeRotationGraphCard: React.FC<RelativeRotationGraphCardProps> = ({
  className = '',
  defaultHeight = 620,
}) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W'>('1D');
  const [tailLength, setTailLength] = useState<number>(4);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [dataset, setDataset] = useState<RRGDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/market/rrg?timeframe=${timeframe}&tail=${tailLength}&benchmark=VNINDEX`
      );
      if (!res.ok) {
        throw new Error(`Lỗi tải dữ liệu RRG: HTTP ${res.status}`);
      }
      const json = await res.json();
      const data: RRGDataset = json.data || json;
      setDataset(data);
    } catch (err: unknown) {
      console.error('Failed to load RRG data:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu luân chuyển dòng tiền RRG'
      );
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, tailLength]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div
      className={`relative rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Control Bar Header */}
      <RRGControlBar
        dataset={dataset}
        timeframe={timeframe}
        onChangeTimeframe={setTimeframe}
        tailLength={tailLength}
        onChangeTailLength={setTailLength}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onExportImage={() => canvasRef.current?.exportImage()}
        onRefresh={fetchData}
        isLoading={isLoading}
        isFullscreen={false}
        onToggleFullscreen={() => setIsModalOpen(true)}
      />

      {/* Main Canvas / Chart Body */}
      <div className="relative w-full overflow-hidden bg-[#090d16]">
        {isLoading && !dataset ? (
          <div
            className="flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs"
            style={{ height: defaultHeight }}
          >
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span>Đang tính toán luân chuyển dòng tiền 16 nhóm ngành từ nến Entrade...</span>
          </div>
        ) : error && !dataset ? (
          <div
            className="flex flex-col items-center justify-center gap-3 text-rose-400 font-mono text-xs"
            style={{ height: defaultHeight }}
          >
            <WarningCircle className="w-8 h-8" />
            <span>{error}</span>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <RelativeRotationGraphCanvas
            ref={canvasRef}
            sectors={dataset?.sectors || []}
            showGrid={showGrid}
            selectedSectorId={selectedSectorId}
            onSelectSector={setSelectedSectorId}
            height={defaultHeight}
          />
        )}
      </div>

      {/* Collapsible Ranking Table */}
      {dataset && (
        <RRGSectorRankingTable
          sectors={dataset.sectors}
          selectedSectorId={selectedSectorId}
          onSelectSector={setSelectedSectorId}
        />
      )}

      {/* Fullscreen Modal View */}
      <RelativeRotationGraphModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dataset={dataset}
        timeframe={timeframe}
        onChangeTimeframe={setTimeframe}
        tailLength={tailLength}
        onChangeTailLength={setTailLength}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        selectedSectorId={selectedSectorId}
        onSelectSector={setSelectedSectorId}
        onRefresh={fetchData}
        isLoading={isLoading}
      />
    </div>
  );
};
