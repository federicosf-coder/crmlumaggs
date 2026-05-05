import { supabase } from "@/integrations/supabase/client";

/**
 * Dado un URL público antiguo (o un path del bucket), devuelve un URL firmado de corta duración.
 * Soporta tanto enlaces "/storage/v1/object/public/document-files/<path>" como rutas crudas.
 */
export function extractDocFilesPath(urlOrPath: string): string {
  if (!urlOrPath) return urlOrPath;
  const marker = "/document-files/";
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(urlOrPath.slice(idx + marker.length));
  return urlOrPath;
}

export async function openDocFilesSignedUrl(urlOrPath: string, expiresIn = 3600): Promise<void> {
  const path = extractDocFilesPath(urlOrPath);
  const { data, error } = await supabase.storage
    .from("document-files")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error("createSignedUrl error", error);
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}