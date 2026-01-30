-- Migration Phase 3: Restore Admin Inventory Write Access
-- Fixes issue where Admins could not upload CSVs (Insert) or Manage Stock (Update/Delete)
-- Caused by 12_LOCKDOWN.sql revoking all write access, and subsequent restoration missing these tables.

-- 1. ASSETS (Hardware)
DROP POLICY IF EXISTS "Asset Write Admin" ON public.assets;

CREATE POLICY "Asset Insert Admin" ON public.assets
FOR INSERT TO authenticated
WITH CHECK ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Asset Update Admin" ON public.assets
FOR UPDATE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Asset Delete Admin" ON public.assets
FOR DELETE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );

-- 2. CONSUMABLES (Accessories)
DROP POLICY IF EXISTS "Consumable Write Admin" ON public.consumables;

CREATE POLICY "Consumable Insert Admin" ON public.consumables
FOR INSERT TO authenticated
WITH CHECK ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Consumable Update Admin" ON public.consumables
FOR UPDATE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Consumable Delete Admin" ON public.consumables
FOR DELETE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );

-- 3. EXPENSES (Admin & Gerencial)
DROP POLICY IF EXISTS "Expense Write Admin" ON public.expenses;

CREATE POLICY "Expense Insert Admin" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Expense Update Admin" ON public.expenses
FOR UPDATE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );

CREATE POLICY "Expense Delete Admin" ON public.expenses
FOR DELETE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Gerencial') );
