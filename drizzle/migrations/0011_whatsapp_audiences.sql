CREATE TABLE public.whatsapp_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_audiences TO authenticated;
GRANT ALL ON public.whatsapp_audiences TO service_role;
ALTER TABLE public.whatsapp_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins y gerentes gestionan audiencias" ON public.whatsapp_audiences
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'master'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'master'));

CREATE OR REPLACE FUNCTION public.count_audience_contacts(filters jsonb)
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(*)::int FROM contacts c
  LEFT JOIN companies co ON co.id = c.company_id
  WHERE c.is_active = true AND c.no_contactar = false
    AND coalesce(nullif(c.whatsapp_phone,''), nullif(c.mobile,'')) IS NOT NULL
    AND (coalesce(filters->>'plaza_id','') = '' OR coalesce(c.plaza_id, co.plaza_id)::text = filters->>'plaza_id')
    AND (jsonb_array_length(coalesce(filters->'giro_ids','[]'::jsonb)) = 0 OR EXISTS (
      SELECT 1 FROM contacto_intereses ci WHERE ci.contacto_id = c.id
        AND ci.interes_id::text IN (SELECT jsonb_array_elements_text(filters->'giro_ids'))))
    AND (coalesce((filters->>'exclude_blocked')::boolean, true) = false OR NOT EXISTS (
      SELECT 1 FROM whatsapp_numeros_bloqueados b WHERE b.activo = true
        AND (b.contact_id = c.id OR right(regexp_replace(b.wa_phone,'\D','','g'),10) = right(regexp_replace(coalesce(nullif(c.whatsapp_phone,''), c.mobile),'\D','','g'),10))))
$$;
GRANT EXECUTE ON FUNCTION public.count_audience_contacts(jsonb) TO authenticated;