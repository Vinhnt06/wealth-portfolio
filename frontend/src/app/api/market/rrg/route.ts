import { NextResponse } from 'next/server';
import { getLiveRRGDataset } from '@/features/market/services/rrgDataService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') || '1D').toUpperCase() === '1W' ? '1W' : '1D';
  const tailLength = Math.max(2, Math.min(16, parseInt(searchParams.get('tail') || '4', 10)));
  const benchmark = (searchParams.get('benchmark') || 'VNINDEX').toUpperCase();

  try {
    const dataset = await getLiveRRGDataset(timeframe, tailLength, benchmark);
    if (!dataset) {
      return NextResponse.json(
        { success: false, error: 'Không thể tải dữ liệu nến chuẩn cho ' + benchmark },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dataset,
      source: 'live',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi xử lý đồ thị RRG' },
      { status: 500 }
    );
  }
}
