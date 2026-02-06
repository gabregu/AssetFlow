-- PERMITIR BORRAR TICKETS AL ROL ADMINISTRATIVO
-- Habilita al rol 'Administrativo' para eliminar registros en la tabla tickets

-- 1. Eliminar la política anterior
DROP POLICY IF EXISTS "Admins can delete tickets" ON "public"."tickets";

-- 2. Crear la nueva política que incluye 'Administrativo'
CREATE POLICY "Admins and Administrative can delete tickets" ON "public"."tickets"
FOR DELETE TO authenticated
USING ( public.get_my_role() IN ('admin', 'Administrativo') );
