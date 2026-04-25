-- Migration 41: Consolidated Assets Columns Verification
-- This ensures all columns requested by the user exist in the assets table,
-- mapped to the snake_case format used by the application.

ALTER TABLE "public"."assets"
    ADD COLUMN IF NOT EXISTS "date" text,
    ADD COLUMN IF NOT EXISTS "assignee" text,
    ADD COLUMN IF NOT EXISTS "vendor" text,
    ADD COLUMN IF NOT EXISTS "purchase_order" text,
    ADD COLUMN IF NOT EXISTS "sfdc_case" text,
    ADD COLUMN IF NOT EXISTS "oem" text,
    ADD COLUMN IF NOT EXISTS "type" text,
    ADD COLUMN IF NOT EXISTS "model_number" text,
    ADD COLUMN IF NOT EXISTS "name" text,
    ADD COLUMN IF NOT EXISTS "hardware_spec" text,
    ADD COLUMN IF NOT EXISTS "part_number" text,
    ADD COLUMN IF NOT EXISTS "imei" text,
    ADD COLUMN IF NOT EXISTS "imei_2" text,
    ADD COLUMN IF NOT EXISTS "serial" text,
    ADD COLUMN IF NOT EXISTS "status" text,
    ADD COLUMN IF NOT EXISTS "eol_date" text,
    ADD COLUMN IF NOT EXISTS "notes" text,
    ADD COLUMN IF NOT EXISTS "country" text,
    ADD COLUMN IF NOT EXISTS "cod" text,
    ADD COLUMN IF NOT EXISTS "box_number" text,
    ADD COLUMN IF NOT EXISTS "updated_by" text,
    ADD COLUMN IF NOT EXISTS "date_last_update" text;

-- Add comments to document the mapping from User Terms to DB columns
COMMENT ON TABLE "public"."assets" IS 'Inventory table for assets with all required tracking fields.';
COMMENT ON COLUMN "public"."assets"."purchase_order" IS 'Maps to: Purchase Order';
COMMENT ON COLUMN "public"."assets"."sfdc_case" IS 'Maps to: SFDC_CASE';
COMMENT ON COLUMN "public"."assets"."model_number" IS 'Maps to: model';
COMMENT ON COLUMN "public"."assets"."hardware_spec" IS 'Maps to: hardwareSpec';
COMMENT ON COLUMN "public"."assets"."part_number" IS 'Maps to: partnumber';
COMMENT ON COLUMN "public"."assets"."imei_2" IS 'Maps to: IMEI 2';
COMMENT ON COLUMN "public"."assets"."eol_date" IS 'Maps to: eol';
COMMENT ON COLUMN "public"."assets"."cod" IS 'Maps to: cod (Certificate of Destruction)';
COMMENT ON COLUMN "public"."assets"."box_number" IS 'Maps to: box_number (Box Number)';
