-- Fix Admin Role
-- Executing this will reset the user with username 'admin' to role 'admin'
UPDATE "public"."users"
SET role = 'admin'
WHERE username = 'admin' OR name = 'Administrador';
