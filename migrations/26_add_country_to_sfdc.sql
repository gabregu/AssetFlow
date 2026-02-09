-- Add country column to sfdc_cases for better filtering and reporting
ALTER TABLE "public"."sfdc_cases" ADD COLUMN IF NOT EXISTS "country" text;

-- Optional: efficient index for filtering
CREATE INDEX IF NOT EXISTS "idx_sfdc_cases_country" ON "public"."sfdc_cases" ("country");
