// Frankfurter API Client - Free forex rates from European Central Bank
// No rate limit, completely free

interface FrankfurterRates {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
}

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.app';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

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

// Get latest exchange rates
export async function getForexRates(
    base: string = 'USD',
    symbols?: string[]
): Promise<FrankfurterRates> {
    const cacheKey = `rates:${base}:${symbols?.join(',') || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let url = `${FRANKFURTER_BASE_URL}/latest?from=${base}`;
    if (symbols && symbols.length > 0) {
        url += `&to=${symbols.join(',')}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data: FrankfurterRates = await response.json();
    setCache(cacheKey, data);
    return data;
}

// Convert currency
export async function convertCurrency(
    amount: number,
    from: string,
    to: string
): Promise<number> {
    const url = `${FRANKFURTER_BASE_URL}/latest?amount=${amount}&from=${from}&to=${to}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data: FrankfurterRates = await response.json();
    return data.rates[to];
}

// Get historical rates for a specific date
export async function getHistoricalRates(
    date: string, // Format: YYYY-MM-DD
    base: string = 'USD',
    symbols?: string[]
): Promise<FrankfurterRates> {
    let url = `${FRANKFURTER_BASE_URL}/${date}?from=${base}`;
    if (symbols && symbols.length > 0) {
        url += `&to=${symbols.join(',')}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
    }

    return await response.json();
}

// Get available currencies
export async function getAvailableCurrencies(): Promise<Record<string, string>> {
    const response = await fetch(`${FRANKFURTER_BASE_URL}/currencies`);
    if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
    }

    return await response.json();
}
