import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 1 minute cache

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '30', 10)));

    // Fetch from Spring Boot RS Rating Backend Service
    const backendRes = await fetch(`http://localhost:8080/api/market/rs-rating/top?limit=${limit}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 60 },
    });

    if (!backendRes.ok) {
      throw new Error(`Backend service responded with status ${backendRes.status}`);
    }

    const json = await backendRes.json();
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Không thể kết nối dịch vụ tính toán RS Rating backend',
        data: [],
      },
      { status: 502 }
    );
  }
}
