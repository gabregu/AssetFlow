-- Migration Phase 5: Purge Legacy Credentials
-- CRITICAL SECURITY FIX: Remove plaintext passwords from public profile table

-- 1. Remove the password column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
        ALTER TABLE "public"."users" DROP COLUMN "password";
    END IF;
END $$;

-- 2. Lock down the users table updates
-- Prevent users from modifying roles (this should be admin only)
-- We'll create a trigger to ensure only admins can change roles
CREATE OR REPLACE FUNCTION public.check_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If role is changing
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Check if the modifier is an admin
    IF (public.get_my_role() <> 'admin') THEN
        RAISE EXCEPTION 'Only administrators can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_role_security ON public.users;
CREATE TRIGGER ensure_role_security
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.check_role_change();
