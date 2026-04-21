-- Migration 39: Add box_number to assets
-- This allows tracking the storage location (box number) for retired equipment.

ALTER TABLE "public"."assets"
    ADD COLUMN IF NOT EXISTS "box_number" text;

COMMENT ON COLUMN "public"."assets"."box_number" IS 'The storage box number where the equipment is kept (mainly for BAJA DE EQUIPO)';
