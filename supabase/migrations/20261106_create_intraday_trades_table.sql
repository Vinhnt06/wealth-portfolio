-- ==============================================================================
-- Supabase Migration: Bảng lưu trữ nhật ký khớp lệnh trong ngày (Intraday Trades Tape)
-- Hỗ trợ lưu trữ bền vững tập trung, tự động dọn dẹp trước phiên 30 phút (08:30 sáng)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.intraday_trades (
    id VARCHAR(100) PRIMARY KEY, -- Unique key: time_symbol_price_volume_type
    symbol VARCHAR(20) NOT NULL,
    trading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    trade_time VARCHAR(20) NOT NULL,
    price NUMERIC(12, 2) NOT NULL, -- Giá hiển thị (k VNĐ, vd: 28.50)
    volume BIGINT NOT NULL,        -- Khối lượng CP khớp
    value BIGINT NOT NULL,         -- Giá trị lệnh (VNĐ)
    investor_type VARCHAR(20) NOT NULL, -- 'Cá mập', 'Sói già', 'Cừu non'
    match_type VARCHAR(5) NOT NULL,      -- 'M' (Mua chủ động), 'B' (Bán chủ động)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tìm kiếm siêu tốc theo mã cổ phiếu và ngày giao dịch
CREATE INDEX IF NOT EXISTS idx_intraday_trades_symbol_date ON public.intraday_trades(symbol, trading_date);
CREATE INDEX IF NOT EXISTS idx_intraday_trades_type ON public.intraday_trades(investor_type);
CREATE INDEX IF NOT EXISTS idx_intraday_trades_time ON public.intraday_trades(trading_date, trade_time DESC);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE public.intraday_trades ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai (Public Read cho cả người dùng ẩn danh và đăng nhập)
DROP POLICY IF EXISTS "Allow public read access on intraday_trades" ON public.intraday_trades;
CREATE POLICY "Allow public read access on intraday_trades" ON public.intraday_trades
    FOR SELECT TO anon, authenticated
    USING (true);

-- Cho phép ghi dữ liệu (Insert/Upsert)
DROP POLICY IF EXISTS "Allow insert on intraday_trades" ON public.intraday_trades;
CREATE POLICY "Allow insert on intraday_trades" ON public.intraday_trades
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (true);

-- Cho phép dọn dẹp phiên giao dịch cũ (Delete / Cleanup)
DROP POLICY IF EXISTS "Allow delete on intraday_trades" ON public.intraday_trades;
CREATE POLICY "Allow delete on intraday_trades" ON public.intraday_trades
    FOR DELETE TO anon, authenticated, service_role
    USING (true);

-- Hàm PostgreSQL hỗ trợ dọn dẹp tự động các lệnh trước ngày hiện tại
CREATE OR REPLACE FUNCTION public.cleanup_old_intraday_trades()
RETURNS void AS $$
BEGIN
    DELETE FROM public.intraday_trades
    WHERE trading_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
