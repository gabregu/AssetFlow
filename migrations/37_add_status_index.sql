-- Migration: Add Indexes for Status and Serial Columns
-- Description: Improves performance for filtering by status and searching by serial, as requested.

-- 1. ASSETS
CREATE INDEX IF NOT EXISTS "idx_assets_status" ON "public"."assets" ("status");
CREATE INDEX IF NOT EXISTS "idx_assets_serial" ON "public"."assets" ("serial");
-- Composite index for common filtering pattern: Country + Status
CREATE INDEX IF NOT EXISTS "idx_assets_country_status" ON "public"."assets" ("country", "status");

-- 2. YUBIKEYS
CREATE INDEX IF NOT EXISTS "idx_yubikeys_status" ON "public"."yubikeys" ("status");
CREATE INDEX IF NOT EXISTS "idx_yubikeys_serial" ON "public"."yubikeys" ("serial");

-- 3. CONSUMABLES
-- Consumables don't have 'status' per se (just stock), but category is used.
CREATE INDEX IF NOT EXISTS "idx_consumables_category" ON "public"."consumables" ("category");
