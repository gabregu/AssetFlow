# Auditoría de Seguridad de Supabase (Linter)
*Fecha del reporte: 12 de Junio de 2026*

Este documento guarda el reporte del Linter de Seguridad de Supabase y las recomendaciones para mejorar la seguridad de la base de datos en el futuro, si fuera necesario auditar o endurecer el sistema.

## 1. Políticas RLS (Row Level Security) muy permisivas
**Nivel:** Advertencia (WARN)
**Tablas Afectadas:** `app_config`, `assets`, `logistics_tasks`, `sfdc_cases`, `tickets`, `yubikeys`.
**Detalle:** Supabase advierte que las tablas tienen políticas con `USING (true)` o `WITH CHECK (true)` para `UPDATE`, `DELETE`, o `INSERT`.
**Implicación:** Cualquier usuario autenticado (que haya iniciado sesión) puede editar, crear o borrar información en estas tablas sin restricciones a nivel de fila.
**Acción Futura:** Si el negocio lo requiere, se deben ajustar estas políticas para que solo ciertos roles (ej. administradores o los dueños de un ticket) puedan editar ciertos registros, reemplazando el `(true)` por funciones que verifiquen el ID o el rol del usuario actual.

## 2. Funciones expuestas al público (SECURITY DEFINER)
**Nivel:** Advertencia (WARN)
**Funciones Afectadas:** 
- `public.get_my_country()`
- `public.get_my_role()`
- `public.handle_new_user()`
- `public.rls_auto_enable()`
**Detalle:** Las funciones están marcadas como `SECURITY DEFINER` y pueden ser ejecutadas por el rol `anon` (usuarios anónimos/no autenticados).
**Acción Futura:** Revocar el permiso `EXECUTE` para el rol `anon` o cambiar la función a `SECURITY INVOKER` si no se requiere que escalen privilegios.

## 3. Funciones con Search Path Mutable
**Nivel:** Advertencia (WARN)
**Funciones Afectadas:** 
- `public.check_ticket_content`
- `public.validate_ticket_update`
- `public.check_role_change`
**Detalle:** Las funciones no tienen un `search_path` definido explícitamente, lo que en teoría podría permitir a un atacante alterar el esquema de búsqueda para interceptar la ejecución si tuvieran acceso a crear tablas en el esquema.
**Acción Futura:** Alterar la función para agregar `SET search_path = ''` o establecer el esquema explícito en la definición.

## 4. Protección contra Contraseñas Filtradas Desactivada
**Nivel:** Advertencia (WARN)
**Servicio Afectado:** Supabase Auth
**Detalle:** La protección de contraseñas filtradas (que valida contra HaveIBeenPwned) no está habilitada.
**Acción Futura:** Habilitar la función desde el panel de control de Auth en Supabase para evitar el uso de contraseñas débiles o comprometidas.
