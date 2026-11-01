'use client';

import React, { useState } from 'react';
import { SectorMoneyFlowTable, SessionSectorFlow } from './SectorMoneyFlowTable';
import { SectorFlowChart } from './SectorFlowChart';
import { SectorHeatmapMatrix } from './SectorHeatmapMatrix';
import { SectorSessionDetailModal } from './SectorSessionDetailModal';
import {
  Bank,
  Buildings,
  TrendUp,
  Fire,
  ShieldCheck,
  ChartLineUp,
  SquaresFour,
} from '@phosphor-icons/react';

export function SectorMoneyFlowSection() {
  const [data, setData] = useState<SessionSectorFlow[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSectorFlow | null>(null);

  const latest = data[0];

  return (
    <div className="space-y-8">
      {/* ── TOP SECTOR OVERVIEW KPI CARDS ── */}
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60 font-bold">
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60 font-bold">
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  Đỉnh Dòng Tiền
                </span>
              ) : latest.bds?.isTrough ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold">
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 font-bold">
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

      {/* ── SECTION 1: CHART NHÓM CỐT LÕI (NGÂN HÀNG, CHỨNG KHOÁN, BẤT ĐỘNG SẢN, THÉP, HỌ VIN) ── */}
      {data.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-4 rounded-full bg-blue-500" />
            <h2 className="text-base font-bold text-zinc-100">
              Phần 1: Dòng Tiền Nhóm Trụ Cột (NH - CK - BĐS - Thép - Vin)
            </h2>
          </div>
          <SectorFlowChart
            data={data}
            variant="core"
            title="Biểu Đồ Luân Chuyển Dòng Tiền 5 Nhóm Trụ Cột"
            subtitle="Quan sát sự dịch chuyển thanh khoản giữa các nhóm dẫn dắt (Nhấp vào ngành trên thanh legend để Focus làm nổi bật đường)"
          />
        </section>
      )}

      {/* ── SECTION 2: TOÀN BỘ 11 NHÓM NGÀNH THỊ TRƯỜNG & MA TRẬN NHIỆT TOÀN DIỆN ── */}
      {data.length > 0 && (
        <section className="space-y-4 pt-2 border-t border-zinc-900">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-4 rounded-full bg-emerald-500" />
            <h2 className="text-base font-bold text-zinc-100">
              Phần 2: Toàn Cảnh 11 Nhóm Ngành Toàn Thị Trường
            </h2>
          </div>

          {/* Chart Full 11 Ngành */}
          <SectorFlowChart
            data={data}
            variant="full"
            title="Biểu Đồ Luân Chuyển Toàn Bộ 11 Nhóm Ngành"
            subtitle="Phản ánh chuyển động thanh khoản trên toàn bộ 11 phân ngành thị trường (Nhấp vào ngành để bật sáng và làm mờ các ngành khác)"
          />

          {/* Bản Đồ Nhiệt Ma Trận % 11 Ngành Thị Trường */}
          <SectorHeatmapMatrix
            data={data}
            onSelectSession={(session) => setSelectedSession(session)}
          />
        </section>
      )}

      {/* ── SECTION 3: BẢNG DỮ LIỆU CHI TIẾT TỪNG PHIÊN ── */}
      <section className="space-y-3 pt-2 border-t border-zinc-900">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-4 rounded-full bg-amber-500" />
          <h2 className="text-base font-bold text-zinc-100">
            Phần 3: Bảng Dữ Liệu Giao Dịch Chi Tiết Từng Phiên
          </h2>
        </div>
        <SectorMoneyFlowTable onDataLoaded={(loadedData) => setData(loadedData)} />
      </section>

      {/* Modal Chi Tiết Khớp Lệnh Của Phiên Khi Click Từ Bản Đồ Nhiệt */}
      {selectedSession && (
        <SectorSessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
