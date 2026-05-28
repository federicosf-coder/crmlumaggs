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
import { Loader2, Plus, ExternalLink, Building2, MapPin, User, Briefcase } from "lucide-react";
import { fetchAllRows } from "@/lib/supabasePagination";

function cleanPipelineName(nombre: string): string {
  if (!nombre) return "";
  let out = nombre;
  const patterns = [
    /\bphillips\s*66\b/gi,
    /\bchevron\b/gi,
    /\bprimera\s*compra\b/gi,
    /\b1ra\.?\s*compra\b/gi,
    /\brecompra\b/gi,
  ];
  for (const p of patterns) out = out.replace(p, "");
  return out.replace(/[·\-–|]+/g, " ").replace(/\s+/g, " ").trim() || nombre.trim();
}

function formatPipelineLabel(p: { nombre: string; marca: string | null; pipeline_type: string | null }): string {
  const marcaLabel = p.marca === "phillips66" ? "Phillips 66" : "Chevron";
  const tipoLabel = p.pipeline_type === "recompra" ? "Recompra" : "Primera Compra";
  const clean = cleanPipelineName(p.nombre);
  return clean ? `${marcaLabel} · ${tipoLabel} · ${clean}` : `${marcaLabel} · ${tipoLabel}`;
}

interface CreateCrmDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: CrmPipelineStage[];
  defaultStageId?: string;
  defaultCompanyId?: string;
  defaultContactId?: string;
}

const pipelineTypeLabel = (t: string | null | undefined) =>
  t === "recompra" ? "Recompra" : "Primera Compra";

