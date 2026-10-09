import { NextResponse } from 'next/server';
import realTicks from '../../../../features/market/data/realTicks.json';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      source: 'vnstock',
      data: realTicks,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
