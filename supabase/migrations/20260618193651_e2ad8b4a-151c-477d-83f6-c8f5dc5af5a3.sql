
CREATE OR REPLACE FUNCTION public.get_company_contacts_for_cobranza(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  mobile text,
  whatsapp_phone text,
  email text,
  email2 text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.first_name, c.last_name, c.phone, c.mobile, c.whatsapp_phone, c.email, c.email2, c.is_active
  FROM public.contacts c
  WHERE c.company_id = p_company_id
    AND c.is_active = true
  ORDER BY c.first_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_contacts_for_cobranza(uuid) TO authenticated;
