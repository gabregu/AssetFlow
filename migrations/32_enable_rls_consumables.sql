-- Enable RLS on consumables
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Enable read access for all authenticated users" ON consumables
FOR SELECT
TO authenticated
USING (true);

-- Allow insert/update/delete to admins and managers
CREATE POLICY "Enable write access for admins and managers" ON consumables
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'email' IN (
    SELECT email FROM users WHERE role IN ('admin', 'Gerencial')
  )
);
