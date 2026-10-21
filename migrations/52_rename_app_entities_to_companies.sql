-- ==============================================================================
-- MIGRACIÓN 52: Renombrar 'app_entities' a 'companies'
-- ==============================================================================
-- Esta migración renombra la tabla de sedes/empresas manteniendo todos sus datos,
-- índices y claves primarias intactas, y asegura las políticas de RLS.
-- ==============================================================================

-- 1. Renombrar la tabla en el esquema public si existe como app_entities
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'app_entities'
    ) THEN
        ALTER TABLE public.app_entities RENAME TO companies;
    END IF;
END $$;

-- 2. Asegurar que Row Level Security (RLS) esté habilitado
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas previas si existían con nombres antiguos
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.companies;
DROP POLICY IF EXISTS "Enable write access for admins" ON public.companies;
DROP POLICY IF EXISTS "Enable write access for admins and Gerencial" ON public.companies;

-- 4. Recrear política de lectura para usuarios autenticados
CREATE POLICY "Enable read access for all authenticated users" ON public.companies
FOR SELECT
TO authenticated
USING (true);

-- 5. Recrear política de escritura para administradores y rol Gerencial
CREATE POLICY "Enable write access for admins and Gerencial" ON public.companies
FOR ALL
TO authenticated
USING (
    public.get_my_role() IN ('admin', 'Gerencial')
)
WITH CHECK (
    public.get_my_role() IN ('admin', 'Gerencial')
);

-- 6. Otorgar permisos de consulta/modificación
GRANT ALL ON TABLE public.companies TO authenticated;
GRANT ALL ON TABLE public.companies TO service_role;

-- 7. Eliminar la vista/nombre viejo 'app_entities' para que no quede como 'UNRESTRICTED' en Supabase
DROP VIEW IF EXISTS public.app_entities;
