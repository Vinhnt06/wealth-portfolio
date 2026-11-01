'use client';

import React from 'react';
import { SessionSectorFlow, SectorItemData, getMoneyFlowHeatStyle } from './SectorMoneyFlowTable';
import { ALL_11_SECTORS } from './SectorFlowChart';
import { SquaresFour } from '@phosphor-icons/react';

interface SectorHeatmapMatrixProps {
  data: SessionSectorFlow[];
  onSelectSession?: (session: SessionSectorFlow) => void;
}

export function SectorHeatmapMatrix({
  data,
  onSelectSession,
}: SectorHeatmapMatrixProps) {
  if (!data || data.length === 0) return null;

  // Chronological or reverse chronological sessions (newest right or left)
  // Display from newest to oldest for immediate visibility, or oldest to newest (left to right matching chart)
  const sessions = [...data].reverse();

  // Calculate Average Ratio % for each sector across available sessions
  const sectorAverages: Record<string, number> = {};
  ALL_11_SECTORS.forEach((sec) => {
    let sum = 0;
    let count = 0;
    sessions.forEach((s) => {
      const item = (s as any)[sec.key] as SectorItemData | undefined;
      if (item && item.ratioPct !== undefined && !isNaN(item.ratioPct)) {
        sum += item.ratioPct;
        count += 1;
      }
    });
    sectorAverages[sec.key] = count > 0 ? sum / count : 0;
  });

  return (
    <div className="p-5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-xl space-y-4">
      {/* Title & Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <SquaresFour className="w-4 h-4 text-emerald-400" />
            <span>Bản Đồ Nhiệt Tỷ Trọng 11 Nhóm Ngành Toàn Thị Trường</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Ma trận nhiệt liền khối phản ánh phân bổ và dịch chuyển % thanh khoản thị trường qua từng phiên
          </p>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-sans">
          <span className="text-zinc-500 font-medium mr-1">Thang nhiệt:</span>
          <span className="px-2 py-0.5 rounded font-bold bg-emerald-600/90 text-white">
            &ge; 25% Cực mạnh
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-emerald-700/85 text-emerald-50">
            18% - 25% Mạnh
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-teal-700/80 text-teal-50">
            12% - 18% Khá tốt
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-amber-600/80 text-amber-50">
            8% - 12% Trung bình khá
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-orange-600/85 text-orange-50">
            4% - 8% Trung bình
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-rose-700/85 text-rose-50">
            2.5% - 4% Thấp
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-red-950/95 text-red-200">
            &lt; 2.5% Cạn
          </span>
        </div>
      </div>

      {/* Heatmap Table Matrix */}
      <div className="relative overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl">
        <table className="w-full text-left text-xs text-zinc-200 border-collapse">
          <thead className="bg-zinc-900/95 text-zinc-300 font-mono text-[11px] sticky top-0 z-20 backdrop-blur-md border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap border-r border-zinc-800/80 min-w-[190px] text-zinc-300 font-sans font-bold sticky left-0 z-30 bg-zinc-900/95">
                Nhóm Ngành ({ALL_11_SECTORS.length})
              </th>
              {sessions.map((s) => (
                <th
                  key={s.date}
                  className="px-2.5 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center text-zinc-400 min-w-[76px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    {s.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    <span>{s.displayDate || s.date.slice(5)}</span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 whitespace-nowrap border-l border-zinc-700 text-center text-emerald-400 font-bold min-w-[70px] bg-zinc-900/95">
                TB (%)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/60 font-mono text-[11.5px]">
            {ALL_11_SECTORS.map((sec) => {
              const avg = sectorAverages[sec.key] || 0;
              const avgHeat = getMoneyFlowHeatStyle(avg);

              return (
                <tr key={sec.key} className="hover:bg-zinc-800/20 transition-colors">
                  {/* Tên ngành & Chấm màu */}
                  <td className="px-4 py-2.5 whitespace-nowrap border-r border-zinc-800/80 font-sans font-semibold text-zinc-200 bg-zinc-900/60 sticky left-0 z-10">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="truncate">{sec.name}</span>
                    </div>
                  </td>

                  {/* Các ô tỷ trọng % qua các phiên (Fill full cell color edge-to-edge) */}
                  {sessions.map((s) => {
                    const itemData = (s as any)[sec.key] as SectorItemData | undefined;
                    const pct = itemData?.ratioPct;
                    const heat = getMoneyFlowHeatStyle(pct);

                    return (
                      <td
                        key={s.date}
                        className={`py-2 px-1 border-r border-zinc-900/60 text-center font-bold text-xs cursor-pointer transition-all hover:brightness-125 ${heat.cellClass}`}
                        title={`${sec.name} (${s.date}): ${pct !== undefined ? pct.toFixed(2) : '-'}% • GTGD: ${itemData?.total ? itemData.total.toLocaleString('vi-VN') : '-'} Tỷ`}
                        onClick={() => onSelectSession && onSelectSession(s)}
                      >
                        <span>{pct !== undefined ? `${pct.toFixed(1)}%` : '-'}</span>
                      </td>
                    );
                  })}

                  {/* Cột Trung Bình % Tỷ Trọng */}
                  <td
                    className={`py-2 px-1 border-l border-zinc-700 text-center font-bold text-xs ${avgHeat.cellClass}`}
                    title={`Tỷ trọng trung bình của ngành ${sec.name}: ${avg.toFixed(2)}%`}
                  >
                    <span>{avg.toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
