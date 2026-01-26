-- Migration Phase 4: Data Backfill for Existing Users
-- Run this AFTER 02_auth_hardening.sql (which adds the email column)

-- Update existing users with their emails so they link to Supabase Auth
-- Based on the screenshot provided

UPDATE public.users 
SET email = 'admin@yawi.ar' 
WHERE username = 'admin';

UPDATE public.users 
SET email = 'yalfaro@yawi.ar' 
WHERE username = 'yalfaro';

UPDATE public.users 
SET email = 'palfaro@yawi.ar' 
WHERE username = 'palfaro';

UPDATE public.users 
SET email = 'fsantini@yawi.ar' 
WHERE username = 'fsantini';

UPDATE public.users 
SET email = 'gabregu@yawi.ar' 
WHERE username = 'gabregu';

UPDATE public.users 
SET email = 'lmiguel@yawi.ar' 
WHERE username = 'lmiguel';

-- Verify the update
-- SELECT * FROM public.users;
