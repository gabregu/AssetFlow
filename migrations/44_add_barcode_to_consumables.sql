-- Migration: Add barcode column to consumables table
ALTER TABLE "public"."consumables" ADD COLUMN IF NOT EXISTS "barcode" text;
COMMENT ON COLUMN "public"."consumables"."barcode" IS 'Código de barra del accesorio/consumible para escaneo en servicios';
