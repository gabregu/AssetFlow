-- EXECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Para forzar que el usuario admin@yawi.ar sea Administrador

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@yawi.ar';

-- Verificación
SELECT email, role, username FROM public.users WHERE email = 'admin@yawi.ar';
