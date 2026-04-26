import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/assets - Get user's assets
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const assets = await prisma.asset.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: assets });
    } catch (error) {
        console.error('Get assets error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch assets' },
            { status: 500 }
        );
    }
}

// POST /api/assets - Add new asset
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { type, symbol, name, quantity, avgBuyPrice } = body;

        // Validation
        if (!type || !symbol || !name || quantity === undefined || avgBuyPrice === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const asset = await prisma.asset.create({
            data: {
                userId: session.user.id,
                type,
                symbol: symbol.toUpperCase(),
                name,
                quantity: parseFloat(quantity),
                avgBuyPrice: parseFloat(avgBuyPrice),
            },
        });

        return NextResponse.json({ success: true, data: asset }, { status: 201 });
    } catch (error) {
        console.error('Create asset error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create asset' },
            { status: 500 }
        );
    }
}
