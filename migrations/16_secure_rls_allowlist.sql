-- SECURITY HARDENING: Whitelist-based RLS
-- Addresses the 'Ghost User' vulnerability where users without a profile (NULL role)
-- could potentially bypass 'IS DISTINCT FROM pending' checks.
-- Also explicitly defines who can read what.

-- 1. TICKETS
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.tickets;
DROP POLICY IF EXISTS "Ticket Read" ON public.tickets;
CREATE POLICY "Ticket Read" ON public.tickets
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor')
);

-- 2. ASSETS
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.assets;
DROP POLICY IF EXISTS "Asset Read" ON public.assets;
CREATE POLICY "Asset Read" ON public.assets
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor')
);

-- 3. DELIVERIES
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery Read" ON public.deliveries;
CREATE POLICY "Delivery Read" ON public.deliveries
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor')
);

-- 4. SFDC CASES
DROP POLICY IF EXISTS "Enable access for approved users" ON public.sfdc_cases;
DROP POLICY IF EXISTS "SFDC Read" ON public.sfdc_cases;
CREATE POLICY "SFDC Read" ON public.sfdc_cases
FOR SELECT TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor')
);

-- 5. USERS (Profile Visibility)
-- Keep 'pending' users able to see themselves, but restrict others to the whitelist
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON public.users;
DROP POLICY IF EXISTS "User Profile Read" ON public.users;
CREATE POLICY "User Profile Read" ON public.users
FOR SELECT TO authenticated
USING (
  (public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor'))
  OR
  (email = auth.jwt() ->> 'email')
);
