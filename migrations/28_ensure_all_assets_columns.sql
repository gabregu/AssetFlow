-- Ensure all requested columns exist in the assets table
-- Using IF NOT EXISTS to make it safe to run multiple times

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
    ADD COLUMN IF NOT EXISTS "country" text;

-- Add comments for clarity
COMMENT ON COLUMN "public"."assets"."purchase_order" IS 'Purchase Order';
COMMENT ON COLUMN "public"."assets"."sfdc_case" IS 'SFDC Case Number';
COMMENT ON COLUMN "public"."assets"."imei_2" IS 'Secondary IMEI';
COMMENT ON COLUMN "public"."assets"."eol_date" IS 'End of Life Date';
