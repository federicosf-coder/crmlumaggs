import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmDeal } from "@/hooks/useCrmDeals";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ExternalLink } from "lucide-react";

interface CreateCrmDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: CrmPipelineStage[];
  defaultStageId?: string;
}

const pipelineTypeLabel = (t: string | null | undefined) =>
  t === "recompra" ? "Recompra" : "Primera Compra";

export function CreateCrmDealDialog({ open, onOpenChange, pipelineId, stages, defaultStageId }: CreateCrmDealDialogProps) {
  const { session } = useAuth();
  const createDeal = useCreateCrmDeal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, refetch: refetchCompanies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name, is_active").eq("is_active", true).order("name");
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: contacts, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name, is_active").eq("is_active", true).order("first_name");
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Pipelines disponibles (todos)
  const { data: allPipelines } = useQuery({
    queryKey: ["crm-pipelines-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_pipelines")
        .select("id, nombre, marca, pipeline_type")
        .order("marca", { ascending: true })
        .order("created_at", { ascending: true });
      return data || [];
    },
    staleTime: 60_000,
  });

  // Ejecutivos (perfiles activos)
  const { data: ejecutivos } = useQuery({
    queryKey: ["ejecutivos-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, is_active")
        .eq("is_active", true)
        .order("full_name");
      return data || [];
    },
    staleTime: 60_000,
  });

  // Refrescar listas cada vez que se abre el diálogo (puede haber empresas/contactos creados desde otra parte de la app)
  useEffect(() => {
    if (open) {
      refetchCompanies();
      refetchContacts();
    }
  }, [open, refetchCompanies, refetchContacts]);

  const [title, setTitle] = useState("");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState(pipelineId);
  const [stageId, setStageId] = useState(defaultStageId || stages[0]?.id || "");
  const [ownerId, setOwnerId] = useState<string>("");
  const [value, setValue] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  // Etapas del pipeline seleccionado (cuando coincide con el inicial usamos las stages prop, si no, las cargamos)
  const { data: pipelineStages } = useQuery({
    queryKey: ["crm-pipeline-stages-picker", selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      const { data } = await supabase
        .from("crm_pipeline_stages")
        .select("id, name, color, position, pipeline_id")
        .eq("pipeline_id", selectedPipelineId)
        .order("position", { ascending: true });
      return data || [];
    },
    enabled: !!selectedPipelineId,
  });

  const effectiveStages = useMemo(() => {
    if (selectedPipelineId === pipelineId && stages?.length) return stages;
    return (pipelineStages || []) as CrmPipelineStage[];
  }, [selectedPipelineId, pipelineId, stages, pipelineStages]);

  // Reset al abrir
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelectedPipelineId(pipelineId);
      setStageId(defaultStageId || stages[0]?.id || "");
      setOwnerId(session?.user?.id || "");
      setTitle("");
      setTitleManuallyEdited(false);
      setCompanyId("");
      setContactId("");
      setValue("");
      setCloseDate("");
      setNotes("");
    }
    wasOpen.current = open;
  }, [open, pipelineId, defaultStageId, stages, session?.user?.id]);

  // Si cambia el pipeline seleccionado, asegurar que stageId pertenezca al nuevo pipeline
  useEffect(() => {
    if (!effectiveStages.length) return;
    const stillValid = effectiveStages.some((s) => s.id === stageId);
    if (!stillValid) {
      setStageId(effectiveStages[0].id);
    }
  }, [effectiveStages, stageId]);

  // Auto-generar título al cambiar empresa o pipeline (sólo si el usuario no lo ha editado manualmente)
  const selectedPipeline = useMemo(
    () => (allPipelines || []).find((p: any) => p.id === selectedPipelineId),
    [allPipelines, selectedPipelineId]
  );
  const selectedCompany = useMemo(
    () => (companies || []).find((c: any) => c.id === companyId),
    [companies, companyId]
  );

  useEffect(() => {
    if (titleManuallyEdited) return;
    if (!selectedCompany) return;
    const tipo = pipelineTypeLabel(selectedPipeline?.pipeline_type);
    setTitle(`${selectedCompany.name} - ${tipo}`);
  }, [selectedCompany, selectedPipeline, titleManuallyEdited]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !title || !stageId || !selectedPipelineId) return;
    if (!companyId) {
      toast({ title: "Empresa requerida", description: "Selecciona una empresa para el negocio", variant: "destructive" });
      return;
    }

    createDeal.mutate(
      {
        title,
        pipeline_id: selectedPipelineId,
        stage_id: stageId,
        owner_id: ownerId || session.user.id,
        created_by: session.user.id,
        company_id: companyId,
        contact_id: contactId || null,
        value: 0,
        potencial_unidades: parseFloat(value) || null,
        volumen_mensual_estimado: parseFloat(value) || null,
        close_date: closeDate || null,
        notes: notes || null,
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Negocio creado", description: `"${title}" agregado al pipeline` });
          onOpenChange(false);
          setTitle(""); setTitleManuallyEdited(false); setCompanyId(""); setContactId(""); setValue(""); setCloseDate(""); setNotes("");
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo crear el negocio", variant: "destructive" });
        },
      }
    );
  };

  const openInNewTab = (path: string) => window.open(path, "_blank", "noopener,noreferrer");

  const ejecutivoOptions = (ejecutivos || []).map((u: any) => ({
    value: u.user_id,
    label: u.full_name || u.email || (u.user_id ? u.user_id.slice(0, 8) : ""),
  }));

  const pipelineOptions = (allPipelines || []).map((p: any) => ({
    value: p.id,
    label: `${p.nombre} · ${pipelineTypeLabel(p.pipeline_type)}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Negocio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ejecutivo + Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ejecutivo</Label>
              <SearchableSelect
                value={ownerId}
                onValueChange={setOwnerId}
                options={ejecutivoOptions}
                placeholder="Seleccionar ejecutivo..."
              />
            </div>
            <div className="space-y-2">
              <Label>Pipeline</Label>
              <SearchableSelect
                value={selectedPipelineId}
                onValueChange={setSelectedPipelineId}
                options={pipelineOptions}
                placeholder="Seleccionar pipeline..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {effectiveStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-value">Unidades Eq. Mensuales</Label>
              <Input id="deal-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={companyId}
                  onValueChange={setCompanyId}
                  options={(companies || []).map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Buscar empresa..."
                />
              </div>
              <Button type="button" variant="outline" size="icon" title="Nueva empresa" onClick={() => setCompanyDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" title="Abrir empresa" disabled={!companyId} onClick={() => companyId && openInNewTab(`/directory?tab=companies&select=${companyId}`)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contacto</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={contactId}
                  onValueChange={setContactId}
                  options={(contacts || []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                  placeholder="Buscar contacto..."
                />
              </div>
              <Button type="button" variant="outline" size="icon" title="Nuevo contacto" onClick={() => setContactDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" title="Abrir contacto" disabled={!contactId} onClick={() => contactId && openInNewTab(`/directory?tab=contacts&select=${contactId}`)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-close-date">Fecha de Cierre</Label>
            <Input id="deal-close-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>

          {/* Título del Negocio (autogenerado, editable) */}
          <div className="space-y-2">
            <Label htmlFor="deal-title">Título del Negocio *</Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleManuallyEdited(true); }}
              placeholder="Se autogenera al seleccionar empresa"
              required
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">Se genera como "Empresa - Tipo de pipeline". Puedes editarlo.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-notes">Notas</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={3} maxLength={2000} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Negocio"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={async (id) => {
          setCompanyId(id);
          // Fetch the new company and merge into the picker cache so it appears inmediatamente
          const { data: nueva } = await supabase
            .from("companies")
            .select("id, name, is_active")
            .eq("id", id)
            .maybeSingle();
          if (nueva) {
            queryClient.setQueryData<any[]>(["companies-picker"], (old) => {
              const list = old || [];
              if (list.some((c) => c.id === nueva.id)) return list;
              return [...list, nueva].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["companies-picker"] });
          refetchCompanies();
        }}
      />
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={companyId || undefined}
        onCreated={async (id) => {
          setContactId(id);
          const { data: nuevo } = await supabase
            .from("contacts")
            .select("id, first_name, last_name, is_active")
            .eq("id", id)
            .maybeSingle();
          if (nuevo) {
            queryClient.setQueryData<any[]>(["contacts-picker"], (old) => {
              const list = old || [];
              if (list.some((c) => c.id === nuevo.id)) return list;
              return [...list, nuevo].sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["contacts-picker"] });
          refetchContacts();
        }}
      />
    </Dialog>
  );
}
