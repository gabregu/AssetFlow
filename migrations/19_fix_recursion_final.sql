-- FIX INFINITE RECURSION LOOPS
-- This script fixes the "Verificando seisión..." freeze by breaking the RLS loop.

-- 1. Redefine the Role Helper as SECURITY DEFINER (Bypass RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1;
$$;

-- 2. SIMPLIFY the Users Table Policy to prevent self-referencing loops
DROP POLICY IF EXISTS "User Profile Read" ON public.users;
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON public.users;
DROP POLICY IF EXISTS "Lockdown Read Users" ON public.users;

CREATE POLICY "No-Loop User Read" ON public.users
FOR SELECT TO authenticated
USING (
  -- 1. Users can ALWAYS see themselves (Zero recursion)
  email = auth.jwt() ->> 'email'
  OR
  -- 2. Admins can see everyone (Uses the SECURITY DEFINER function to verify admin status safely)
  get_my_role() IN ('admin', 'staff', 'Gerencial', 'Conductor')
);

-- 3. ENSURE WRITE ACCESS IS RESTORED
DROP POLICY IF EXISTS "Admins Update Users" ON public.users;
CREATE POLICY "Admins Update Users" ON public.users
FOR UPDATE TO authenticated
USING ( get_my_role() IN ('admin', 'Gerencial') );

DROP POLICY IF EXISTS "Admins Insert Users" ON public.users;
CREATE POLICY "Admins Insert Users" ON public.users
FOR INSERT TO authenticated
WITH CHECK ( get_my_role() IN ('admin', 'Gerencial') );
