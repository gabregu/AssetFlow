ALTER TABLE "public"."yubikeys" 
ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'Argentina',
ADD COLUMN IF NOT EXISTS "add_by_user" text;

COMMENT ON COLUMN "public"."yubikeys"."country" IS 'Country where the Yubikey is located';
COMMENT ON COLUMN "public"."yubikeys"."add_by_user" IS 'User who added the Yubikey to the system';
