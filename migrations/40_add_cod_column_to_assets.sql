-- Migration 40: Add cod column to assets
-- This allows tracking the Certificate of Destruction (COD) reference for equipment.

ALTER TABLE "public"."assets"
    ADD COLUMN IF NOT EXISTS "cod" text;

COMMENT ON COLUMN "public"."assets"."cod" IS 'Certificate of Destruction (COD) reference number or date (e.g., COD Abril 2026)';
