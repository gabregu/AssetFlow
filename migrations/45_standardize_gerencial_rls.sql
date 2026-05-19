-- Migration Phase 45: Standardize RLS policies for Gerencial role
-- This migration updates RLS policies on tables to ensure the 'Gerencial' role has matching administrative permissions.

-- 1. TICKETS Table Policies
DROP POLICY IF EXISTS "Ticket Read" ON public.tickets;
CREATE POLICY "Ticket Read" ON public.tickets
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor', 'Gerencial')
);

DROP POLICY IF EXISTS "Ticket Insert" ON public.tickets;
CREATE POLICY "Ticket Insert" ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor', 'Gerencial')
);

DROP POLICY IF EXISTS "Ticket Update" ON public.tickets;
CREATE POLICY "Ticket Update" ON public.tickets
FOR UPDATE TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Conductor', 'Gerencial')
);

DROP POLICY IF EXISTS "Admins and Administrative can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
CREATE POLICY "Admins and Administrative and Gerencial can delete tickets" ON public.tickets
FOR DELETE TO authenticated
USING (
  public.get_my_role() IN ('admin', 'Administrativo', 'Gerencial')
);

-- 2. ASSETS Table Policies
DROP POLICY IF EXISTS "Asset Write" ON public.assets;
CREATE POLICY "Asset Write" ON public.assets
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Gerencial')
);

-- 3. CONSUMABLES Table Policies
DROP POLICY IF EXISTS "Consumable Write" ON public.consumables;
CREATE POLICY "Consumable Write" ON public.consumables
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Gerencial')
);

-- 4. DELIVERIES Table Policies
DROP POLICY IF EXISTS "Delivery Write" ON public.deliveries;
CREATE POLICY "Delivery Write" ON public.deliveries
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Conductor', 'Gerencial')
);

-- 5. SFDC_CASES Table Policies
DROP POLICY IF EXISTS "SFDC Read" ON public.sfdc_cases;
CREATE POLICY "SFDC Read" ON public.sfdc_cases
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor', 'Gerencial')
);

-- 6. APP_ENTITIES Table Policies
DROP POLICY IF EXISTS "Enable write access for admins" ON public.app_entities;
CREATE POLICY "Enable write access for admins and Gerencial" ON public.app_entities
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'Gerencial')
);

-- 7. WAREHOUSE_LOCATIONS Table Policies
DROP POLICY IF EXISTS "Allow admin manage warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "Allow admin and Gerencial manage warehouse_locations" ON public.warehouse_locations
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'Gerencial')
);
