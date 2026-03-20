-- Migration 38: Relational Logistics Architecture
-- This creates a dedicated table for sub-cases/logistics tasks to avoid JSON nesting problems.

-- 1. Create the new logistics_tasks table
CREATE TABLE IF NOT EXISTS public.logistics_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id text REFERENCES public.tickets(id) ON DELETE CASCADE,
    case_number text, -- Associated SFDC Case Number
    subject text,     -- Associated Subject
    status text DEFAULT 'Pendiente',
    method text,      -- Courier / Internal
    delivery_person text, -- Driver Name
    assigned_to text, -- Driver UID (matches users.id)
    date date,
    time_slot text DEFAULT 'AM',
    address text,
    tracking_number text,
    assets jsonb DEFAULT '[]', -- Assets specifically for this task
    accessories jsonb DEFAULT '{}',
    yubikeys jsonb DEFAULT '[]',
    delivery_info jsonb DEFAULT '{}', -- info captured by driver
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.logistics_tasks ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.logistics_tasks;
    CREATE POLICY "Enable all for authenticated users" ON public.logistics_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 4. Initial Migration of existing data
-- This script converts the JSONB array 'associated_assets' from 'tickets' table into 'logistics_tasks' rows.
DO $$
DECLARE
    ticket_record RECORD;
    case_item JSONB;
    v_date date;
BEGIN
    -- Only process tickets that have associated assets in the old JSON format
    FOR ticket_record IN SELECT id, associated_assets, logistics FROM public.tickets WHERE associated_assets IS NOT NULL AND jsonb_array_length(associated_assets) > 0 LOOP
        FOR case_item IN SELECT jsonb_array_elements(ticket_record.associated_assets) LOOP
            
            -- Safe date conversion
            BEGIN
                v_date := (case_item->'logistics'->>'date')::date;
            EXCEPTION WHEN OTHERS THEN
                v_date := NULL;
            END;

            INSERT INTO public.logistics_tasks (
                ticket_id,
                case_number,
                subject,
                status,
                method,
                delivery_person,
                assigned_to,
                date,
                time_slot,
                address,
                tracking_number,
                assets,
                accessories,
                yubikeys,
                delivery_info
            ) VALUES (
                ticket_record.id,
                case_item->>'caseNumber',
                case_item->>'subject',
                COALESCE(case_item->'logistics'->>'status', 'Pendiente'),
                case_item->'logistics'->>'method',
                case_item->'logistics'->>'deliveryPerson',
                case_item->'logistics'->>'assignedTo',
                v_date,
                COALESCE(case_item->'logistics'->>'timeSlot', 'AM'),
                COALESCE(case_item->'logistics'->>'address', ticket_record.logistics->>'address'),
                case_item->'logistics'->>'trackingNumber',
                COALESCE(case_item->'assets', '[]'::jsonb),
                COALESCE(case_item->'accessories', '{}'::jsonb),
                COALESCE(case_item->'yubikeys', '[]'::jsonb),
                COALESCE(case_item->'logistics'->'deliveryInfo', '{}'::jsonb)
            );
        END LOOP;
    END LOOP;
END $$;
