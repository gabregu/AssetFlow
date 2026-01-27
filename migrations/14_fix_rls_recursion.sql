-- SOLUCION AL ERROR "INFINITE RECURSION"
-- Ejecuta esto en el SQL Editor de Supabase y dale a RUN

-- 1. Creamos una función segura (Security Definer) para obtener el rol
-- Esto evita que la política se llame a sí misma en bucle
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email';
$$;

-- 2. Corregimos la política de USUARIOS (donde ocurre el error principal)
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON public.users;

CREATE POLICY "Enable read access for approved users or self" ON public.users
FOR SELECT TO authenticated
USING (
  -- Usamos la función en lugar de consultar la tabla directamente
  (get_my_role() IS DISTINCT FROM 'pending')
  OR
  (email = auth.jwt() ->> 'email')
);

-- 3. Optimizamos las otras tablas para usar la misma función y prevenir futuros errores

-- Tickets
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.tickets;
CREATE POLICY "Enable read access for approved users" ON public.tickets
FOR SELECT TO authenticated
USING ( get_my_role() IS DISTINCT FROM 'pending' );

-- Assets
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.assets;
CREATE POLICY "Enable read access for approved users" ON public.assets
FOR SELECT TO authenticated
USING ( get_my_role() IS DISTINCT FROM 'pending' );

-- Deliveries
DROP POLICY IF EXISTS "Enable read access for approved users" ON public.deliveries;
CREATE POLICY "Enable read access for approved users" ON public.deliveries
FOR SELECT TO authenticated
USING ( get_my_role() IS DISTINCT FROM 'pending' );

-- SFDC Cases
DROP POLICY IF EXISTS "Enable access for approved users" ON public.sfdc_cases;
CREATE POLICY "Enable access for approved users" ON public.sfdc_cases
FOR ALL TO authenticated
USING ( get_my_role() IS DISTINCT FROM 'pending' );
