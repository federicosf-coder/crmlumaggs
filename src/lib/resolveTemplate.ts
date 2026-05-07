import { supabase } from '@/integrations/supabase/client';

export async function resolveTemplate(
  body: string,
  ctx: { documentoId?: string; contactoId?: string; pagoId?: string } = {}
): Promise<string> {
  if (!body) return body;
  const { data } = await supabase.rpc('resolve_template_placeholders', {
    _documento_id: ctx.documentoId ?? null,
    _contacto_id: ctx.contactoId ?? null,
    _pago_id: ctx.pagoId ?? null,
  });
  if (!data) return body;
  let result = body;
  for (const [key, value] of Object.entries(data as Record<string, string>)) {
    result = result.replaceAll(key, value ?? '');
  }
  return result;
}