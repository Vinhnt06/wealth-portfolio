import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DnseSessionCache {
  investorId: string;
  token: string;
  expiry: number;
}

let cachedSession: DnseSessionCache | null = null;

export async function GET() {
  const username = process.env.DNSE_USERNAME?.trim();
  const password = process.env.DNSE_PASSWORD?.trim();

  if (!username || !password) {
    return NextResponse.json({
      success: false,
      reason: 'CREDENTIALS_MISSING',
      message: 'Chưa cấu hình DNSE_USERNAME và DNSE_PASSWORD trong .env.local',
    });
  }

  // Check valid cache (DNSE JWT token lasts 8 hours, cache for 7 hours)
  if (cachedSession && Date.now() < cachedSession.expiry) {
    return NextResponse.json({
      success: true,
      investorId: cachedSession.investorId,
      token: cachedSession.token,
      fromCache: true,
    });
  }

  try {
    // 1. Authenticate with DNSE Entrade X User Service
    const authRes = await fetch('https://services.entrade.com.vn/dnse-user-service/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });

    if (!authRes.ok) {
      const errJson = await authRes.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        reason: 'AUTH_FAILED',
        message: errJson.message || `Đăng nhập thất bại (HTTP ${authRes.status})`,
      });
    }

    const authData = await authRes.json();
    const token = authData.token;

    if (!token) {
      return NextResponse.json({
        success: false,
        reason: 'NO_TOKEN',
        message: 'Máy chủ DNSE không trả về JWT token',
      });
    }

    // 2. Extract investorId directly from the JWT payload
    let investorId = username;
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.investorId) {
          investorId = String(payload.investorId);
        }
      }
    } catch {}

    // Fallback: Fetch Account Info if not found in JWT
    if (investorId === username) {
      const meRes = await fetch('https://services.entrade.com.vn/dnse-user-service/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        cache: 'no-store',
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.investorId) {
          investorId = String(meData.investorId);
        } else if (meData.custodyCode) {
          investorId = String(meData.custodyCode);
        }
      }
    }

    // Cache session for 7 hours
    cachedSession = {
      investorId,
      token,
      expiry: Date.now() + 7 * 60 * 60 * 1000,
    };

    return NextResponse.json({
      success: true,
      investorId,
      token,
      fromCache: false,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      reason: 'NETWORK_ERROR',
      message: error.message || 'Lỗi kết nối tới máy chủ xác thực DNSE',
    });
  }
}
