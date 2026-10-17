import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import macroDatabase from '@/features/market/data/macroDatabase.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GdpItem {
  period: string;
  growthRate: number;
  target: number;
  value: string;
}

interface CpiItem {
  period: string;
  yoy: number;
  mom: number;
  target: number;
}

interface InterestRateItem {
  bank: string;
  rate: string;
}

interface MacroIndicatorsData {
  gdp: GdpItem[];
  cpi: CpiItem[];
  interestRate: InterestRateItem[];
  cycleAssessment: string;
  updatedAt: string;
  source: string;
}

// In-memory cache fallback
let memoryIndicators: MacroIndicatorsData = {
  gdp: macroDatabase.gdp,
  cpi: macroDatabase.cpi,
  interestRate: macroDatabase.interestRate,
  cycleAssessment: 'Mở Rộng Kinh Tế Mạnh',
  updatedAt: 'Kỳ Q3/2026 (GSO & SBV)',
  source: 'Tổng cục Thống kê (GSO) & Ngân hàng Nhà nước (SBV)',
};

export async function GET() {
  try {
    // 1. Attempt to fetch from Supabase table 'macro_indicators' if available
    const { data: dbData, error } = await supabase
      .from('macro_indicators')
      .select('*')
      .order('id', { ascending: true });

    if (!error && dbData && dbData.length > 0) {
      const gdpRow = dbData.find((r: any) => r.type === 'gdp');
      const cpiRow = dbData.find((r: any) => r.type === 'cpi');
      const interestRow = dbData.find((r: any) => r.type === 'interest_rate');

      return NextResponse.json({
        success: true,
        source: 'supabase',
        data: {
          gdp: gdpRow?.data || memoryIndicators.gdp,
          cpi: cpiRow?.data || memoryIndicators.cpi,
          interestRate: interestRow?.data || memoryIndicators.interestRate,
          cycleAssessment: gdpRow?.cycle_assessment || memoryIndicators.cycleAssessment,
          updatedAt: gdpRow?.updated_at || memoryIndicators.updatedAt,
          source: memoryIndicators.source,
        },
      });
    }
  } catch (err) {
    // Fallback to memory
  }

  // 2. Fallback to verified local baseline
  return NextResponse.json({
    success: true,
    source: 'local_database',
    data: memoryIndicators,
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (body.gdp) memoryIndicators.gdp = body.gdp;
    if (body.cpi) memoryIndicators.cpi = body.cpi;
    if (body.interestRate) memoryIndicators.interestRate = body.interestRate;
    if (body.cycleAssessment) memoryIndicators.cycleAssessment = body.cycleAssessment;
    memoryIndicators.updatedAt = new Date().toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Attempt to upsert to Supabase
    try {
      await supabase.from('macro_indicators').upsert([
        { id: 'gdp', type: 'gdp', data: memoryIndicators.gdp, cycle_assessment: memoryIndicators.cycleAssessment, updated_at: memoryIndicators.updatedAt },
        { id: 'cpi', type: 'cpi', data: memoryIndicators.cpi, updated_at: memoryIndicators.updatedAt },
        { id: 'interest_rate', type: 'interest_rate', data: memoryIndicators.interestRate, updated_at: memoryIndicators.updatedAt },
      ], { onConflict: 'id' });
    } catch {
      // ignore db error
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật chỉ số vĩ mô thành công',
      data: memoryIndicators,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
