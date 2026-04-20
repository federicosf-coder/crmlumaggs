-- Update handle_new_user to auto-approve
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, phone, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'aprobado'
  );
  RETURN NEW;
END;
$function$;

-- Approve all currently pending profiles so they can log in
UPDATE public.profiles
SET approval_status = 'aprobado', updated_at = now()
WHERE approval_status = 'pendiente';