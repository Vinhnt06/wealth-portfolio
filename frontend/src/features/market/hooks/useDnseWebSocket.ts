'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../store/marketStore';
import { TickData, QuotesData, MarketIndexData } from '../types/dnse.types';
import realTicksData from '../data/realTicks.json';

const WS_URL = 'wss://ws-openapi.dnse.com.vn';

const DEFAULT_SYMBOLS = [
  'HPG', 'SSI', 'VCB', 'VNM', 'TCB', 'FPT', 'MBB', 'VHM', 'MWG', 'VIC',
  'GAS', 'MSN', 'STB', 'VPB', 'BID', 'PLX', 'NVL', 'DIG', 'PDR', 'SHB',
  'ACB', 'EIB', 'LPB', 'HDB', 'KBC', 'DGC', 'VHC', 'DBC', 'REE', 'GEX',
  'KDH', 'VRE', 'VJC', 'POW', 'SAB', 'CTG', 'VIB'
];

interface RealTickEntry {
  price: number;
  ref: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

const REAL_TICKS: Record<string, RealTickEntry> = realTicksData as unknown as Record<string, RealTickEntry>;

export function useDnseWebSocket(symbols: string[] = DEFAULT_SYMBOLS) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  const {
    setWsStatus,
    updateTick,
    updateQuotes,
    updateIndex,
    setLastHeartbeat,
    selectedSymbol,
  } = useMarketStore();

