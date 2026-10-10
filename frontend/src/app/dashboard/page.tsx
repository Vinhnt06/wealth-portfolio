'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { TradingViewChart } from '../components/TradingViewChart';
import { IndexBanner } from '../../features/market/components/IndexBanner';
import { motion } from 'framer-motion';
import { CandlestickData } from 'lightweight-charts';
import { useLanguage } from '../components/LanguageContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { Shield, Target, Plus, TrendUp, Sparkle, ArrowRight, Wallet, ChartPie, Globe } from '@phosphor-icons/react';
import vnindexCandles from '../../features/market/data/vnindexHistory.json';

const realChartData = (vnindexCandles as unknown as CandlestickData[]).slice(-120);

const PORTFOLIO = {
  totalNetWorth: 1242084.50,
  change24h: 12402.10,
  changePercent24h: 1.01,
  allTimeReturn: 34.2,
  assets: [
    { key: 'stocks', value: 371874, change: 2.8 },
    { key: 'bonds', value: 125000, change: 0.4 },
    { key: 'crypto', value: 640210, change: 4.1 },
    { key: 'metals', value: 105000, change: -0.2 },
  ],
};

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#6366F1'];
const fmtUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
const fmtPrice = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export default function DashboardPage() {
  const { t } = useLanguage();
  const chartData = realChartData;

  const assetLabels: Record<string, string> = {
    stocks: t('assets.stocks') || 'Cổ phiếu',
    bonds: t('assets.bonds') || 'Trái phiếu',
    crypto: t('assets.crypto') || 'Tiền mã hóa',
    metals: t('assets.precious_metals') || 'Vàng & Kim loại',
  };

  const barData = PORTFOLIO.assets.map(a => ({ name: assetLabels[a.key], value: a.value, change: a.change }));
  const pieData = PORTFOLIO.assets.map(a => ({ name: assetLabels[a.key], value: a.value }));
  const timeframes = ['1D', '1W', '1M', '1Y', 'ALL'];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1440px] mx-auto pb-12">
        
        {/* ── 1. Executive Top Header Banner ── */}
        <div className="p-6 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkle className="w-4 h-4 animate-pulse" />
              </span>
              <h1 className="font-mono font-black text-2xl text-zinc-100 tracking-tight">EXECUTIVE OVERVIEW</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                TỔNG QUAN TÀI CHÍNH
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">
              Báo cáo tổng hợp tài sản, chỉ số kinh tế vĩ mô, diễn biến thị trường và tin tức chứng khoán tiêu điểm
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 z-10 font-mono">
            <div className="px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-right">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">TỔNG TÀI SẢN (NET WORTH)</p>
              <p className="text-2xl font-extrabold text-zinc-100">{fmtPrice(PORTFOLIO.totalNetWorth)}</p>
            </div>
            <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-right">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">LỢI NHUẬN TỔNG THỂ</p>
              <p className="text-2xl font-extrabold text-emerald-400">+{PORTFOLIO.allTimeReturn}%</p>
            </div>
          </div>
        </div>

        {/* ── 2. Realtime Market Index Pulse (Thị Trường) ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono">
              <TrendUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-zinc-100">DIỄN BIẾN CHỈ SỐ THỊ TRƯỜNG CHỨNG KHOÁN</h2>
            </div>
            <Link
              href="/market"
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition-colors"
            >
              <span>Vào Live Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <IndexBanner />
        </section>

        {/* ── 4. Portfolio Asset Allocation & Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Asset Allocation Breakdown */}
          <div className="lg:col-span-4 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 font-mono">
                <ChartPie className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-zinc-100">PHÂN BỔ DANH MỤC TÀI SẢN</h3>
              </div>
            </div>

            <div className="space-y-3">
              {PORTFOLIO.assets.map((asset) => (
                <div
                  key={asset.key}
                  className="p-3.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl flex items-center justify-between font-mono"
                >
                  <div>
                    <p className="text-xs text-zinc-400 font-semibold">{assetLabels[asset.key]}</p>
                    <p className="text-base font-bold text-zinc-100">{fmtUSD(asset.value)}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${asset.change >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {asset.change >= 0 ? '+' : ''}{asset.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Chart */}
          <div className="lg:col-span-8 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="font-mono font-bold text-sm text-zinc-100">DIỄN BIẾN CHỈ SỐ VN-INDEX (VNSTOCK REAL DATA)</h3>
                <p className="text-xs text-zinc-400">Dữ liệu nến giá thực tế đồng bộ từ Sở giao dịch chứng khoán qua vnstock</p>
              </div>
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    className={`px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                      tf === '1M'
                        ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewChart data={chartData} chartType="area" height={300} />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
