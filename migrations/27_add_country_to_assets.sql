-- Add country column to assets
ALTER TABLE "public"."assets" ADD COLUMN IF NOT EXISTS "country" text;

-- Optional: inefficient index for filtering if needed
CREATE INDEX IF NOT EXISTS "idx_assets_country" ON "public"."assets" ("country");
