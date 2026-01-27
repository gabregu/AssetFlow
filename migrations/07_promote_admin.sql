-- Script de Emergencia: Promocionar a Admin
-- Ejecuta esto en el Editor SQL de Supabase para obtener acceso completo
-- y poder aprobar a otros usuarios.

-- 1. Actualizar tu usuario principal a 'admin'
UPDATE public.users
SET role = 'admin'
WHERE email = 'gabregu@yawi.ar' -- Tu email principal
   OR email = 'admin@yawi.ar'   -- Email de admin genérico
   OR username = 'admin';       -- Usuario admin legacy

-- 2. Verificar el cambio
SELECT id, email, name, role FROM public.users WHERE role = 'admin';
