# Informe Completo de Configuración y Despliegue - AssetFlow
**Fecha:** 26 de Enero de 2026
**Versión:** 1.0 - Migración a Supabase Auth

Este documento detalla la configuración actual de la aplicación, la arquitectura de seguridad implementada y los pasos necesarios para restaurar o desplegar el proyecto.

## 1. Arquitectura del Proyecto

*   **Frontend:** Next.js (React)
    *   Estado Global: `zustand` (`lib/store.js`)
    *   UI: TailwindCSS + Lucide React
*   **Backend / Base de Datos:** Supabase (PostgreSQL)
    *   Autenticación: Supabase Auth (Email/Password)
    *   Base de Datos: Tablas relacionales con Row Level Security (RLS) habilitado.
*   **Infraestructura:** Vercel (Hosting)

## 2. Configuración de Seguridad (Supabase)

Hemos migrado de un sistema de usuarios "dummy" en una tabla simple a un sistema robusto vinculado a Supabase Auth.

### A. Autenticación
*   **Método:** Email y Contraseña.
*   **Vinculación:** La tabla pública `public.users` ahora tiene una columna `email` que actúa como clave foránea lógica (FK) con `auth.users` de Supabase.
*   **Roles:** Los roles (`admin`, `Gerencial`, `Conductor`, etc.) se gestionan en la tabla `public.users`.

### B. Row Level Security (RLS)
Se han activado políticas de seguridad en las tablas críticas para que **solo usuarios autenticados** puedan acceder a los datos.

*   `tickets`: Lectura pública para autenticados. Escritura restringida según lógica de negocio.
*   `assets`: Lectura pública para autenticados.
*   `sfdc_cases`: Lectura pública para autenticados.
*   `users`: Lectura pública para autenticados (necesario para ver nombres de compañeros).

### C. Triggers de Base de Datos
Se implementaron reglas automáticas en la base de datos (`migrations/04_security_triggers.sql`) para prevenir errores humanos o malintencionados:
*   **Prevención de Borrado:** Solo usuarios con rol `admin` pueden eliminar tickets.
*   **Validación de Entrega:** Solo usuarios con rol `Conductor` o `admin` pueden cambiar un estado a `Entregado`.

## 3. Variables de Entorno

Estas variables son **CRÍTICAS** para el funcionamiento. Deben existir en el archivo `.env.local` (para desarrollo) y en el panel de Vercel (para producción).

| Variable | Descripción | Valor (Ejemplo) |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (segura para frontend) | `eyJJh...` (Larga cadena) |

**Nota:** Nunca compartir la `SERVICE_ROLE_KEY` en estas variables públicas.

## 4. Estructura de Base de Datos y Migraciones

La carpeta `/migrations` contiene el historial de cambios aplicados a la base de datos. Si necesitas reconstruir la base de datos desde cero, ejecuta estos scripts en orden:

1.  `01_add_missing_assets_columns.sql` - Define la estructura completa de activos.
2.  `02_auth_hardening.sql` - Habilita seguridad RLS y agrega campo email.
3.  `03_fix_admin.sql` - Correcciones de datos base.
4.  `04_security_triggers.sql` - Lógica de negocio (Triggers).
5.  `05_migrate_legacy_users.sql` - Carga de emails para usuarios existentes.

## 5. Procedimiento de Backup

Se ha generado una copia de seguridad completa del código fuente en tu sistema local.

*   **Ubicación Original:** `.../Documents/Antigravity-APP/AssetFlow`
*   **Ubicación de Backup:** `.../Documents/Antigravity-APP/Backups/AssetFlow_Backup_[FECHA]`
*   **Contenido:** Todo el código fuente, configuración, carpeta pública y migraciones. (Se excluyen `node_modules` y `.next` por ser generados automáticamente).

## 6. Instrucciones de Despliegue (Vercel)

1.  Asegurar que los cambios estén en GitHub (`git push`).
2.  En Vercel, verificar que las **Environment Variables** estén configuradas (Punto 3).
3.  Vercel detectará el push y desplegará automáticamente.
4.  Si falla, usar el botón "Redeploy" en el panel de Vercel.

---
**Reporte generado por Antigravity AI**
