import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const FORMATO_BUCKET = "credito-formatos";
export const FORMATO_PREFIX = "formato-solicitud-credito";

/** Busca el archivo vigente del formato en blanco (cualquier extensión). */
export async function getFormatoBlanco(): Promise<{ path: string; updated_at?: string } | null> {
  const { data, error } = await supabase.storage.from(FORMATO_BUCKET).list("", { limit: 50 });
  if (error) return null;
  const f = (data || [])
    .filter((o) => o.name.startsWith(FORMATO_PREFIX))
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
  return f ? { path: f.name, updated_at: f.updated_at || undefined } : null;
}

/** Descarga el formato en blanco para llenarse a mano. */
export async function descargarFormatoBlanco() {
  const f = await getFormatoBlanco();
  if (!f) { toast.error("Aún no hay un formato en blanco cargado. Pide al administrador que lo suba."); return; }
  const ext = f.path.split(".").pop();
  const { data, error } = await supabase.storage
    .from(FORMATO_BUCKET)
    .createSignedUrl(f.path, 600, { download: `Solicitud_de_Credito_formato.${ext}` });
  if (error || !data?.signedUrl) { toast.error("No se pudo descargar el formato"); return; }
  window.location.href = data.signedUrl;
}
