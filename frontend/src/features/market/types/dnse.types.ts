// DNSE Market Data WebSocket Types

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TickData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  totalVolume: number;
  high: number;
  low: number;
  open: number;
  referencePrice: number;
  ceilingPrice: number;
  floorPrice: number;
  timestamp: number;
  matchType?: 'B' | 'S' | 'U'; // Buy, Sell, Unknown
}

export interface BidOffer {
  price: number;
  volume: number;
}

export interface QuotesData {
  symbol: string;
  bids: BidOffer[]; // 3 levels: best bid -> 3rd bid
  asks: BidOffer[]; // 3 levels: best ask -> 3rd ask
  totalBidVol: number;
  totalAskVol: number;
  timestamp: number;
}

export interface OHLCCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndexData {
  symbol: string; // VNINDEX, VN30, HNX, UPCOM
  name: string;
  value: number;
  change: number;
  changePercent: number;
  totalVolume: number;
  totalValue: number;
  advances: number;
  declines: number;
  noChanges: number;
  timestamp: number;
}

export interface ForeignInvestorData {
  symbol: string;
  buyVolume: number;
  sellVolume: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  timestamp: number;
}

export interface DnseSubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channel: string;
  symbols: string[];
}

export interface DnseHeartbeatMessage {
  action: 'pong' | 'ping';
}
