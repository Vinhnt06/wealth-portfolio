'use client';

import React from 'react';
import { SessionSectorFlow, SectorItemData, getMoneyFlowHeatStyle, SECTOR_META } from './SectorMoneyFlowTable';
import { X } from '@phosphor-icons/react';

interface SectorSessionDetailModalProps {
  session: SessionSectorFlow | null;
  onClose: () => void;
}

export function SectorSessionDetailModal({
  session,
  onClose,
}: SectorSessionDetailModalProps) {
  if (!session) return null;

  const formatVal = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '-';
    return val.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              Chi Tiết Khớp Lệnh Dòng Tiền • Phiên {session.date}
              {session.isLive && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                  Live
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Tổng thanh khoản thị trường: <strong className="text-emerald-400 font-mono">{formatVal(session.totalMarket)} Tỷ VNĐ</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content: Grid Breakdown per Sector */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {Object.entries(SECTOR_META).map(([key, meta]) => {
            const item = (session as any)[key] as SectorItemData | undefined;
            if (!item) return null;
            const heat = getMoneyFlowHeatStyle(item.ratioPct);
            const netBuyVal = (item.buy || 0) - (item.sell || 0);

            return (
              <div
                key={key}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <div>
                    <div className="font-semibold text-zinc-200 text-xs sm:text-sm">
                      {meta.label}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      Tổng: <strong className="text-zinc-100">{formatVal(item.total)} Tỷ</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <div className="text-emerald-400">Mua CĐ: {formatVal(item.buy)} Tỷ</div>
                    <div className="text-rose-400">Bán CĐ: {formatVal(item.sell)} Tỷ</div>
                  </div>

                  <div className="text-right pl-3 border-l border-zinc-800">
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${heat.className}`}>
                      {item.ratioPct}%
                    </span>
                    <div className={`text-[10px] mt-1 ${netBuyVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {netBuyVal >= 0 ? `+${formatVal(netBuyVal)} Tỷ` : `${formatVal(netBuyVal)} Tỷ`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
