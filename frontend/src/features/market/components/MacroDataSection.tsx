'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChartLineUp, 
  TrendUp, 
  TrendDown, 
  Bank, 
  Globe, 
  CurrencyCircleDollar,
  Info,
  Scales
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import macroDatabase from '../data/macroDatabase.json';

export const MacroDataSection: React.FC = () => {
  const { gdp, cpi, exchangeRate, interestRate } = macroDatabase;
  const [mounted, setMounted] = useState(false);
  const [liveExchangeRates, setLiveExchangeRates] = useState<any[]>(exchangeRate);
  const [exchangeUpdateTime, setExchangeUpdateTime] = useState<string>('Live');
  const [isLiveRates, setIsLiveRates] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);

    const fetchRates = async () => {
      try {
        const res = await fetch('/api/macro/exchange-rate');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setLiveExchangeRates(json.data);
          setExchangeUpdateTime(json.updateTime || 'Hôm nay');
          setIsLiveRates(true);
        }
      } catch (err) {
        console.error('Error fetching live exchange rates:', err);
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentGdp = gdp[0];
  const currentCpi = cpi[0];
  const currentUsd = liveExchangeRates[0] || exchangeRate[0];
  const overnightRate = interestRate[0];
  const refRate = interestRate[1];

  return (
    <div suppressHydrationWarning className="relative overflow-hidden p-6 md:p-8 bg-zinc-950/90 border border-zinc-800/80 rounded-3xl backdrop-blur-2xl space-y-6 shadow-2xl">
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
            <Globe className="w-5 h-5" weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
                Vĩ Mô & Thị Trường Tiền Tệ
              </h2>
            </div>
            <p className="text-xs text-zinc-400 font-sans">
              Dữ liệu chu kỳ kinh tế vĩ mô, lạm phát mục tiêu, tỷ giá & lãi suất liên ngân hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Kỳ {currentGdp.period} (GDP {currentGdp.growthRate}%)</span>
            <span className="text-zinc-600 font-light select-none">|</span>
            <span className="text-zinc-400">GSO & SBV</span>
          </span>
        </div>
      </div>

      {/* Bento 2.0 Asymmetric Architecture (2fr:1fr:1fr on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── CARD 1: GDP TĂNG TRƯỞNG CHỦ ĐẠO (Chiếm 5 Cột, Hero Card) ── */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-emerald-500/20 shadow-lg relative flex flex-col justify-between overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <ChartLineUp className="w-5 h-5" weight="bold" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Tăng Trưởng GDP Thực Tế</span>
              </div>
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                {currentGdp.period}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl md:text-5xl font-black text-white tracking-tight">
                +{currentGdp.growthRate}%
              </span>
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-400 block font-mono">Mục tiêu: {currentGdp.target}%</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                  <TrendUp className="w-3.5 h-3.5" weight="bold" />
                  +{(currentGdp.growthRate - currentGdp.target).toFixed(2)}% so với kế hoạch
                </span>
              </div>
            </div>

            {/* Quarterly Growth Mini Trend Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>Diễn biến 4 quý gần nhất</span>
                <span className="text-zinc-300 font-bold">Quy mô: {currentGdp.value}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {gdp.map((item, idx) => (
                  <div key={idx} className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-zinc-500 block font-mono">{item.period}</span>
                    <span className={`text-xs font-mono font-bold ${idx === 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      +{item.growthRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Đánh giá chu kỳ:</span>
            <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              Mở Rộng Kinh Tế Mạnh
            </span>
          </div>
        </motion.div>

        {/* ── CARD 2: LẠM PHÁT CPI & LÃI SUẤT (Chiếm 4 Cột, Trung Tâm Điều Hành) ── */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* 2.1 CPI Card */}
          <motion.div 
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Scales className="w-4 h-4" weight="bold" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Lạm Phát CPI (YoY)</span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                {currentCpi.period}
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <span className="font-mono text-3xl font-extrabold text-white">
                {currentCpi.yoy}%
              </span>
              <div className="text-right font-mono">
                <span className="text-[11px] text-zinc-400 block">MoM: +{currentCpi.mom}%</span>
                <span className="text-[11px] text-blue-400 font-bold">Dưới trần {currentCpi.target}%</span>
              </div>
            </div>

            {/* Target indicator bar */}
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${(currentCpi.yoy / currentCpi.target) * 100}%` }}
              />
            </div>
          </motion.div>

          {/* 2.2 Lãi Suất Liên Ngân Hàng */}
          <motion.div 
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <Bank className="w-4 h-4" weight="bold" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Lãi Suất Điều Hành</span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                NHNN
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-2 font-mono">
              <div>
                <span className="text-[10px] text-zinc-400 block">Liên ngân hàng (ON)</span>
                <span className="text-2xl font-black text-white">{overnightRate.rate}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Tái cấp vốn</span>
                <span className="text-2xl font-black text-zinc-300">{refRate.rate}</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-1">
              <span>Thanh khoản hệ thống:</span>
              <span className="text-emerald-400 font-bold">Dồi dào / Ổn định</span>
            </div>
          </motion.div>
        </div>

        {/* ── CARD 3: TỶ GIÁ NGOẠI TỆ REALTIME (Chiếm 3 Cột, Sidebar Tỷ Giá) ── */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-3 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <CurrencyCircleDollar className="w-5 h-5" weight="bold" />
                <span className="text-xs font-semibold text-zinc-200">Tỷ Giá Ngoại Tệ</span>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveRates ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{isLiveRates ? `Live ${exchangeUpdateTime}` : 'Hôm nay'}</span>
              </span>
            </div>

            {/* USD Primary */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 mb-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-200 font-bold">{currentUsd.pair}</span>
                <span className={`font-bold ${currentUsd.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {currentUsd.change >= 0 ? `+${currentUsd.change}` : currentUsd.change}đ
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {Number(currentUsd.sell).toLocaleString('vi-VN')} <span className="text-xs text-zinc-400 font-normal">đ</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono flex justify-between">
                <span>Mua vào:</span>
                <span className="text-zinc-300 font-medium">{Number(currentUsd.buy).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            {/* Other Pairs */}
            <div className="space-y-1.5 font-mono text-xs">
              {liveExchangeRates.slice(1).map((pair, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/40">
                  <span className="text-zinc-400 font-medium">{pair.pair}</span>
                  <div className="text-right">
                    <span className="text-zinc-200 font-bold block">{Number(pair.sell).toLocaleString('vi-VN')}</span>
                    <span className={`text-[10px] font-medium ${pair.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pair.change >= 0 ? '+' : ''}{pair.change}đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500 flex justify-between">
            <span>Biên độ SBV:</span>
            <span className="text-zinc-300 font-medium">±5.0%</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
