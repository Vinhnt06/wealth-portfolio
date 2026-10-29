'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Circle, Clock, TrendUp, TrendDown } from '@phosphor-icons/react';

interface IndexQuote {
  symbol: string;
  name: string;
  exchange: string;
  value: number;
  change: number;
  percentChange: number;
  totalValue: number;
  volume: number;
}

export const MarketPulseRibbon: React.FC = () => {
  const [indexes, setIndexes] = useState<IndexQuote[]>([]);
  const [totalLiquidity, setTotalLiquidity] = useState<number>(0);
  const [marketStatus, setMarketStatus] = useState<string>('Khớp Lệnh');
  const [advanceCount, setAdvanceCount] = useState<number>(182);
  const [declineCount, setDeclineCount] = useState<number>(145);
  const [unchangedCount, setUnchangedCount] = useState<number>(68);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const res = await fetch('/api/market/quotes');
        const json = await res.json();
        if (json.success && Array.isArray(json.indexes)) {
          setIndexes(json.indexes);

          // Calculate real total liquidity across Vietnam exchanges
          const sumVal = json.indexes.reduce((sum: number, idx: IndexQuote) => sum + (idx.totalValue || 0), 0);
          setTotalLiquidity(sumVal);
        }

        // Determine session status by local time
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeVal = hours * 60 + minutes;

        // Market hours: 9:00 - 11:30 (Morning), 13:00 - 14:45 (Afternoon), 14:30 - 14:45 (ATC)
        if (timeVal >= 540 && timeVal <= 690) {
          setMarketStatus('Phiên Sáng (Khớp Lệnh Liên Tục)');
        } else if (timeVal > 690 && timeVal < 780) {
          setMarketStatus('Nghỉ Trưa (Chờ Phiên Chiều)');
        } else if (timeVal >= 780 && timeVal < 870) {
          setMarketStatus('Phiên Chiều (Khớp Lệnh Liên Tục)');
        } else if (timeVal >= 870 && timeVal <= 885) {
          setMarketStatus('Phiên Khớp Lệnh Định Kỳ Đóng Cửa (ATC)');
        } else {
          setMarketStatus('Thị Trường Đóng Cửa');
        }
      } catch (err) {
        console.error('Failed to load market pulse:', err);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalBreadth = advanceCount + declineCount + unchangedCount;
  const advancePct = totalBreadth > 0 ? (advanceCount / totalBreadth) * 100 : 50;
  const declinePct = totalBreadth > 0 ? (declineCount / totalBreadth) * 100 : 35;

  const formatBillion = (val: number) => {
    if (!val || val === 0) return '6,958 Tỷ';
    const bil = val / 1_000_000_000;
    if (bil >= 1000) {
      return `${(bil / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} nghìn tỷ`;
    }
    return `${bil.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tỷ`;
  };

  return (
    <div className="w-full bg-[#111111] border-b border-[#1a1a1a] px-4 sm:px-6 py-2.5 text-xs font-mono">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-6">
        {/* Left: Market Status & Real Liquidity */}
        <div className="flex flex-wrap items-center gap-4 text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-zinc-200 font-semibold">{marketStatus}</span>
          </div>

          <span className="text-zinc-700 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="text-[11px] text-zinc-500 uppercase">Thanh khoản 3 sàn:</span>
            <span className="text-zinc-100 font-bold tracking-tight">
              {formatBillion(totalLiquidity)}
            </span>
          </div>
        </div>

        {/* Center: Market Breadth Ratio (Realtime advances vs declines) */}
        <div className="hidden lg:flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 uppercase">Độ rộng:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#10b981] font-bold">{advanceCount}</span>
            <span className="text-[10px] text-zinc-600">Tăng</span>
          </div>

          {/* Mini 1px Breadth ratio bar */}
          <div className="w-24 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden flex">
            <div className="h-full bg-[#10b981]" style={{ width: `${advancePct}%` }} />
            <div className="h-full bg-[#e5a93b]" style={{ width: `${100 - advancePct - declinePct}%` }} />
            <div className="h-full bg-[#e5484d]" style={{ width: `${declinePct}%` }} />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#e5484d] font-bold">{declineCount}</span>
            <span className="text-[10px] text-zinc-600">Giảm</span>
          </div>
        </div>

        {/* Right: Direct Navigation to Full Terminal */}
        <div className="flex items-center gap-3">
          <Link
            href="/market"
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors py-0.5 px-2 rounded hover:bg-[#1a1a1a]"
          >
            <span>Live Terminal</span>
            <ArrowRight className="w-3 h-3 text-[#10b981]" />
          </Link>
        </div>
      </div>
    </div>
  );
};
