import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function downloadCotizacionPdf(documentoId: string, onStatusChange?: () => void) {
  try {
    toast.info("Generando PDF...");

    const { data, error } = await supabase.functions.invoke("generate-cotizacion-pdf", {
      body: { documento_id: documentoId },
    });

    if (error) throw error;

    // data is an ArrayBuffer or Blob
    const blob = data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cotizacion_${documentoId}.pdf`;
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
