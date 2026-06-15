import { supabase } from "@/integrations/supabase/client";

export const TEMPLATE_DOCUMENT_CATALOG_BUCKET = "template-document-catalog";

export const MAX_CATALOG_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/** Tipos comunes que se envían por email/WhatsApp. */
export const ALLOWED_CATALOG_MIME: string[] = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/zip",
];

export interface TemplateCatalogDocument {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTemplateDocumentCatalog(activeOnly = false): Promise<TemplateCatalogDocument[]> {
  let q = (supabase as any).from("template_document_catalog").select("*").order("name", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as TemplateCatalogDocument[];
}

export async function downloadCatalogBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(TEMPLATE_DOCUMENT_CATALOG_BUCKET).download(path);
  if (error || !data) throw error || new Error("No se pudo descargar el archivo");
  return data;
}

export async function openTemplateDocumentCatalogSignedUrl(path: string, expiresIn = 3600): Promise<void> {
  const { data, error } = await supabase.storage
    .from(TEMPLATE_DOCUMENT_CATALOG_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error("createSignedUrl error", error);
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}