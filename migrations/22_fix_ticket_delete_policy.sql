-- FIX: Grants DELETE permission to Admins for tickets
-- Previously, only INSERT and UPDATE were allowed, causing silent failures on delete.

CREATE POLICY "Admins can delete tickets" ON "public"."tickets"
FOR DELETE TO authenticated
USING ( public.get_my_role() = 'admin' );
