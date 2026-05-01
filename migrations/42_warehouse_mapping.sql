-- Migration 42: Warehouse Mapping System
-- Creates the structure for physical location tracking and links it to assets.

-- 1. Create the warehouse_locations table
CREATE TABLE IF NOT EXISTS "public"."warehouse_locations" (
    "id" text PRIMARY KEY, -- ej: "B-03-2"
    "aisle" text NOT NULL, -- Pasillo
    "section" text NOT NULL, -- Sección/Rack
    "level" text NOT NULL, -- Nivel/Altura
    "status" text DEFAULT 'Disponible', -- Disponible, Ocupado, Reservado
    "created_at" timestamp with time zone DEFAULT now()
);

-- 2. Add location link to assets
ALTER TABLE "public"."assets"
    ADD COLUMN IF NOT EXISTS "location_id" text REFERENCES "public"."warehouse_locations"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "date_mapped" timestamp with time zone;

-- 3. Enable RLS for the new table
ALTER TABLE "public"."warehouse_locations" ENABLE ROW LEVEL SECURITY;

-- 4. Create basic policies for warehouse_locations
CREATE POLICY "Allow authenticated read warehouse_locations"
ON "public"."warehouse_locations" FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin manage warehouse_locations"
ON "public"."warehouse_locations" FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.email = (SELECT auth.jwt() ->> 'email')
        AND (users.role = 'admin' OR users.role = 'Gerencial')
    )
);

-- 5. Helper function to search assets by location
CREATE INDEX IF NOT EXISTS "idx_assets_location_id" ON "public"."assets" ("location_id");
