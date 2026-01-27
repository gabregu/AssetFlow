-- Migration Phase 7: Close SFDC Loophole & Cleanup
-- Fixes a medium severity issue where non-admins could modify Salesforce imported cases

-- 1. Tighten SFDC Cases Policy
DROP POLICY IF EXISTS "Enable access for authenticated users" ON "public"."sfdc_cases";

-- Allow Everyone to READ (needed for linking assets/tickets)
CREATE POLICY "SFDC Read" ON "public"."sfdc_cases"
FOR SELECT TO authenticated
USING (true);

-- Allow ONLY Admin/Staff to WRITE (Import/Delete)
CREATE POLICY "SFDC Write" ON "public"."sfdc_cases"
FOR ALL TO authenticated
USING (public.get_my_role() IN ('admin', 'staff'));

-- 2. Ensure NO public access to storage buckets (if any)
-- (Supabase Storage policies should be checked separately in Storage UI, but we can't do it via SQL easily without knowing bucket names)

-- 3. Final Security Audit Log table (Optional but recommended for "Hacker Proofing")
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_time timestamptz DEFAULT now(),
    user_email text,
    action text,
    resource text,
    details jsonb
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only Admins can read audit logs
CREATE POLICY "Audit Read" ON "public"."security_audit_log"
FOR SELECT TO authenticated
USING (public.get_my_role() = 'admin');

-- App can insert logs (server-side or via specific functions) - for now allow authenticated insert for tracking
CREATE POLICY "Audit Insert" ON "public"."security_audit_log"
FOR INSERT TO authenticated
WITH CHECK (true);

-- 4. Trigger to log sensitive actions (Example: User Role Change attempted)
-- We already handle role change prevention in trigger, but logging successful changes might be good.
-- For now, let's just secure the table.
