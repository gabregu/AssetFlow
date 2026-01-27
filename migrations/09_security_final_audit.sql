-- Migration Phase 9: Final Security Hardening
-- Addresses VULN-01: Audit Log Integrity & Spoofing Prevention
-- Ensures that users can ONLY insert audit logs that correspond to their own identity.

-- 1. Drop the potential insecure policy (if it exists or from previous migration)
DROP POLICY IF EXISTS "Audit Insert" ON "public"."security_audit_log";

-- 2. Create the stricter policy
-- This forces the 'user_email' column in the INSERT statement to match the JWT email.
-- If an attacker tries to insert { user_email: 'admin@company.com', action: 'malicious' }, 
-- the database will REJECT it silently or with an error, preventing the spoof.

CREATE POLICY "Audit Insert" ON "public"."security_audit_log"
FOR INSERT TO authenticated
WITH CHECK (
    -- The email being inserted MUST match the email in the Auth Token
    user_email = (auth.jwt() ->> 'email')
);

-- 3. Additional Hardening: Prevent updates to audit logs completely
-- Audit logs should be Write-Once, Read-Many (WORM).
-- We ensure no policy exists for UPDATE or DELETE for regular users.

DROP POLICY IF EXISTS "Audit Update" ON "public"."security_audit_log";
DROP POLICY IF EXISTS "Audit Delete" ON "public"."security_audit_log";

-- (Admins can still read via "Audit Read" policy defined in 08_sfdc_hardening.sql)