export function CreateCrmDealDialog({ open, onOpenChange, pipelineId, stages, defaultStageId, defaultCompanyId, defaultContactId }: CreateCrmDealDialogProps) {
  const { session } = useAuth();
  const createDeal = useCreateCrmDeal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, refetch: refetchCompanies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const rows = await fetchAllRows<{ id: string; name: string; is_active: boolean; plaza_id: string | null }>(
        (from, to) =>
          supabase
            .from("companies")
            .select("id, name, is_active, plaza_id")
            .eq("is_active", true)
            .order("name")
            .range(from, to)
      );
      return rows;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: contacts, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts-picker-with-company"],
    queryFn: async () => {
      const rows = await fetchAllRows<{ id: string; first_name: string; last_name: string; company_id: string | null; is_active: boolean }>(
        (from, to) =>
          supabase
            .from("contacts")
            .select("id, first_name, last_name, company_id, is_active")
            .eq("is_active", true)
            .order("first_name")
            .range(from, to)
      );
      return rows;
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
        .select("user_id, full_name, email, is_active, plaza_id")
        .eq("is_active", true)
        .order("full_name");
      return data || [];
    },
    staleTime: 60_000,
  });

  // Plazas activas
  const { data: plazas } = useQuery({
    queryKey: ["plazas-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plazas")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
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
  const [plazaId, setPlazaId] = useState<string>("");
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
      setCompanyId(defaultCompanyId || "");
      setContactId(defaultContactId || "");
      setValue("");
      setCloseDate("");
      setNotes("");
      setPlazaId("");
    }
    wasOpen.current = open;
  }, [open, pipelineId, defaultStageId, stages, session?.user?.id, defaultCompanyId, defaultContactId]);

  // Default plaza = plaza principal del ejecutivo seleccionado (si el usuario aún no la cambió manualmente)
  const plazaManuallyEdited = useRef(false);
  useEffect(() => {
    if (!open) { plazaManuallyEdited.current = false; return; }
    if (plazaManuallyEdited.current) return;
    const eje = (ejecutivos || []).find((u: any) => u.user_id === ownerId);
    if (eje?.plaza_id) setPlazaId(eje.plaza_id);
  }, [open, ownerId, ejecutivos]);

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

  // Limpiar contacto si no pertenece a la empresa seleccionada
  useEffect(() => {
    if (!contactId) return;
    if (!companyId) { setContactId(""); return; }
    const c = (contacts || []).find((x: any) => x.id === contactId);
    if (c && c.company_id !== companyId) setContactId("");
  }, [companyId, contacts, contactId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !title || !stageId || !selectedPipelineId) return;
    if (!companyId) {
      toast({ title: "Empresa requerida", description: "Selecciona una empresa para el negocio", variant: "destructive" });
      return;
    }
    if (!plazaId) {
      toast({ title: "Plaza requerida", description: "Selecciona una plaza para el negocio", variant: "destructive" });
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
        notes: notes.trim() ? notes.trim() : null,
        plaza_id: plazaId || null,
      } as any,
      {
        onSuccess: async () => {
          // Vincular la plaza a la empresa si no la tiene; setear como principal si está vacía
          try {
            const { data: cp } = await supabase
              .from("company_plazas")
              .select("plaza_id")
              .eq("company_id", companyId)
              .eq("plaza_id", plazaId)
              .maybeSingle();
            if (!cp) {
              await supabase.from("company_plazas").insert({ company_id: companyId, plaza_id: plazaId });
            }
            const { data: comp } = await supabase
              .from("companies")
              .select("plaza_id")
              .eq("id", companyId)
              .maybeSingle();
            if (comp && !comp.plaza_id) {
              await supabase.from("companies").update({ plaza_id: plazaId }).eq("id", companyId);
            }
          } catch (err) {
            console.error("Error sincronizando plaza de la empresa", err);
          }
          toast({ title: "Negocio creado", description: `"${title}" agregado al pipeline` });
          onOpenChange(false);
          setTitle(""); setTitleManuallyEdited(false); setCompanyId(""); setContactId(""); setValue(""); setCloseDate(""); setNotes(""); setPlazaId(""); plazaManuallyEdited.current = false;
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

  const plazaOptions = (plazas || []).map((p: any) => ({ value: p.id, label: p.nombre }));

  const pipelineOptions = (allPipelines || []).map((p: any) => ({
    value: p.id,
    label: formatPipelineLabel(p),
  }));

  // Header visual igual al detalle de negocio
  const selectedStage = effectiveStages.find((s) => s.id === stageId);
  const stageColor = selectedStage?.color || "hsl(var(--primary))";
  const isPhillips = selectedPipeline?.marca === "phillips66";
  const headerGradient = isPhillips
    ? "bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-l-4 border-red-500"
    : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-blue-500";
  const plazaName = (plazas || []).find((p: any) => p.id === plazaId)?.nombre || null;
  const ownerName =
    (ejecutivos || []).find((e: any) => e.user_id === ownerId)?.full_name ||
    (ejecutivos || []).find((e: any) => e.user_id === ownerId)?.email ||
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className={`rounded-lg p-4 shadow-sm ${headerGradient}`}>
            <DialogTitle className="flex items-center gap-2 text-lg flex-wrap">
              <div className="h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: stageColor }} />
              <span>{title || "Nuevo Negocio"}</span>
            </DialogTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {selectedCompany && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/80">
                  <Building2 className="h-3.5 w-3.5" /> {selectedCompany.name}
                </span>
              )}
              {plazaName && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border shadow-sm bg-white/70">
                  <MapPin className="h-3.5 w-3.5" /> {plazaName}
                </span>
              )}
              {selectedStage && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: stageColor, color: "white" }}
                >
                  {selectedStage.name}
                </span>
              )}
              {selectedPipeline?.pipeline_type === "recompra" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/70 border">
                  Recompra
                </span>
              )}
              {ownerName && (
                <span className="inline-flex items-center gap-1 text-sm text-foreground/70">
                  <User className="h-3.5 w-3.5" /> {ownerName}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título del Negocio (autogenerado, editable) */}
          <div className="space-y-2">
            <Label htmlFor="deal-title">Título <span className="text-destructive">*</span></Label>
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
            <Label htmlFor="deal-value">Potencial Unidades</Label>
            <Input
              id="deal-value"
              type="number"
              step="any"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Unidades manuales"
            />
          </div>

          <div className="space-y-2">
            <Label>Plaza <span className="text-destructive">*</span></Label>
            <Select value={plazaId} onValueChange={(v) => { plazaManuallyEdited.current = true; setPlazaId(v); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
              <SelectContent>
                {(plazas || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!plazaId && (
              <p className="text-xs text-muted-foreground">La plaza es obligatoria.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Ejecutivo</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar ejecutivo" /></SelectTrigger>
              <SelectContent>
                {(ejecutivos || []).map((e: any) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Label>Pipeline</Label>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar pipeline" /></SelectTrigger>
              <SelectContent>
                {(allPipelines || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{formatPipelineLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa <span className="text-destructive">*</span></Label>
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
            {!companyId && (
              <p className="text-xs text-muted-foreground">La empresa es obligatoria.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Contacto</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={contactId}
                  onValueChange={setContactId}
                  options={(contacts || [])
                    .filter((c: any) => c.company_id === companyId)
                    .map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                  placeholder={companyId ? "Buscar contacto..." : "Selecciona primero una empresa"}
                  disabled={!companyId}
                />
              </div>
              <Button type="button" variant="outline" size="icon" title="Nuevo contacto" disabled={!companyId} onClick={() => setContactDialogOpen(true)}>
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

          <div className="space-y-2">
            <Label htmlFor="deal-notes">Notas</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={3} maxLength={2000} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createDeal.isPending || !companyId || !plazaId}>
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
            .select("id, name, is_active, plaza_id")
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
          const { data: nuevo } = await supabase
            .from("contacts")
            .select("id, first_name, last_name, company_id, is_active")
            .eq("id", id)
            .maybeSingle();
          if (nuevo) {
            queryClient.setQueryData<any[]>(["contacts-picker-with-company"], (old) => {
              const list = old || [];
              if (list.some((c) => c.id === nuevo.id)) return list;
              return [...list, nuevo].sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
            });
            // Solo seleccionar si pertenece a la empresa actual
            if (nuevo.company_id === companyId) {
              setContactId(id);
            }
          }
          await queryClient.invalidateQueries({ queryKey: ["contacts-picker-with-company"] });
          refetchContacts();
        }}
      />
    </Dialog>
  );
}
