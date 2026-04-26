import { NextRequest, NextResponse } from 'next/server';
import { getBinancePrice, getBinance24hrTicker, getBinancePrices, getTopCryptos } from '@/lib/api/binance';

// GET /api/market/crypto
// Query params:
//   - symbols: comma-separated list of symbols (e.g., BTCUSDT,ETHUSDT)
//   - top: get top N cryptos by volume (e.g., top=10)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolsParam = searchParams.get('symbols');
        const topParam = searchParams.get('top');

        // Get top cryptos by volume
        if (topParam) {
            const limit = parseInt(topParam) || 10;
            const topCryptos = await getTopCryptos(limit);
            return NextResponse.json({
                success: true,
                data: topCryptos,
                count: topCryptos.length,
            });
        }

        // Get specific symbols
        if (symbolsParam) {
            const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());

            // If only one symbol, get detailed 24hr ticker
            if (symbols.length === 1) {
                const ticker = await getBinance24hrTicker(symbols[0]);
                return NextResponse.json({
                    success: true,
                    data: {
                        symbol: ticker.symbol,
                        price: parseFloat(ticker.lastPrice),
                        change24h: parseFloat(ticker.priceChange),
                        changePercent: parseFloat(ticker.priceChangePercent),
                        volume: parseFloat(ticker.volume),
                        quoteVolume: parseFloat(ticker.quoteVolume),
                        high24h: parseFloat(ticker.highPrice),
                        low24h: parseFloat(ticker.lowPrice),
                    },
                });
            }

            // Multiple symbols - get prices only
            const prices = await getBinancePrices(symbols);
            return NextResponse.json({
                success: true,
                data: prices,
                count: Object.keys(prices).length,
            });
        }

        // Default: get top 10 cryptos
        const topCryptos = await getTopCryptos(10);
        return NextResponse.json({
            success: true,
            data: topCryptos,
            count: topCryptos.length,
        });

    } catch (error) {
        console.error('Crypto API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch crypto prices',
            },
            { status: 500 }
        );
    }
}
