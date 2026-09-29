-- Add accessories_qty column to logistics_tasks to store per-accessory quantities
ALTER TABLE logistics_tasks 
ADD COLUMN IF NOT EXISTS accessories_qty JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN logistics_tasks.accessories_qty IS 'Map of accessory name to quantity';
