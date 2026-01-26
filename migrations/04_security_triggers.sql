-- Phase 3: Application Logic & Security Triggers
-- Prevent illegal state transitions and unauthorized deletions

-- 1. Helper function to check role of current user
-- Returns the role string or null
create or replace function public.get_my_role()
returns text
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.users
  where email = auth.jwt() ->> 'email'; -- We link via email
  return user_role;
end;
$$;

-- 2. Trigger: Prevent Ticket Deletion by non-admins
create or replace function public.prevent_ticket_deletion()
returns trigger
language plpgsql
as $$
declare
  my_role text;
begin
  my_role := public.get_my_role();
  
  -- Allow if admin
  if my_role = 'admin' then
    return old;
  end if;

  -- Block otherwise
  raise exception 'Solo los administradores pueden eliminar tickets.';
end;
$$;

-- Attach trigger
create trigger check_ticket_deletion
before delete on public.tickets
for each row execute procedure public.prevent_ticket_deletion();


-- 3. Trigger: Validate Delivery Status Transition
-- Example Rule: Only Drivers or Admins can mark as 'Entregado'
create or replace function public.validate_ticket_update()
returns trigger
language plpgsql
as $$
declare
  my_role text;
begin
  my_role := public.get_my_role();
  
  -- Check if they are trying to mark as delivered
  if new.delivery_status = 'Entregado' and old.delivery_status != 'Entregado' then
    if my_role not in ('admin', 'Conductor') then
       raise exception 'Solo conductores o administradores pueden finalizar una entrega.';
    end if;
  end if;

  return new;
end;
$$;

-- Attach trigger
create trigger check_ticket_update
before update on public.tickets
for each row execute procedure public.validate_ticket_update();
