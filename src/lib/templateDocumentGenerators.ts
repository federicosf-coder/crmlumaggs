import { supabase } from "@/integrations/supabase/client";
import { TEMPLATE_ATTACHMENTS_BUCKET } from "@/lib/templates";
import { buildCobranzaReportInput, type ReportBrand } from "@/lib/buildCobranzaReportInput";
import { generateCobranzaReportPdfBlob } from "@/lib/generateCobranzaReportPdf";
import { generateCobranzaReportXlsxBlob } from "@/lib/generateCobranzaReportXlsx";
import { buildCompanyCreditoCobranzaData } from "@/lib/buildCompanyCreditoCobranzaData";
import { generateCompanyCreditoCobranzaPdfBlob } from "@/lib/generateCompanyCreditoCobranzaPdf";

/** Built-in "documentos generados por la aplicación" que aparecen en el
 *  catálogo de documentos para plantillas, junto con los archivos cargados. */
export type GeneratorId =
  | "cobranza_pdf"
  | "cobranza_xlsx"
  | "cotizacion_pdf"
  | "company_credito_cobranza_pdf";

export interface BuiltinGenerator {
  id: GeneratorId;
  name: string;
  description: string;
  mime_type: string;
  /** Extensión usada para el archivo final. */
  extension: string;
  /** Categoría del archivo generado. */
  format: "pdf" | "xlsx" | "docx";
}

export const BUILTIN_GENERATORS: BuiltinGenerator[] = [
  {
    id: "cobranza_pdf",
    name: "Dashboard de Cobranza (PDF)",
    description: "Reporte completo de cobranza con KPIs, antigüedad y facturas vencidas/por vencer.",
    mime_type: "application/pdf",
    extension: "pdf",
    format: "pdf",
  },
  {
    id: "cobranza_xlsx",
    name: "Dashboard de Cobranza (Excel)",
    description: "Mismo reporte de cobranza en formato Excel con hojas de Resumen y Facturas Vencidas.",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    format: "xlsx",
  },
  {
    id: "cotizacion_pdf",
    name: "Cotización (PDF)",
    description: "PDF de una cotización específica generada por el sistema.",
    mime_type: "application/pdf",
    extension: "pdf",
    format: "pdf",
  },
  {
    id: "company_credito_cobranza_pdf",
    name: "Crédito y Cobranza por Empresa (PDF)",
    description: "Dashboard de Crédito y Cobranza para una empresa específica: límite, KPIs, antigüedad, vencidas y por vencer.",
    mime_type: "application/pdf",
    extension: "pdf",
    format: "pdf",
  },
];

export function getGeneratorById(id: GeneratorId): BuiltinGenerator | undefined {
  return BUILTIN_GENERATORS.find((g) => g.id === id);
}

// ===== Generación de blobs =====

export interface CobranzaParams {
  brand: ReportBrand;
  plazaId: string | null;
}

export async function generateCobranzaPdfArtifact(p: CobranzaParams): Promise<{ blob: Blob; fileName: string }> {
  const input = await buildCobranzaReportInput({ empresaVendedora: p.brand, plazaId: p.plazaId });
  const blob = generateCobranzaReportPdfBlob(input);
  const brandLabel = p.brand === "galsa_phillips66" ? "Galsa" : "Lumaggs";
  const dateStr = new Date().toISOString().slice(0, 10);
  return { blob, fileName: `Dashboard de Cobranza - ${brandLabel} - ${dateStr}.pdf` };
}

export async function generateCobranzaXlsxArtifact(p: CobranzaParams): Promise<{ blob: Blob; fileName: string }> {
  const input = await buildCobranzaReportInput({ empresaVendedora: p.brand, plazaId: p.plazaId });
  const blob = generateCobranzaReportXlsxBlob(input);
  const brandLabel = p.brand === "galsa_phillips66" ? "Galsa" : "Lumaggs";
  const dateStr = new Date().toISOString().slice(0, 10);
  return { blob, fileName: `Dashboard de Cobranza - ${brandLabel} - ${dateStr}.xlsx` };
}

export async function generateCotizacionPdfArtifact(documentoId: string): Promise<{ blob: Blob; fileName: string }> {
  const { data: doc } = await supabase
    .from("documentos")
    .select("numero_cotizacion, fecha_documento, created_at, companies(name, razon_social)")
    .eq("id", documentoId)
    .maybeSingle();

  const { data, error } = await supabase.functions.invoke("generate-cotizacion-pdf", {
    body: { documento_id: documentoId },
  });
  if (error) throw error;
  const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "application/pdf" });

  const docAny = doc as any;
  const clientRaw = docAny?.companies?.name || docAny?.companies?.razon_social || "Cliente";
  const cliente = String(clientRaw).replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, "_") || "Cliente";
  const folio = (docAny?.numero_cotizacion || documentoId.slice(0, 8)).toString().replace(/[^A-Za-z0-9-]+/g, "");
  return { blob, fileName: `Cotizacion-${cliente}-${folio}.pdf` };
}

export async function generateCompanyCreditoCobranzaPdfArtifact(companyId: string): Promise<{ blob: Blob; fileName: string }> {
  const data = await buildCompanyCreditoCobranzaData(companyId);
  const blob = generateCompanyCreditoCobranzaPdfBlob(data);
  const clean = data.empresaNombre.replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, "_");
  return { blob, fileName: `Credito_Cobranza_${clean}_${new Date().toISOString().slice(0, 10)}.pdf` };
}

/** Sube el blob generado al bucket de adjuntos y registra la fila en template_attachments. */
export async function attachGeneratedBlobToTemplate(opts: {
  templateId: string;
  userId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
}): Promise<void> {
  const { templateId, userId, blob, fileName, mimeType } = opts;
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  const key = `${templateId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).upload(key, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (up.error) throw up.error;
  const ins = await (supabase as any).from("template_attachments").insert({
    template_id: templateId,
    file_name: fileName,
    file_path: key,
    mime_type: mimeType,
    file_size: blob.size,
    uploaded_by: userId,
  });
  if (ins.error) {
    await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).remove([key]);
    throw ins.error;
  }
}