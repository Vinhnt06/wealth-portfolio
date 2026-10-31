'use client';

import React, { useState } from 'react';
import { SectorMoneyFlowTable, SessionSectorFlow } from './SectorMoneyFlowTable';
import { SectorFlowChart } from './SectorFlowChart';
import {
  Bank,
  Buildings,
  TrendUp,
  Fire,
  ChartPieSlice,
  ShieldCheck,
  WarningOctagon,
  Sparkle,
} from '@phosphor-icons/react';

export function SectorMoneyFlowSection() {
  const [data, setData] = useState<SessionSectorFlow[]>([]);

  const latest = data[0];

  return (
    <div className="space-y-6">
      {/* Top Sector Overview KPI Cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Ngân hàng */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Bank className="w-4 h-4 text-blue-400" />
                Ngân Hàng
              </span>
              {latest.nh?.isClimax ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.nh?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Vùng Trũng
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">Bình thường</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                {latest.nh?.ratioPct}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {latest.nh?.total?.toLocaleString('vi-VN')} Tỷ
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span className="text-emerald-400">Mua: {latest.nh?.buy?.toLocaleString('vi-VN')}</span>
              <span className="text-rose-400">Bán: {latest.nh?.sell?.toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Chứng khoán */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <TrendUp className="w-4 h-4 text-amber-400" />
                Chứng Khoán
              </span>
              {latest.ck?.isClimax ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.ck?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Vùng Trũng
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">Bình thường</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                {latest.ck?.ratioPct}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {latest.ck?.total?.toLocaleString('vi-VN')} Tỷ
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span className="text-emerald-400">Mua: {latest.ck?.buy?.toLocaleString('vi-VN')}</span>
              <span className="text-rose-400">Bán: {latest.ck?.sell?.toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Bất động sản */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Buildings className="w-4 h-4 text-emerald-400" />
                Bất Động Sản
              </span>
              {latest.bds?.isClimax ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.bds?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Vùng Trũng
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">Bình thường</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                {latest.bds?.ratioPct}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {latest.bds?.total?.toLocaleString('vi-VN')} Tỷ
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span className="text-emerald-400">Mua: {latest.bds?.buy?.toLocaleString('vi-VN')}</span>
              <span className="text-rose-400">Bán: {latest.bds?.sell?.toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Thép */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Thép & Kim Loại
              </span>
              {latest.thep?.isClimax ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.thep?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Vùng Trũng
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">Bình thường</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                {latest.thep?.ratioPct}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {latest.thep?.total?.toLocaleString('vi-VN')} Tỷ
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span className="text-emerald-400">Mua: {latest.thep?.buy?.toLocaleString('vi-VN')}</span>
              <span className="text-rose-400">Bán: {latest.thep?.sell?.toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Họ Vin */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Fire className="w-4 h-4 text-rose-400" />
                Họ Vin (VIC/VHM/VRE)
              </span>
              {latest.vin?.isClimax ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.vin?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Vùng Trũng
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">Bình thường</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-100">
                {latest.vin?.ratioPct}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {latest.vin?.total?.toLocaleString('vi-VN')} Tỷ
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span className="text-emerald-400">Mua: {latest.vin?.buy?.toLocaleString('vi-VN')}</span>
              <span className="text-rose-400">Bán: {latest.vin?.sell?.toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Rotation Chart */}
      {data.length > 0 && <SectorFlowChart data={data} />}

      {/* Main Matrix Table */}
      <SectorMoneyFlowTable onDataLoaded={(loadedData) => setData(loadedData)} />
    </div>
  );
}
