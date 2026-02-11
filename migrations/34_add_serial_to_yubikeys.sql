-- Add serial column to yubikeys table if it doesn't exist
ALTER TABLE yubikeys ADD COLUMN IF NOT EXISTS serial text;
ALTER TABLE yubikeys ADD COLUMN IF NOT EXISTS country text;

-- Optional: If we were using stock, we would handle it here. 
-- Since it does not exist and we are moving to individual tracking, we don't need to do anything about it.

