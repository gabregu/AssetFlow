-- Migration 43: Add missing columns to logistics_tasks
-- These columns are used in the UI but were missing in the relational schema.

ALTER TABLE public.logistics_tasks 
ADD COLUMN IF NOT EXISTS coordinated_by text,
ADD COLUMN IF NOT EXISTS instructions text,
ADD COLUMN IF NOT EXISTS chat_log jsonb DEFAULT '[]';

-- Update RLS if needed (usually existing policies on the table apply to new columns)
COMMENT ON COLUMN public.logistics_tasks.coordinated_by IS 'The person coordinating the logistics (e.g. name of the admin)';
COMMENT ON COLUMN public.logistics_tasks.instructions IS 'Specific instructions for this sub-case/task';
COMMENT ON COLUMN public.logistics_tasks.chat_log IS 'Log of messages/events for this specific task';
