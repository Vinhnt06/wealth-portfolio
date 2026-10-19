'use client';

import React, { useState } from 'react';
import { CaretDown, CaretUp, Compass, TrendUp, TrendDown } from '@phosphor-icons/react';
import { RRGSectorData, getQuadrantInfo } from '../../utils/rrgCalculator';

interface RRGSectorRankingTableProps {
  sectors: RRGSectorData[];
  selectedSectorId: string | null;
  onSelectSector: (sectorId: string | null) => void;
}

export const RRGSectorRankingTable: React.FC<RRGSectorRankingTableProps> = ({
  sectors,
  selectedSectorId,
  onSelectSector,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'momentum' | 'ratio' | 'velocity' | 'change'>('momentum');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const sortedSectors = [...sectors].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'momentum') diff = a.currentPoint.rsMomentum - b.currentPoint.rsMomentum;
    else if (sortBy === 'ratio') diff = a.currentPoint.rsRatio - b.currentPoint.rsRatio;
    else if (sortBy === 'velocity') diff = a.velocity - b.velocity;
    else if (sortBy === 'change') diff = a.changePercent - b.changePercent;
    return sortAsc ? diff : -diff;
  });

  const handleSort = (field: 'momentum' | 'ratio' | 'velocity' | 'change') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-zinc-950/90 border-t border-zinc-800/80 backdrop-blur-xl">
      {/* Table Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/60 transition-all"
      >
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">BẢNG XẾP HẠNG LUÂN CHUYỂN DÒNG TIỀN (16 NGÀNH)</span>
          <span className="text-[11px] text-zinc-500">
            ({sectors.length} nhóm ngành · Nhấp vào ngành để định vị trên đồ thị)
          </span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <span className="text-[11px]">{isExpanded ? 'Thu gọn' : 'Mở rộng bảng'}</span>
          {isExpanded ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded Table */}
      {isExpanded && (
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto px-4 pb-4">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider sticky top-0 bg-zinc-950">
                <th className="py-2 px-2 font-medium">Nhóm Ngành</th>
                <th className="py-2 px-2 font-medium">Mã Đại Diện</th>
                <th className="py-2 px-2 font-medium text-center">Góc Phần Tư</th>
                <th
                  onClick={() => handleSort('ratio')}
                  className="py-2 px-2 font-medium text-right cursor-pointer hover:text-zinc-200"
                >
                  RS-Ratio (X) {sortBy === 'ratio' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('momentum')}
                  className="py-2 px-2 font-medium text-right cursor-pointer hover:text-zinc-200"
                >
                  RS-Momentum (Y) {sortBy === 'momentum' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('velocity')}
                  className="py-2 px-2 font-medium text-right cursor-pointer hover:text-zinc-200"
                >
                  Vận Tốc {sortBy === 'velocity' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th
                  onClick={() => handleSort('change')}
                  className="py-2 px-2 font-medium text-right cursor-pointer hover:text-zinc-200"
                >
                  % 1D {sortBy === 'change' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {sortedSectors.map((sec) => {
                const isSelected = selectedSectorId === sec.id;
                const qInfo = getQuadrantInfo(sec.quadrant);

                return (
                  <tr
                    key={sec.id}
                    onClick={() => onSelectSector(isSelected ? null : sec.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-800/80 text-white font-bold'
                        : 'hover:bg-zinc-900/50 text-zinc-300'
                    }`}
                  >
                    <td className="py-2 px-2 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: qInfo.color }}
                      />
                      <span>{sec.name}</span>
                    </td>
                    <td className="py-2 px-2 text-zinc-400 text-[11px]">
                      {sec.symbols.slice(0, 3).join(', ')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: qInfo.bgColor,
                          color: qInfo.color,
                          border: `1px solid ${qInfo.borderColor}`,
                        }}
                      >
                        {qInfo.name}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {sec.currentPoint.rsRatio.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {sec.currentPoint.rsMomentum.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-400 font-medium">
                      {sec.velocity.toFixed(2)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-medium ${
                        sec.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sec.changePercent >= 0 ? '+' : ''}
                      {sec.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
