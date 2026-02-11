-- Migration Phase: Multi-Country Architecture Implementation

-- 1. Add country column to users table
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'Argentina';
COMMENT ON COLUMN "public"."users"."country" IS 'User country for RLS filtering';

-- 2. Indexing for performance
-- Assets (Already created in mig 27 potentially, but good to ensure)
CREATE INDEX IF NOT EXISTS "idx_assets_country" ON "public"."assets" ("country");
-- Yubikeys
CREATE INDEX IF NOT EXISTS "idx_yubikeys_country" ON "public"."yubikeys" ("country");
-- Consumables
CREATE INDEX IF NOT EXISTS "idx_consumables_country" ON "public"."consumables" ("country");
-- Users
CREATE INDEX IF NOT EXISTS "idx_users_country" ON "public"."users" ("country");

-- 3. Update RLS Policies

-- ASSETS
-- Drop previous policies that might conflict or be too permissive
DROP POLICY IF EXISTS "Enable read access for approved users" ON "public"."assets";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."assets";

CREATE POLICY "Enable read access based on country" ON "public"."assets"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  ((SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = (SELECT country FROM public.users WHERE email = auth.jwt() ->> 'email'))
);

-- YUBIKEYS
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON "public"."yubikeys";

CREATE POLICY "Enable read access based on country" ON "public"."yubikeys"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  ((SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = (SELECT country FROM public.users WHERE email = auth.jwt() ->> 'email'))
);

-- CONSUMABLES
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON "public"."consumables";

CREATE POLICY "Enable read access based on country" ON "public"."consumables"
FOR SELECT
TO authenticated
USING (
  -- Admin or Manager sees all
  ((SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IN ('admin', 'Gerencial'))
  OR
  -- Standard user sees their country
  (country = (SELECT country FROM public.users WHERE email = auth.jwt() ->> 'email'))
);

-- USERS
-- Restrict viewing users list to own country (unless Admin)
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON "public"."users";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."users";

CREATE POLICY "Enable read access based on country" ON "public"."users"
FOR SELECT
TO authenticated
USING (
  -- Self (Always allow reading own profile)
  (email = auth.jwt() ->> 'email')
  OR
  -- Admin/Manager sees all
  ((SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IN ('admin', 'Gerencial'))
  OR
  -- Users see others in same country (for team collaboration/assignee lists)
  (country = (SELECT country FROM public.users WHERE email = auth.jwt() ->> 'email'))
);
