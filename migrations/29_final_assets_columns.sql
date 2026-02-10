-- Comprehensive column check/add for assets table
-- Ensuring all requested fields are present in snake_case format

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
    ADD COLUMN IF NOT EXISTS "add_by_user" text;

-- Add comments to map User's terms to DB columns
COMMENT ON COLUMN "public"."assets"."model_number" IS 'Referenced as model';
COMMENT ON COLUMN "public"."assets"."hardware_spec" IS 'Referenced as hardwareSpec';
COMMENT ON COLUMN "public"."assets"."part_number" IS 'Referenced as partnumber';
COMMENT ON COLUMN "public"."assets"."eol_date" IS 'Referenced as eol';
COMMENT ON COLUMN "public"."assets"."add_by_user" IS 'User who added the asset';
