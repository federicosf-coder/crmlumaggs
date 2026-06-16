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

/**
 * Reemplaza todas las ocurrencias de URLs públicas del bucket privado
 * `document-files` dentro de un HTML/texto por URLs firmadas de corta duración.
 * Útil para correos cuyo cuerpo se generó con placeholders que devolvieron la
 * URL pública almacenada en BD (que ya no es accesible porque el bucket es privado).
 */
export async function signDocFilesUrlsInHtml(html: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  if (!html) return html;
  const re = /https?:\/\/[^\s"'<>]*\/storage\/v1\/object\/(?:public|sign)\/document-files\/[^\s"'<>)]+/gi;
  const matches = Array.from(new Set(html.match(re) || []));
  if (matches.length === 0) return html;
  const replacements = new Map<string, string>();
  await Promise.all(
    matches.map(async (url) => {
      try {
        // Quitar querystring (token) antes de extraer el path
        const clean = url.split("?")[0];
        const path = extractDocFilesPath(clean);
        const { data } = await supabase.storage
          .from("document-files")
          .createSignedUrl(path, expiresIn);
        if (data?.signedUrl) replacements.set(url, data.signedUrl);
      } catch (e) {
        console.warn("[signDocFilesUrlsInHtml] no se pudo firmar", url, e);
      }
    })
  );
  let out = html;
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }
  return out;
}