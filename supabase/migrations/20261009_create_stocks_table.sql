-- Supabase Migration: Create stocks table for Master Data
-- Table: public.stocks

CREATE TABLE IF NOT EXISTS public.stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    sector VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON public.stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_exchange ON public.stocks(exchange);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON public.stocks(sector);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- Grant public read access to anonymous and authenticated users
DROP POLICY IF EXISTS "Allow public read access" ON public.stocks;
CREATE POLICY "Allow public read access" ON public.stocks
    FOR SELECT TO anon, authenticated
    USING (true);

-- Allow service role full access for updates/seeding
DROP POLICY IF EXISTS "Allow service role manage" ON public.stocks;
CREATE POLICY "Allow service role manage" ON public.stocks
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
