import { useState, useEffect } from "react";
import { localInputToIso } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmTask } from "@/hooks/useCrmTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { fetchAllRows } from "@/lib/supabasePagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { format, addHours, startOfHour } from "date-fns";
import { cn } from "@/lib/utils";
import { TASK_TYPES, TASK_TYPE_LABEL, TaskTypeKey } from "@/lib/taskTypes";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Plus, ExternalLink } from "lucide-react";

/** Próxima hora redonda (si son las 14:23 → 15:00). */
function nextRoundHourLocal(): string {
  const next = addHours(startOfHour(new Date()), 1);
  return format(next, "yyyy-MM-dd'T'HH:mm");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultBrand?: string;
  defaultDate?: string;
  defaultCompanyId?: string;
  defaultTaskType?: TaskTypeKey;
  defaultDescription?: string;
  origenTareaId?: string;
  /** Marcas pre-seleccionadas (uno o ambos). */
  defaultBrands?: Array<"lumaggs_chevron" | "galsa_phillips66">;
}

type Brand = "lumaggs_chevron" | "galsa_phillips66";

export function CreateCrmActivityTaskDialog({ open, onOpenChange, defaultContactId, defaultBrand, defaultDate, defaultCompanyId, defaultTaskType, defaultDescription, origenTareaId, defaultBrands }: Props) {
  const { session } = useAuth();
  const createTask = useCreateCrmTask();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("companies").select("id, name").eq("is_active", true).order("name").range(from, to));
      return data;
    },
  });


  const { data: users } = useQuery({
    queryKey: ["profiles-picker"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name").range(from, to));
      return data;
    },
  });

  const defaultDateValue = defaultDate || nextRoundHourLocal();

  const [taskType, setTaskType] = useState<TaskTypeKey>(defaultTaskType || "call");
  const [activityDate, setActivityDate] = useState(defaultDateValue);
  const [description, setDescription] = useState(defaultDescription || "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [taskStatus, setTaskStatus] = useState<"planned" | "done" | "cancelled">("planned");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [contactId, setContactId] = useState(defaultContactId || "");

  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker", companyId || "all"],
    queryFn: async () => {
      if (!companyId || companyId === "none") return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .eq("company_id", companyId)
        .order("first_name");
      return data || [];
    },
  });
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [brands, setBrands] = useState<Brand[]>(defaultBrands || []);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  useEffect(() => {
    if (open) setBrands(defaultBrands || []);
  }, [open, defaultBrands?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBrand = (b: Brand) => {
    setBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const linkSeguimientos = async (taskId: string, companyIdFinal: string) => {
    for (const ev of brands) {
      try {
        await supabase.rpc("recompute_seguimiento_ventas", { _company_id: companyIdFinal, _ev: ev });
        const { data: seg } = await supabase
          .from("seguimiento_ventas")
          .select("id")
          .eq("company_id", companyIdFinal)
          .eq("empresa_vendedora", ev)
          .maybeSingle();
        if (seg?.id) {
          await supabase
            .from("crm_task_seguimiento")
            .upsert({ task_id: taskId, seguimiento_venta_id: seg.id }, { onConflict: "task_id,seguimiento_venta_id" });
        }
      } catch (err) {
        console.warn("[seguimiento link] failed", ev, err);
      }
    }
  };

  // Auto-resolver vínculos cuando se abre desde una vista específica
  useEffect(() => {
    if (!open) return;
    (async () => {
      if (defaultCompanyId) {
        // Si viene defaultCompanyId: resolver contacto principal
        const { data: comp } = await supabase
          .from("companies")
          .select("primary_contact_id")
          .eq("id", defaultCompanyId)
          .maybeSingle();
        const primary = (comp as any)?.primary_contact_id;
        if (primary) setContactId((prev) => prev || primary);
      }
    })();
  }, [open, defaultCompanyId]);

  const lockCompany = !!defaultCompanyId;
  const lockContact = !!defaultContactId;

  const availableCollaborators = users?.filter(
    (u) => u.user_id !== session?.user?.id && !collaboratorIds.includes(u.user_id)
  ) || [];

  const handleAddCollaborator = (userId: string) => {
    if (userId && userId !== "none" && !collaboratorIds.includes(userId)) {
      setCollaboratorIds([...collaboratorIds, userId]);
    }
  };

  const handleRemoveCollaborator = (userId: string) => {
    setCollaboratorIds(collaboratorIds.filter((id) => id !== userId));
  };

  const saveCollaborators = async (entityType: "activity" | "task", entityId: string) => {
    if (collaboratorIds.length === 0) return;
    const table = entityType === "activity" ? "crm_activity_collaborators" : "crm_task_collaborators";
    const fkField = entityType === "activity" ? "activity_id" : "task_id";
    const rows = collaboratorIds.map((uid) => ({ [fkField]: entityId, user_id: uid }));
    try {
      const { error } = await supabase.from(table).insert(rows as any);
      if (error) throw error;
    } catch (err: any) {
      // No bloquear el éxito del registro principal
      toast({
        title: "Advertencia",
        description: `No se pudieron guardar los colaboradores: ${err?.message || "error desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    if (createTask.isPending) return;

    if (brands.length === 0) {
      toast({ title: "Selecciona al menos una marca", description: "Marca Lumaggs y/o Galsa antes de guardar.", variant: "destructive" });
      return;
    }

    const typeLabel = TASK_TYPE_LABEL[taskType];
    const normalizedContactId = contactId && contactId !== "none" ? contactId : null;
    let normalizedCompanyId = companyId && companyId !== "none" ? companyId : null;

    // Auto-resolver company_id desde contact si el usuario no la seleccionó
    if (!normalizedCompanyId && normalizedContactId) {
      const { data: contactRow } = await supabase
        .from("contacts").select("company_id").eq("id", normalizedContactId).maybeSingle();
      if (contactRow?.company_id) normalizedCompanyId = contactRow.company_id;
    }

    if (!normalizedCompanyId) {
      toast({ title: "Selecciona una empresa", description: "Se requiere para vincular el seguimiento por marca.", variant: "destructive" });
      return;
    }

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
      queryClient.invalidateQueries({ queryKey: ["seller-portal"] });
      queryClient.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
    };

    const verifyCompany = (data: any) => {
      if (normalizedCompanyId && !data?.company_id) {
        toast({
          title: "Aviso",
          description: "El registro se creó pero no quedó vinculado a la empresa seleccionada.",
          variant: "destructive",
        });
      }
    };

    createTask.mutate(
      {
        user_id: session.user.id,
        title: typeLabel,
        description: description || null,
        due_date: localInputToIso(activityDate),
        priority,
        company_id: normalizedCompanyId,
        contact_id: normalizedContactId,
        // Nuevas columnas
        task_type: taskType,
        recurrence,
        task_status: taskStatus,
        completed: taskStatus === "done",
        origen_tarea_id: origenTareaId || null,
      } as any,
      {
        onSuccess: async (data) => {
          verifyCompany(data);
          await linkSeguimientos(data.id, normalizedCompanyId!);
          invalidateAll();
          toast({ title: "Tarea creada" });
          resetAndClose();
          saveCollaborators("task", data.id);
        },
        onError: (err: any) => {
          toast({
            title: "Error al crear tarea",
            description: err?.message || "No se pudo guardar la tarea.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const resetAndClose = () => {
    onOpenChange(false);
    setTaskType(defaultTaskType || "call");
    setActivityDate(defaultDate || nextRoundHourLocal());
    setDescription(defaultDescription || "");
    setDueDate("");
    setPriority("medium");
    setRecurrence("none");
    setTaskStatus("planned");
    setCompanyId(defaultCompanyId || "");
    setContactId(defaultContactId || "");
    setCollaboratorIds([]);
    setBrands(defaultBrands || []);
  };

  const isPending = createTask.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(true); }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle>Nueva Actividad / Tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Tipo - iconos compactos full width */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo *</Label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {TASK_TYPES.map(({ key, label, Icon, soft, active }) => {
                  const selected = taskType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTaskType(key)}
                      title={label}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 transition-all",
                        selected ? active : soft
                      )}
                      aria-pressed={selected}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-medium leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Marcas */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marca * (puede seleccionar una o ambas)</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "lumaggs_chevron" as Brand, label: "Lumaggs (Chevron)", soft: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", active: "bg-blue-600 text-white border-blue-600 hover:bg-blue-600" },
                  { key: "galsa_phillips66" as Brand, label: "Galsa (Phillips 66)", soft: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100", active: "bg-red-600 text-white border-red-600 hover:bg-red-600" },
                ].map((b) => {
                  const sel = brands.includes(b.key);
                  return (
                    <button key={b.key} type="button" onClick={() => toggleBrand(b.key)} aria-pressed={sel}
                      className={cn("rounded-md border px-3 py-2 text-sm font-medium transition-all", sel ? b.active : b.soft)}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doble columna */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {/* Columna Izquierda */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Fecha y hora *</Label>
                  <Input type="datetime-local" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Prioridad</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estatus</Label>
                    <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planificada</SelectItem>
                        <SelectItem value="done">Realizada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Recurrencia</Label>
                  <Select value={recurrence} onValueChange={(v) => setRecurrence(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="daily">Diaria</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Columna Derecha - Vinculación */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Colaboradores</Label>
                  <SearchableSelect
                    value="none"
                    onValueChange={handleAddCollaborator}
                    options={[
                      { value: "none", label: "Agregar colaborador..." },
                      ...availableCollaborators.map((u) => ({
                        value: u.user_id,
                        label: u.full_name || u.email || "Sin nombre",
                      })),
                    ]}
                    placeholder="Buscar usuario..."
                  />
                  {collaboratorIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {collaboratorIds.map((uid) => {
                        const user = users?.find((u) => u.user_id === uid);
                        return (
                          <Badge key={uid} variant="secondary" className="gap-1">
                            {user?.full_name || user?.email || uid.slice(0, 8)}
                            <button type="button" onClick={() => handleRemoveCollaborator(uid)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2">Empresa / Cliente {lockCompany && <span className="text-[10px] text-muted-foreground">(prellenada)</span>}</Label>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCompanyDialogOpen(true)} disabled={lockCompany}>
                        <Plus className="h-3 w-3 mr-1" /> Nueva
                      </Button>
                      {companyId && companyId !== "none" && (
                        <a
                          href={`/directory?tab=companies&select=${companyId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 h-6"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver
                        </a>
                      )}
                    </div>
                  </div>
                  <SearchableSelect
                    value={companyId || "none"}
                    onValueChange={(v) => {
                      const next = v === "none" ? "" : v;
                      setCompanyId(next);
                      setContactId("");
                    }}
                    options={[
                      { value: "none", label: "Ninguna" },
                      ...(companies?.map((c) => ({ value: c.id, label: c.name })) || []),
                    ]}
                    placeholder="Buscar empresa..."
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2">Vincular a Contacto {lockContact && <span className="text-[10px] text-muted-foreground">(prellenado)</span>}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setContactDialogOpen(true)}
                      disabled={lockContact || !companyId || companyId === "none"}
                      title={!companyId || companyId === "none" ? "Selecciona una empresa primero" : "Nuevo contacto"}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Nuevo
                    </Button>
                  </div>
                  <SearchableSelect
                    value={contactId || "none"}
                    onValueChange={(v) => setContactId(v === "none" ? "" : v)}
                    options={[
                      { value: "none", label: "Ninguno" },
                      ...(contacts?.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })) || []),
                    ]}
                    placeholder="Buscar contacto..."
                  />
                  {(!companyId || companyId === "none") && (
                    <p className="text-[10px] text-muted-foreground">Selecciona una empresa para ver sus contactos.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Descripción full width */}
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalles de la actividad..." maxLength={2000} />
            </div>
          </div>

          {/* Sticky footer */}
          <div className="border-t bg-background px-6 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    {companyDialogOpen && (
      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={(newId) => {
          queryClient.invalidateQueries({ queryKey: ["companies-picker"] });
          setCompanyId(newId);
          setContactId("");
        }}
      />
    )}
    {contactDialogOpen && companyId && companyId !== "none" && (
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={companyId}
        onCreated={(newId) => {
          queryClient.invalidateQueries({ queryKey: ["contacts-picker", companyId] });
          setContactId(newId);
        }}
      />
    )}
    </>
  );
}
