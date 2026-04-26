import { NextRequest, NextResponse } from 'next/server';
import { getYahooQuote, getYahooQuotes, getGoldPrice, getSilverPrice } from '@/lib/api/yahoo';

// GET /api/market/stocks
// Query params:
//   - symbols: comma-separated list of stock symbols (e.g., AAPL,GOOGL,TSLA)
//   - gold: get gold price (gold=true)
//   - silver: get silver price (silver=true)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Get gold price
        if (searchParams.get('gold') === 'true') {
            const gold = await getGoldPrice();
            return NextResponse.json({
                success: true,
                data: {
                    symbol: 'GC=F',
                    name: 'Gold Futures',
                    ...gold,
                },
            });
        }

        // Get silver price
        if (searchParams.get('silver') === 'true') {
            const silver = await getSilverPrice();
            return NextResponse.json({
                success: true,
                data: {
                    symbol: 'SI=F',
                    name: 'Silver Futures',
                    ...silver,
                },
            });
        }

        // Get stock quotes
        const symbolsParam = searchParams.get('symbols');
        if (!symbolsParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required parameter: symbols',
                },
                { status: 400 }
            );
        }

        const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());

        // Single symbol - return detailed quote
        if (symbols.length === 1) {
            const quote = await getYahooQuote(symbols[0]);
            return NextResponse.json({
                success: true,
                data: quote,
            });
        }

        // Multiple symbols
        const quotes = await getYahooQuotes(symbols);
        return NextResponse.json({
            success: true,
            data: quotes,
            count: quotes.length,
        });

    } catch (error) {
        console.error('Stocks API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch stock quotes',
            },
            { status: 500 }
        );
    }
}
