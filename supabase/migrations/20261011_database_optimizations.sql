-- ==============================================================================
-- Database Optimization Migration: Indexes & RLS Policy Performance
-- Created at: 2026-10-11
-- Description:
--   1. Xoá các index trùng lặp (duplicate indexes) trên public.assets và public.market_prices
--   2. Tối ưu hoá RLS policies trên public.users sử dụng (SELECT auth.uid()) thay vì re-evaluate per row
--   3. Phân tách vai trò rõ ràng giữa authenticated và service_role nhằm tránh cảnh báo multiple permissive policies
-- ==============================================================================

-- 1. Xoá các index trùng lặp (Duplicate Indexes Cleanup)
DROP INDEX IF EXISTS public.idx_symbol;
DROP INDEX IF EXISTS public.idx_assets_user_id;
DROP INDEX IF EXISTS public.idx_symbol_timestamp;

-- 2. Tối ưu hoá RLS Policies trên public.users (Auth RLS InitPlan & Permissive Policies Fix)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.users;
DROP POLICY IF EXISTS "Service role has full access" ON public.users;

-- SELECT: Chỉ cho phép người dùng đăng nhập xem hồ sơ của chính mình
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid())::text = id));

-- UPDATE: Chỉ cho phép người dùng cập nhật hồ sơ của chính mình
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid())::text = id));

-- INSERT: Cho phép người dùng authenticated tự tạo hồ sơ cho chính id của họ
CREATE POLICY "Authenticated users can insert" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid())::text = id));

-- SERVICE ROLE: Toàn quyền truy cập cho backend service_role
CREATE POLICY "Service role has full access" ON public.users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