  // Helper to parse incoming DNSE message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.action === 'ping' || data.type === 'ping') {
        setLastHeartbeat(Date.now());
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'pong' }));
        }
        return;
      }

      if (data.channel?.startsWith('tick') || data.type === 'tick' || data.symbol) {
        if (data.symbol && data.price) {
          const tick: TickData = {
            symbol: data.symbol,
            price: Number(data.price),
            change: Number(data.change || 0),
            changePercent: Number(data.changePercent || 0),
            volume: Number(data.volume || 0),
            totalVolume: Number(data.totalVolume || 0),
            high: Number(data.high || data.price),
            low: Number(data.low || data.price),
            open: Number(data.open || data.price),
            referencePrice: Number(data.refPrice || data.referencePrice || data.price),
            ceilingPrice: Number(data.ceilPrice || data.price * 1.07),
            floorPrice: Number(data.floorPrice || data.price * 0.93),
            timestamp: data.timestamp || Date.now(),
            matchType: data.matchType || 'B',
          };
          updateTick(tick);
        }
      }

      if (data.channel?.startsWith('quote') || data.bids) {
        if (data.symbol) {
          const quotes: QuotesData = {
            symbol: data.symbol,
            bids: data.bids || [],
            asks: data.asks || [],
            totalBidVol: data.totalBidVol || 0,
            totalAskVol: data.totalAskVol || 0,
            timestamp: data.timestamp || Date.now(),
          };
          updateQuotes(quotes);
        }
      }

      if (data.channel?.startsWith('index') || data.indexSymbol) {
        const indexData: MarketIndexData = {
          symbol: data.indexSymbol || data.symbol || 'VNINDEX',
          name: data.name || 'VN-INDEX',
          value: Number(data.value || 1280.5),
          change: Number(data.change || 4.2),
          changePercent: Number(data.changePercent || 0.33),
          totalVolume: Number(data.totalVolume || 650000000),
          totalValue: Number(data.totalValue || 16500000000000),
          advances: Number(data.advances || 215),
          declines: Number(data.declines || 142),
          noChanges: Number(data.noChanges || 78),
          timestamp: Date.now(),
        };
        updateIndex(indexData);
      }
    } catch {
      // Non-JSON frame
    }
  }, [updateTick, updateQuotes, updateIndex, setLastHeartbeat]);

  // Seed market state with REAL vnstock data
  const seedInitialState = useCallback(() => {
    Object.entries(REAL_TICKS).forEach(([sym, val]) => {
      const price = val.price;
      const ref = val.ref || price;
      const change = price - ref;
      const changePercent = ref ? (change / ref) * 100 : 0;

      updateTick({
        symbol: sym,
        price: price,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: Math.floor((val.volume || 1000000) / 10),
        totalVolume: val.volume || 5000000,
        high: val.high || Math.round(price * 1.01),
        low: val.low || Math.round(price * 0.99),
        open: val.open || ref,
        referencePrice: ref,
        ceilingPrice: Math.round(ref * 1.07),
        floorPrice: Math.round(ref * 0.93),
        timestamp: Date.now(),
        matchType: Math.random() > 0.5 ? 'B' : 'S',
      });

      const spread = Math.max(50, Math.round(price * 0.002 / 50) * 50);
      updateQuotes({
        symbol: sym,
        bids: [
          { price: price - spread, volume: Math.floor(Math.random() * 80000) + 20000 },
          { price: price - spread * 2, volume: Math.floor(Math.random() * 120000) + 30000 },
          { price: price - spread * 3, volume: Math.floor(Math.random() * 150000) + 40000 },
        ],
        asks: [
          { price: price + spread, volume: Math.floor(Math.random() * 70000) + 15000 },
          { price: price + spread * 2, volume: Math.floor(Math.random() * 110000) + 25000 },
          { price: price + spread * 3, volume: Math.floor(Math.random() * 140000) + 35000 },
        ],
        totalBidVol: 350000,
        totalAskVol: 320000,
        timestamp: Date.now(),
      });
    });

    // Seed Real Market Indexes from vnstock
    updateIndex({
      symbol: 'VNINDEX',
      name: 'VN-INDEX',
      value: 1735.09,
      change: -3.88,
      changePercent: -0.22,
      totalVolume: 911324549,
      totalValue: 22450000000000,
      advances: 168,
      declines: 242,
      noChanges: 74,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'VN30',
      name: 'VN30-INDEX',
      value: 1873.43,
      change: -3.57,
      changePercent: -0.19,
      totalVolume: 468198975,
      totalValue: 13200000000000,
      advances: 11,
      declines: 16,
      noChanges: 3,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'HNX',
      name: 'HNX-INDEX',
      value: 261.60,
      change: 1.15,
      changePercent: 0.44,
      totalVolume: 78500000,
      totalValue: 1620000000000,
      advances: 92,
      declines: 81,
      noChanges: 55,
      timestamp: Date.now(),
    });
  }, [updateTick, updateQuotes, updateIndex]);

  // Ensure dynamically selected custom symbols fetch real quote with DNSE failover
  useEffect(() => {
    if (!selectedSymbol) return;
    const currentStore = useMarketStore.getState();
    if (!currentStore.ticks[selectedSymbol]) {
      fetch(`/api/market/quote?symbol=${selectedSymbol}`)
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success && resData.data) {
            const d = resData.data;
            updateTick({
              symbol: d.symbol,
              price: d.price,
              change: d.change,
              changePercent: d.changePercent,
              volume: Math.floor(d.volume / 10),
              totalVolume: d.volume,
              high: d.high,
              low: d.low,
              open: d.open,
              referencePrice: d.referencePrice,
              ceilingPrice: d.ceilingPrice,
              floorPrice: d.floorPrice,
              timestamp: d.timestamp,
              matchType: 'B',
            });
          }
        })
        .catch(() => {
          // Graceful fallback to cached snapshot
          const real = REAL_TICKS[selectedSymbol];
          const ref = real?.ref || real?.price || 25000;
          const price = real?.price || ref;
          updateTick({
            symbol: selectedSymbol,
            price: price,
            change: price - ref,
            changePercent: ref ? ((price - ref) / ref) * 100 : 0,
            volume: 15000,
            totalVolume: real?.volume || 1200000,
            high: real?.high || Math.round(ref * 1.02),
            low: real?.low || Math.round(ref * 0.98),
            open: real?.open || ref,
            referencePrice: ref,
            ceilingPrice: Math.round(ref * 1.07),
            floorPrice: Math.round(ref * 0.93),
            timestamp: Date.now(),
            matchType: 'B',
          });
        });
    }
  }, [selectedSymbol, updateTick]);

  // Live simulation tick updates
  const startLiveSimulation = useCallback(() => {
    if (mockTimerRef.current) clearInterval(mockTimerRef.current);

    mockTimerRef.current = setInterval(() => {
      const symList = Object.keys(useMarketStore.getState().ticks);
      if (symList.length === 0) return;
      const sym = symList[Math.floor(Math.random() * symList.length)];
      const currentStore = useMarketStore.getState();
      const existing = currentStore.ticks[sym];
      if (!existing) return;

      const delta = (Math.random() - 0.49) * (existing.referencePrice * 0.003);
      const newPrice = Math.round((existing.price + delta) / 100) * 100;
      const boundedPrice = Math.max(existing.floorPrice, Math.min(existing.ceilingPrice, newPrice));
      const change = boundedPrice - existing.referencePrice;
      const changePercent = (change / existing.referencePrice) * 100;
      const tickVol = Math.floor(Math.random() * 5000) + 100;

      updateTick({
        ...existing,
        price: boundedPrice,
        change,
        changePercent,
        volume: tickVol,
        totalVolume: existing.totalVolume + tickVol,
        high: Math.max(existing.high, boundedPrice),
        low: Math.min(existing.low, boundedPrice),
        timestamp: Date.now(),
        matchType: delta >= 0 ? 'B' : 'S',
      });

      const spread = 100;
      updateQuotes({
        symbol: sym,
        bids: [
          { price: boundedPrice - spread, volume: Math.floor(Math.random() * 60000) + 10000 },
          { price: boundedPrice - spread * 2, volume: Math.floor(Math.random() * 90000) + 20000 },
          { price: boundedPrice - spread * 3, volume: Math.floor(Math.random() * 140000) + 30000 },
        ],
        asks: [
          { price: boundedPrice + spread, volume: Math.floor(Math.random() * 55000) + 8000 },
          { price: boundedPrice + spread * 2, volume: Math.floor(Math.random() * 85000) + 18000 },
          { price: boundedPrice + spread * 3, volume: Math.floor(Math.random() * 130000) + 28000 },
        ],
        totalBidVol: 290000 + Math.floor(Math.random() * 50000),
        totalAskVol: 270000 + Math.floor(Math.random() * 50000),
        timestamp: Date.now(),
      });
    }, 800);
  }, [updateTick, updateQuotes]);

  // Main Connection logic
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_DNSE_API_KEY;
    seedInitialState();

    setWsStatus('connecting');

    const targetUrl = apiKey ? `${WS_URL}?token=${encodeURIComponent(apiKey)}` : WS_URL;

    try {
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        reconnectAttemptRef.current = 0;

        const subTickMsg = {
          action: 'subscribe',
          channel: 'tick.G1.json',
          symbols: symbols,
        };
        const subQuoteMsg = {
          action: 'subscribe',
          channel: 'quote.G1.json',
          symbols: symbols,
        };
        const subIndexMsg = {
          action: 'subscribe',
          channel: 'index.G1.json',
          symbols: ['VNINDEX', 'VN30', 'HNX'],
        };

        ws.send(JSON.stringify(subTickMsg));
        ws.send(JSON.stringify(subQuoteMsg));
        ws.send(JSON.stringify(subIndexMsg));

        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
          }
        }, 120000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setWsStatus('error');
        startLiveSimulation();
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        startLiveSimulation();
      };
    } catch {
      setWsStatus('error');
      startLiveSimulation();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (mockTimerRef.current) {
        clearInterval(mockTimerRef.current);
      }
    };
  }, [symbols, handleMessage, seedInitialState, setWsStatus, startLiveSimulation]);

  const { wsStatus } = useMarketStore();
  return { wsStatus, selectedSymbol };
}
