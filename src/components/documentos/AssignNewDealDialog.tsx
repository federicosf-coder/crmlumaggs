import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { toast } from "sonner";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Plus } from "lucide-react";

export type AssignNewDealPrefill = {
  docId: string;
  empresa_vendedora: "lumaggs_chevron" | "galsa_phillips66" | string;
  empresa_id: string;
  contacto_id: string | null;
  plaza_id: string | null;
  ejecutivo_venta_id: string | null;
  total: number;
  fecha_documento: string;
  /** True si es primera compra (cliente sin historial). */
  isPrimeraCompra: boolean;
};

const EMPRESA_VENDEDORA_OPTS = [
  { v: "lumaggs_chevron", l: "Lumaggs (Chevron)" },
  { v: "galsa_phillips66", l: "Galsa (Phillips 66)" },
];

function lastDayOfCurrentMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  prefill: AssignNewDealPrefill | null;
  onClose: () => void;
  onCreated: (dealId: string) => void;
}

export function AssignNewDealDialog({ open, prefill, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [empresaVendedora, setEmpresaVendedora] = useState<string>("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [contactoId, setContactoId] = useState<string>("");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [plazaId, setPlazaId] = useState<string>("");
  const [closeDate, setCloseDate] = useState<string>(lastDayOfCurrentMonth());
  const [potencial, setPotencial] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    setEmpresaVendedora(prefill.empresa_vendedora || "");
    setEmpresaId(prefill.empresa_id || "");
    setContactoId(prefill.contacto_id || "");
    setPlazaId(prefill.plaza_id || "");
    setCloseDate(lastDayOfCurrentMonth());
    setPipelineId("");
    setPotencial("");
  }, [prefill]);

  const marca = empresaVendedora === "galsa_phillips66" ? "phillips66" : empresaVendedora === "lumaggs_chevron" ? "chevron" : null;

  const { data: pipelines = [] } = useQuery({
    queryKey: ["assign_new_deal_pipelines", marca],
    enabled: !!marca,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, nombre, pipeline_type, marca")
        .eq("marca", marca as any)
        .order("pipeline_type");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["assign_new_deal_companies"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("companies").select("id, name").eq("is_active", true).order("name").range(from, to));
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["assign_new_deal_contacts", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("is_active", true).eq("company_id", empresaId).order("first_name");
      return data || [];
    },
  });
  const qcContactsKey = ["assign_new_deal_contacts", empresaId];

  const { data: plazas = [] } = useQuery({
    queryKey: ["assign_new_deal_plazas"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const selectedPipeline = useMemo(() => pipelines.find((p: any) => p.id === pipelineId), [pipelines, pipelineId]);
  // El potencial es requerido si es primera compra (sin historial) o si el embudo elegido es primera_compra
  const potencialRequired = (prefill?.isPrimeraCompra ?? false) || selectedPipeline?.pipeline_type === "primera_compra";

  const handleSubmit = async () => {
    if (!prefill) return;
    if (!empresaVendedora) return toast.error("Selecciona la empresa vendedora");
    if (!empresaId) return toast.error("Selecciona la empresa cliente");
    if (!pipelineId) return toast.error("Selecciona el embudo");
    if (!closeDate) return toast.error("Captura la fecha de cierre");
    if (!plazaId) return toast.error("Selecciona la plaza");
    if (potencialRequired && (!potencial || Number(potencial) <= 0)) {
      return toast.error("Captura el Potencial en Unidades");
    }
    setSaving(true);
    try {
      const pipeline: any = selectedPipeline;
      const { data: stage } = await supabase
        .from("crm_pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      const empresaName = (companies as any[]).find((c) => c.id === empresaId)?.name || "Cliente";
      const titulo = `${empresaName} - Oportunidad de Venta`;

      const { data: { user } } = await supabase.auth.getUser();
      const isRecompra = pipeline?.pipeline_type === "recompra";
      const mes = isRecompra ? (prefill.fecha_documento || new Date().toISOString().slice(0, 10)).slice(0, 7) + "-01" : null;

      const newDeal: any = {
        title: titulo,
        pipeline_id: pipelineId,
        stage_id: stage?.id || null,
        pipeline_type: pipeline?.pipeline_type || "primera_compra",
        tipo_negocio: isRecompra ? "recompra" : "prospecto",
        company_id: empresaId,
        contact_id: contactoId || null,
        owner_id: prefill.ejecutivo_venta_id || user?.id || null,
        created_by: user?.id || null,
        value: prefill.total || 0,
        probability: 10,
        close_date: closeDate,
        plaza_id: plazaId || null,
        potencial_unidades: potencial ? Number(potencial) : null,
        mes_negocio: mes,
      };

      const { data: created, error } = await supabase.from("crm_deals").insert(newDeal).select("id").single();
      if (error) throw error;

      const { error: updErr } = await supabase
        .from("documentos")
        .update({ negocio_id: created.id } as any)
        .eq("id", prefill.docId);
      if (updErr) throw updErr;

      toast.success("Negocio creado y vinculado al documento");
      onCreated(created.id);
    } catch (e: any) {
      toast.error("No se pudo crear el negocio: " + (e.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>No se cuenta con Negocio (oportunidad de venta) registrado</DialogTitle>
          <DialogDescription>
            Se procederá a generar uno. Verifica los datos y selecciona el embudo correspondiente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Empresa vendedora *</Label>
            <Select value={empresaVendedora} onValueChange={(v) => { setEmpresaVendedora(v); setPipelineId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                {EMPRESA_VENDEDORA_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Empresa (cliente) *</Label>
            <SearchableSelect
              value={empresaId}
              onValueChange={(v) => { setEmpresaId(v); setContactoId(""); }}
              options={(companies as any[]).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecciona empresa..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contacto</Label>
            <div className="flex gap-1">
              <SearchableSelect
                value={contactoId}
                onValueChange={setContactoId}
                options={(contacts as any[]).map((c) => ({ value: c.id, label: `${c.first_name || ""} ${c.last_name || ""}`.trim() }))}
                placeholder={empresaId ? "(opcional)" : "Selecciona empresa primero"}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!empresaId}
                onClick={() => setContactDialogOpen(true)}
                title="Agregar contacto"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Embudo *</Label>
            <Select value={pipelineId} onValueChange={setPipelineId} disabled={!marca}>
              <SelectTrigger><SelectValue placeholder={marca ? "Selecciona embudo..." : "Selecciona empresa vendedora primero"} /></SelectTrigger>
              <SelectContent>
                {(pipelines as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.pipeline_type === "primera_compra" ? "Primera Compra" : "Recompra"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de cierre *</Label>
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Plaza *</Label>
            <Select value={plazaId} onValueChange={setPlazaId}>
              <SelectTrigger><SelectValue placeholder="Selecciona plaza..." /></SelectTrigger>
              <SelectContent>
                {(plazas as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Potencial en Unidades {potencialRequired ? "*" : "(opcional)"}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={potencial}
              onChange={(e) => setPotencial(e.target.value)}
              placeholder={potencialRequired ? "Requerido para primera compra" : "Opcional"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creando..." : "Crear negocio"}
          </Button>
        </DialogFooter>
        <ContactFormDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          defaultCompanyId={empresaId || undefined}
          onCreated={async (newId) => {
            await queryClient.invalidateQueries({ queryKey: ["assign_new_deal_contacts", empresaId] });
            setContactoId(newId);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}