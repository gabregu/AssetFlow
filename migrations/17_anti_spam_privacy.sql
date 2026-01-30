-- Migration Phase 2: Anti-Spam & Privacy Hardening
-- Implements "Manual Provisioning" Strategy and strict validations.

-- 1. HARDEN 'USERS' TABLE (ANTI-ENUMERATION)
-- Previous policy allowed all authenticated users to see all profiles.
-- New policy: Users can only see THEMSELVES and Staff/Admins (for support contact).
-- They CANNOT see other 'user' or 'pending' accounts.

DROP POLICY IF EXISTS "User Profile Read" ON public.users;
DROP POLICY IF EXISTS "Enable read access for approved users or self" ON public.users;

CREATE POLICY "User Profile Read" ON public.users
FOR SELECT TO authenticated
USING (
  -- 1. I can see my own profile
  (email = auth.jwt() ->> 'email')
  OR
  -- 2. I can see Admins and Staff (so I know who helps me)
  (role IN ('admin', 'staff', 'Conductor'))
  OR
  -- 3. If I am an Admin/Staff, I can see everyone
  (public.get_my_role() IN ('admin', 'staff'))
);


-- 2. HARDEN 'TICKETS' TABLE (ANTI-SPAM)
-- Previous policy allowed any 'authenticated' user (including pending) to Insert.
-- New policy: Must have an assigned role (NOT pending, NOT null).

DROP POLICY IF EXISTS "Ticket Insert" ON public.tickets;

CREATE POLICY "Ticket Insert" ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
   -- Only approved roles can create tickets
   public.get_my_role() IN ('admin', 'staff', 'user', 'Conductor')
);


-- 3. TICKET CONTENT VALIDATION (DATA HYGIENE)
-- Prevent creation of empty or "garbage" tickets via API

CREATE OR REPLACE FUNCTION public.check_ticket_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate Title
  IF new.title IS NULL OR length(trim(new.title)) < 3 THEN
    RAISE EXCEPTION 'El título del ticket es demasiado corto o está vacío.';
  END IF;

  -- Validate Priority (Enum integrity check is usually automatic, but explicit is safer)
  IF new.priority NOT IN ('Baja', 'Media', 'Alta', 'Crítica') THEN
     -- Defaulting to Media if invalid/missing for UX, or Raise Exception if strict.
     -- Let's set default to protect data integrity without crashing user flow if feasible,
     -- BUT because we want security, we REJECT invalid input.
     RAISE EXCEPTION 'Prioridad inválida. Debe ser Baja, Media, Alta o Crítica.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS validate_new_ticket ON public.tickets;
CREATE TRIGGER validate_new_ticket
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE PROCEDURE public.check_ticket_content();
