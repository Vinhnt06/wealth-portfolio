import { NextResponse } from 'next/server';
import realTicks from '../../../../features/market/data/realTicks.json';
import realIndexes from '../../../../features/market/data/realIndexes.json';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      source: 'vnstock',
      indexes: realIndexes,
      data: realTicks,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
