-- FIX FINAL: VER TODOS LOS USUARIOS (Sin errores de dependencias)
-- Actualiza la función existente sin borrarla para no romper las políticas.

-- 1. ACTUALIZAR la función existente (Reemplazo directo)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users 
  WHERE lower(email) = lower(auth.jwt() ->> 'email') 
  LIMIT 1;
$$;

-- 2. Asegurar permisos (por si acaso)
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role TO service_role;

-- 3. Confirmación silenciosa de que las políticas usarán la nueva lógica automáticamente.
