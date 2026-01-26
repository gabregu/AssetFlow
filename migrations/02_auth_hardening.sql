-- Migration Phase 1: Authentication & Authorization (RLS)
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on all sensitive tables
ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sfdc_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY; -- This is our 'public profile' table

-- 2. Create Policy for 'users' (Profiles)
-- Authenticated users can read all profiles (to see assignees, drivers, etc)
CREATE POLICY "Enable read access for authenticated users" ON "public"."users"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

-- 3. Create Policy for 'tickets'
-- Authenticated users can read all tickets (for now, or filter by role later)
CREATE POLICY "Enable read access for authenticated users" ON "public"."tickets"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

-- Only Authenticated users can insert/update
CREATE POLICY "Enable insert for authenticated users" ON "public"."tickets"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "public"."tickets"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true);

-- 4. Create Policy for 'assets'
CREATE POLICY "Enable read access for authenticated users" ON "public"."assets"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable write access for authenticated users" ON "public"."assets"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true);

-- 5. Create Policy for 'sfdc_cases'
CREATE POLICY "Enable access for authenticated users" ON "public"."sfdc_cases"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true);

-- 6. Add email column to users table if not exists (to link with Auth)
-- We attempt to add it, ignoring if exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE "public"."users" ADD COLUMN "email" text;
        -- Optional: Add Constraint unique
        ALTER TABLE "public"."users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
    END IF;
END $$;

-- 7. Sync Logic (Optional Advanced)
-- Create a trigger to automatically create a user entry in public.users when a new user signs up in auth.users
-- This ensures 'users' table is always populated.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
      'USR-' || floor(extract(epoch from now())), -- Generate a custom ID format to match existing or use UUID
      new.email,
      new.raw_user_meta_data ->> 'full_name',
      'user' -- Default role
  );
  return new;
end;
$$;

-- Trigger creation (uncomment if you want to auto-create profiles)
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();

