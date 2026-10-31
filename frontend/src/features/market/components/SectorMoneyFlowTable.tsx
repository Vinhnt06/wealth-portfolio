'use client';

import React, { useState, useEffect } from 'react';
import {
  Gear,
  ArrowsDownUp,
  WarningCircle,
  CheckCircle,
  TrendUp,
  TrendDown,
  Sparkle,
  ArrowClockwise,
} from '@phosphor-icons/react';

export interface SectorItemData {
  total: number;
  buy: number;
  sell: number;
  ratioPct: number;
  isClimax: boolean;
  isTrough: boolean;
}

export interface SessionSectorFlow {
  date: string;
  displayDate: string;
  totalMarket: number;
  nh: SectorItemData;
  ck: SectorItemData;
  bds: SectorItemData;
  thep: SectorItemData;
  vin: SectorItemData;
  isLive?: boolean;
}

interface SectorMoneyFlowTableProps {
  onDataLoaded?: (data: SessionSectorFlow[]) => void;
}

export function SectorMoneyFlowTable({ onDataLoaded }: SectorMoneyFlowTableProps) {
  const [data, setData] = useState<SessionSectorFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<number>(30);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Column visibility settings
  const [colSettings, setColSettings] = useState({
    showActiveTrades: true, // Mua CĐ / Bán CĐ
    showNh: true,
    showCk: true,
    showBds: true,
    showThep: true,
    showVin: true,
    showRatios: true,
  });

  const fetchData = async (limitVal: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/sector-flow?limit=${limitVal}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setData(json.data);
          setWarnings(json.warnings || []);
          if (onDataLoaded) onDataLoaded(json.data);
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

  // Format number in billions with Vietnamese formatting (e.g. 14.768 or 2,816.77)
  const formatVal = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '-';
    return val.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Climax & Market Money Flow Warning Bar */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
            <WarningCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Cảnh Báo Dòng Tiền:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {warnings.map((w, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
              >
                <Sparkle className="w-3 h-3 text-amber-400" />
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar: Title, Limits, Settings Modal Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
            ₫
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
              Bảng Theo Dõi Dòng Tiền Ngành
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-normal">
                Đơn vị: Tỷ VNĐ
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Phân bổ thanh khoản & bóc tách Mua/Bán chủ động qua từng phiên giao dịch
            </p>
          </div>
        </div>

        {/* Actions: Timeframe Buttons & Settings */}
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setLimit(10)}
              className={`px-3 py-1 rounded-lg transition-all ${
                limit === 10
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              10 Phiên
            </button>
            <button
              onClick={() => setLimit(20)}
              className={`px-3 py-1 rounded-lg transition-all ${
                limit === 20
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              20 Phiên
            </button>
            <button
              onClick={() => setLimit(30)}
              className={`px-3 py-1 rounded-lg transition-all ${
                limit === 30
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              30 Phiên
            </button>
            <button
              onClick={() => setLimit(60)}
              className={`px-3 py-1 rounded-lg transition-all ${
                limit === 60
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(limit)}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <ArrowClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Customize Columns Button ("⚙ Cài đặt cột") */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition-all shadow-[0_0_12px_rgba(59,130,246,0.15)]"
          >
            <Gear className="w-3.5 h-3.5" />
            <span>Cài đặt cột</span>
          </button>

          {/* Settings Popover Dropdown */}
          {isSettingsOpen && (
            <div className="absolute right-0 top-12 z-50 w-64 p-4 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-semibold text-zinc-200">Tùy Chọn Cột Hiển Thị</span>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colSettings.showActiveTrades}
                    onChange={(e) =>
                      setColSettings({ ...colSettings, showActiveTrades: e.target.checked })
                    }
                    className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                  />
                  <span>Hiện Mua CĐ & Bán CĐ</span>
                </label>

                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colSettings.showRatios}
                    onChange={(e) =>
                      setColSettings({ ...colSettings, showRatios: e.target.checked })
                    }
                    className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                  />
                  <span>Hiện Tỉ Lệ Dòng Tiền (%)</span>
                </label>

                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                    Nhóm Ngành
                  </span>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colSettings.showNh}
                      onChange={(e) => setColSettings({ ...colSettings, showNh: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                    />
                    <span>Ngân hàng (NH)</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colSettings.showCk}
                      onChange={(e) => setColSettings({ ...colSettings, showCk: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                    />
                    <span>Chứng khoán (CK)</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colSettings.showBds}
                      onChange={(e) => setColSettings({ ...colSettings, showBds: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                    />
                    <span>Bất động sản (BĐS)</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colSettings.showThep}
                      onChange={(e) => setColSettings({ ...colSettings, showThep: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                    />
                    <span>Thép & Kim loại</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colSettings.showVin}
                      onChange={(e) => setColSettings({ ...colSettings, showVin: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                    />
                    <span>Họ Vin (VIC/VHM/VRE)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Matrix Table */}
      <div className="relative overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl">
        <table className="w-full text-left text-xs text-zinc-200 border-collapse">
          {/* Table Header */}
          <thead className="bg-zinc-900/95 text-zinc-300 font-mono text-[11px] sticky top-0 z-20 backdrop-blur-md border-b border-zinc-800">
            <tr>
              <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/80 text-zinc-400">
                Ngày GD
              </th>
              <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/80 text-emerald-400 bg-emerald-950/20">
                Tổng TT
              </th>

              {/* Ngân hàng */}
              {colSettings.showNh && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-blue-950/30 text-blue-300 font-bold">
                    Tổng NH
                  </th>
                  {colSettings.showActiveTrades && (
                    <>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                        Mua NH
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                        Bán NH
                      </th>
                    </>
                  )}
                </>
              )}

              {/* Chứng khoán */}
              {colSettings.showCk && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-amber-950/20 text-amber-300 font-bold">
                    Tổng CK
                  </th>
                  {colSettings.showActiveTrades && (
                    <>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                        Mua CK
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                        Bán CK
                      </th>
                    </>
                  )}
                </>
              )}

              {/* Bất động sản */}
              {colSettings.showBds && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-amber-950/20 text-amber-300 font-bold">
                    Tổng BĐS
                  </th>
                  {colSettings.showActiveTrades && (
                    <>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                        Mua BĐS
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                        Bán BĐS
                      </th>
                    </>
                  )}
                </>
              )}

              {/* Thép */}
              {colSettings.showThep && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-cyan-950/30 text-cyan-300 font-bold">
                    Tổng Thép
                  </th>
                  {colSettings.showActiveTrades && (
                    <>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                        Mua Thép
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                        Bán Thép
                      </th>
                    </>
                  )}
                </>
              )}

              {/* Họ Vin */}
              {colSettings.showVin && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 bg-indigo-950/30 text-indigo-300 font-bold">
                    Tổng VIN
                  </th>
                  {colSettings.showActiveTrades && (
                    <>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400 font-normal">
                        Mua VIN
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap border-r border-zinc-800/80 text-rose-400 font-normal">
                        Bán VIN
                      </th>
                    </>
                  )}
                </>
              )}

              {/* Tỉ lệ % dòng tiền */}
              {colSettings.showRatios && (
                <>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center font-bold text-blue-300">
                    Tỉ Lệ NH (%)
                  </th>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center font-bold text-amber-300">
                    Tỉ Lệ CK (%)
                  </th>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center font-bold text-amber-300">
                    Tỉ Lệ BĐS (%)
                  </th>
                  <th className="px-3.5 py-3 whitespace-nowrap border-r border-zinc-800/60 text-center font-bold text-cyan-300">
                    Tỉ Lệ Thép (%)
                  </th>
                  <th className="px-3.5 py-3 whitespace-nowrap text-center font-bold text-indigo-300">
                    Tỉ Lệ VIN (%)
                  </th>
                </>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-zinc-800/60 font-mono text-[12px]">
            {loading ? (
              <tr>
                <td
                  colSpan={20}
                  className="px-6 py-12 text-center text-zinc-400 font-sans text-xs"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ArrowClockwise className="w-5 h-5 text-emerald-400 animate-spin" />
                    <span>Đang đồng bộ dữ liệu dòng tiền ngành thực tế...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={20}
                  className="px-6 py-8 text-center text-zinc-400 font-sans text-xs"
                >
                  Không có dữ liệu dòng tiền cho khoảng thời gian này.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.date}
                  className={`hover:bg-zinc-800/30 transition-colors ${
                    row.isLive ? 'bg-emerald-950/10' : ''
                  }`}
                >
                  {/* Ngày GD */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/80 font-bold text-zinc-300">
                    <div className="flex items-center gap-1.5">
                      {row.isLive && (
                        <span
                          title="Phiên trực tiếp hôm nay"
                          className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                        />
                      )}
                      <span>{row.displayDate || row.date}</span>
                    </div>
                  </td>

                  {/* Tổng TT */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/80 font-bold text-emerald-400 bg-emerald-950/10">
                    {formatVal(row.totalMarket)}
                  </td>

                  {/* Ngân hàng */}
                  {colSettings.showNh && (
                    <>
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/40">
                        {formatVal(row.nh?.total)}
                      </td>
                      {colSettings.showActiveTrades && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.nh?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.nh?.sell)}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Chứng khoán */}
                  {colSettings.showCk && (
                    <>
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/40">
                        {formatVal(row.ck?.total)}
                      </td>
                      {colSettings.showActiveTrades && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.ck?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.ck?.sell)}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Bất động sản */}
                  {colSettings.showBds && (
                    <>
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/40">
                        {formatVal(row.bds?.total)}
                      </td>
                      {colSettings.showActiveTrades && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.bds?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.bds?.sell)}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Thép */}
                  {colSettings.showThep && (
                    <>
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/40">
                        {formatVal(row.thep?.total)}
                      </td>
                      {colSettings.showActiveTrades && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.thep?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.thep?.sell)}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Họ Vin */}
                  {colSettings.showVin && (
                    <>
                      <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-zinc-800/60 font-bold text-zinc-100 bg-zinc-900/40">
                        {formatVal(row.vin?.total)}
                      </td>
                      {colSettings.showActiveTrades && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/40 text-emerald-400">
                            {formatVal(row.vin?.buy)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-800/80 text-rose-400">
                            {formatVal(row.vin?.sell)}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Tỉ lệ % dòng tiền kèm Climax / Trough highlight */}
                  {colSettings.showRatios && (
                    <>
                      {/* NH Ratio */}
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800/60 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.nh?.isClimax
                              ? 'bg-purple-900/70 text-purple-200 border border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                              : row.nh?.isTrough
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-300'
                          }`}
                        >
                          {formatVal(row.nh?.ratioPct)}
                        </span>
                      </td>

                      {/* CK Ratio */}
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800/60 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.ck?.isClimax
                              ? 'bg-purple-900/70 text-purple-200 border border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                              : row.ck?.isTrough
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-300'
                          }`}
                        >
                          {formatVal(row.ck?.ratioPct)}
                        </span>
                      </td>

                      {/* BĐS Ratio */}
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800/60 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.bds?.isClimax
                              ? 'bg-purple-900/70 text-purple-200 border border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                              : row.bds?.isTrough
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-300'
                          }`}
                        >
                          {formatVal(row.bds?.ratioPct)}
                        </span>
                      </td>

                      {/* Thép Ratio */}
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800/60 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.thep?.isClimax
                              ? 'bg-purple-900/70 text-purple-200 border border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                              : row.thep?.isTrough
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-300'
                          }`}
                        >
                          {formatVal(row.thep?.ratioPct)}
                        </span>
                      </td>

                      {/* Họ Vin Ratio */}
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.vin?.isClimax
                              ? 'bg-purple-900/70 text-purple-200 border border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                              : row.vin?.isTrough
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                              : 'text-zinc-300'
                          }`}
                        >
                          {formatVal(row.vin?.ratioPct)}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footnote / Explanation of Climax and Trough */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-zinc-900/40 border border-zinc-800/60 rounded-xl text-xs text-zinc-400">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-purple-900/70 border border-purple-500/60 inline-block" />
            <span>
              <strong className="text-purple-300">Đạt Đỉnh Dòng Tiền (Quá nhiệt):</strong> Ngân hàng &ge; 30%, Chứng khoán &ge; 20%, Thép &ge; 9% &rarr; Nguy cơ điều chỉnh ngắn hạn.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-950/60 border border-emerald-500/40 inline-block" />
            <span>
              <strong className="text-emerald-300">Vùng Trũng Dòng Tiền (Tích lũy):</strong> Thanh khoản cạn kiệt &rarr; Cơ hội gom đón đầu sóng mới.
            </span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-zinc-500">
          Nguồn dữ liệu: Sở GDCK HOSE/HNX • Tự động tổng hợp
        </span>
      </div>
    </div>
  );
}
