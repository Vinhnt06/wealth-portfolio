-- ====================================================================
-- Supabase Migration: Enable Row Level Security (RLS) & Policies
-- Resolves Supabase Linter Warnings:
--   1. Title: RLS Disabled in Public | Entity: public.market_prices
--   2. Title: RLS Disabled in Public | Entity: public.assets
-- ====================================================================

-- ────────────────────────────────────────────────────────────────────
-- 1. Table: public.market_prices (Public Reference / Financial Quotes)
-- ────────────────────────────────────────────────────────────────────
-- Enable Row Level Security
ALTER TABLE IF EXISTS public.market_prices ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to read market quotes
DROP POLICY IF EXISTS "Allow public read access on market_prices" ON public.market_prices;
CREATE POLICY "Allow public read access on market_prices" ON public.market_prices
    FOR SELECT TO anon, authenticated
    USING (true);

-- Allow service_role (backend worker / cron ingestion) full management access
DROP POLICY IF EXISTS "Allow service_role manage market_prices" ON public.market_prices;
CREATE POLICY "Allow service_role manage market_prices" ON public.market_prices
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────────
-- 2. Table: public.assets (User Portfolio Holdings / Multi-Tenant Data)
-- ────────────────────────────────────────────────────────────────────
-- Ensure index exists on user_id for optimal RLS query plan performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);

-- Enable Row Level Security
ALTER TABLE IF EXISTS public.assets ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only view their own assets
-- Note: Wrapping auth.uid() in (select auth.uid()) prevents per-row re-evaluation
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
CREATE POLICY "Users can view own assets" ON public.assets
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

-- Authenticated users can only insert assets assigned to themselves
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
CREATE POLICY "Users can insert own assets" ON public.assets
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- Authenticated users can only update their own assets
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
CREATE POLICY "Users can update own assets" ON public.assets
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Authenticated users can only delete their own assets
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;
CREATE POLICY "Users can delete own assets" ON public.assets
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- Allow service_role full management access
DROP POLICY IF EXISTS "Allow service_role manage assets" ON public.assets;
CREATE POLICY "Allow service_role manage assets" ON public.assets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
