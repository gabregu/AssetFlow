-- Migration 53: Add purchase invoice columns to assets and configure storage bucket for PDFs
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "invoice_url" text;
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "invoice_filename" text;

-- Permitir archivos PDF y formatos de imagen en el bucket de storage
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/jpg']
WHERE id = 'device-photos';
