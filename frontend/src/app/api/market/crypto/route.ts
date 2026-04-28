import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api-config';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');

    try {
        const response = await fetch(`${API_URL}/api/market/crypto?symbols=${symbols}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Failed to fetch market data' },
            { status: 500 }
        );
    }
}
