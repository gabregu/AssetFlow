-- EMERGENCY REVERT: RESTORE ACCESS
-- This script removes strict RBAC policies and restores broad access for authenticated users.
-- Run this to unblock the application immediately.

-- 1. USERS Table (Revert to permissive)
DROP POLICY IF EXISTS "Admin Manage Users" ON "public"."users";
DROP POLICY IF EXISTS "Public Read Users" ON "public"."users";
DROP POLICY IF EXISTS "Admin Write Users" ON "public"."users";
DROP POLICY IF EXISTS "Self Update Users" ON "public"."users";
-- New Policy: Any logged-in user can Read/Write everything in Users (Dangerous but restores access)
CREATE POLICY "Emergency All Users" ON "public"."users" FOR ALL TO authenticated USING (true);

-- 2. TICKETS Table
DROP POLICY IF EXISTS "Ticket Read" ON "public"."tickets";
DROP POLICY IF EXISTS "Ticket Insert" ON "public"."tickets";
DROP POLICY IF EXISTS "Ticket Update" ON "public"."tickets";
CREATE POLICY "Emergency All Tickets" ON "public"."tickets" FOR ALL TO authenticated USING (true);

-- 3. ASSETS Table
DROP POLICY IF EXISTS "Asset Write" ON "public"."assets";
CREATE POLICY "Emergency All Assets" ON "public"."assets" FOR ALL TO authenticated USING (true);

-- 4. EXPENSES & CONSUMABLES
DROP POLICY IF EXISTS "Finance Read" ON "public"."expenses";
DROP POLICY IF EXISTS "Finance Write" ON "public"."expenses";
CREATE POLICY "Emergency All Expenses" ON "public"."expenses" FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Consumable Read" ON "public"."consumables";
DROP POLICY IF EXISTS "Consumable Write" ON "public"."consumables";
CREATE POLICY "Emergency All Consumables" ON "public"."consumables" FOR ALL TO authenticated USING (true);

-- 5. OTHER TABLES
DROP POLICY IF EXISTS "Config Read" ON "public"."app_config";
DROP POLICY IF EXISTS "Config Write" ON "public"."app_config";
CREATE POLICY "Emergency All Config" ON "public"."app_config" FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Delivery Read" ON "public"."deliveries";
DROP POLICY IF EXISTS "Delivery Write" ON "public"."deliveries";
CREATE POLICY "Emergency All Deliveries" ON "public"."deliveries" FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "SFDC Read" ON "public"."sfdc_cases";
DROP POLICY IF EXISTS "SFDC Write" ON "public"."sfdc_cases";
CREATE POLICY "Emergency All SFDC" ON "public"."sfdc_cases" FOR ALL TO authenticated USING (true);

-- 6. AUDIT LOG (Revert to permissive insert)
DROP POLICY IF EXISTS "Audit Insert" ON "public"."security_audit_log";
CREATE POLICY "Emergency Audit Insert" ON "public"."security_audit_log" FOR INSERT TO authenticated WITH CHECK (true);
