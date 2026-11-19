import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TickData, QuotesData, OHLCCandle, MarketIndexData, WsStatus } from '../types/dnse.types';
import { isMarketTradingSession } from '../utils/marketHours';
import { judgeSnapshot, tradingDayKey, TickSource } from '../utils/tickGuard';

export interface LiveTradeTick {
  id: string;
  symbol: string;
  price: number;
  volume: number;
  matchType: 'B' | 'S';
  timestamp: number;
}

// ── Cổng kiểm soát ghi giá: một mã có nhiều nguồn (MQTT, REST sổ lệnh, REST báo giá, heatmap, seed…) ──
// Trước đây nguồn nào đến sau ghi đè nguồn trước → giá nhảy lên nhảy xuống. Giờ mỗi tick phải qua `admitTick`.
interface TickMeta {
  src: TickSource;
  at: number;
  eventTime?: number;
}
const tickMeta = new Map<string, TickMeta>();
/** Giá tham chiếu mới (khác giá đang có trong cùng phiên) đang chờ xác nhận lần thứ 2 */
const pendingRef = new Map<string, number>();
const SOURCE_PRIORITY: Record<TickSource, number> = { seed: 0, derived: 1, rest: 2, mqtt: 3 };
/** Trong khoảng này, nguồn kém tin cậy hơn không được ghi đè nguồn tốt hơn vừa cập nhật */
const FRESH_WINDOW_MS = 8_000;

/** Trả về tick được phép ghi (có thể đã chỉnh), hoặc null nếu phải bỏ qua. */
function admitTick(prev: TickData | undefined, incoming: TickData, src: TickSource, now: number): TickData | null {
  let next = incoming;
  if (!(next.price > 0)) return null;

  const meta = tickMeta.get(next.symbol);
  if (!prev || !meta) return next;

  // Seed (snapshot dựng sẵn) chỉ để lấp chỗ trống; dữ liệu thật luôn thay được seed.
  if (src === 'seed') return null;
  if (meta.src === 'seed') {
    pendingRef.delete(next.symbol);
    return next;
  }

  // Nguồn suy diễn (heatmap, nến) tự tính giá tham chiếu = giá − thay đổi nên lệch vài đồng; trong cùng phiên
  // không được đổi giá tham chiếu đã có: giữ nguyên nó và tính lại thay đổi theo giá mới.
  if (
    src === 'derived' &&
    prev.referencePrice > 0 &&
    next.referencePrice !== prev.referencePrice &&
    tradingDayKey(meta.eventTime ?? meta.at) === tradingDayKey(next.eventTime ?? now)
  ) {
    const ref = prev.referencePrice;
    const change = next.price - ref;
    next = {
      ...next,
      referencePrice: ref,
      ceilingPrice: prev.ceilingPrice || next.ceilingPrice,
      floorPrice: prev.floorPrice || next.floorPrice,
      open: prev.open || next.open,
      change,
      changePercent: Number(((change / ref) * 100).toFixed(2)),
    };
  }

  // Nguồn tin cậy cao hơn bản đang có thì không bị luật khối lượng chặn (bản đang có có thể chính là bản cũ).
  const outranks = SOURCE_PRIORITY[src] > SOURCE_PRIORITY[meta.src];
  const verdict = judgeSnapshot(
    { totalVolume: prev.totalVolume, refPrice: prev.referencePrice, eventTime: meta.eventTime, seenAt: meta.at },
    { totalVolume: next.totalVolume, refPrice: next.referencePrice, eventTime: next.eventTime },
    now,
    { volumeRule: !outranks }
  );

  if (verdict === 'stale') return null;

  if (verdict === 'ref_changed') {
    // Giá tham chiếu cố định cả phiên: một lần lẻ khác biệt là snapshot cũ → chờ xác nhận lần 2 mới nhận.
    if (pendingRef.get(next.symbol) !== next.referencePrice) {
      pendingRef.set(next.symbol, next.referencePrice);
      return null;
    }
    pendingRef.delete(next.symbol);
  } else {
    pendingRef.delete(next.symbol);
  }

  // Nguồn kém tin cậy không được chen vào ngay sau nguồn tốt hơn.
  if (SOURCE_PRIORITY[src] < SOURCE_PRIORITY[meta.src] && now - meta.at < FRESH_WINDOW_MS) return null;

  return next;
}

