ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'desconocido';
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS lead_id uuid NULL;

CREATE OR REPLACE FUNCTION public.leads_validate_canal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.canal IS NULL OR NEW.canal NOT IN ('whatsapp','facebook','web','formulario','campana','carga_manual','otro','desconocido') THEN
    RAISE EXCEPTION 'Canal de prospecto no válido: %', NEW.canal;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_leads_validate_canal ON public.leads;
CREATE TRIGGER trg_leads_validate_canal BEFORE INSERT OR UPDATE OF canal ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_validate_canal();

UPDATE public.leads l SET canal = CASE
  WHEN ls.nombre ILIKE '%manual%' THEN 'carga_manual'
  WHEN ls.nombre ILIKE '%web%' THEN 'web'
  ELSE 'otro' END
FROM public.lead_sources ls WHERE ls.id = l.source_id AND l.canal = 'desconocido';

CREATE OR REPLACE FUNCTION public.get_leads_conversion()
RETURNS TABLE(lead_id uuid, canal text, empresa_id uuid, empresa_nombre text, estado text,
  primera_compra date, ultima_compra date, num_facturas bigint, facturacion numeric,
  leads_en_empresa bigint, atribuible boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT l.id, l.canal, l.created_at, COALESCE(l.company_id, c.company_id) AS emp
    FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
  ),
  compras AS (
    SELECT d.empresa_id, min(d.fecha_documento) primera, max(d.fecha_documento) ultima,
           count(*) n, coalesce(sum(d.total),0) tot
    FROM documentos d
    WHERE d.tipo_documento = 'factura' AND d.estatus_factura IS DISTINCT FROM 'cancelada'
      AND d.empresa_id IN (SELECT emp FROM base WHERE emp IS NOT NULL)
    GROUP BY d.empresa_id
  ),
  cnt AS (SELECT emp, count(*) k FROM base WHERE emp IS NOT NULL GROUP BY emp)
  SELECT b.id, b.canal, b.emp, co.name,
    CASE
      WHEN b.emp IS NULL OR cp.empresa_id IS NULL THEN 'prospecto'
      WHEN b.created_at IS NULL OR cp.primera IS NULL THEN 'desconocido'
      WHEN cp.primera < (b.created_at AT TIME ZONE 'America/Tijuana')::date THEN 'cliente_previo'
      ELSE 'convertido'
    END,
    cp.primera, cp.ultima, coalesce(cp.n,0), coalesce(cp.tot,0), coalesce(cn.k,0),
    (cp.empresa_id IS NOT NULL AND cn.k = 1 AND b.canal <> 'desconocido'
      AND cp.primera >= (b.created_at AT TIME ZONE 'America/Tijuana')::date)
  FROM base b
  LEFT JOIN compras cp ON cp.empresa_id = b.emp
  LEFT JOIN cnt cn ON cn.emp = b.emp
  LEFT JOIN companies co ON co.id = b.emp
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_leads_conversion() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_leads_conversion() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_empresas_estado_compra(_empresa_ids uuid[])
RETURNS TABLE(empresa_id uuid, num_facturas bigint, primera_compra date, ultima_compra date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.empresa_id, count(*), min(d.fecha_documento), max(d.fecha_documento)
  FROM documentos d
  WHERE auth.uid() IS NOT NULL AND d.empresa_id = ANY(_empresa_ids)
    AND d.tipo_documento = 'factura' AND d.estatus_factura IS DISTINCT FROM 'cancelada'
  GROUP BY d.empresa_id;
$$;
REVOKE ALL ON FUNCTION public.get_empresas_estado_compra(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_empresas_estado_compra(uuid[]) TO authenticated;