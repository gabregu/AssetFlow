-- Add location tracking columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS location_latitude double precision,
ADD COLUMN IF NOT EXISTS location_longitude double precision,
ADD COLUMN IF NOT EXISTS last_location_update timestamptz,
ADD COLUMN IF NOT EXISTS tracking_enabled boolean DEFAULT false;

-- Policy to allow users to update their own location
CREATE POLICY "Users can update their own location"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure admins can view all locations (already covered by existing SELECT policies usually, but good to verify)
-- If RLS is strict, we might need:
-- CREATE POLICY "Admins can view all locations" ON public.users FOR SELECT TO authenticated USING (get_my_role() = 'admin');