interface MarketState {
  // Connection state
  wsStatus: WsStatus;
  lastHeartbeat: number | null;
  selectedSymbol: string;
  selectedIndexSymbol: string;

  // Real-time market state map
  ticks: Record<string, TickData>;
  quotes: Record<string, QuotesData>;
  ohlc: Record<string, OHLCCandle[]>; // key: `${symbol}_${resolution}`
  indexes: Record<string, MarketIndexData>;

  // Search & Navigation state
  searchQuery: string;
  watchlistSymbols: string[];
  isChartExpanded: boolean;
  activeTab: 'orderbook' | 'info' | 'foreign';
  isQuickViewOpen: boolean;
  viewMode: 'overview' | 'detail' | 'screener' | 'rrg' | 'flow' | 'radar' | 'expectancy';

  // Real-time live trade tick from WebSocket stream
  lastTradeTick: LiveTradeTick | null;

  // Actions
  setWsStatus: (status: WsStatus) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedIndexSymbol: (symbol: string) => void;
  setViewMode: (viewMode: 'overview' | 'detail' | 'screener' | 'rrg' | 'flow' | 'radar' | 'expectancy') => void;
  setActiveTab: (tab: 'orderbook' | 'info' | 'foreign') => void;
  openQuickView: (symbol?: string) => void;
  closeQuickView: () => void;
  setSearchQuery: (query: string) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  setChartExpanded: (expanded: boolean) => void;
  toggleChartExpanded: () => void;
  updateTick: (tick: TickData, src?: TickSource) => void;
  updateTicks: (ticks: TickData[], src?: TickSource) => void;
  setLastTradeTick: (tick: LiveTradeTick | null) => void;
  updateQuotes: (quotes: QuotesData) => void;
  appendOHLC: (symbol: string, resolution: string, candle: OHLCCandle) => void;
  setOHLCHistory: (symbol: string, resolution: string, candles: OHLCCandle[]) => void;
  updateIndex: (indexData: MarketIndexData) => void;
  setLastHeartbeat: (timestamp: number) => void;
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      wsStatus: 'disconnected',
      lastHeartbeat: null,
      selectedSymbol: 'HPG',
      selectedIndexSymbol: 'VNINDEX',
      searchQuery: '',
      watchlistSymbols: ['HPG', 'VCB', 'SSI', 'VHM', 'TCB', 'FPT', 'MBB', 'MWG', 'VNM', 'VIC'],
      isChartExpanded: true,
      activeTab: 'info',
      isQuickViewOpen: false,
      viewMode: 'overview',

