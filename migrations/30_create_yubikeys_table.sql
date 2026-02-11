-- Create yubikeys table
CREATE TABLE IF NOT EXISTS "public"."yubikeys" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "serial" text,
    "type" text,
    "status" text,
    "assignee" text,
    "last_updated" timestamp with time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    UNIQUE ("serial")
);

-- Enable Row Level Security (RLS)
ALTER TABLE "public"."yubikeys" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users (adjust as needed for security)
CREATE POLICY "Enable all for authenticated users" ON "public"."yubikeys"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy to allow read access for anon (if needed for public views, otherwise restrict)
-- Create policy to allow all access for anon (TEMPORARY FOR IMPORT)
CREATE POLICY "Enable all for anon" ON "public"."yubikeys"
AS PERMISSIVE FOR ALL
TO anon
USING (true)
WITH CHECK (true);
