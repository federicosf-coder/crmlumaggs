-- Add user_id linking repartidores to auth.users
ALTER TABLE public.repartidores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS repartidores_user_id_unique
  ON public.repartidores(user_id) WHERE user_id IS NOT NULL;

-- Auto-assign 'delivery' role when a user is linked to a repartidor
CREATE OR REPLACE FUNCTION public.repartidor_assign_delivery_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'delivery'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repartidor_assign_delivery_role ON public.repartidores;
CREATE TRIGGER trg_repartidor_assign_delivery_role
  AFTER INSERT OR UPDATE OF user_id ON public.repartidores
  FOR EACH ROW
  EXECUTE FUNCTION public.repartidor_assign_delivery_role();