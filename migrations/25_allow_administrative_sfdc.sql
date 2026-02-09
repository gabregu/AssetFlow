-- Allow 'Administrativo' and 'Gerencial' to manage SFDC Cases
-- This fixes the issue where Administrativo users could not import or delete SFDC cases due to strict RLS.

DROP POLICY IF EXISTS "SFDC Write" ON "public"."sfdc_cases";

CREATE POLICY "SFDC Write" ON "public"."sfdc_cases"
FOR ALL TO authenticated
USING (public.get_my_role() IN ('admin', 'staff', 'Administrativo', 'Gerencial'))
WITH CHECK (public.get_my_role() IN ('admin', 'staff', 'Administrativo', 'Gerencial'));
