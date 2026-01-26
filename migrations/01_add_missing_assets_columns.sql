-- Migration to add missing columns to assets table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS imei text,
ADD COLUMN IF NOT EXISTS imei_2 text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS purchase_order text,
ADD COLUMN IF NOT EXISTS sfdc_case text,
ADD COLUMN IF NOT EXISTS oem text,
ADD COLUMN IF NOT EXISTS model_number text,
ADD COLUMN IF NOT EXISTS hardware_spec text,
ADD COLUMN IF NOT EXISTS part_number text,
ADD COLUMN IF NOT EXISTS eol_date text,
ADD COLUMN IF NOT EXISTS vendor text;

-- Optional: Comments for clarity
COMMENT ON COLUMN public.assets.imei IS 'International Mobile Equipment Identity';
COMMENT ON COLUMN public.assets.sfdc_case IS 'Salesforce Case Number related to procurement';
