import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function sanitizeForFilename(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function shortDate(d: Date): string {
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

export async function downloadCotizacionPdf(documentoId: string, onStatusChange?: () => void) {
  try {
    toast.info("Generando PDF...");

    // Fetch metadata for filename
    const { data: doc } = await supabase
      .from("documentos")
      .select("numero_cotizacion, fecha_documento, created_at, companies(name, razon_social)")
      .eq("id", documentoId)
      .maybeSingle();

    const { data, error } = await supabase.functions.invoke("generate-cotizacion-pdf", {
      body: { documento_id: documentoId },
    });

    if (error) throw error;

    // data is an ArrayBuffer or Blob
    const blob = data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const docAny = doc as any;
    const clientRaw = docAny?.companies?.name || docAny?.companies?.razon_social || "Cliente";
    const cliente = sanitizeForFilename(clientRaw) || "Cliente";
    const folio = (docAny?.numero_cotizacion || documentoId.slice(0, 8)).toString().replace(/[^A-Za-z0-9-]+/g, "");
    const fechaStr = docAny?.fecha_documento || docAny?.created_at;
    const fecha = fechaStr ? shortDate(new Date(fechaStr)) : shortDate(new Date());
    a.href = url;
    a.download = `Cotizacion-${cliente}-${folio}-${fecha}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("PDF generado exitosamente");
    
    // Notify caller that status may have changed
    onStatusChange?.();
  } catch (err: any) {
    console.error("Error generating PDF:", err);
    toast.error("Error al generar PDF: " + (err.message || "Error desconocido"));
  }
}
