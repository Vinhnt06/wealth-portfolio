// Yahoo Finance API Client using native fetch
// Yahoo Finance provides free public endpoints

interface YahooQuote {
    symbol: string;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    regularMarketVolume: number;
    marketCap?: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketOpen: number;
    regularMarketPreviousClose: number;
    shortName?: string;
    longName?: string;
}

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

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

// Get stock quote
export async function getYahooQuote(symbol: string): Promise<YahooQuote> {
    const cacheKey = `quote:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await fetch(
        `${YAHOO_BASE_URL}/${symbol}?interval=1d&range=1d`
    );

    if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result) {
        throw new Error(`No data found for symbol: ${symbol}`);
    }

    const meta = result.meta;

    // Manually calculate changes if Yahoo API returns undefined
    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPreviousClose || price;

    const calculatedChange = prevClose > 0 ? price - prevClose : 0;
    const calculatedChangePercent = prevClose > 0 ? (calculatedChange / prevClose) * 100 : 0;

    const quote = {
        symbol: meta.symbol,
        regularMarketPrice: price,
        regularMarketChange: meta.regularMarketChange ?? calculatedChange,
        regularMarketChangePercent: meta.regularMarketChangePercent ?? calculatedChangePercent,
        regularMarketVolume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap,
        regularMarketDayHigh: meta.regularMarketDayHigh || 0,
        regularMarketDayLow: meta.regularMarketDayLow || 0,
        regularMarketOpen: meta.regularMarketOpen || 0,
        regularMarketPreviousClose: prevClose,
        shortName: meta.shortName || meta.symbol,
        longName: meta.longName || meta.symbol,
    };

    setCache(cacheKey, quote);
    return quote;
}

// Get multiple stock quotes
export async function getYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
    const promises = symbols.map(symbol =>
        getYahooQuote(symbol).catch(err => {
            console.error(`Failed to fetch ${symbol}:`, err);
            return null;
        })
    );

    const results = await Promise.all(promises);
    return results.filter((r): r is YahooQuote => r !== null);
}

// Get gold price (GC=F is Gold Futures)
export async function getGoldPrice(): Promise<{ price: number; change: number; changePercent: number }> {
    const quote = await getYahooQuote('GC=F');
    return {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
    };
}

// Get silver price (SI=F is Silver Futures)
export async function getSilverPrice(): Promise<{ price: number; change: number; changePercent: number }> {
    const quote = await getYahooQuote('SI=F');
    return {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
    };
}

// Get historical data
export async function getHistoricalData(
    symbol: string,
    range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' = '1mo'
): Promise<{ date: string; close: number }[]> {
    const response = await fetch(
        `${YAHOO_BASE_URL}/${symbol}?interval=1d&range=${range}`
    );

    if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result) {
        throw new Error(`No data found for symbol: ${symbol}`);
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    return timestamps.map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        close: closes[index],
    })).filter((item: { close: number }) => item.close !== null);
}
