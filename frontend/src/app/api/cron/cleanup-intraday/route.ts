import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wipeAll = searchParams.get('wipe') === 'all';

  // Lấy ngày hiện tại theo giờ Việt Nam (Asia/Ho_Chi_Minh)
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

  try {
    let query = supabase.from('intraday_trades');

    if (wipeAll) {
      // Xoá toàn bộ nếu có yêu cầu reset trắng phiên
      const { error, count } = await query.delete().neq('id', 'dummy');
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: 'Đã xoá toàn bộ dữ liệu nhật ký khớp lệnh trong database',
        count,
        cleanedAt: new Date().toISOString(),
      });
    }

    // Mặc định: Xoá tất cả các lệnh của các phiên trước (trading_date < todayKey)
    // Tự động kích hoạt lúc 08:30 sáng (trước phiên 30 phút)
    const { error, count } = await query.delete().lt('trading_date', todayKey);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp các phiên giao dịch trước ngày ${todayKey} (chuẩn bị cho phiên mới)`,
      todayKey,
      count,
      cleanedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Lỗi khi dọn dẹp nhật ký khớp lệnh' },
      { status: 500 }
    );
  }
}