  setWsStatus: (wsStatus) => set({ wsStatus }),
  setSelectedSymbol: (selectedSymbol) =>
    set({ selectedSymbol, isChartExpanded: true, activeTab: 'info', viewMode: 'detail' }),
  setSelectedIndexSymbol: (selectedIndexSymbol) => set({ selectedIndexSymbol }),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  openQuickView: (symbol) =>
    set((state) => ({
      selectedSymbol: symbol ? symbol.toUpperCase() : state.selectedSymbol,
      isQuickViewOpen: true,
      activeTab: 'info',
    })),
  closeQuickView: () => set({ isQuickViewOpen: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleWatchlistSymbol: (symbol) =>
    set((state) => ({
      watchlistSymbols: state.watchlistSymbols.includes(symbol)
        ? state.watchlistSymbols.filter((s) => s !== symbol)
        : [...state.watchlistSymbols, symbol],
    })),
  setChartExpanded: (isChartExpanded) => set({ isChartExpanded }),
  toggleChartExpanded: () => set((state) => ({ isChartExpanded: !state.isChartExpanded })),

  ticks: {},
  quotes: {},
  ohlc: {},
  indexes: {},
  lastTradeTick: null,

  setLastTradeTick: (lastTradeTick) => set({ lastTradeTick }),

  updateTick: (incoming, src = 'rest') =>
    set((state) => {
      const now = Date.now();
      const tick = admitTick(state.ticks[incoming.symbol], incoming, src, now);
      if (!tick) return state;

      const existing = state.ticks[tick.symbol];
      tickMeta.set(tick.symbol, { src, at: now, eventTime: tick.eventTime });

      // Ngoài khung giờ giao dịch (15:05 -> 08:30 sáng hôm sau):
      // Tuyệt đối không cho phép tick rỗng/batch chốt sổ lúc 21h (change = 0% với vol = 0) ghi đè kết quả phiên đóng cửa
      if (
        !isMarketTradingSession() &&
        existing &&
        existing.changePercent !== 0 &&
        tick.changePercent === 0 &&
        (tick.totalVolume === 0 || tick.volume === 0)
      ) {
        return {
          ticks: {
            ...state.ticks,
            [tick.symbol]: {
              ...tick,
              price: existing.price > 0 ? existing.price : tick.price,
              change: existing.change,
              changePercent: existing.changePercent,
              totalVolume: existing.totalVolume > 0 ? existing.totalVolume : tick.totalVolume,
            },
          },
        };
      }

      return {
        ticks: {
          ...state.ticks,
          [tick.symbol]: tick,
        },
      };
    }),

  // Gộp nhiều tick trong 1 lần set() để heatmap poll 700+ mã không re-render từng mã
  updateTicks: (incoming, src = 'rest') =>
    set((state) => {
      if (incoming.length === 0) return state;
      const now = Date.now();
      const next = { ...state.ticks };
      const outsideSession = !isMarketTradingSession();
      let changed = false;

      for (const raw of incoming) {
        const existing = next[raw.symbol];
        const tick = admitTick(existing, raw, src, now);
        if (!tick) continue;
        tickMeta.set(tick.symbol, { src, at: now, eventTime: tick.eventTime });
        changed = true;

        if (
          outsideSession &&
          existing &&
          existing.changePercent !== 0 &&
          tick.changePercent === 0 &&
          (tick.totalVolume === 0 || tick.volume === 0)
        ) {
          next[tick.symbol] = {
            ...tick,
            price: existing.price > 0 ? existing.price : tick.price,
            change: existing.change,
            changePercent: existing.changePercent,
            totalVolume: existing.totalVolume > 0 ? existing.totalVolume : tick.totalVolume,
          };
        } else {
          next[tick.symbol] = tick;
        }
      }
      return changed ? { ticks: next } : state;
    }),

  updateQuotes: (quotes) =>
    set((state) => ({
      quotes: {
        ...state.quotes,
        [quotes.symbol]: quotes,
      },
    })),

  appendOHLC: (symbol, resolution, candle) =>
    set((state) => {
      const key = `${symbol}_${resolution}`;
      const existing = state.ohlc[key] || [];
      // Keep last 500 candles maximum to prevent memory leak
      const updated = existing.length > 0 && existing[existing.length - 1].time === candle.time
        ? [...existing.slice(0, -1), candle]
        : [...existing, candle].slice(-500);

      return {
        ohlc: {
          ...state.ohlc,
          [key]: updated,
        },
      };
    }),

  setOHLCHistory: (symbol, resolution, candles) =>
    set((state) => ({
      ohlc: {
        ...state.ohlc,
        [`${symbol}_${resolution}`]: candles,
      },
    })),

  updateIndex: (indexData) =>
    set((state) => ({
      indexes: {
        ...state.indexes,
        [indexData.symbol]: {
          ...(state.indexes[indexData.symbol] || {}),
          ...indexData,
        },
      },
    })),

  setLastHeartbeat: (lastHeartbeat) => set({ lastHeartbeat }),
    }),
    {
      name: 'yourfin_market_store',
      partialize: (state) => ({
        watchlistSymbols: state.watchlistSymbols,
      }),
    }
  )
);
