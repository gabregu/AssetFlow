-- Fix for Bug in check_ticket_content function
-- The original function referenced 'new.title' which does not exist.
-- Changing to 'new.subject'.

CREATE OR REPLACE FUNCTION public.check_ticket_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate Subject (corrected from Title)
  IF new.subject IS NULL OR length(trim(new.subject)) < 3 THEN
    RAISE EXCEPTION 'El asunto del ticket es demasiado corto o está vacío.';
  END IF;

  -- Validate Priority
  IF new.priority NOT IN ('Baja', 'Media', 'Alta', 'Crítica') THEN
     RAISE EXCEPTION 'Prioridad inválida. Debe ser Baja, Media, Alta o Crítica.';
  END IF;

  RETURN new;
END;
$$;
