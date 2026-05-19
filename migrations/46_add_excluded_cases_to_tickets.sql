-- Migration 46: Add excluded_cases column to tickets table
-- This column stores case numbers manually deleted by the user
-- so the auto-linker doesn't re-add them on page reload.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS excluded_cases JSONB DEFAULT '[]'::jsonb;
