-- Migration Phase 6: RBAC & Gap Analysis Closure
-- This migration tightens the rules to true Role-Based Access Control
-- And protects tables that were missed in the first pass

-- 1. Enable RLS on remaining tables
ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."consumables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies for EXPENSES (Finance Data)
-- Only Admins/Staff should see or touch expenses.
CREATE POLICY "Finance Read" ON "public"."expenses"
FOR SELECT TO authenticated
USING (public.get_my_role() IN ('admin', 'staff'));

CREATE POLICY "Finance Write" ON "public"."expenses"
FOR ALL TO authenticated
USING (public.get_my_role() IN ('admin', 'staff'));

-- 3. Define Policies for CONSUMABLES (Inventory)
-- Read: Everyone
-- Write: Admin/Staff
CREATE POLICY "Consumable Read" ON "public"."consumables"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Consumable Write" ON "public"."consumables"
FOR ALL TO authenticated
USING (public.get_my_role() IN ('admin', 'staff'));

-- 4. Define Policies for APP_CONFIG (Rates)
-- Read: Everyone (needed for calculations)
-- Write: Admin only
CREATE POLICY "Config Read" ON "public"."app_config"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Config Write" ON "public"."app_config"
FOR UPDATE TO authenticated
USING (public.get_my_role() = 'admin');

-- 5. FIX & TIGHTEN 'TICKETS' POLICIES
-- First, drop the loose policies from Phase 1
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."tickets";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "public"."tickets";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."tickets";

-- ticket READ: Everyone can read (for now, to ensure app works)
CREATE POLICY "Ticket Read" ON "public"."tickets" FOR SELECT TO authenticated USING (true);

-- ticket INSERT: Anyone can create a ticket (Request)
CREATE POLICY "Ticket Insert" ON "public"."tickets" FOR INSERT TO authenticated WITH CHECK (true);

-- ticket UPDATE: RESTRICTED
-- Regular 'user' role CANNOT update tickets (no changing status, no assigning assets)
-- Only Admin, Staff, or Conductor
CREATE POLICY "Ticket Update" ON "public"."tickets"
FOR UPDATE TO authenticated
USING (public.get_my_role() IN ('admin', 'staff', 'Conductor'));

-- 6. FIX 'USERS' MANAGEMENT
-- Currently broken because we enabled RLS but gave no Write permissions
CREATE POLICY "Admin Manage Users" ON "public"."users"
FOR ALL TO authenticated
USING (public.get_my_role() = 'admin');

-- Allow users to update their OWN profile (e.g. name) if needed, but not role (blocked by trigger)
CREATE POLICY "User Self Update" ON "public"."users"
FOR UPDATE TO authenticated
USING (auth.jwt() ->> 'email' = email);

-- 7. TIGHTEN 'ASSETS'
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON "public"."assets";

CREATE POLICY "Asset Write" ON "public"."assets"
FOR ALL TO authenticated
USING (public.get_my_role() IN ('admin', 'staff'));

-- 8. TIGHTEN 'DELIVERIES'
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."deliveries"; -- if exists
-- Assuming we need to recreate/create
CREATE POLICY "Delivery Read" ON "public"."deliveries" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Delivery Write" ON "public"."deliveries" FOR ALL TO authenticated USING (public.get_my_role() IN ('admin', 'staff', 'Conductor'));
