-- 🚨 EMERGENCY LOCKDOWN 🚨
-- STOP EVERYTHING. This script revokes ALL WRITE PERMISSIONS immediately.
-- It puts the application in "Read-Only" mode.
-- USE THIS TO STOP THE ATTACKER.

-- 1. DROP ALL "Emergency" (Permissive) Policies
DROP POLICY IF EXISTS "Emergency All Users" ON "public"."users";
DROP POLICY IF EXISTS "Emergency All Tickets" ON "public"."tickets";
DROP POLICY IF EXISTS "Emergency All Assets" ON "public"."assets";
DROP POLICY IF EXISTS "Emergency All Expenses" ON "public"."expenses";
DROP POLICY IF EXISTS "Emergency All Consumables" ON "public"."consumables";
DROP POLICY IF EXISTS "Emergency All Config" ON "public"."app_config";
DROP POLICY IF EXISTS "Emergency All Deliveries" ON "public"."deliveries";
DROP POLICY IF EXISTS "Emergency All SFDC" ON "public"."sfdc_cases";
DROP POLICY IF EXISTS "Emergency Audit Insert" ON "public"."security_audit_log";

-- 2. ENSURE RLS IS ON (Implicit Deny All for anything not defined)
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."consumables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sfdc_cases" ENABLE ROW LEVEL SECURITY;

-- 3. CREATE "READ ONLY" POLICIES
-- This allows you to see what is happening, but NO ONE (not even you via UI) can delete/edit.
CREATE POLICY "Lockdown Read Users" ON "public"."users" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Tickets" ON "public"."tickets" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Assets" ON "public"."assets" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Expenses" ON "public"."expenses" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Consumables" ON "public"."consumables" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Config" ON "public"."app_config" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read Deliveries" ON "public"."deliveries" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lockdown Read SFDC" ON "public"."sfdc_cases" FOR SELECT TO authenticated USING (true);

-- NO WRITE POLICIES = NO WRITING ALLOWED.
