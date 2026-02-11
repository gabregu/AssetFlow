-- Enable RLS on yubikeys
ALTER TABLE yubikeys ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Enable read access for all authenticated users" ON yubikeys
FOR SELECT
TO authenticated
USING (true);

-- Allow insert/update/delete to admins and managers
-- Using explicit type casting for robustness
CREATE POLICY "Enable write access for admins and managers" ON yubikeys
FOR ALL
TO authenticated
USING (
  (SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('admin', 'Gerencial')
);
