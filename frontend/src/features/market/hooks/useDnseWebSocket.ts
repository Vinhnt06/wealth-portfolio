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

      // 1. PING from Server -> Respond with PONG immediately
      if (data.action === 'ping' || data.type === 'ping' || data === 'ping' || data.event === 'ping') {
        setLastHeartbeat(Date.now());
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'pong' }));
        }
        return;
      }

      // 2. Trade & Trade Extra (tick.G1.json / tick_extra.G1.json)
      if (data.channel?.startsWith('tick') || data.matchPrice !== undefined) {
        const rawPrice = Number(data.matchPrice ?? data.price ?? 0);
        const price = rawPrice > 0 && rawPrice < 500 ? Math.round(rawPrice * 1000) : Math.round(rawPrice);
        const rawOpen = Number(data.openPrice ?? data.open ?? rawPrice);
        const open = rawOpen > 0 && rawOpen < 500 ? Math.round(rawOpen * 1000) : Math.round(rawOpen);
        const rawHigh = Number(data.highestPrice ?? data.high ?? rawPrice);
        const high = rawHigh > 0 && rawHigh < 500 ? Math.round(rawHigh * 1000) : Math.round(rawHigh);
        const rawLow = Number(data.lowestPrice ?? data.low ?? rawPrice);
        const low = rawLow > 0 && rawLow < 500 ? Math.round(rawLow * 1000) : Math.round(rawLow);
        const rawRef = Number(data.basicPrice ?? data.referencePrice ?? open);
        const ref = rawRef > 0 && rawRef < 500 ? Math.round(rawRef * 1000) : Math.round(rawRef);
        const rawCeil = Number(data.ceilingPrice ?? Math.round(ref * 1.07));
        const ceil = rawCeil > 0 && rawCeil < 500 ? Math.round(rawCeil * 1000) : Math.round(rawCeil);
        const rawFloor = Number(data.floorPrice ?? Math.round(ref * 0.93));
        const floor = rawFloor > 0 && rawFloor < 500 ? Math.round(rawFloor * 1000) : Math.round(rawFloor);

        const change = price - ref;
        const changePercent = ref > 0 ? (change / ref) * 100 : 0;
        const vol = Number(data.matchQtty ?? data.volume ?? 0);
        const totalVol = Number(data.totalVolumeTraded ?? data.totalVolume ?? 0);

        if (data.symbol && price > 0) {
          updateTick({
            symbol: data.symbol,
            price,
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: vol,
            totalVolume: totalVol,
            high,
            low,
            open,
            referencePrice: ref,
            ceilingPrice: ceil,
            floorPrice: floor,
            timestamp: Date.now(),
            matchType: data.side === 'BUY' ? 'B' : data.side === 'SELL' ? 'S' : (data.matchType || 'B'),
          });
        }
      }

      // 3. Quotes / Market Depth (top_price.G1.json)
      if (data.channel?.startsWith('top_price') || data.bid || data.offer || data.bids) {
        if (data.symbol) {
          const rawBids = data.bid || data.bids || [];
          const rawOffers = data.offer || data.asks || [];

          const bids = rawBids.map((b: any) => ({
            price: Number(b.price) < 500 ? Math.round(Number(b.price) * 1000) : Math.round(Number(b.price)),
            volume: Number(b.quantity ?? b.volume ?? 0),
          }));

          const asks = rawOffers.map((a: any) => ({
            price: Number(a.price) < 500 ? Math.round(Number(a.price) * 1000) : Math.round(Number(a.price)),
            volume: Number(a.quantity ?? a.volume ?? 0),
          }));

          updateQuotes({
            symbol: data.symbol,
            bids,
            asks,
            totalBidVol: Number(data.totalBidQtty ?? data.totalBidVol ?? 0),
            totalAskVol: Number(data.totalOfferQtty ?? data.totalAskVol ?? 0),
            timestamp: Date.now(),
          });
        }
      }

      // 4. Market Index (market_index.{index}.json)
      if (data.channel?.startsWith('market_index') || data.indexName || data.valueIndexes) {
        const sym = (data.indexName || data.indexSymbol || data.symbol || 'VNINDEX').toUpperCase();
        const val = Number(data.valueIndexes ?? data.value ?? 1735.09);
        const chg = Number(data.changedValue ?? data.change ?? 0);
        const chgPct = Number(data.changedRatio ?? data.changePercent ?? 0);
        const vol = Number(data.totalVolumeTraded ?? data.totalVolume ?? 0);
        const grossAmount = Number(data.grossTradeAmount ?? data.totalValue ?? 0);

        updateIndex({
          symbol: sym,
          name: sym === 'VNINDEX' ? 'VN-INDEX' : sym === 'VN30' ? 'VN30-INDEX' : `${sym}-INDEX`,
          value: val,
          change: chg,
          changePercent: chgPct,
          totalVolume: vol,
          totalValue: grossAmount > 0 && grossAmount < 1000000 ? grossAmount * 1000000000 : grossAmount,
          advances: Number(data.fluctuationUpIssueCount ?? 168),
          declines: Number(data.fluctuationDownIssueCount ?? 242),
          noChanges: Number(data.fluctuationSteadinessIssueCount ?? 74),
          timestamp: Date.now(),
        });
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
    
    // Always fetch verified real quote from DNSE for the selected symbol
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
        // Fallback to real snapshot if available
        const real = REAL_TICKS[selectedSymbol];
        if (real?.price) {
          const ref = real.ref || real.price;
          updateTick({
            symbol: selectedSymbol,
            price: real.price,
            change: real.price - ref,
            changePercent: ref ? ((real.price - ref) / ref) * 100 : 0,
            volume: 15000,
            totalVolume: real.volume || 1200000,
            high: real.high || Math.round(ref * 1.02),
            low: real.low || Math.round(ref * 0.98),
            open: real.open || ref,
            referencePrice: ref,
            ceilingPrice: Math.round(ref * 1.07),
            floorPrice: Math.round(ref * 0.93),
            timestamp: Date.now(),
            matchType: 'B',
          });
        }
      });
  }, [selectedSymbol, updateTick]);



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

        // 1. Trade & Trade Extra Channel (Lô chẵn G1)
        const subTickMsg = {
          action: 'subscribe',
          channel: 'tick.G1.json',
          symbols: symbols,
        };
        const subTickExtraMsg = {
          action: 'subscribe',
          channel: 'tick_extra.G1.json',
          symbols: symbols,
        };

        // 2. Market Depth Quotes (top_price.G1.json)
        const subTopPriceMsg = {
          action: 'subscribe',
          channel: 'top_price.G1.json',
          symbols: symbols,
        };

        // 3. Market Index Channels (VNINDEX, VN30, HNX, UPCOM)
        const subVnIndexMsg = {
          action: 'subscribe',
          channel: 'market_index.VNINDEX.json',
        };
        const subVn30Msg = {
          action: 'subscribe',
          channel: 'market_index.VN30.json',
        };
        const subHnxMsg = {
          action: 'subscribe',
          channel: 'market_index.HNX.json',
        };
        const subUpcomMsg = {
          action: 'subscribe',
          channel: 'market_index.UPCOM.json',
        };

        // 4. Foreign Investor Flow (foreign.G1.json)
        const subForeignMsg = {
          action: 'subscribe',
          channel: 'foreign.G1.json',
          symbols: symbols,
        };

        // 5. Market Index Influence (Top cổ phiếu ảnh hưởng chỉ số)
        const subInfluenceMsg = {
          action: 'subscribe',
          channel: 'market_index_influence.VNINDEX.1.json',
        };

        ws.send(JSON.stringify(subTickMsg));
        ws.send(JSON.stringify(subTickExtraMsg));
        ws.send(JSON.stringify(subTopPriceMsg));
        ws.send(JSON.stringify(subVnIndexMsg));
        ws.send(JSON.stringify(subVn30Msg));
        ws.send(JSON.stringify(subHnxMsg));
        ws.send(JSON.stringify(subUpcomMsg));
        ws.send(JSON.stringify(subForeignMsg));
        ws.send(JSON.stringify(subInfluenceMsg));

        // Client-initiated keepalive: send PONG every 2 minutes (tối đa 3 phút theo tài liệu DNSE)
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'pong' }));
          }
        }, 120000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setWsStatus('error');
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      };
    } catch {
      setWsStatus('error');
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [symbols, handleMessage, seedInitialState, setWsStatus]);

  const { wsStatus } = useMarketStore();
  return { wsStatus, selectedSymbol };
}
