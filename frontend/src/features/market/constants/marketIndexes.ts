export interface MarketIndexMeta {
  symbol: string;
  name: string;
  shortName: string;
  exchange: string;
  sector: string;
  isIndex: true;
  aliases: string[];
}

export const VN_MARKET_INDEXES: MarketIndexMeta[] = [
  {
    symbol: 'VNINDEX',
    name: 'Chỉ số VN-INDEX',
    shortName: 'VN-INDEX',
    exchange: 'HOSE',
    sector: 'Chỉ số toàn thị trường HOSE',
    isIndex: true,
    aliases: ['VNINDEX', 'VN-INDEX', 'VNI', 'CHISO', 'CHỈ SỐ', 'INDEX', 'HOSE'],
  },
  {
    symbol: 'VN30',
    name: 'Chỉ số VN30-INDEX',
    shortName: 'VN30',
    exchange: 'HOSE',
    sector: 'Chỉ số 30 cổ phiếu vốn hóa lớn HOSE',
    isIndex: true,
    aliases: ['VN30', 'VN-30', 'VN30INDEX', 'TOP30', 'BLUECHIP'],
  },
  {
    symbol: 'HNX',
    name: 'Chỉ số HNX-INDEX',
    shortName: 'HNX-INDEX',
    exchange: 'HNX',
    sector: 'Chỉ số toàn thị trường HNX',
    isIndex: true,
    aliases: ['HNX', 'HNX-INDEX', 'HNXINDEX', 'HASTC'],
  },
  {
    symbol: 'HNX30',
    name: 'Chỉ số HNX30-INDEX',
    shortName: 'HNX30',
    exchange: 'HNX',
    sector: 'Chỉ số 30 cổ phiếu tiêu biểu HNX',
    isIndex: true,
    aliases: ['HNX30', 'HNX-30', 'HNX30INDEX'],
  },
  {
    symbol: 'UPCOM',
    name: 'Chỉ số UPCOM-INDEX',
    shortName: 'UPCOM',
    exchange: 'UPCOM',
    sector: 'Chỉ số thị trường UPCoM',
    isIndex: true,
    aliases: ['UPCOM', 'UP-COM', 'UPCOM-INDEX', 'UPCOMINDEX'],
  },
];

export const MARKET_INDEX_SYMBOLS = new Set(VN_MARKET_INDEXES.map((idx) => idx.symbol));

export function isMarketIndex(symbol?: string | null): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase().replace(/[-_\s]/g, '');
  return s === 'VNINDEX' || s === 'VN30' || s === 'HNX' || s === 'HNX30' || s === 'UPCOM' || s === 'VNI';
}

export function getMarketIndexMeta(symbol?: string | null): MarketIndexMeta | undefined {
  if (!symbol) return undefined;
  const s = symbol.toUpperCase().replace(/[-_\s]/g, '');
  const normalized = s === 'VNI' ? 'VNINDEX' : s;
  return VN_MARKET_INDEXES.find((idx) => idx.symbol === normalized);
}
