-- Add salesforce_case column to tickets table
-- This stores the primary SFDC case number ("Caso Principal SFDC") for deduplication
-- during CSV imports and display in the ticket detail view.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS salesforce_case TEXT;

-- Create an index for fast lookups during import deduplication
CREATE INDEX IF NOT EXISTS idx_tickets_salesforce_case ON tickets(salesforce_case) WHERE salesforce_case IS NOT NULL;

-- Backfill: if the associated_assets JSONB array has items with caseNumber and they look
-- like 8-digit SFDC numbers, we can optionally extract the first one as salesforce_case.
-- This is a best-effort backfill - run only if desired:
-- UPDATE tickets
-- SET salesforce_case = (associated_assets->0->>'caseNumber')
-- WHERE salesforce_case IS NULL
--   AND associated_assets IS NOT NULL
--   AND jsonb_array_length(associated_assets) > 0
--   AND (associated_assets->0->>'caseNumber') ~ '^\d{8}$';
