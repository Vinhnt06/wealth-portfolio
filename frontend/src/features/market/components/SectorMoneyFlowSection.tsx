'use client';

import React, { useState, useEffect } from 'react';
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
  ArrowClockwise,
  WarningCircle,
} from '@phosphor-icons/react';

export function SectorMoneyFlowSection() {
  const [data, setData] = useState<SessionSectorFlow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(20);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSectorFlow | null>(null);

  const fetchData = async (limitVal: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/sector-flow?limit=${limitVal}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setData(json.data);
          setWarnings(json.warnings || []);
        }
      }
    } catch (e) {
      console.error('Failed to load sector flow data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(limit);
  }, [limit]);

  const latest = data[0];

  return (
    <div className="space-y-7">
      {/* ── TOP HEADER TOOLBAR: GLOBAL TIMEFRAME & CONTROLS AT TOP OF PAGE ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-xl">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>Dòng Tiền Ngành & Ma Trận Thanh Khoản Thị Trường</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Dữ liệu realtime từ 3 sàn HOSE, HNX, UPCOM • Đơn vị: Tỷ VNĐ
          </p>
        </div>

        {/* Global Timeframe Selector at the very top */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
            <span className="text-zinc-500 text-[11px] font-sans px-2">Khung thời gian:</span>
            {[10, 20, 30, 50].map((num) => (
              <button
                key={num}
                onClick={() => setLimit(num)}
                className={`px-3 py-1.5 rounded-lg transition-all font-mono ${
                  limit === num
                    ? 'bg-zinc-800 text-emerald-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {num} Phiên
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchData(limit)}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <ArrowClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium">
            <WarningCircle className="w-4 h-4 shrink-0" />
            <span>Cảnh Báo Dòng Tiền:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {warnings.map((w, idx) => (
              <span
                key={idx}
                className="font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[11px]"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* ── SECTION 1: CHART 5 NHÓM TRỤ CỘT (NH, CK, BĐS, THÉP, VIN) ── */}
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

      {/* ── SECTION 3: BẢNG DỮ LIỆU GIAO DỊCH CHI TIẾT TỪNG PHIÊN ── */}
      <section className="space-y-3 pt-2 border-t border-zinc-900">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-4 rounded-full bg-amber-500" />
          <h2 className="text-base font-bold text-zinc-100">
            Phần 3: Bảng Dữ Liệu Giao Dịch Chi Tiết Từng Phiên
          </h2>
        </div>
        <SectorMoneyFlowTable
          data={data}
          loading={loading}
          hideTimeframe={true}
        />
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
