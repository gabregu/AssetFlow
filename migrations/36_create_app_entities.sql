
-- Migration: Add dynamic entities (countries/clients)

CREATE TABLE IF NOT EXISTS public.app_entities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_entities ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Enable read access for all authenticated users" ON public.app_entities
FOR SELECT
TO authenticated
USING (true);

-- Allow only admins to insert/update/delete
CREATE POLICY "Enable write access for admins" ON public.app_entities
FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') = 'admin'
)
WITH CHECK (
    (SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email') = 'admin'
);

-- Insert defaults
INSERT INTO public.app_entities (name) VALUES 
('Argentina'),
('Chile'),
('Colombia'),
('Costa Rica'),
('Uruguay')
ON CONFLICT DO NOTHING;
