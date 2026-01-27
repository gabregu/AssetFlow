-- Migration Phase 6: Self-Signup & Approval Flow
-- 1. Update the user creation trigger handler
-- This function runs automatically when a user signs up via Supabase Auth

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first_user boolean;
  default_role text;
begin
  -- Check if this is the very first user (optional, but good for dev)
  -- select count(*) = 0 into is_first_user from public.users;
  
  -- if is_first_user then
  --   default_role := 'admin';
  -- else
  --   default_role := 'pending'; -- Default for everyone else
  -- end if;

  -- For this migration, we enforcing 'pending' for all new signups
  -- The admin must manually approve them.
  default_role := 'pending';

  insert into public.users (id, email, name, username, role)
  values (
      'USR-' || floor(extract(epoch from now())), -- Generate a timestamp-based ID
      new.email,
      COALESCE(new.raw_user_meta_data ->> 'full_name', 'Usuario Nuevo'),
      split_part(new.email, '@', 1), -- Generate username from email
      default_role
  );
  return new;
end;
$$;

-- 2. Create the trigger (if not exists)
-- We drop it first to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 3. Update RLS Policies to Restrict 'pending' users
-- We need to ensure 'pending' users cannot see data meant for active users.

-- Tickets: restrict to NOT pending
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."tickets";
CREATE POLICY "Enable read access for approved users" ON "public"."tickets"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IS DISTINCT FROM 'pending'
);

-- Assets: restrict to NOT pending
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."assets";
CREATE POLICY "Enable read access for approved users" ON "public"."assets"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IS DISTINCT FROM 'pending'
);

-- Deliveries: restrict to NOT pending
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."deliveries"; -- Assuming policy existed or default deny
CREATE POLICY "Enable read access for approved users" ON "public"."deliveries"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IS DISTINCT FROM 'pending'
);

-- Users: pending users can ONLY see themselves (to check status)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."users";
CREATE POLICY "Enable read access for approved users or self" ON "public"."users"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  -- Admin/Approved can see all
  ((SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IS DISTINCT FROM 'pending')
  OR
  -- Pending users can only see their own record
  (email = auth.jwt() ->> 'email')
);

-- SFDC Cases: restrict
DROP POLICY IF EXISTS "Enable access for authenticated users" ON "public"."sfdc_cases";
CREATE POLICY "Enable access for approved users" ON "public"."sfdc_cases"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') IS DISTINCT FROM 'pending'
);
