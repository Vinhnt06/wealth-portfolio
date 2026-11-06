'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../store/marketStore';
import { TickData, QuotesData, MarketIndexData } from '../types/dnse.types';
import realTicksData from '../data/realTicks.json';
import { isPreMarketResetWindow } from '../utils/marketHours';

const WS_URL = 'wss://ws-openapi.dnse.com.vn';

const DEFAULT_SYMBOLS = [
  // Ngân hàng & Tài chính
  'VCB', 'BID', 'CTG', 'TCB', 'MBB', 'ACB', 'VPB', 'HDB', 'STB', 'LPB', 'SHB', 'TPB', 'VIB', 'MSB', 'OCB', 'EIB',
  // Chứng khoán
  'SSI', 'VND', 'VCI', 'HCM', 'SHS', 'MBS', 'FTS', 'BSI', 'CTS', 'VIX',
  // Thép & Vật liệu
  'HPG', 'HSG', 'NKG', 'VGS',
  // Bất động sản
  'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'PDR', 'DIG', 'DXG', 'CEO', 'NVL', 'KBC', 'IDC', 'VGC', 'SZC', 'BCM', 'TCH',
  // Công nghệ
  'FPT', 'CMG', 'ELC',
  // Bán lẻ & Tiêu dùng
  'MWG', 'FRT', 'DGW', 'PNJ', 'MSN', 'VNM', 'SAB', 'DBC', 'HAG', 'BAF', 'VHC', 'ANV',
  // Năng lượng & Dầu khí
  'GAS', 'PLX', 'BSR', 'PVD', 'PVS', 'PVT', 'PVP', 'POW', 'REE', 'PC1',
  // Hóa chất & Phân bón
  'DGC', 'DCM', 'DPM', 'CSV', 'GVR',
  // Công nghiệp & Xây dựng, Vận tải
  'GEX', 'VSC', 'GMD', 'HAH', 'VCG', 'HHV', 'CII', 'VJC'
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

// Global Singleton Streaming Manager across all hook instances
let activeHookCount = 0;
let liveStreamInterval: NodeJS.Timeout | null = null;
let currentTrackedSymbol = '';
let seenTradeFingerprints = new Set<string>();
let isWsConnected = false;
let globalWs: WebSocket | null = null;
let globalMqttClient: any = null;
let globalHeartbeatTimer: NodeJS.Timeout | null = null;
let globalReconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;

async function executeStreamCycle() {
  const state = useMarketStore.getState();
  const symbol = state.selectedSymbol;
  if (!symbol) return;

  // Giảm tải khi người dùng đang chuyển sang tab khác
  if (typeof document !== 'undefined' && document.hidden) {
    return;
  }

  // 1. Cập nhật Sổ Lệnh (Order Book Depth) 3 mức giá thật từ sàn Vietcap
  try {
    const obRes = await fetch(`/api/market/orderbook?symbol=${symbol}`);
    const obJson = await obRes.json();
    if (obJson.success && obJson.data) {
      const d = obJson.data;
      state.updateQuotes({
        symbol: d.symbol,
        bids: d.bids || [],
        asks: d.asks || [],
        totalBidVol: d.totalBidVol || 0,
        totalAskVol: d.totalAskVol || 0,
        timestamp: d.timestamp || Date.now(),
      });

      if (d.price) {
        state.updateTick({
          symbol: d.symbol,
          price: d.price,
          change: d.change,
          changePercent: d.changePercent,
          volume: d.totalVolume,
          totalVolume: d.totalVolume,
          high: d.high,
          low: d.low,
          open: d.open,
          referencePrice: d.referencePrice,
          ceilingPrice: d.ceilingPrice,
          floorPrice: d.floorPrice,
          timestamp: d.timestamp || Date.now(),
          matchType: 'B',
        });
      }

      // Đánh dấu trạng thái kết nối thành công để mọi badge trên UI chuyển màu xanh Realtime
      if (state.wsStatus !== 'connected') {
        state.setWsStatus('connected');
      }
      state.setLastHeartbeat(Date.now());
    }
  } catch {
    // Bỏ qua lỗi mạng tạm thời
  }

  // 2. Cập nhật Khớp Lệnh Real-time & Bắn Tick cho Radar Cá Mập
  try {
    const trRes = await fetch(`/api/market/trades?symbol=${symbol}&limit=50`);
    const trJson = await trRes.json();
    if (trJson.success && trJson.data?.trades) {
      const trades = trJson.data.trades;

      // Khi đổi mã cổ phiếu mới: reset danh sách đã xem & emit tick đầu tiên
      if (currentTrackedSymbol !== symbol) {
        currentTrackedSymbol = symbol;
        seenTradeFingerprints = new Set(
          trades.slice(0, 40).map((t: any) => `${t.time}_${t.volume}_${t.price}_${t.type}`)
        );

        if (trades.length > 0) {
          const latest = trades[0];
          const rawP = latest.price;
          const priceInVnd = rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP);
          state.setLastTradeTick({
            id: `stream-${symbol}-${latest.time}-${latest.volume}`,
            symbol,
            price: priceInVnd,
            volume: latest.volume,
            matchType: latest.type === 'M' ? 'B' : 'S',
            timestamp: Date.now(),
          });
        }
      } else {
        // Phát hiện các lệnh khớp MỚI xuất hiện trên sàn
        const newTrades: any[] = [];
        for (const t of trades) {
          const fp = `${t.time}_${t.volume}_${t.price}_${t.type}`;
          if (!seenTradeFingerprints.has(fp)) {
            newTrades.push(t);
            seenTradeFingerprints.add(fp);
          }
        }

        // Nếu có lệnh mới, emit lệnh mới nhất để kích hoạt badge 'VỪA KHỚP'
        if (newTrades.length > 0) {
          const newest = newTrades[0];
          const rawP = newest.price;
          const priceInVnd = rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP);
          state.setLastTradeTick({
            id: `stream-${symbol}-${newest.time}-${newest.volume}-${Date.now()}`,
            symbol,
            price: priceInVnd,
            volume: newest.volume,
            matchType: newest.type === 'M' ? 'B' : 'S',
            timestamp: Date.now(),
          });
        }
      }
    }
  } catch {
    // Bỏ qua lỗi mạng tạm thời
  }
}

