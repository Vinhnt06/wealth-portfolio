'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../store/marketStore';
import { TickData, QuotesData, MarketIndexData } from '../types/dnse.types';

const WS_URL = 'wss://ws-openapi.dnse.com.vn';

const DEFAULT_SYMBOLS = [
  'HPG', 'SSI', 'VCB', 'VNM', 'TCB', 'FPT', 'MBB', 'VHM', 'MWG', 'VIC',
  'GAS', 'MSN', 'STB', 'VPB', 'BID', 'PLX', 'NVL', 'DIG', 'PDR', 'SHB',
  'ACB', 'EIB', 'LPB', 'HDB', 'KBC', 'DGC', 'VHC', 'DBC', 'REE', 'GEX',
  'KDH', 'VRE', 'VJC', 'POW', 'SAB', 'CTG', 'VIB'
];

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

  // Seed market state for 35+ major stocks
  const seedInitialState = useCallback(() => {
    const initialTicks: Record<string, { price: number; ref: number; name: string }> = {
      HPG: { price: 28500, ref: 28100, name: 'Hòa Phát' },
      SSI: { price: 34200, ref: 34500, name: 'Chứng khoán SSI' },
      VCB: { price: 92500, ref: 91000, name: 'Vietcombank' },
      VNM: { price: 67800, ref: 67800, name: 'Vinamilk' },
      TCB: { price: 23800, ref: 23200, name: 'Techcombank' },
      FPT: { price: 134500, ref: 132000, name: 'FPT Corp' },
      MBB: { price: 24100, ref: 24000, name: 'MBBank' },
      VHM: { price: 42300, ref: 43000, name: 'Vinhomes' },
      MWG: { price: 64200, ref: 65000, name: 'Thế Giới Di Động' },
      VIC: { price: 44600, ref: 45000, name: 'Vingroup' },
      STB: { price: 29800, ref: 29200, name: 'Sacombank' },
      VPB: { price: 19200, ref: 18900, name: 'VPBank' },
      BID: { price: 49500, ref: 49000, name: 'BIDV' },
      NVL: { price: 14200, ref: 14500, name: 'Novaland' },
      DIG: { price: 26500, ref: 26000, name: 'DIC Corp' },
      PDR: { price: 22100, ref: 22500, name: 'Phát Đạt' },
      SHB: { price: 11500, ref: 11400, name: 'SHB' },
      ACB: { price: 24800, ref: 24500, name: 'ACB' },
      EIB: { price: 18500, ref: 18200, name: 'Eximbank' },
      LPB: { price: 31200, ref: 30800, name: 'LPBank' },
    };

    Object.entries(initialTicks).forEach(([sym, val]) => {
      const change = val.price - val.ref;
      const changePercent = (change / val.ref) * 100;
      updateTick({
        symbol: sym,
        price: val.price,
        change,
        changePercent,
        volume: Math.floor(Math.random() * 50000) + 10000,
        totalVolume: Math.floor(Math.random() * 8000000) + 2000000,
        high: Math.round(val.price * 1.02),
        low: Math.round(val.price * 0.98),
        open: val.ref,
        referencePrice: val.ref,
        ceilingPrice: Math.round(val.ref * 1.07),
        floorPrice: Math.round(val.ref * 0.93),
        timestamp: Date.now(),
        matchType: Math.random() > 0.5 ? 'B' : 'S',
      });

      const spread = Math.round(val.price * 0.002);
      updateQuotes({
        symbol: sym,
        bids: [
          { price: val.price - spread, volume: Math.floor(Math.random() * 80000) + 20000 },
          { price: val.price - spread * 2, volume: Math.floor(Math.random() * 120000) + 30000 },
          { price: val.price - spread * 3, volume: Math.floor(Math.random() * 150000) + 40000 },
        ],
        asks: [
          { price: val.price + spread, volume: Math.floor(Math.random() * 70000) + 15000 },
          { price: val.price + spread * 2, volume: Math.floor(Math.random() * 110000) + 25000 },
          { price: val.price + spread * 3, volume: Math.floor(Math.random() * 140000) + 35000 },
        ],
        totalBidVol: 350000,
        totalAskVol: 320000,
        timestamp: Date.now(),
      });
    });

    // Seed Market Indexes
    updateIndex({
      symbol: 'VNINDEX',
      name: 'VN-INDEX',
      value: 1284.62,
      change: 6.15,
      changePercent: 0.48,
      totalVolume: 742180000,
      totalValue: 18450000000000,
      advances: 224,
      declines: 138,
      noChanges: 65,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'VN30',
      name: 'VN30-INDEX',
      value: 1318.45,
      change: 8.92,
      changePercent: 0.68,
      totalVolume: 312000000,
      totalValue: 9820000000000,
      advances: 20,
      declines: 8,
      noChanges: 2,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'HNX',
      name: 'HNX-INDEX',
      value: 242.18,
      change: -0.85,
      changePercent: -0.35,
      totalVolume: 84000000,
      totalValue: 145000000000,
      advances: 72,
      declines: 95,
      noChanges: 54,
      timestamp: Date.now(),
    });
  }, [updateTick, updateQuotes, updateIndex]);

  // Ensure dynamically selected custom symbols are instantly seeded
  useEffect(() => {
    if (!selectedSymbol) return;
    const currentStore = useMarketStore.getState();
    if (!currentStore.ticks[selectedSymbol]) {
      const ref = 25000;
      updateTick({
        symbol: selectedSymbol,
        price: ref,
        change: 0,
        changePercent: 0,
        volume: 15000,
        totalVolume: 1200000,
        high: Math.round(ref * 1.02),
        low: Math.round(ref * 0.98),
        open: ref,
        referencePrice: ref,
        ceilingPrice: Math.round(ref * 1.07),
        floorPrice: Math.round(ref * 0.93),
        timestamp: Date.now(),
        matchType: 'B',
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
