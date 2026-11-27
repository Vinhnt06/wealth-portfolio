'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CaretDown,
  CaretUp,
  CheckCircle,
  Crosshair,
  Lock,
  ShieldWarning,
  TrendUp,
} from '@phosphor-icons/react';
import { MinerviniScreenerItem } from '../types/minervini.types';
import {
  ScreenerActionPlan,
  formatCompactVol,
} from '../utils/screenerActionPlanner';
import { MARKET_STATE_EVIDENCE, MARKET_STATE_TEXT, MarketStateKey } from '../utils/marketState';
import { getStockPriceColor } from '../utils/priceColors';

export type ActionQuickFilter = 'ALL' | 'BUY_NEW' | 'SCALE_UP' | 'READY_ADD' | 'STAGE2_WAIT';

export interface EnrichedScreenerRow {
  item: MinerviniScreenerItem;
  plan: ScreenerActionPlan;
}

interface ScreenerActionSummaryPanelProps {
  rows: EnrichedScreenerRow[];
  marketState: MarketStateKey;
  marketProvisional?: boolean;
  activeFilter: ActionQuickFilter;
  lastUpdated?: string;
  wsStatus?: string;
  onSelectFilter: (filter: ActionQuickFilter) => void;
  onSelectStock: (symbol: string) => void;
}