function startGlobalStreaming() {
  if (liveStreamInterval) return;
  // Thực hiện ngay chu kỳ đầu tiên
  executeStreamCycle();
  // Lặp lại mỗi 2 giây (Zero Lag Realtime)
  liveStreamInterval = setInterval(executeStreamCycle, 2000);
}

function stopGlobalStreaming() {
  if (liveStreamInterval) {
    clearInterval(liveStreamInterval);
    liveStreamInterval = null;
  }
}

export function useDnseWebSocket(symbols: string[] = DEFAULT_SYMBOLS) {
  const {
    setWsStatus,
    updateTick,
    updateQuotes,
    updateIndex,
    setLastHeartbeat,
    selectedSymbol,
    setLastTradeTick,
  } = useMarketStore();

  // Helper to parse incoming DNSE message (hỗ trợ cả chuẩn DNSE MDDS MQTT và WS legacy)
  const handleMessage = useCallback((event: { data: string }, topic?: string) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data) return;

      // 1. PING từ máy chủ -> Phản hồi PONG giữ kết nối
      if (data.action === 'ping' || data.type === 'ping' || data === 'ping' || data.event === 'ping') {
        setLastHeartbeat(Date.now());
        if (globalWs && globalWs.readyState === WebSocket.OPEN) {
          globalWs.send(JSON.stringify({ action: 'pong' }));
        }
        return;
      }

      setLastHeartbeat(Date.now());
      const rawSymbol = String(data.Symbol || data.symbol || data.indexName || data.MarketID || '').toUpperCase();

      // 2. Xử lý TOP_PRICE (Sổ lệnh OrderBook 3 mức giá Bid / Ask)
      if (topic?.includes('/TP/') || data.Bid !== undefined || data.Ask !== undefined || data.channel?.startsWith('top_price') || data.bid || data.offer || data.bids) {
        if (rawSymbol) {
          const rawBids = data.Bid || data.bid || data.bids || [];
          const rawAsks = data.Ask || data.offer || data.asks || [];

          const bids = rawBids.map((b: any) => {
            const rawP = Number(b.Price ?? b.price ?? 0);
            return {
              price: rawP > 0 && rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP),
              volume: Number(b.Qtty ?? b.quantity ?? b.volume ?? 0),
            };
          }).filter((b: any) => b.price > 0);

          const asks = rawAsks.map((a: any) => {
            const rawP = Number(a.Price ?? a.price ?? 0);
            return {
              price: rawP > 0 && rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP),
              volume: Number(a.Qtty ?? a.quantity ?? a.volume ?? 0),
            };
          }).filter((a: any) => a.price > 0);

          updateQuotes({
            symbol: rawSymbol,
            bids,
            asks,
            totalBidVol: bids.reduce((acc: number, cur: any) => acc + cur.volume, 0) || Number(data.totalBidQtty ?? data.totalBidVol ?? 0),
            totalAskVol: asks.reduce((acc: number, cur: any) => acc + cur.volume, 0) || Number(data.totalOfferQtty ?? data.totalAskVol ?? 0),
            timestamp: Date.now(),
          });
        }
      }

      // 3. Xử lý TICK (Khớp lệnh realtime từng giây - Bắn thẳng vào Radar Cá Mập)
      if (topic?.includes('/tick/') || (data.MatchPrice !== undefined && data.BasicPrice === undefined) || data.channel?.startsWith('tick')) {
        const rawP = Number(data.MatchPrice ?? data.matchPrice ?? data.price ?? 0);
        const price = rawP > 0 && rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP);
        const vol = Number(data.MatchQtty ?? data.matchQtty ?? data.volume ?? 0);
        const sideRaw = data.side || data.matchType || (data.MatchSide === 'BUY' ? 'B' : data.MatchSide === 'SELL' ? 'S' : 'B');
        const matchSide: 'B' | 'S' = sideRaw === 'BUY' || sideRaw === 'B' ? 'B' : 'S';

        if (rawSymbol && price > 0 && vol > 0) {
          setLastTradeTick({
            id: `mqtt-${rawSymbol}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            symbol: rawSymbol,
            price,
            volume: vol,
            matchType: matchSide,
            timestamp: Date.now(),
          });
        }
      }

      // 4. Xử lý STOCK_INFO (Giá tham chiếu, trần, sàn, giá khớp, tổng khối lượng)
      if (topic?.includes('/SI/') || data.BasicPrice !== undefined || data.CeilingPrice !== undefined || data.basicPrice !== undefined) {
        const rawP = Number(data.MatchPrice ?? data.matchPrice ?? data.price ?? data.BasicPrice ?? data.basicPrice ?? 0);
        const price = rawP > 0 && rawP < 500 ? Math.round(rawP * 1000) : Math.round(rawP);
        const rawRef = Number(data.BasicPrice ?? data.basicPrice ?? data.referencePrice ?? price);
        const ref = rawRef > 0 && rawRef < 500 ? Math.round(rawRef * 1000) : Math.round(rawRef);
        const rawCeil = Number(data.CeilingPrice ?? data.ceilingPrice ?? Math.round(ref * 1.07));
        const ceil = rawCeil > 0 && rawCeil < 500 ? Math.round(rawCeil * 1000) : Math.round(rawCeil);
        const rawFloor = Number(data.FloorPrice ?? data.floorPrice ?? Math.round(ref * 0.93));
        const floor = rawFloor > 0 && rawFloor < 500 ? Math.round(rawFloor * 1000) : Math.round(rawFloor);
        const rawHigh = Number(data.HighestPrice ?? data.highestPrice ?? data.high ?? price);
        const high = rawHigh > 0 && rawHigh < 500 ? Math.round(rawHigh * 1000) : Math.round(rawHigh);
        const rawLow = Number(data.LowestPrice ?? data.lowestPrice ?? data.low ?? price);
        const low = rawLow > 0 && rawLow < 500 ? Math.round(rawLow * 1000) : Math.round(rawLow);

        const change = Number(data.Changed ?? data.change ?? (price - ref));
        const changePercent = Number(data.ChangedRatio ?? data.changePercent ?? (ref > 0 ? (change / ref) * 100 : 0));
        const vol = Number(data.MatchQtty ?? data.matchQtty ?? data.volume ?? 0);
        const totalVol = Number(data.AccumulatedVol ?? data.totalVolumeTraded ?? data.totalVolume ?? 0);

        if (rawSymbol && price > 0) {
          updateTick({
            symbol: rawSymbol,
            price,
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: vol,
            totalVolume: totalVol,
            high,
            low,
            open: ref,
            referencePrice: ref,
            ceilingPrice: ceil,
            floorPrice: floor,
            timestamp: Date.now(),
            matchType: 'B',
          });
        }
      }

      // 5. Xử lý MARKET_INDEX (Chỉ số thị trường VNINDEX, VN30, HNX, UPCOM)
      if (topic?.includes('/MI/') || data.MarketID !== undefined || data.indexValue !== undefined || data.indexName || data.valueIndexes) {
        const sym = (data.MarketID || data.indexName || data.indexSymbol || data.symbol || 'VNINDEX').toUpperCase();
        const val = Number(data.indexValue ?? data.valueIndexes ?? data.marketIndex ?? 0);
        const chg = Number(data.changed ?? data.changedValue ?? data.change ?? 0);
        const vol = Number(data.totalShareTraded ?? data.totalVolumeTraded ?? data.totalVolume ?? 0);
        const grossAmount = Number(data.totalValueTraded ?? data.grossTradeAmount ?? data.totalValue ?? 0);
        const advances = Number(data.advance ?? data.fluctuationUpIssueCount ?? 0);
        const declines = Number(data.decline ?? data.fluctuationDownIssueCount ?? 0);
        const noChanges = Number(data.noChange ?? data.fluctuationSteadinessIssueCount ?? 0);

        if (val > 0) {
          const chgPct = val > 0 && chg ? Number(((chg / (val - chg)) * 100).toFixed(2)) : 0;
          updateIndex({
            symbol: sym,
            name: sym === 'VNINDEX' ? 'VN-INDEX' : sym === 'VN30' ? 'VN30-INDEX' : `${sym}-INDEX`,
            value: val,
            change: chg,
            changePercent: chgPct,
            totalVolume: vol,
            totalValue: grossAmount > 0 && grossAmount < 1000000 ? grossAmount * 1000000000 : grossAmount,
            advances,
            declines,
            noChanges,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // Bỏ qua khung tin không hợp lệ
    }
  }, [updateTick, updateQuotes, updateIndex, setLastHeartbeat, setLastTradeTick]);

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

    const isPreMarketVN = isPreMarketResetWindow('VNINDEX');
    const isPreMarketHNX = isPreMarketResetWindow('HNX');

    // Seed Real Market Indexes
    updateIndex({
      symbol: 'VNINDEX',
      name: 'VN-INDEX',
      value: 1740.73,
      change: isPreMarketVN ? 0 : 7.71,
      changePercent: isPreMarketVN ? 0 : 0.44,
      totalVolume: isPreMarketVN ? 0 : 911324549,
      totalValue: isPreMarketVN ? 0 : 22450000000000,
      advances: isPreMarketVN ? 0 : 168,
      declines: isPreMarketVN ? 0 : 242,
      noChanges: isPreMarketVN ? 0 : 74,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'VN30',
      name: 'VN30-INDEX',
      value: 1873.43,
      change: isPreMarketVN ? 0 : -3.57,
      changePercent: isPreMarketVN ? 0 : -0.19,
      totalVolume: isPreMarketVN ? 0 : 468198975,
      totalValue: isPreMarketVN ? 0 : 13200000000000,
      advances: isPreMarketVN ? 0 : 11,
      declines: isPreMarketVN ? 0 : 16,
      noChanges: isPreMarketVN ? 0 : 3,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'HNX',
      name: 'HNX-INDEX',
      value: 261.60,
      change: isPreMarketHNX ? 0 : 1.15,
      changePercent: isPreMarketHNX ? 0 : 0.44,
      totalVolume: isPreMarketHNX ? 0 : 70117939,
      totalValue: isPreMarketHNX ? 0 : 1620000000000,
      advances: isPreMarketHNX ? 0 : 92,
      declines: isPreMarketHNX ? 0 : 81,
      noChanges: isPreMarketHNX ? 0 : 55,
      timestamp: Date.now(),
    });

    updateIndex({
      symbol: 'UPCOM',
      name: 'UPCOM-INDEX',
      value: 124.24,
      change: isPreMarketHNX ? 0 : -0.97,
      changePercent: isPreMarketHNX ? 0 : -0.77,
      totalVolume: isPreMarketHNX ? 0 : 37646708,
      totalValue: isPreMarketHNX ? 0 : 650000000000,
      advances: isPreMarketHNX ? 0 : 145,
      declines: isPreMarketHNX ? 0 : 120,
      noChanges: isPreMarketHNX ? 0 : 88,
      timestamp: Date.now(),
    });
  }, [updateTick, updateQuotes, updateIndex]);

  // Seed 1 lần khi mount
  useEffect(() => {
    seedInitialState();
  }, [seedInitialState]);

  // Khi selectedSymbol thay đổi, kích hoạt ngay 1 chu kỳ stream để cập nhật ngay lập tức & subscribe MQTT topic
  useEffect(() => {
    if (!selectedSymbol) return;
    executeStreamCycle();

    if (globalMqttClient && globalMqttClient.connected) {
      try {
        globalMqttClient.subscribe([
          `plaintext/quotes/stock/TP/${selectedSymbol}`,
          `plaintext/quotes/stock/SI/${selectedSymbol}`,
          `plaintext/quotes/stock/tick/${selectedSymbol}`,
        ]);
      } catch {}
    }
  }, [selectedSymbol]);

  // Main Singleton Connection & Streaming Engine
  useEffect(() => {
    activeHookCount++;

    // Khởi động High-Frequency Streaming Engine
    startGlobalStreaming();

    // 1. Thử kết nối trực tiếp DNSE MQTT WebSocket (chuẩn broker EMQX datafeed-lts của DNSE)
    async function initDnseMqtt() {
      if (globalMqttClient && globalMqttClient.connected) return;
      try {
        const sessionRes = await fetch('/api/market/dnse-session');
        const sessionJson = await sessionRes.json();
        if (sessionJson.success && sessionJson.investorId && sessionJson.token) {
          const mqttModule = await import('mqtt');
          const mqtt = (mqttModule as any).default || mqttModule;
          const clientId = `dnse-price-json-mqtt-ws-sub-${sessionJson.investorId}-${Math.random().toString(36).substring(2, 8)}`;

          const client = mqtt.connect('wss://datafeed-lts.dnse.com.vn/wss', {
            clientId,
            username: sessionJson.investorId,
            password: sessionJson.token,
            protocolVersion: 4,
            reconnectPeriod: 5000,
            connectTimeout: 10000,
          });

          globalMqttClient = client;

          client.on('connect', () => {
            isWsConnected = true;
            setWsStatus('connected');
            const sym = selectedSymbol || 'HPG';

            // Subscribe toàn diện: Cả các wildcard toàn thị trường và mã đang theo dõi
            const allMarketTopics = [
              'plaintext/quotes/stock/TP/+',
              'plaintext/quotes/stock/SI/+',
              'plaintext/quotes/stock/tick/+',
              'plaintext/quotes/index/MI/+',
              'plaintext/quotes/session/+',
              `plaintext/quotes/stock/TP/${sym}`,
              `plaintext/quotes/stock/SI/${sym}`,
              `plaintext/quotes/stock/tick/${sym}`,
            ];

            client.subscribe(allMarketTopics, (err: any) => {
              if (!err) {
                console.log('[DNSE MQTT] Đã kích hoạt toàn bộ luồng dữ liệu thị trường trực tiếp từ DNSE!');
              }
            });
          });

          client.on('message', (topic: string, message: any) => {
            try {
              const str = message.toString();
              handleMessage({ data: str }, topic);
            } catch {}
          });

          client.on('error', () => {
            // Broker lỗi auth hoặc network -> Fallback vẫn duy trì bởi startGlobalStreaming()
          });
        }
      } catch {
        // Fallback transparently
      }
    }

    initDnseMqtt();

    // Đồng thời thử kết nối WebSocket DNSE (nếu khả dụng)
    const apiKey = process.env.NEXT_PUBLIC_DNSE_API_KEY;
    const targetUrl = apiKey ? `${WS_URL}?token=${encodeURIComponent(apiKey)}` : WS_URL;

    function connectWs() {
      if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const ws = new WebSocket(targetUrl);
        globalWs = ws;

        ws.onopen = () => {
          isWsConnected = true;
          setWsStatus('connected');
          reconnectAttempt = 0;

          const activeSymbols = Array.from(new Set([...symbols, selectedSymbol].filter(Boolean)));
          const subTickMsg = { action: 'subscribe', channel: 'tick.G1.json', symbols: activeSymbols };
          const subTickExtraMsg = { action: 'subscribe', channel: 'tick_extra.G1.json', symbols: activeSymbols };
          const subTopPriceMsg = { action: 'subscribe', channel: 'top_price.G1.json', symbols: activeSymbols };
          const subVnIndexMsg = { action: 'subscribe', channel: 'market_index.VNINDEX.json' };
          const subVn30Msg = { action: 'subscribe', channel: 'market_index.VN30.json' };
          const subHnxMsg = { action: 'subscribe', channel: 'market_index.HNX.json' };
          const subUpcomMsg = { action: 'subscribe', channel: 'market_index.UPCOM.json' };

          ws.send(JSON.stringify(subTickMsg));
          ws.send(JSON.stringify(subTickExtraMsg));
          ws.send(JSON.stringify(subTopPriceMsg));
          ws.send(JSON.stringify(subVnIndexMsg));
          ws.send(JSON.stringify(subVn30Msg));
          ws.send(JSON.stringify(subHnxMsg));
          ws.send(JSON.stringify(subUpcomMsg));

          if (globalHeartbeatTimer) clearInterval(globalHeartbeatTimer);
          globalHeartbeatTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'pong' }));
            }
          }, 120000);
        };

        ws.onmessage = handleMessage;

        ws.onerror = () => {
          isWsConnected = false;
        };

        ws.onclose = () => {
          isWsConnected = false;
          if (globalHeartbeatTimer) clearInterval(globalHeartbeatTimer);
          // Tự nối lại sau delay
          if (!globalReconnectTimer && activeHookCount > 0) {
            const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
            reconnectAttempt++;
            globalReconnectTimer = setTimeout(() => {
              globalReconnectTimer = null;
              connectWs();
            }, delay);
          }
        };
      } catch {
        isWsConnected = false;
      }
    }

    connectWs();

    return () => {
      activeHookCount = Math.max(0, activeHookCount - 1);
      if (activeHookCount === 0) {
        stopGlobalStreaming();
        if (globalReconnectTimer) {
          clearTimeout(globalReconnectTimer);
          globalReconnectTimer = null;
        }
        if (globalHeartbeatTimer) {
          clearInterval(globalHeartbeatTimer);
          globalHeartbeatTimer = null;
        }
        if (globalWs) {
          globalWs.close();
          globalWs = null;
        }
        if (globalMqttClient) {
          try {
            globalMqttClient.end(true);
          } catch {}
          globalMqttClient = null;
        }
      }
    };
  }, [symbols, handleMessage, setWsStatus, selectedSymbol]);

  const { wsStatus } = useMarketStore();
  return { wsStatus, selectedSymbol };
}

