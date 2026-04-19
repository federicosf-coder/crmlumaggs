-- Approval status enum
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add approval_status column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'pendiente';

-- Mark all existing users as approved
UPDATE public.profiles SET approval_status = 'aprobado' WHERE approval_status = 'pendiente';

-- Update signup trigger to set pending and NOT auto-assign role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, phone, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'pendiente'
  );
  RETURN NEW;
END;
$$;

-- Function to get admin emails (for notification)
CREATE OR REPLACE FUNCTION public.get_admin_emails()
RETURNS TABLE(email text, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.email, p.full_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'admin'
    AND p.email IS NOT NULL
    AND p.is_active = true
    AND p.approval_status = 'aprobado'
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_emails() TO anon, authenticated;