-- Migration 49: Secure storage policies for device-photos bucket
-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Allow anyone to upload device-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anyone to delete device-photos" ON storage.objects;

-- Create secure policy for upload: Only authenticated users can insert objects
CREATE POLICY "Allow authenticated uploads to device-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'device-photos');

-- Create secure policy for delete: Only admin or staff role can delete objects
CREATE POLICY "Allow admin and staff to delete device-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'device-photos' 
  AND public.get_my_role() IN ('admin', 'staff', 'Gerencial', 'Administrativo')
);
