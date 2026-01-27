-- HABILIITAR PERMISOS DE EDICION Y BORRADO PARA ADMINS
-- Ejecuta esto en Supabase SQL Editor

-- 1. Permitir a Admins ACTUALIZAR cualquier perfil (cambiar roles, nombres)
CREATE POLICY "Admins can update users" ON public.users
FOR UPDATE TO authenticated
USING ( public.get_my_role() = 'admin' );

-- 2. Permitir a Usuarios ACTUALIZAR su propio perfil (opcional, pero util)
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE TO authenticated
USING ( email = auth.jwt() ->> 'email' );

-- 3. Permitir a Admins BORRAR usuarios (solo de la lista publica)
CREATE POLICY "Admins can delete users" ON public.users
FOR DELETE TO authenticated
USING ( public.get_my_role() = 'admin' );

-- 4. Permitir a Admins CREAR usuarios manualmente (si usan el boton "Nuevo Usuario")
CREATE POLICY "Admins can insert users" ON public.users
FOR INSERT TO authenticated
WITH CHECK ( public.get_my_role() = 'admin' );