/** Thanh trực quan vị trí Giá hiện tại giữa Cắt lỗ (SL) -> Pivot 20P -> Mục tiêu */
const PricePositionBar: React.FC<{
  price: number;
  stopLoss: number | null;
  pivot: number | null;
  target: number | null;
}> = ({ price, stopLoss, pivot, target }) => {
  if (!stopLoss || !target || target <= stopLoss) return null;

  const min = stopLoss;
  const max = target;
  const span = max - min;
  const clampPct = (val: number) => Math.max(2, Math.min(98, ((val - min) / span) * 100));

  const pricePct = clampPct(price);
  const pivotPct = pivot && pivot > min && pivot < max ? clampPct(pivot) : null;

  return (
    <div className="pt-2 pb-1 space-y-1">
      <div className="relative h-1.5 w-full rounded-full bg-zinc-800/90 overflow-visible">
        {/* Safe zone fill from SL to current price */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-rose-500/70 via-emerald-500/70 to-emerald-400"
          style={{ width: `${pricePct}%` }}
        />
        {/* Pivot 20P breakout marker */}
        {pivotPct !== null && (
          <div
            title={`Kháng cự Pivot 20P: ${pivot?.toLocaleString('vi-VN')}`}
            className="absolute -top-1 w-0.5 h-3.5 bg-cyan-400 rounded-full"
            style={{ left: `${pivotPct}%` }}
          />
        )}
        {/* Current live price dot */}
        <div
          title={`Giá hiện tại: ${price.toLocaleString('vi-VN')}`}
          className="absolute -top-1 w-3 h-3 -ml-1.5 rounded-full bg-zinc-100 border-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
          style={{ left: `${pricePct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 tabular-nums">
        <span className="text-rose-400/90">SL {stopLoss.toLocaleString('vi-VN')}</span>
        {pivot && (
          <span className="text-cyan-400/90">
            Pivot {pivot.toLocaleString('vi-VN')}
          </span>
        )}
        <span className="text-emerald-400/90">Mục tiêu {target.toLocaleString('vi-VN')}</span>
      </div>
    </div>
  );
};

export const ScreenerActionSummaryPanel: React.FC<ScreenerActionSummaryPanelProps> = ({
  rows,
  marketState,
  marketProvisional = false,
  activeFilter,
  lastUpdated,
  wsStatus,
  onSelectFilter,
  onSelectStock,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showWatchlistInBear, setShowWatchlistInBear] = useState(false);

  const buyNewRows = rows
    .filter((r) => r.plan.signal === 'BUY_NEW')
    .sort((a, b) => b.plan.priorityScore - a.plan.priorityScore);

  const scaleUpActiveRows = rows
    .filter((r) => r.plan.signal === 'SCALE_UP')
    .sort((a, b) => b.plan.priorityScore - a.plan.priorityScore);

  const readyToAddRows = rows
    .filter((r) => r.plan.signal !== 'SCALE_UP' && r.plan.isReadyToScaleUpSoon)
    .sort((a, b) => (b.plan.distToPivotPct ?? -99) - (a.plan.distToPivotPct ?? -99));

  const stage2WaitRows = rows.filter(
    (r) =>
      r.plan.signal === 'HOLD_WAIT' ||
      r.plan.signal === 'EXTENDED' ||
      r.plan.signal === 'CAUTION_DIST'
  );

  const buySizeMultiplier = MARKET_STATE_EVIDENCE[marketState]?.buySize ?? 1;
  const isMarketBlocked = buySizeMultiplier === 0;

  // Khi thị trường BẤT LỢI, số lệnh khuyến nghị giải ngân thực tế = 0
  const effectiveBuyCount = isMarketBlocked ? 0 : buyNewRows.length;
  const effectiveScaleCount = isMarketBlocked ? 0 : scaleUpActiveRows.length;
  const totalStage2WatchCount = buyNewRows.length + scaleUpActiveRows.length + stage2WaitRows.length;

  const renderStockCard = (
    { item, plan }: EnrichedScreenerRow,
    mode: 'BUY_NEW' | 'SCALE_UP' | 'READY_ADD'
  ) => {
    const priceColor = getStockPriceColor({
      price: item.price,
      changePercent: item.changePct,
      exchange: item.exchange,
    });
    const isUp = item.changePct > 0;

    const sizeBadgeText = isMarketBlocked
      ? '0% · Theo dõi (Chờ TT)'
      : mode === 'BUY_NEW'
      ? `Mua mới ${plan.effectivePct}%`
      : mode === 'SCALE_UP'
      ? `Bồi +${plan.effectivePct}% → 70%`
      : `Vượt Pivot → +${Math.round(40 * buySizeMultiplier)}%`;

    const sizeBadgeTone = isMarketBlocked
      ? 'border-zinc-700 bg-zinc-800/80 text-zinc-300'
      : mode === 'BUY_NEW'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
      : mode === 'SCALE_UP'
      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
      : 'border-amber-500/40 bg-amber-500/15 text-amber-300';

    return (
      <div
        key={`${mode}_${item.symbol}`}
        onClick={() => onSelectStock(item.symbol)}
        className="p-3.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 transition-colors cursor-pointer group"
      >
        {/* Top Row: Ticker Identity + Live Price + Position Sizing Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-black text-sm text-zinc-100 group-hover:text-amber-400 transition-colors">
              {item.symbol}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              {item.exchange}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 tabular-nums whitespace-nowrap">
              RS {item.rsRating}
            </span>
            <span className="text-[11px] text-zinc-400 truncate max-w-[140px] font-sans">
              {item.sector}
            </span>
          </div>

          <div className="flex items-center gap-2 tabular-nums font-mono">
            <div className="text-right whitespace-nowrap">
              <span className={`text-xs font-bold ${priceColor.colorClass}`}>
                {item.price.toLocaleString('vi-VN')}
              </span>
              <span className={`ml-1.5 text-[11px] font-bold ${priceColor.colorClass}`}>
                ({isUp ? '+' : ''}
                {item.changePct.toFixed(2)}%)
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold whitespace-nowrap ${sizeBadgeTone}`}>
              {sizeBadgeText}
            </span>
          </div>
        </div>

        {/* Visual Price Position Bar: SL -> Live Price -> Pivot -> Target */}
        <PricePositionBar
          price={item.price}
          stopLoss={plan.stopLossVnd}
          pivot={plan.pivotVnd}
          target={plan.target1Vnd}
        />

        {/* Quantitative Action Plan Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2 border-y border-zinc-800/60 font-mono text-[11px] tabular-nums">
          <div>
            <span className="block text-[10px] text-zinc-500">
              {mode === 'BUY_NEW' ? 'Vùng mua thăm dò' : 'Điểm kích hoạt bồi'}
            </span>
            <span className="font-bold text-zinc-100">
              {mode === 'READY_ADD' && plan.pivotVnd
                ? `≥ ${plan.pivotVnd.toLocaleString('vi-VN')}`
                : plan.actionZoneLabel.replace(/^(Vùng mua|Vùng bồi)\s+/i, '')}
            </span>
          </div>

          <div>
            <span className="block text-[10px] text-zinc-500">
              {mode === 'BUY_NEW' ? 'Cắt lỗ tối đa' : 'Mốc nâng chặn lỗ'}
            </span>
            <span className="font-bold text-rose-400">
              {plan.stopLossVnd
                ? `${plan.stopLossVnd.toLocaleString('vi-VN')} (${plan.stopLossPct?.toFixed(1)}%)`
                : '--'}
            </span>
          </div>

          <div>
            <span className="block text-[10px] text-zinc-500">Mục tiêu (R:R)</span>
            <span className="font-bold text-emerald-400">
              {plan.target1Vnd
                ? `${plan.target1Vnd.toLocaleString('vi-VN')}${plan.riskReward ? ` (1:${plan.riskReward})` : ''}`
                : '--'}
            </span>
          </div>

          <div>
            <span className="block text-[10px] text-zinc-500">
              {mode === 'BUY_NEW'
                ? 'Điểm gia tăng kế'
                : mode === 'SCALE_UP'
                ? 'Khối lượng phiên'
                : 'Cần KL xác nhận'}
            </span>
            <span className="font-bold text-cyan-300">
              {mode === 'BUY_NEW'
                ? plan.pivotVnd
                  ? `>${plan.pivotVnd.toLocaleString('vi-VN')} · ≥${formatCompactVol(plan.minScaleUpVol)}`
                  : `KL ≥ 1.3x TB20`
                : mode === 'SCALE_UP'
                ? `${item.relVol.toFixed(2)}x TB20 (${formatCompactVol(item.volume)})`
                : `≥ ${formatCompactVol(plan.minScaleUpVol)} (${plan.distToPivotPct?.toFixed(1)}%)`}
            </span>
          </div>
        </div>

        {/* Concrete Evidence Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
          <span className="truncate">
            {mode === 'READY_ADD'
              ? `Trên MA20 (${plan.distFromSma20Pct !== null && plan.distFromSma20Pct >= 0 ? '+' : ''}${plan.distFromSma20Pct ?? 0}%) · Cách Pivot 20P ${plan.distToPivotPct?.toFixed(1)}% · U/D ${item.upDownVolRatio ?? 1}x`
              : plan.reason}
          </span>
          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-200 shrink-0 inline-flex items-center gap-1 whitespace-nowrap">
            Phân tích <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-zinc-950/95 border border-zinc-800/90 overflow-hidden">
      {/* Header Summary Strip */}
      <div className="px-5 py-4 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-mono font-bold text-zinc-100 tracking-tight uppercase">
              Tổng Kết Hành Động Vị Thế: Mua Mới &amp; Gia Tăng
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 whitespace-nowrap">
              KIM TỰ THÁP 30% → +40% → +30%
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border whitespace-nowrap ${
                isMarketBlocked
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {isMarketBlocked
                ? `KHÓA GIẢI NGÂN (0%) · TT BẤT LỢI${marketProvisional ? ' (tạm tính)' : ''}`
                : `TT ${MARKET_STATE_TEXT[marketState].vi.toUpperCase()}${marketProvisional ? ' (tạm tính)' : ''} · MUA 100%`}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {wsStatus === 'connected' ? 'Realtime WS' : 'Live 10s'}
              {lastUpdated ? ` · ${lastUpdated.replace(' (SSI trực tiếp)', '')}` : ''}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {isMarketBlocked
              ? 'Cổng Thị Trường đang Bất lợi (VN-Index < MA200 & biến động cao) — hệ thống tự khóa lệnh mua mới/bồi lệnh theo kỷ luật Minervini để bảo toàn vốn.'
              : 'Tự động lọc từ các mã đạt 8/8 Trend Template Stage 2 theo vùng nền MA20, kháng cự Pivot 20 phiên và dòng tiền khớp lệnh trực tiếp.'}
          </p>
        </div>

        {/* Interactive Arithmetic Filter Pills + Collapse Button */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          <button
            onClick={() => onSelectFilter(activeFilter === 'BUY_NEW' ? 'ALL' : 'BUY_NEW')}
            className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === 'BUY_NEW'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketBlocked ? 'bg-zinc-500' : 'bg-emerald-400'}`} />
            <span>Mua mới:</span>
            <strong className={isMarketBlocked ? 'text-zinc-400' : 'text-emerald-400'}>
              {effectiveBuyCount}
            </strong>
          </button>

          <button
            onClick={() => onSelectFilter(activeFilter === 'SCALE_UP' ? 'ALL' : 'SCALE_UP')}
            className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === 'SCALE_UP'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketBlocked ? 'bg-zinc-500' : 'bg-cyan-400'}`} />
            <span>Gia tăng:</span>
            <strong className={isMarketBlocked ? 'text-zinc-400' : 'text-cyan-300'}>
              {effectiveScaleCount}
            </strong>
          </button>

          <button
            onClick={() => onSelectFilter(activeFilter === 'STAGE2_WAIT' ? 'ALL' : 'STAGE2_WAIT')}
            className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === 'STAGE2_WAIT'
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span>Stage 2 theo dõi:</span>
            <strong>{totalStage2WatchCount}</strong>
          </button>

          {activeFilter !== 'ALL' && (
            <button
              onClick={() => onSelectFilter('ALL')}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-amber-300 hover:text-amber-200 text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              Bỏ lọc nhóm
            </button>
          )}

          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title={collapsed ? 'Mở rộng bảng tổng kết vị thế' : 'Thu gọn bảng tổng kết vị thế'}
          >
            {collapsed ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {isMarketBlocked ? (
            /* ── DEFENSIVE MODE: THỊ TRƯỜNG BẤT LỢI (0% GIẢI NGÂN) ── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
                    <Lock className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-mono font-bold text-xs text-zinc-100">
                        1. MÃ MUA MỚI (30%)
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono font-bold text-[10px] whitespace-nowrap">
                        0 mã · Tạm khóa
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Không mở vị thế mua mới (0%) khi thị trường Bất lợi. Giữ tiền mặt và chờ VN-Index lấy lại MA200 / hạ biến động.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
                    <ShieldWarning className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-mono font-bold text-xs text-zinc-100">
                        2. GIA TĂNG VỊ THẾ (+40%)
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono font-bold text-[10px] whitespace-nowrap">
                        0 mã · Tạm khóa
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Không bồi thêm quy mô trong pha thị trường rủi ro cao (tỷ lệ tuần giảm &gt;3% lên tới 18% theo kiểm chứng). Ưu tiên giữ chặt chặn lỗ.
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional Collapsible Stage 2 Leaders Watchlist during Bear Market */}
              {(buyNewRows.length > 0 || scaleUpActiveRows.length > 0 || readyToAddRows.length > 0) && (
                <div className="rounded-xl border border-zinc-800/90 bg-zinc-950 overflow-hidden">
                  <button
                    onClick={() => setShowWatchlistInBear((prev) => !prev)}
                    className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-zinc-900/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-zinc-200">
                        Danh Sách Theo Dõi Sức Mạnh (Watchlist Stage 2 Giữ Nền Tốt Khi TT Yếu)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold whitespace-nowrap">
                        {buyNewRows.length + scaleUpActiveRows.length} mã
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 inline-flex items-center gap-1 whitespace-nowrap">
                      {showWatchlistInBear ? 'Ẩn danh sách' : 'Mở xem thông số chờ TT hồi'}
                      {showWatchlistInBear ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showWatchlistInBear && (
                    <div className="p-4 pt-1 border-t border-zinc-800/70 grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {scaleUpActiveRows.map((row) => renderStockCard(row, 'SCALE_UP'))}
                      {buyNewRows.map((row) => renderStockCard(row, 'BUY_NEW'))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── ACTIVE MODE: THỊ TRƯỜNG THUẬN LỢI / TRUNG TÍNH (100% QUY MÔ) ── */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* ── COLUMN 1: MÃ MUA MỚI / THĂM DÒ VỊ THẾ (30%) ── */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-950 flex flex-col">
                <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" weight="fill" />
                      <h4 className="font-mono font-bold text-xs sm:text-sm text-zinc-100">
                        1. MÃ MUA MỚI · THĂM DÒ (30%)
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-[11px] tabular-nums whitespace-nowrap">
                        {buyNewRows.length} mã
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Đủ 8/8 Stage 2 · Giá tích lũy chặt quanh MA20 (-3% đến +4.2%), cắt lỗ tối đa ≤ 7%.
                    </p>
                  </div>

                  {buyNewRows.length > 0 && (
                    <button
                      onClick={() => onSelectFilter(activeFilter === 'BUY_NEW' ? 'ALL' : 'BUY_NEW')}
                      className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      {activeFilter === 'BUY_NEW' ? 'Đang lọc ✓' : 'Lọc bảng →'}
                    </button>
                  )}
                </div>

                <div className="p-3.5 space-y-2.5 max-h-[460px] overflow-y-auto">
                  {buyNewRows.length === 0 ? (
                    <div className="py-8 px-4 text-center rounded-xl border border-dashed border-zinc-800/80 font-mono text-xs text-zinc-400 space-y-1.5">
                      <p className="text-zinc-300 font-semibold">0 mã có điểm mua thăm dò quanh nền MA20 lúc này</p>
                      <p className="text-[11px] text-zinc-500">
                        Các mã đạt 8/8 Stage 2 hiện đã chạy xa nền MA20 hoặc đang nằm ở nhóm bứt phá gia tăng bên cạnh.
                      </p>
                    </div>
                  ) : (
                    buyNewRows.map((row) => renderStockCard(row, 'BUY_NEW'))
                  )}
                </div>
              </div>

              {/* ── COLUMN 2: VỊ THẾ NÊN TĂNG LÊN / BỒI LỆNH (+40% -> 70%) ── */}
              <div className="rounded-xl border border-zinc-800/90 bg-zinc-950 flex flex-col">
                <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TrendUp className="w-4 h-4 text-cyan-400 shrink-0" weight="bold" />
                      <h4 className="font-mono font-bold text-xs sm:text-sm text-zinc-100">
                        2. GIA TĂNG VỊ THẾ · BỒI LỆNH (+40% → 70%)
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-bold text-[11px] tabular-nums whitespace-nowrap">
                        {scaleUpActiveRows.length} kích hoạt
                      </span>
                      {readyToAddRows.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold text-[11px] tabular-nums whitespace-nowrap">
                          +{readyToAddRows.length} chờ nổ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Chỉ bồi +40% khi Lần 1 đang có lãi đệm (≥ +2%~4%) và giá vượt Pivot 20P / Pocket Pivot kèm Vol lớn.
                    </p>
                  </div>

                  {(scaleUpActiveRows.length > 0 || readyToAddRows.length > 0) && (
                    <button
                      onClick={() =>
                        onSelectFilter(
                          scaleUpActiveRows.length > 0
                            ? activeFilter === 'SCALE_UP'
                              ? 'ALL'
                              : 'SCALE_UP'
                            : activeFilter === 'READY_ADD'
                            ? 'ALL'
                            : 'READY_ADD'
                        )
                      }
                      className="text-[11px] font-mono font-bold text-cyan-400 hover:text-cyan-300 shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      {activeFilter === 'SCALE_UP' || activeFilter === 'READY_ADD' ? 'Đang lọc ✓' : 'Lọc bảng →'}
                    </button>
                  )}
                </div>

                <div className="p-3.5 space-y-3 max-h-[460px] overflow-y-auto">
                  {scaleUpActiveRows.length > 0 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 font-bold px-1">
                        <span>⚡ ĐANG KÍCH HOẠT BỒI LỆNH ({scaleUpActiveRows.length} MÃ)</span>
                        <span className="text-zinc-500 font-normal">Nâng chặn lỗ lên sát MA20</span>
                      </div>
                      {scaleUpActiveRows.map((row) => renderStockCard(row, 'SCALE_UP'))}
                    </div>
                  ) : (
                    <div className="py-4 px-3.5 rounded-xl border border-dashed border-zinc-800/80 font-mono text-xs text-zinc-400">
                      Chưa có mã Stage 2 nào nổ Vol vượt Pivot ngay lúc này (0 mã kích hoạt trực tiếp).
                    </div>
                  )}

                  {readyToAddRows.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center justify-between text-[11px] font-mono text-amber-300 font-bold px-1">
                        <span className="inline-flex items-center gap-1.5">
                          <Crosshair className="w-3.5 h-3.5 shrink-0" />
                          <span>SẴN SÀNG BỒI KHI VƯỢT PIVOT 20P ({readyToAddRows.length} MÃ)</span>
                        </span>
                        <button
                          onClick={() => onSelectFilter(activeFilter === 'READY_ADD' ? 'ALL' : 'READY_ADD')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Lọc riêng
                        </button>
                      </div>
                      {readyToAddRows.map((row) => renderStockCard(row, 'READY_ADD'))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
