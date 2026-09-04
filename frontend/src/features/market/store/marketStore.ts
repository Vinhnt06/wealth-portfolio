import { create } from 'zustand';
import { TickData, QuotesData, OHLCCandle, MarketIndexData, WsStatus } from '../types/dnse.types';

interface MarketState {
  // Connection state
  wsStatus: WsStatus;
  lastHeartbeat: number | null;
  selectedSymbol: string;

  // Real-time market state map
  ticks: Record<string, TickData>;
  quotes: Record<string, QuotesData>;
  ohlc: Record<string, OHLCCandle[]>; // key: `${symbol}_${resolution}`
  indexes: Record<string, MarketIndexData>;

  // Search & Navigation state
  searchQuery: string;
  watchlistSymbols: string[];
  isChartExpanded: boolean;

  // Actions
  setWsStatus: (status: WsStatus) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSearchQuery: (query: string) => void;
  toggleWatchlistSymbol: (symbol: string) => void;
  setChartExpanded: (expanded: boolean) => void;
  toggleChartExpanded: () => void;
  updateTick: (tick: TickData) => void;
  updateQuotes: (quotes: QuotesData) => void;
  appendOHLC: (symbol: string, resolution: string, candle: OHLCCandle) => void;
  setOHLCHistory: (symbol: string, resolution: string, candles: OHLCCandle[]) => void;
  updateIndex: (indexData: MarketIndexData) => void;
  setLastHeartbeat: (timestamp: number) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  wsStatus: 'disconnected',
  lastHeartbeat: null,
  selectedSymbol: 'HPG',
  searchQuery: '',
  watchlistSymbols: ['HPG', 'VCB', 'SSI', 'VHM', 'TCB', 'FPT', 'MBB', 'MWG', 'VNM', 'VIC'],
  isChartExpanded: false,

  setWsStatus: (wsStatus) => set({ wsStatus }),
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
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
        [indexData.symbol]: indexData,
      },
    })),

  setLastHeartbeat: (lastHeartbeat) => set({ lastHeartbeat }),
}));
