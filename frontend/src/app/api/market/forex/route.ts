import { NextRequest, NextResponse } from 'next/server';
import { getForexRates, convertCurrency, getAvailableCurrencies } from '@/lib/api/frankfurter';

// GET /api/market/forex
// Query params:
//   - base: base currency (default: USD)
//   - symbols: comma-separated list of target currencies (e.g., VND,EUR,JPY)
//   - convert: convert amount (requires from, to, amount params)
//   - currencies: get list of available currencies
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Get available currencies
        if (searchParams.get('currencies') === 'true') {
            const currencies = await getAvailableCurrencies();
            return NextResponse.json({
                success: true,
                data: currencies,
            });
        }

        // Convert currency
        const convertParam = searchParams.get('convert');
        if (convertParam === 'true') {
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            const amount = searchParams.get('amount');

            if (!from || !to || !amount) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Missing required params: from, to, amount',
                    },
                    { status: 400 }
                );
            }

            const result = await convertCurrency(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
            return NextResponse.json({
                success: true,
                data: {
                    from,
                    to,
                    amount: parseFloat(amount),
                    result,
                    rate: result / parseFloat(amount),
                },
            });
        }

        // Get exchange rates
        const base = searchParams.get('base')?.toUpperCase() || 'USD';
        const symbolsParam = searchParams.get('symbols');
        const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim().toUpperCase()) : undefined;

        const rates = await getForexRates(base, symbols);

        return NextResponse.json({
            success: true,
            data: {
                base: rates.base,
                date: rates.date,
                rates: rates.rates,
            },
        });

    } catch (error) {
        console.error('Forex API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch forex rates',
            },
            { status: 500 }
        );
    }
}
