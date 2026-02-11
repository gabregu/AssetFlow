-- FIX: Resolve Infinite Recursion in RLS Policies & Restore Navigation

-- 1. Helper Functions (SECURITY DEFINER to bypass RLS)
-- These functions run with the privileges of the creator (postgres), preventing infinite loops when called from policies.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email';
$$;

CREATE OR REPLACE FUNCTION public.get_my_country()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT country FROM public.users WHERE email = auth.jwt() ->> 'email';
$$;

-- 2. Update USERS Policy (Critical Fix)
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."users";
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON "public"."users";

CREATE POLICY "Enable read access based on country" ON "public"."users"
FOR SELECT
TO authenticated
USING (
  -- Self (Always allow reading own profile)
  (email = auth.jwt() ->> 'email')
  OR
  -- Admin/Manager sees all (Using Safe Function)
  (get_my_role() IN ('admin', 'Gerencial'))
  OR
  -- Users see others in same country (Using Safe Function)
  (country = get_my_country())
);

-- 3. Update ASSETS Policy (Optimization)
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."assets";

CREATE POLICY "Enable read access based on country" ON "public"."assets"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  (get_my_role() IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = get_my_country())
);

-- 4. Update YUBIKEYS Policy
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."yubikeys";

CREATE POLICY "Enable read access based on country" ON "public"."yubikeys"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  (get_my_role() IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = get_my_country())
);

-- 5. Update CONSUMABLES Policy
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."consumables";

CREATE POLICY "Enable read access based on country" ON "public"."consumables"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  (get_my_role() IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = get_my_country())
);
