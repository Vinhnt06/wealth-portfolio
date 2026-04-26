// Binance API Client - No API key required for public endpoints
// Rate limit: 1200 requests per minute

interface BinancePrice {
    symbol: string;
    price: string;
}

interface Binance24hrTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
    highPrice: string;
    lowPrice: string;
}

const BINANCE_BASE_URL = 'https://api.binance.com';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

function getCached(key: string) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCache(key: string, data: any) {
    cache.set(key, { data, timestamp: Date.now() });
}

// Get current price for a symbol
export async function getBinancePrice(symbol: string): Promise<number> {
    const cacheKey = `price:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${symbol}`);
    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }

    const data: BinancePrice = await response.json();
    const price = parseFloat(data.price);
    setCache(cacheKey, price);
    return price;
}

// Get 24hr ticker data
export async function getBinance24hrTicker(symbol: string): Promise<Binance24hrTicker> {
    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }

    return await response.json();
}

// Get multiple prices at once
export async function getBinancePrices(symbols: string[]): Promise<Record<string, number>> {
    const cacheKey = `prices:${symbols.join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/price`);
    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }

    const data: BinancePrice[] = await response.json();
    const prices: Record<string, number> = {};

    data.forEach(item => {
        if (symbols.includes(item.symbol)) {
            prices[item.symbol] = parseFloat(item.price);
        }
    });

    setCache(cacheKey, prices);
    return prices;
}

// Get top cryptos by volume
export async function getTopCryptos(limit: number = 10): Promise<Binance24hrTicker[]> {
    const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/24hr`);
    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }

    const data: Binance24hrTicker[] = await response.json();

    // Filter USDT pairs and sort by volume
    return data
        .filter(item => item.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit);
}
