'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Fish,
  ShieldCheck,
  Users,
  TrendUp,
  TrendDown,
  Info,
  Clock,
  Sparkle,
  ArrowsClockwise,
  Fire,
  Funnel,
  ArrowUpRight,
  ArrowDownRight,
  DownloadSimple,
} from '@phosphor-icons/react';
import { useMarketStore } from '../store/marketStore';
import { useDnseWebSocket } from '../hooks/useDnseWebSocket';
import { getMarketSessionInfo } from '../utils/marketHours';

export interface OrderItem {
  id: string | number;
  time: string;
  investorType: 'Cá mập' | 'Sói già' | 'Cừu non';
  price: number;
  volume: number;
  value: number;
  type: 'M' | 'B';
}

interface TradesData {
  symbol: string;
  totalTrades: number;
  totalVolume: number;
  totalValue: number;
  netVolume: number;
  thresholds: {
    sharkMin: number;
    wolfMin: number;
    megaWhaleMin?: number;
    description: string;
  };
  summary: {
    netVolume: number;
    sharkNetVol: number;
    wolfNetVol: number;
    sheepNetVol: number;
    sharkBuyVal?: number;
    sharkSellVal?: number;
    sharkNetVal?: number;
    sharkBuyCount?: number;
    sharkSellCount?: number;
    wolfBuyVal?: number;
    wolfSellVal?: number;
    wolfNetVal?: number;
  };
  buy: {
    totalVolume: number;
    totalValue: number;
    shark: { volume: number; value: number; count: number; pct: number };
    wolf: { volume: number; value: number; count: number; pct: number };
    sheep: { volume: number; value: number; count: number; pct: number };
  };
  sell: {
    totalVolume: number;
    totalValue: number;
    shark: { volume: number; value: number; count: number; pct: number };
    wolf: { volume: number; value: number; count: number; pct: number };
    sheep: { volume: number; value: number; count: number; pct: number };
  };
  trades: OrderItem[];
  timestamp: number;
}

// ── BỘ LƯU TRỮ VĨNH VIỄN NHẬT KÝ KHỚP LỆNH TRONG NGÀY (KHÔNG XOÁ LỆNH) ──
function getTodayVnKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function getLocalTapeStorageKey(symbol: string, dateKey: string): string {
  return `yf_intraday_tape_${symbol.toUpperCase()}_${dateKey}`;
}

export function loadLocalTape(symbol: string): OrderItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const todayKey = getTodayVnKey();
    const raw = localStorage.getItem(getLocalTapeStorageKey(symbol, todayKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn('Cannot load local tape:', e);
  }
  return [];
}

