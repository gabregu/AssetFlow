-- Migration Phase 47: Permitir Acceso Completo al Inventario al Rol Administrativo
-- Este script otorga permisos de lectura global (todos los países) y de escritura (inserción y actualización, pero NO borrado) al rol 'Administrativo' (Pilar Alfaro).

-- ==========================================
-- 1. POLÍTICAS DE LECTURA (SELECT)
-- ==========================================

-- A. Tabla ASSETS: Permitir leer todo a admin, Gerencial y Administrativo
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."assets";
CREATE POLICY "Enable read access based on country" ON "public"."assets"
FOR SELECT TO authenticated
USING (
  (public.get_my_role() IN ('admin', 'Gerencial', 'Administrativo'))
  OR
  (country = public.get_my_country())
);

-- B. Tabla YUBIKEYS: Permitir leer todo a admin, Gerencial y Administrativo
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."yubikeys";
CREATE POLICY "Enable read access based on country" ON "public"."yubikeys"
FOR SELECT TO authenticated
USING (
  (public.get_my_role() IN ('admin', 'Gerencial', 'Administrativo'))
  OR
  (country = public.get_my_country())
);

-- C. Tabla CONSUMABLES: Permitir leer todo a admin, Gerencial y Administrativo
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."consumables";
CREATE POLICY "Enable read access based on country" ON "public"."consumables"
FOR SELECT TO authenticated
USING (
  (public.get_my_role() IN ('admin', 'Gerencial', 'Administrativo'))
  OR
  (country = public.get_my_country())
);

-- D. Tabla USERS: Permitir leer todo a admin, Gerencial y Administrativo
DROP POLICY IF EXISTS "Enable read access based on country" ON "public"."users";
CREATE POLICY "Enable read access based on country" ON "public"."users"
FOR SELECT TO authenticated
USING (
  (email = auth.jwt() ->> 'email')
  OR
  (public.get_my_role() IN ('admin', 'Gerencial', 'Administrativo'))
  OR
  (country = public.get_my_country())
);


-- ==========================================
-- 2. POLÍTICAS DE ESCRITURA (INSERT / UPDATE / DELETE)
-- ==========================================

-- A. Tabla ASSETS
DROP POLICY IF EXISTS "Asset Write" ON public.assets;
DROP POLICY IF EXISTS "Asset Write Admin/Staff/Gerencial" ON public.assets;
DROP POLICY IF EXISTS "Asset Insert Administrativo" ON public.assets;
DROP POLICY IF EXISTS "Asset Update Administrativo" ON public.assets;

-- Admins, Staff y Gerencia mantienen acceso completo (Crear, Editar, Borrar)
CREATE POLICY "Asset Write Admin/Staff/Gerencial" ON public.assets
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Gerencial')
);

-- Administrativos pueden crear nuevos activos
CREATE POLICY "Asset Insert Administrativo" ON public.assets
FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() = 'Administrativo'
);

-- Administrativos pueden editar activos existentes
CREATE POLICY "Asset Update Administrativo" ON public.assets
FOR UPDATE TO authenticated
USING (
  public.get_my_role() = 'Administrativo'
);


-- B. Tabla CONSUMABLES
DROP POLICY IF EXISTS "Consumable Write" ON public.consumables;
DROP POLICY IF EXISTS "Consumables Write Admin/Staff/Gerencial" ON public.consumables;
DROP POLICY IF EXISTS "Consumables Insert Administrativo" ON public.consumables;
DROP POLICY IF EXISTS "Consumables Update Administrativo" ON public.consumables;

-- Admins, Staff y Gerencia mantienen acceso completo
CREATE POLICY "Consumables Write Admin/Staff/Gerencial" ON public.consumables
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'staff', 'Gerencial')
);

-- Administrativos pueden crear accesorios/consumibles
CREATE POLICY "Consumables Insert Administrativo" ON public.consumables
FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() = 'Administrativo'
);

-- Administrativos pueden editar accesorios/consumibles
CREATE POLICY "Consumables Update Administrativo" ON public.consumables
FOR UPDATE TO authenticated
USING (
  public.get_my_role() = 'Administrativo'
);


-- C. Tabla YUBIKEYS
DROP POLICY IF EXISTS "Enable write access for admins and managers" ON public.yubikeys;
DROP POLICY IF EXISTS "Yubikeys Write Admin/Gerencial" ON public.yubikeys;
DROP POLICY IF EXISTS "Yubikeys Insert Administrativo" ON public.yubikeys;
DROP POLICY IF EXISTS "Yubikeys Update Administrativo" ON public.yubikeys;

-- Admins y Gerencia mantienen acceso completo (Crear, Editar, Borrar)
CREATE POLICY "Yubikeys Write Admin/Gerencial" ON public.yubikeys
FOR ALL TO authenticated
USING (
  public.get_my_role() IN ('admin', 'Gerencial')
);

-- Administrativos pueden crear Security Keys
CREATE POLICY "Yubikeys Insert Administrativo" ON public.yubikeys
FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() = 'Administrativo'
);

-- Administrativos pueden editar/actualizar stock de Security Keys
CREATE POLICY "Yubikeys Update Administrativo" ON public.yubikeys
FOR UPDATE TO authenticated
USING (
  public.get_my_role() = 'Administrativo'
);
