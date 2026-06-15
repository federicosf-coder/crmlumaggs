import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import type { ReportBrand } from "@/lib/buildCobranzaReportInput";
import {
  attachGeneratedBlobToTemplate,
  generateCobranzaPdfArtifact,
  generateCobranzaXlsxArtifact,
  generateCotizacionPdfArtifact,
  getGeneratorById,
  type GeneratorId,
} from "@/lib/templateDocumentGenerators";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  generatorId: GeneratorId | null;
  onAttached: () => void;
}

export function RunGeneratorDialog({ open, onOpenChange, templateId, generatorId, onAttached }: Props) {
  const { user } = useAuth();
  const gen = generatorId ? getGeneratorById(generatorId) : undefined;

  // Cobranza params
  const [brand, setBrand] = useState<ReportBrand>("lumaggs_chevron");
  const [plazaId, setPlazaId] = useState<string>("all");

  // Cotización params
  const [cotizacionId, setCotizacionId] = useState<string>("");

  const [busy, setBusy] = useState(false);

  const isCobranza = generatorId === "cobranza_pdf" || generatorId === "cobranza_xlsx";
  const isCotizacion = generatorId === "cotizacion_pdf";

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-for-generators"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
    enabled: open && isCobranza,
  });

  const { data: cotizaciones = [] } = useQuery({
    queryKey: ["cotizaciones-for-generator"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("documentos")
        .select("id, numero_cotizacion, fecha_documento, companies(name)")
        .eq("tipo_documento", "cotizacion")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: open && isCotizacion,
  });

  const cotizacionOptions = useMemo(
    () =>
      (cotizaciones as any[]).map((d) => ({
        value: d.id,
        label: `${d.numero_cotizacion || d.id.slice(0, 8)} — ${d.companies?.name || "Sin cliente"}`,
        searchText: `${d.numero_cotizacion || ""} ${d.companies?.name || ""} ${d.fecha_documento || ""}`,
      })),
    [cotizaciones]
  );

  const handleRun = async () => {
    if (!user || !gen || !generatorId) return;
    setBusy(true);
    try {
      let artifact: { blob: Blob; fileName: string };
      if (generatorId === "cobranza_pdf") {
        artifact = await generateCobranzaPdfArtifact({ brand, plazaId: plazaId === "all" ? null : plazaId });
      } else if (generatorId === "cobranza_xlsx") {
        artifact = await generateCobranzaXlsxArtifact({ brand, plazaId: plazaId === "all" ? null : plazaId });
      } else if (generatorId === "cotizacion_pdf") {
        if (!cotizacionId) { toast.error("Selecciona una cotización"); setBusy(false); return; }
        artifact = await generateCotizacionPdfArtifact(cotizacionId);
      } else {
        toast.error("Generador no soportado"); return;
      }
      await attachGeneratedBlobToTemplate({
        templateId, userId: user.id,
        blob: artifact.blob, fileName: artifact.fileName, mimeType: gen.mime_type,
      });
      toast.success(`${gen.name} adjuntado`);
      onAttached();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error generando el documento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="font-light">{gen ? `Generar y adjuntar: ${gen.name}` : "Generar documento"}</DialogTitle>
          {gen?.description && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{gen.description}</p>
          )}
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {isCobranza && (
            <>
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
                    {(plazas as any[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {isCotizacion && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cotización</Label>
              <SearchableSelect
                value={cotizacionId}
                onValueChange={setCotizacionId}
                options={cotizacionOptions}
                placeholder="Buscar cotización por número o cliente..."
              />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground font-light">
            El documento se genera con la información disponible al momento. Para mantener cifras actualizadas,
            vuelve a generarlo antes de enviar la plantilla.
          </p>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleRun} disabled={busy || !gen || (isCotizacion && !cotizacionId)}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Generar y adjuntar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}