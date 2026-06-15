import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_ATTACHMENTS_BUCKET } from "@/lib/templates";
import { buildCobranzaReportInput, type ReportBrand } from "@/lib/buildCobranzaReportInput";
import { generateCobranzaReportPdfBlob } from "@/lib/generateCobranzaReportPdf";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  onAttached: () => void;
}

export function AttachCobranzaReportDialog({ open, onOpenChange, templateId, onAttached }: Props) {
  const { user } = useAuth();
  const [brand, setBrand] = useState<ReportBrand>("lumaggs_chevron");
  const [plazaId, setPlazaId] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-for-cobranza-report"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
    enabled: open,
  });

  const handleGenerate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const input = await buildCobranzaReportInput({
        empresaVendedora: brand,
        plazaId: plazaId === "all" ? null : plazaId,
      });
      const blob = generateCobranzaReportPdfBlob(input);
      const brandLabel = brand === "galsa_phillips66" ? "Galsa" : "Lumaggs";
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Dashboard de Cobranza - ${brandLabel} - ${dateStr}.pdf`;
      const key = `${templateId}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).upload(key, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) { toast.error(`Error subiendo PDF: ${up.error.message}`); return; }
      const ins = await (supabase as any).from("template_attachments").insert({
        template_id: templateId,
        file_name: fileName,
        file_path: key,
        mime_type: "application/pdf",
        file_size: blob.size,
        uploaded_by: user.id,
      });
      if (ins.error) {
        toast.error(`Error registrando adjunto: ${ins.error.message}`);
        await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).remove([key]);
        return;
      }
      toast.success("Dashboard de Cobranza adjuntado");
      onAttached();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al generar el reporte");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="font-light">Adjuntar Dashboard de Cobranza</DialogTitle>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            Genera el reporte con los datos actuales y lo adjunta a esta plantilla.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marca</Label>
            <Select value={brand} onValueChange={(v) => setBrand(v as ReportBrand)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lumaggs_chevron">Lumaggs (Chevron)</SelectItem>
                <SelectItem value="galsa_phillips66">Galsa (Phillips 66)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plaza</Label>
            <Select value={plazaId} onValueChange={setPlazaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazas.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground font-light">
            El PDF se genera con la información disponible al momento. Para mantener cifras actualizadas,
            vuelve a generarlo antes de enviar la plantilla.
          </p>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Generar y adjuntar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}