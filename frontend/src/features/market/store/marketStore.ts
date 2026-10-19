import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TickData, QuotesData, OHLCCandle, MarketIndexData, WsStatus } from '../types/dnse.types';

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
  viewMode: 'overview' | 'detail' | 'screener' | 'rrg';

  // Actions
  setWsStatus: (status: WsStatus) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedIndexSymbol: (symbol: string) => void;
  setViewMode: (viewMode: 'overview' | 'detail' | 'screener' | 'rrg') => void;
  setActiveTab: (tab: 'orderbook' | 'info' | 'foreign') => void;
  openQuickView: (symbol?: string) => void;
  closeQuickView: () => void;
  setSearchQuery: (query: string) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  setChartExpanded: (expanded: boolean) => void;
  toggleChartExpanded: () => void;
  updateTick: (tick: TickData) => void;
  updateTicks: (ticks: TickData[]) => void;
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

  updateTick: (tick) =>
    set((state) => ({
      ticks: {
        ...state.ticks,
        [tick.symbol]: tick,
      },
    })),

  // Gộp nhiều tick trong 1 lần set() để heatmap poll 700+ mã không re-render từng mã
  updateTicks: (ticks) =>
    set((state) => {
      if (ticks.length === 0) return state;
      const next = { ...state.ticks };
      for (const tick of ticks) {
        next[tick.symbol] = tick;
      }
      return { ticks: next };
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
