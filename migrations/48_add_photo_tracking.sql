-- Migration 48: Add Photo Tracking to Assets and Storage Setup
-- This migration adds the photo_url column to the assets table and configures the public storage bucket.

-- 1. Agregar columna photo_url a la tabla assets
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "photo_url" text;

-- 2. Crear el bucket 'device-photos' si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'device-photos',
    'device-photos',
    true,
    5242880, -- Límite de 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS en storage.objects (generalmente ya está habilitado, pero por seguridad)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso para el bucket 'device-photos'
-- Primero eliminar políticas existentes para evitar duplicados
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read access to device-photos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow anyone to upload device-photos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated uploads to device-photos" ON storage.objects;
    DROP POLICY IF EXISTS "Allow anyone to delete device-photos" ON storage.objects;
END $$;

-- Política de Lectura Pública
CREATE POLICY "Allow public read access to device-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'device-photos');

-- Política de Subida para todos (para evitar que sesiones móviles expiradas bloqueen la subida)
CREATE POLICY "Allow anyone to upload device-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'device-photos');

-- Política de Borrado para todos
CREATE POLICY "Allow anyone to delete device-photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'device-photos');