export function saveLocalTape(symbol: string, trades: OrderItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const todayKey = getTodayVnKey();
    localStorage.setItem(getLocalTapeStorageKey(symbol, todayKey), JSON.stringify(trades));
    // Dọn dẹp các ngày cũ hơn của mã này để giải phóng bộ nhớ
    const prefix = `yf_intraday_tape_${symbol.toUpperCase()}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== getLocalTapeStorageKey(symbol, todayKey)) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {
    console.warn('Cannot save local tape:', e);
  }
}

export function getTradeKey(trade: OrderItem): string {
  return trade.id ? String(trade.id) : `${trade.time}_${trade.volume}_${trade.price}_${trade.type}`;
}

export function calculateTapeStats(trades: OrderItem[], symbol: string): TradesData {
  let totalBuyVolume = 0;
  let totalBuyValue = 0;
  let totalSellVolume = 0;
  let totalSellValue = 0;

  let sharkBuyVol = 0, sharkBuyVal = 0, sharkBuyCount = 0;
  let wolfBuyVol = 0, wolfBuyVal = 0, wolfBuyCount = 0;
  let sheepBuyVol = 0, sheepBuyVal = 0, sheepBuyCount = 0;

  let sharkSellVol = 0, sharkSellVal = 0, sharkSellCount = 0;
  let wolfSellVol = 0, wolfSellVal = 0, wolfSellCount = 0;
  let sheepSellVol = 0, sheepSellVal = 0, sheepSellCount = 0;

  for (const trade of trades) {
    if (trade.type === 'M') {
      totalBuyVolume += trade.volume;
      totalBuyValue += trade.value;
      if (trade.investorType === 'Cá mập') {
        sharkBuyVol += trade.volume;
        sharkBuyVal += trade.value;
        sharkBuyCount++;
      } else if (trade.investorType === 'Sói già') {
        wolfBuyVol += trade.volume;
        wolfBuyVal += trade.value;
        wolfBuyCount++;
      } else {
        sheepBuyVol += trade.volume;
        sheepBuyVal += trade.value;
        sheepBuyCount++;
      }
    } else {
      totalSellVolume += trade.volume;
      totalSellValue += trade.value;
      if (trade.investorType === 'Cá mập') {
        sharkSellVol += trade.volume;
        sharkSellVal += trade.value;
        sharkSellCount++;
      } else if (trade.investorType === 'Sói già') {
        wolfSellVol += trade.volume;
        wolfSellVal += trade.value;
        wolfSellCount++;
      } else {
        sheepSellVol += trade.volume;
        sheepSellVal += trade.value;
        sheepSellCount++;
      }
    }
  }

  const buyBase = Math.max(1, totalBuyVolume);
  const sellBase = Math.max(1, totalSellVolume);

  return {
    symbol,
    totalTrades: trades.length,
    totalVolume: totalBuyVolume + totalSellVolume,
    totalValue: totalBuyValue + totalSellValue,
    netVolume: totalBuyVolume - totalSellVolume,
    thresholds: {
      sharkMin: 1_000_000_000,
      wolfMin: 500_000_000,
      megaWhaleMin: 3_000_000_000,
      description: 'Nhật ký khớp lệnh thật tích lũy 100% trong phiên giao dịch (Không xóa lệnh)',
    },
    summary: {
      netVolume: totalBuyVolume - totalSellVolume,
      sharkNetVol: sharkBuyVol - sharkSellVol,
      wolfNetVol: wolfBuyVol - wolfSellVol,
      sheepNetVol: sheepBuyVol - sheepSellVol,
      sharkBuyVal,
      sharkSellVal,
      sharkNetVal: sharkBuyVal - sharkSellVal,
      sharkBuyCount,
      sharkSellCount,
      wolfBuyVal,
      wolfSellVal,
      wolfNetVal: wolfBuyVal - wolfSellVal,
    },
    buy: {
      totalVolume: totalBuyVolume,
      totalValue: totalBuyValue,
      shark: { volume: sharkBuyVol, value: sharkBuyVal, count: sharkBuyCount, pct: Number(((sharkBuyVol / buyBase) * 100).toFixed(2)) },
      wolf: { volume: wolfBuyVol, value: wolfBuyVal, count: wolfBuyCount, pct: Number(((wolfBuyVol / buyBase) * 100).toFixed(2)) },
      sheep: { volume: sheepBuyVol, value: sheepBuyVal, count: sheepBuyCount, pct: Number(((sheepBuyVol / buyBase) * 100).toFixed(2)) },
    },
    sell: {
      totalVolume: totalSellVolume,
      totalValue: totalSellValue,
      shark: { volume: sharkSellVol, value: sharkSellVal, count: sharkSellCount, pct: Number(((sharkSellVol / sellBase) * 100).toFixed(2)) },
      wolf: { volume: wolfSellVol, value: wolfSellVal, count: wolfSellCount, pct: Number(((wolfSellVol / sellBase) * 100).toFixed(2)) },
      sheep: { volume: sheepSellVol, value: sheepSellVal, count: sheepSellCount, pct: Number(((sheepSellVol / sellBase) * 100).toFixed(2)) },
    },
    trades,
    timestamp: Date.now(),
  };
}

export const InvestorFlowAnalysis: React.FC = () => {
  const { wsStatus } = useDnseWebSocket();
  const { selectedSymbol, lastTradeTick } = useMarketStore();
  const sessionInfo = getMarketSessionInfo();
  const [timeframe, setTimeframe] = useState<'60' | '1D' | 'ALL'>('1D');
  const [activePage, setActivePage] = useState<1 | 2 | 3>(1);
  const [filterInvestor, setFilterInvestor] = useState<'shark' | 'wolf_shark' | 'all'>('shark');
  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [recentLiveIds, setRecentLiveIds] = useState<Set<string>>(new Set());
  const lastProcessedTickRef = React.useRef<string>('');

  const [displayLimit, setDisplayLimit] = useState<number>(100);

  // Nạp log tích lũy từ LocalStorage ngay khi đổi mã để không bị trắng màn hình
  useEffect(() => {
    if (!selectedSymbol) return;
    const cached = loadLocalTape(selectedSymbol);
    if (cached.length > 0) {
      setTradesData(calculateTapeStats(cached, selectedSymbol));
      setLastUpdated(new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
    }
  }, [selectedSymbol]);

  const fetchRealTrades = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market/trades?symbol=${selectedSymbol}&limit=1000`);
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        const apiTrades: OrderItem[] = resJson.data.trades || [];
        const localTrades = loadLocalTape(selectedSymbol);

        // Merge liên tục, deduplicate theo ID hoặc fingerprint - tuyệt đối KHÔNG xoá lệnh
        const tradeMap = new Map<string, OrderItem>();
        for (const t of localTrades) {
          tradeMap.set(getTradeKey(t), t);
        }
        for (const t of apiTrades) {
          tradeMap.set(getTradeKey(t), t);
        }

        const mergedTrades = Array.from(tradeMap.values()).sort((a, b) => b.time.localeCompare(a.time));
        saveLocalTape(selectedSymbol, mergedTrades);
        setTradesData(calculateTapeStats(mergedTrades, selectedSymbol));
        setLastUpdated(new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }));
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu khớp lệnh thật:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  // Nạp dữ liệu ban đầu, đồng bộ đối soát nền mỗi 15s (dữ liệu chính nhảy theo Realtime Stream 2s)
  useEffect(() => {
    fetchRealTrades();
    const interval = setInterval(fetchRealTrades, 15000);
    return () => clearInterval(interval);
  }, [fetchRealTrades]);

  // Lắng nghe tick khớp lệnh thời gian thực từ WebSocket DNSE (Zero Latency Streaming)
  useEffect(() => {
    if (!lastTradeTick || !selectedSymbol) return;
    if (lastTradeTick.symbol.toUpperCase() !== selectedSymbol.toUpperCase()) return;
    if (lastTradeTick.volume <= 0) return;
    if (lastTradeTick.id === lastProcessedTickRef.current) return;

    lastProcessedTickRef.current = lastTradeTick.id;

    const rawP = lastTradeTick.price;
    const priceInVnd = rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP);
    const orderValue = priceInVnd * lastTradeTick.volume;
    const priceDisplay = Number((priceInVnd / 1000).toFixed(2));
    const isBuy = lastTradeTick.matchType === 'B';
    const type: 'M' | 'B' = isBuy ? 'M' : 'B';

    let investorType: 'Cá mập' | 'Sói già' | 'Cừu non' = 'Cừu non';
    if (orderValue >= 1_000_000_000) {
      investorType = 'Cá mập';
    } else if (orderValue >= 500_000_000) {
      investorType = 'Sói già';
    }

    const timeStr = new Date(lastTradeTick.timestamp).toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newOrder: OrderItem = {
      id: lastTradeTick.id,
      time: timeStr,
      investorType,
      price: priceDisplay,
      volume: lastTradeTick.volume,
      value: orderValue,
      type,
    };

    // Đánh dấu tick mới để highlight badge nhấp nháy trên UI
    setRecentLiveIds((prev) => {
      const next = new Set(prev);
      next.add(newOrder.id as string);
      return next;
    });

    const timer = setTimeout(() => {
      setRecentLiveIds((prev) => {
        const next = new Set(prev);
        next.delete(newOrder.id as string);
        return next;
      });
    }, 4000);

    setLastUpdated(timeStr);

    setTradesData((prev) => {
      const currentTrades = prev?.trades || loadLocalTape(selectedSymbol);
      const newKey = getTradeKey(newOrder);
      if (currentTrades.some((t) => getTradeKey(t) === newKey)) return prev;

      // TUYỆT ĐỐI KHÔNG CẮT BỚT (KHÔNG SLICE), LƯU TRỌN VẸN 100% CẢ PHIÊN
      const nextTrades = [newOrder, ...currentTrades];
      saveLocalTape(selectedSymbol, nextTrades);

      return calculateTapeStats(nextTrades, selectedSymbol);
    });

    return () => clearTimeout(timer);
  }, [lastTradeTick, selectedSymbol]);

  // Fallback defaults if loading or no trades yet
  const summary = tradesData?.summary || {
    netVolume: 0,
    sharkNetVol: 0,
    wolfNetVol: 0,
    sheepNetVol: 0,
  };

  const buy = tradesData?.buy || {
    totalVolume: 0,
    totalValue: 0,
    shark: { volume: 0, value: 0, count: 0, pct: 0 },
    wolf: { volume: 0, value: 0, count: 0, pct: 0 },
    sheep: { volume: 0, value: 0, count: 0, pct: 0 },
  };

  const sell = tradesData?.sell || {
    totalVolume: 0,
    totalValue: 0,
    shark: { volume: 0, value: 0, count: 0, pct: 0 },
    wolf: { volume: 0, value: 0, count: 0, pct: 0 },
    sheep: { volume: 0, value: 0, count: 0, pct: 0 },
  };

  const orders: OrderItem[] = tradesData?.trades || [];

  // Shark specific stats
  const sharkStats = useMemo(() => {
    const sharkTrades = orders.filter((o) => o.investorType === 'Cá mập');
    const sharkBuy = sharkTrades.filter((o) => o.type === 'M');
    const sharkSell = sharkTrades.filter((o) => o.type === 'B');

    const totalBuyVal = sharkBuy.reduce((sum, o) => sum + o.value, 0);
    const totalSellVal = sharkSell.reduce((sum, o) => sum + o.value, 0);
    const totalBuyVol = sharkBuy.reduce((sum, o) => sum + o.volume, 0);
    const totalSellVol = sharkSell.reduce((sum, o) => sum + o.volume, 0);
    const netVal = totalBuyVal - totalSellVal;
    const netVol = totalBuyVol - totalSellVol;
    const totalVal = totalBuyVal + totalSellVal;
    const buyPct = totalVal > 0 ? (totalBuyVal / totalVal) * 100 : 50;

    return {
      totalCount: sharkTrades.length,
      buyCount: sharkBuy.length,
      sellCount: sharkSell.length,
      totalBuyVal,
      totalSellVal,
      totalBuyVol,
      totalSellVol,
      netVal,
      netVol,
      buyPct,
      hasTrades: sharkTrades.length > 0,
    };
  }, [orders]);

  const sharkCount = useMemo(() => orders.filter((o) => o.investorType === 'Cá mập').length, [orders]);
  const wolfSharkCount = useMemo(
    () => orders.filter((o) => o.investorType === 'Cá mập' || o.investorType === 'Sói già').length,
    [orders]
  );

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterInvestor === 'shark' && order.investorType !== 'Cá mập') return false;
      if (
        filterInvestor === 'wolf_shark' &&
        order.investorType !== 'Cá mập' &&
        order.investorType !== 'Sói già'
      )
        return false;
      if (filterSide === 'buy' && order.type !== 'M') return false;
      if (filterSide === 'sell' && order.type !== 'B') return false;
      return true;
    });
  }, [orders, filterInvestor, filterSide]);

  // Phân đoạn hiển thị DOM mượt mà (Dữ liệu tính toán & lưu trữ vẫn giữ 100% trong bộ nhớ)
  const visibleOrders = useMemo(() => {
    return filteredOrders.slice(0, displayLimit);
  }, [filteredOrders, displayLimit]);

  // Xuất toàn bộ log khớp lệnh 100% trong ngày ra file CSV Excel
  const exportCsvTape = useCallback(() => {
    if (!orders.length) return;
    const todayKey = getTodayVnKey();
    const headers = ['Thời gian', 'Mã CP', 'Phân khúc', 'Loại lệnh', 'Giá (k VNĐ)', 'Khối lượng (CP)', 'Giá trị (VNĐ)'];
    const rows = orders.map((o) => [
      `"${o.time}"`,
      `"${selectedSymbol}"`,
      `"${o.investorType}"`,
      `"${o.type === 'M' ? 'MUA CHỦ ĐỘNG' : 'BÁN CHỦ ĐỘNG'}"`,
      o.price.toFixed(2),
      o.volume,
      o.value,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NhatKy_KhopLenh_${selectedSymbol}_${todayKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [orders, selectedSymbol]);

  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-4">
      {/* Top Header & Page Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Fish className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono font-bold text-xs sm:text-sm text-zinc-100 flex items-center gap-2 flex-wrap">
                Phân loại nhà đầu tư
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {selectedSymbol}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold transition-all ${
                  sessionInfo.sessionBadge === 'PHIÊN ATC'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : wsStatus === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    sessionInfo.sessionBadge === 'PHIÊN ATC'
                      ? 'bg-amber-400 animate-pulse'
                      : wsStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-zinc-500'
                  }`} />
                  {sessionInfo.sessionBadge === 'PHIÊN ATC'
                    ? 'PHIÊN ĐỊNH KỲ ATC'
                    : wsStatus === 'connected'
                    ? 'REALTIME STREAM'
                    : 'ĐANG KẾT NỐI'}
                </span>
              </h3>
              <div className="group relative cursor-pointer text-zinc-500 hover:text-zinc-300">
                <Info className="w-3.5 h-3.5" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-64 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 shadow-2xl z-50 leading-relaxed">
                  <div className="font-bold text-emerald-400 mb-1 border-b border-zinc-700 pb-1">
                    Tiêu chuẩn phân loại theo quy mô lệnh:
                  </div>
                  • <strong className="text-emerald-400">Cá mập</strong>: Lệnh &ge; 1 Tỷ VNĐ
                  <br />• <strong className="text-cyan-400">Sói già</strong>: Lệnh 500 Triệu &ndash; 1 Tỷ VNĐ
                  <br />• <strong className="text-amber-400">Cừu non</strong>: Lệnh &lt; 500 Triệu VNĐ
                  <div className="mt-1.5 pt-1 border-t border-zinc-800 text-[9px] text-zinc-400">
                    Phân tích từ sổ khớp lệnh chi tiết từng tick trong ngày.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-400 font-mono">Dòng tiền thông minh (Real Order Flow)</span>
              {lastUpdated && (
                <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {lastUpdated}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Page Toggles & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRealTrades()}
            disabled={loading}
            title="Làm mới dữ liệu khớp lệnh thật"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono">
            {(['60', '1D', 'ALL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2 py-0.5 rounded ${
                  timeframe === t
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === '60' ? "60'" : t === '1D' ? '1D' : 'Tất cả'}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono">
            {([1, 2, 3] as const).map((page) => (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`w-6 h-5 rounded flex items-center justify-center font-bold transition-all ${
                  activePage === page
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area based on Active Page */}
      {activePage === 1 && (
        <div className="space-y-4">
          {/* Visual Accumulation Flow Bar */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-400">KLGD ròng tích lũy (Khớp thật):</span>
              <span className={`font-bold ${summary.netVolume >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summary.netVolume >= 0 ? '+' : ''}{summary.netVolume.toLocaleString('vi-VN')} CP
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-zinc-400 block font-semibold">Cá mập (&ge;1 Tỷ)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.sharkNetVol >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {summary.sharkNetVol >= 0 ? '+' : ''}{summary.sharkNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-emerald-500/80">
                  {summary.sharkNetVol >= 0 ? 'Mua ròng' : 'Bán ròng'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-zinc-400 block font-semibold">Sói già (500Tr-1 Tỷ)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.wolfNetVol >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
                  {summary.wolfNetVol >= 0 ? '+' : ''}{summary.wolfNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-cyan-500/80">
                  {summary.wolfNetVol >= 0 ? 'Mua ròng' : 'Bán ròng'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-zinc-400 block font-semibold">Cừu non (&lt;500Tr)</span>
                <span className={`text-xs font-bold mt-0.5 block ${summary.sheepNetVol >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {summary.sheepNetVol >= 0 ? '+' : ''}{summary.sheepNetVol.toLocaleString('vi-VN')}
                </span>
                <span className="text-[9px] text-amber-500/80">
                  {summary.sheepNetVol >= 0 ? 'Nhỏ lẻ mua' : 'Nhỏ lẻ bán'}
                </span>
              </div>
            </div>
          </div>

          {/* Two Side-by-Side Breakdown Cards: Mua vs Bán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mua Side Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendUp className="w-3.5 h-3.5" />
                  Tỷ lệ MUA Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {buy.totalVolume > 0 ? `${buy.totalVolume.toLocaleString('vi-VN')} CP` : '0 CP'}
                </span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Cá mập (&ge; 1 Tỷ)
                    </span>
                    <span className="font-bold text-emerald-400">{buy.shark.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, buy.shark.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Sói già (500Tr &ndash; 1 Tỷ)
                    </span>
                    <span className="font-bold text-cyan-400">{buy.wolf.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${Math.min(100, buy.wolf.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Cừu non (&lt; 500Tr)
                    </span>
                    <span className="font-bold text-amber-400">{buy.sheep.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${Math.min(100, buy.sheep.pct)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bán Side Breakdown */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
                <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5">
                  <TrendDown className="w-3.5 h-3.5" />
                  Tỷ lệ BÁN Chủ Động
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {sell.totalVolume > 0 ? `${sell.totalVolume.toLocaleString('vi-VN')} CP` : '0 CP'}
                </span>
              </div>

              {/* Progress segments */}
              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Cá mập (&ge; 1 Tỷ)
                    </span>
                    <span className="font-bold text-rose-400">{sell.shark.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, sell.shark.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Sói già (500Tr &ndash; 1 Tỷ)
                    </span>
                    <span className="font-bold text-orange-400">{sell.wolf.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.min(100, sell.wolf.pct)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-400" />
                      Cừu non (&lt; 500Tr)
                    </span>
                    <span className="font-bold text-zinc-300">{sell.sheep.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-zinc-400 transition-all duration-500" style={{ width: `${Math.min(100, sell.sheep.pct)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page 2: Summary Breakdown Cards */}
      {activePage === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-emerald-400 mb-2 font-bold">
              <Fish className="w-4 h-4" />
              <span>Cá mập (&ge; 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-emerald-400">{buy.shark.count} lệnh</strong> ({buy.shark.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-rose-400">{sell.shark.count} lệnh</strong> ({sell.shark.volume.toLocaleString('vi-VN')} CP).
              <br />
              Dòng tiền tổ chức và tay to tập trung lệnh quy mô lớn từ 1 Tỷ VNĐ trở lên.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-cyan-400 mb-2 font-bold">
              <Users className="w-4 h-4" />
              <span>Sói già (500Tr &ndash; 1 Tỷ)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-cyan-400">{buy.wolf.count} lệnh</strong> ({buy.wolf.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-orange-400">{sell.wolf.count} lệnh</strong> ({sell.wolf.volume.toLocaleString('vi-VN')} CP).
              <br />
              Nhà đầu tư chuyên nghiệp giao dịch phân khúc từ 500 Triệu đến dưới 1 Tỷ VNĐ.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-amber-400 mb-2 font-bold">
              <Sparkle className="w-4 h-4" />
              <span>Cừu non (&lt; 500Tr)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tổng lệnh mua: <strong className="text-amber-400">{buy.sheep.count} lệnh</strong> ({buy.sheep.volume.toLocaleString('vi-VN')} CP).
              <br />
              Tổng lệnh bán: <strong className="text-zinc-300">{sell.sheep.count} lệnh</strong> ({sell.sheep.volume.toLocaleString('vi-VN')} CP).
              <br />
              Nhỏ lẻ giao dịch dưới 500 Triệu VNĐ, phản ánh tâm lý thị trường đại chúng.
            </p>
          </div>
        </div>
      )}

      {/* Page 3 or bottom log: Live Order Feed */}
      {(activePage === 1 || activePage === 3) && (
        <div className="space-y-3 pt-1">
          {/* ── Whale Radar Telemetry Strip ── */}
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/30 shadow-[0_4px_20px_-8px_rgba(16,185,129,0.2)] flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Fish className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                    Radar Lệnh Cá Mập
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    &ge; 1 TỶ VNĐ
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-zinc-300 bg-zinc-800/80 border border-zinc-700">
                    Đã lưu {orders.length} lệnh trong ngày
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Nhật ký khớp lệnh tích lũy liên tục không xoá &bull; Tự động đồng bộ và lưu trữ cục bộ
                </p>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Cá Mập Mua</div>
                <div className="font-bold text-emerald-400">
                  {(sharkStats.totalBuyVal / 1_000_000_000).toFixed(2)} tỷ{' '}
                  <span className="text-[9px] text-zinc-500 font-normal font-sans">({sharkStats.buyCount} lệnh)</span>
                </div>
              </div>

              <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Cá Mập Bán</div>
                <div className="font-bold text-rose-400">
                  {(sharkStats.totalSellVal / 1_000_000_000).toFixed(2)} tỷ{' '}
                  <span className="text-[9px] text-zinc-500 font-normal font-sans">({sharkStats.sellCount} lệnh)</span>
                </div>
              </div>

              <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

              <div className="text-left md:text-right">
                <div className="text-[9px] text-zinc-500 uppercase">Ròng Cá Mập</div>
                <div
                  className={`font-bold flex items-center gap-1 ${
                    sharkStats.netVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sharkStats.netVal >= 0 ? <TrendUp className="w-3.5 h-3.5" /> : <TrendDown className="w-3.5 h-3.5" />}
                  <span>
                    {sharkStats.netVal >= 0 ? '+' : ''}
                    {(sharkStats.netVal / 1_000_000_000).toFixed(2)} tỷ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Filter Toolbar (Pill Controls) ── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs py-1">
            {/* Investor Scale Filter */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] overflow-x-auto">
              <span className="text-zinc-500 px-1.5 flex items-center gap-1 text-[10px] shrink-0">
                <Funnel className="w-3 h-3" />
                <span>Quy mô:</span>
              </span>
              <button
                onClick={() => setFilterInvestor('shark')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  filterInvestor === 'shark'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🦈 Chỉ Cá Mập (≥ 1 Tỷ)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-300">
                  {sharkCount}
                </span>
              </button>
              <button
                onClick={() => setFilterInvestor('wolf_shark')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                  filterInvestor === 'wolf_shark'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>🐺 Cá Mập & Sói (≥ 500Tr)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-300">
                  {wolfSharkCount}
                </span>
              </button>
              <button
                onClick={() => setFilterInvestor('all')}
                className={`px-2 py-1 rounded-lg font-medium transition-all shrink-0 ${
                  filterInvestor === 'all'
                    ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>Tất cả ({orders.length})</span>
              </button>
            </div>

            {/* Execution Side Filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px]">
              <button
                onClick={() => setFilterSide('all')}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  filterSide === 'all'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Tất cả chiều
              </button>
              <button
                onClick={() => setFilterSide('buy')}
                className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  filterSide === 'buy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-emerald-500/70 hover:text-emerald-400'
                }`}
              >
                <span>🟢 Mua C.Động</span>
              </button>
              <button
                onClick={() => setFilterSide('sell')}
                className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  filterSide === 'sell'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'text-rose-500/70 hover:text-rose-400'
                }`}
              >
                <span>🔴 Bán C.Động</span>
              </button>
            </div>

            {/* Export Full Day CSV Button */}
            <button
              onClick={exportCsvTape}
              title="Xuất file nhật ký toàn bộ lệnh trong ngày ra Excel CSV"
              className="px-2.5 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-400 font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm sm:ml-auto"
            >
              <DownloadSimple className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất Log Ngày (.CSV)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px] text-zinc-400">
                {orders.length}
              </span>
            </button>
          </div>

          {/* ── Orders Table ── */}
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-none rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 bg-zinc-900 z-10 text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 pl-3">Thời gian</th>
                  <th className="py-2.5">Phân khúc</th>
                  <th className="py-2.5 text-right">Giá (k)</th>
                  <th className="py-2.5 text-right">Khối lượng</th>
                  <th className="py-2.5 text-right">Giá trị (VNĐ)</th>
                  <th className="py-2.5 pr-3 text-center">Chiều lệnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-[11px]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                          <Fish className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div className="font-bold text-zinc-300 text-xs">
                          {filterInvestor === 'shark'
                            ? `Chưa ghi nhận lệnh Cá Mập (≥ 1 Tỷ) trong ${orders.length} lệnh tích lũy ngày của ${selectedSymbol}`
                            : 'Không tìm thấy lệnh khớp phù hợp với bộ lọc'}
                        </div>
                        <p className="text-[10px] text-zinc-500 max-w-sm">
                          Hệ thống đang tích lũy 100% nhật ký khớp lệnh thời gian thực và lưu trữ liên tục.
                        </p>
                        {filterInvestor === 'shark' && (
                          <button
                            onClick={() => setFilterInvestor('wolf_shark')}
                            className="mt-1 px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold transition-colors"
                          >
                            Xem thêm phân khúc Sói Già (≥ 500Tr)
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((order, idx) => {
                    const isBuy = order.type === 'M';
                    const isMegaWhale = order.value >= 3_000_000_000;
                    const isShark = order.investorType === 'Cá mập';
                    const isWolf = order.investorType === 'Sói già';

                    const isRecentLive = recentLiveIds.has(String(order.id));
                    const formattedVal =
                      order.value >= 1_000_000_000
                        ? `${(order.value / 1_000_000_000).toFixed(2)} tỷ`
                        : order.value >= 1_000_000
                        ? `${(order.value / 1_000_000).toFixed(1)} tr`
                        : `${order.value.toLocaleString('vi-VN')} đ`;

                    return (
                      <tr
                        key={order.id || idx}
                        className={`hover:bg-zinc-800/40 transition-all ${
                          isRecentLive
                            ? 'bg-emerald-500/20 border-l-2 border-emerald-400 shadow-[0_0_15px_-4px_rgba(16,185,129,0.4)]'
                            : isMegaWhale
                            ? 'bg-amber-500/5 border-l-2 border-amber-500'
                            : isShark
                            ? 'bg-emerald-500/5'
                            : ''
                        }`}
                      >
                        <td className="py-2 pl-3 text-zinc-400 font-mono text-[11px]">{order.time}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isRecentLive && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 flex items-center gap-0.5 animate-pulse">
                                <span>⚡ VỪA KHỚP</span>
                              </span>
                            )}
                            {isShark ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span>🦈</span>
                                <span>Cá mập</span>
                              </span>
                            ) : isWolf ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                <span>🐺</span>
                                <span>Sói già</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Cừu non</span>
                            )}
                            {isMegaWhale && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5 animate-pulse">
                                <Fire className="w-3 h-3 text-amber-400" />
                                <span>MEGA</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right font-bold text-zinc-100 text-xs font-mono">
                          {order.price.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-zinc-200 font-mono font-bold">
                          {order.volume.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 text-right font-mono font-black text-xs">
                          <span
                            className={
                              isMegaWhale
                                ? 'text-amber-300 font-bold'
                                : isShark
                                ? isBuy
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                                : 'text-zinc-300'
                            }
                          >
                            {formattedVal}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBuy
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isBuy ? (
                              <>
                                <ArrowUpRight className="w-3 h-3" />
                                <span>MUA CHỦ ĐỘNG</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3 h-3" />
                                <span>BÁN CHỦ ĐỘNG</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Display Pagination Controls (Smooth DOM Rendering while Preserving 100% Day Data) ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Đang hiển thị <strong className="text-emerald-400">{Math.min(visibleOrders.length, filteredOrders.length)}</strong> / <strong className="text-zinc-200">{filteredOrders.length}</strong> lệnh phù hợp (Đã lưu trữ <strong className="text-zinc-100">{orders.length}</strong> lệnh trọn vẹn cả ngày)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {filteredOrders.length > displayLimit && (
                <>
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 100)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold transition-colors"
                  >
                    + Xem thêm 100 lệnh
                  </button>
                  <button
                    onClick={() => setDisplayLimit(filteredOrders.length)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors"
                  >
                    Xem toàn bộ ({filteredOrders.length})
                  </button>
                </>
              )}
              {displayLimit > 100 && (
                <button
                  onClick={() => setDisplayLimit(100)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors"
                >
                  Thu gọn 100
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
