'use client';

import React from 'react';
import { ChartLineUp, Coin, CurrencyDollar, TrendUp, TrendDown, Bank, Globe } from '@phosphor-icons/react';
import macroDatabase from '../data/macroDatabase.json';

export const MacroDataSection: React.FC = () => {
  const { gdp, cpi, exchangeRate, commodities, interestRate } = macroDatabase;

  return (
    <div className="p-5 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl backdrop-blur-xl space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-base text-zinc-100 tracking-tight">DỮ LIỆU KINH TẾ VĨ MÔ & HÀNG HÓA (MACRO)</h2>
            <p className="text-xs text-zinc-400">Chỉ số GDP, CPI, Tỷ giá hối đoái, Lãi suất & Giá hàng hóa thế giới</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
          VNSTOCK MACRO LAYER
        </span>
      </div>

      {/* Grid of Macro Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        {/* 1. GDP Growth Card */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2.5 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-emerald-400 font-bold">
            <div className="flex items-center gap-1.5">
              <ChartLineUp className="w-4 h-4" />
              <span>TĂNG TRƯỞNG GDP</span>
            </div>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400">
              {gdp[0].period}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-zinc-100">+{gdp[0].growthRate}%</span>
            <span className="text-[11px] text-zinc-400">Mục tiêu: {gdp[0].target}%</span>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex justify-between">
            <span>Quy mô Q1:</span>
            <span className="text-zinc-200 font-bold">{gdp[0].value}</span>
          </div>
        </div>

        {/* 2. CPI Inflation Card */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2.5 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-blue-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Coin className="w-4 h-4" />
              <span>LẠM PHÁT CPI (YoY)</span>
            </div>
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400">
              {cpi[0].period}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-zinc-100">{cpi[0].yoy}%</span>
            <span className="text-[11px] text-zinc-400">MoM: +{cpi[0].mom}%</span>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex justify-between">
            <span>Trần kiểm soát NHNN:</span>
            <span className="text-zinc-200 font-bold">{cpi[0].target}%</span>
          </div>
        </div>

        {/* 3. USD/VND Exchange Rate Card */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2.5 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-amber-400 font-bold">
            <div className="flex items-center gap-1.5">
              <CurrencyDollar className="w-4 h-4" />
              <span>TỶ GIÁ USD/VND</span>
            </div>
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-amber-400">
              REALTIME
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-zinc-100">{exchangeRate[0].sell.toLocaleString('vi-VN')}</span>
            <span className="text-[11px] text-emerald-400 font-bold">+{exchangeRate[0].change}đ</span>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex justify-between">
            <span>Giá mua vào:</span>
            <span className="text-zinc-200 font-bold">{exchangeRate[0].buy.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {/* 4. Gold & Oil Commodity Card */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2.5 hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between text-rose-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Bank className="w-4 h-4" />
              <span>LÃI SUẤT LIÊN NGÂN HÀNG</span>
            </div>
            <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-rose-400">
              NHNN
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-zinc-100">{interestRate[0].rate}</span>
            <span className="text-[11px] text-zinc-400">Qua đêm</span>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex justify-between">
            <span>Tái cấp vốn:</span>
            <span className="text-zinc-200 font-bold">{interestRate[1].rate}</span>
          </div>
        </div>
      </div>

      {/* Commodity Quick Row */}
      <div className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <span className="text-zinc-400 font-bold flex items-center gap-1.5">
          <Coin className="w-4 h-4 text-amber-400" />
          <span>GIÁ HÀNG HÓA THẾ GIỚI:</span>
        </span>
        {commodities.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-zinc-300">{item.item}:</span>
            <span className="text-zinc-100 font-bold">{'sell' in item ? item.sell : item.price}</span>
            <span className={item.change >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {item.change >= 0 ? '+' : ''}{item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
