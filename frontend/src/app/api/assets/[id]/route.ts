import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/assets/[id] - Update asset
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const body = await request.json();
        const { quantity, avgBuyPrice } = body;

        // Check if asset belongs to user
        const existingAsset = await prisma.asset.findUnique({
            where: { id },
        });

        if (!existingAsset) {
            return NextResponse.json(
                { success: false, error: 'Asset not found' },
                { status: 404 }
            );
        }

        if (existingAsset.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        // Update asset
        const updatedAsset = await prisma.asset.update({
            where: { id },
            data: {
                ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
                ...(avgBuyPrice !== undefined && { avgBuyPrice: parseFloat(avgBuyPrice) }),
            },
        });

        return NextResponse.json({ success: true, data: updatedAsset });
    } catch (error) {
        console.error('Update asset error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update asset' },
            { status: 500 }
        );
    }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await context.params;

        // Check if asset belongs to user
        const existingAsset = await prisma.asset.findUnique({
            where: { id },
        });

        if (!existingAsset) {
            return NextResponse.json(
                { success: false, error: 'Asset not found' },
                { status: 404 }
            );
        }

        if (existingAsset.userId !== session.user.id) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        // Delete asset
        await prisma.asset.delete({
            where: { id },
        });

        return NextResponse.json({ success: true, message: 'Asset deleted' });
    } catch (error) {
        console.error('Delete asset error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete asset' },
            { status: 500 }
        );
    }
}
