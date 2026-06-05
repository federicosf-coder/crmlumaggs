import { useEffect, useState } from "react";
import { GripVertical, Plus, Trash2, Eye } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { ACTION_GROUPS, actionLabel, type ActionDraft } from "./types";
import { WhatsAppPersonalizadoEditor } from "./WhatsAppPersonalizadoConfig";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";

export function AutomationStepActions({
  actions, onChange,
}: {
  actions: ActionDraft[];
  onChange: (next: ActionDraft[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addAction = (action_type: string) => {
    onChange([...actions, { action_type, action_config: {} }]);
    setOpen(false);
  };
  const updateAction = (idx: number, patch: Partial<ActionDraft>) => {
    const next = [...actions];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeAction = (idx: number) => onChange(actions.filter((_, i) => i !== idx));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = Number(active.id);
    const newIdx = Number(over.id);
    onChange(arrayMove(actions, oldIdx, newIdx));
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={actions.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
          {actions.map((a, idx) => (
            <SortableActionCard
              key={idx}
              id={String(idx)}
              index={idx}
              action={a}
              onUpdate={(patch) => updateAction(idx, patch)}
              onRemove={() => removeAction(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground">Aún no has agregado acciones.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Agregar acción
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecciona una acción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {ACTION_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{g.label}</p>
                <div className="grid grid-cols-1 gap-1">
                  {g.actions.map((a) => (
                    <Button key={a.value} variant="ghost" className="justify-start" onClick={() => addAction(a.value)}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableActionCard({
  id, index, action, onUpdate, onRemove,
}: {
  id: string;
  index: number;
  action: ActionDraft;
  onUpdate: (patch: Partial<ActionDraft>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-3">
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab pt-1"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {index + 1}. {actionLabel(action.action_type)}
            </p>
            <Button size="icon" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <ActionConfigEditor action={action} onUpdate={onUpdate} />
        </div>
      </div>
    </Card>
  );
}

function ActionConfigEditor({
  action, onUpdate,
}: {
  action: ActionDraft;
  onUpdate: (patch: Partial<ActionDraft>) => void;
}) {
  const cfg = action.action_config || {};
  const setCfg = (patch: Record<string, any>) =>
    onUpdate({ action_config: { ...cfg, ...patch } });

  switch (action.action_type) {
    case "send_email":
      return <EmailActionEditor cfg={cfg} setCfg={setCfg} />;
    case "send_whatsapp":
      return <WhatsAppActionEditor cfg={cfg} setCfg={setCfg} />;
    case "send_whatsapp_personalizado":
      return <WhatsAppPersonalizadoEditor cfg={cfg as any} setCfg={(p) => setCfg(p)} />;
    case "send_whatsapp_api_local":
      return <WhatsAppApiLocalEditor cfg={cfg} setCfg={setCfg} />;
    case "send_notification":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Mensaje">
            <Input value={cfg.message || ""} onChange={(e) => setCfg({ message: e.target.value })} />
          </Field>
          <Field label="Para">
            <SelectInline
              value={cfg.to_user || "ejecutivo_asignado"}
              onChange={(v) => setCfg({ to_user: v })}
              options={[{ value: "ejecutivo_asignado", label: "Ejecutivo asignado" }]}
            />
          </Field>
        </div>
      );
    case "create_task":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Título (acepta {company_name}, {deal_title})">
            <Input value={cfg.title || ""} onChange={(e) => setCfg({ title: e.target.value })} />
          </Field>
          <Field label="Vencimiento">
            <SelectInline
              value={cfg.due_date_formula || "hoy"}
              onChange={(v) => setCfg({ due_date_formula: v })}
              options={[
                { value: "hoy", label: "Hoy" },
                { value: "hoy+1", label: "Hoy + 1 día" },
                { value: "hoy+3", label: "Hoy + 3 días" },
                { value: "hoy+7", label: "Hoy + 7 días" },
                { value: "campo_fecha", label: "Campo de fecha del registro" },
              ]}
            />
          </Field>
          <Field label="Prioridad">
            <SelectInline
              value={cfg.priority || "medium"}
              onChange={(v) => setCfg({ priority: v })}
              options={[
                { value: "low", label: "Baja" },
                { value: "medium", label: "Media" },
                { value: "high", label: "Alta" },
              ]}
            />
          </Field>
          <Field label="Asignado a">
            <SelectInline
              value={cfg.assignee || "ejecutivo_asignado"}
              onChange={(v) => setCfg({ assignee: v })}
              options={[{ value: "ejecutivo_asignado", label: "Ejecutivo asignado" }]}
            />
          </Field>
        </div>
      );
    case "update_deal_stage":
      return <StageSelect value={cfg.stage_id} onChange={(v) => setCfg({ stage_id: v })} />;
    case "close_deal":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Resultado">
            <SelectInline
              value={cfg.result || "ganado"}
              onChange={(v) => setCfg({ result: v })}
              options={[
                { value: "ganado", label: "Ganado" },
                { value: "perdido", label: "Perdido" },
              ]}
            />
          </Field>
          <Field label="Razón (opcional)">
            <Input value={cfg.reason || ""} onChange={(e) => setCfg({ reason: e.target.value })} />
          </Field>
        </div>
      );
    case "create_recompra_deal":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Mes de recompra">
            <SelectInline
              value={cfg.mes_formula || "mes_siguiente"}
              onChange={(v) => setCfg({ mes_formula: v })}
              options={[
                { value: "mes_actual", label: "Mes actual" },
                { value: "mes_siguiente", label: "Mes siguiente" },
              ]}
            />
          </Field>
          <Field label="Nota (opcional)">
            <Input value={cfg.nota || ""} onChange={(e) => setCfg({ nota: e.target.value })} />
          </Field>
        </div>
      );
    case "create_activity_log":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Tipo">
            <SelectInline
              value={cfg.type || "note"}
              onChange={(v) => setCfg({ type: v })}
              options={[
                { value: "call", label: "Llamada" },
                { value: "email", label: "Correo" },
                { value: "meeting", label: "Reunión" },
                { value: "note", label: "Nota" },
              ]}
            />
          </Field>
          <Field label="Notas">
            <Textarea rows={2} value={cfg.notes || ""} onChange={(e) => setCfg({ notes: e.target.value })} />
          </Field>
        </div>
      );
    case "assign_owner":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Tipo de asignación">
            <SelectInline
              value={cfg.assignee_type || "usuario_especifico"}
              onChange={(v) => setCfg({ assignee_type: v })}
              options={[
                { value: "usuario_especifico", label: "Usuario específico" },
                { value: "round_robin_equipo", label: "Round robin de equipo" },
              ]}
            />
          </Field>
          <Field label={cfg.assignee_type === "round_robin_equipo" ? "Equipo (ID)" : "Usuario (ID)"}>
            <Input
              value={cfg.assignee_type === "round_robin_equipo" ? cfg.team_id || "" : cfg.user_id || ""}
              onChange={(e) =>
                setCfg(cfg.assignee_type === "round_robin_equipo"
                  ? { team_id: e.target.value }
                  : { user_id: e.target.value })
              }
            />
          </Field>
        </div>
      );
    case "update_deal_field":
    case "update_company_field":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Campo">
            <Input value={cfg.field_name || ""} onChange={(e) => setCfg({ field_name: e.target.value })} />
          </Field>
          <Field label="Valor">
            <Input value={cfg.value || ""} onChange={(e) => setCfg({ value: e.target.value })} />
          </Field>
        </div>
      );
    default:
      return null;
  }
}

function EmailActionEditor({ cfg, setCfg }: { cfg: any; setCfg: (p: any) => void }) {
  const [templates, setTemplates] = useState<
    { id: string; name: string; to_emails: any; cc_emails: any; bcc_emails: any }[]
  >([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("templates")
        .select("id,name,to_emails,cc_emails,bcc_emails")
        .eq("type", "email")
        .eq("is_active", true)
        .order("name");
      setTemplates(data || []);
    })();
  }, []);
  const selected = templates.find((t) => t.id === cfg.template_id);
  const fmt = (v: any) => {
    if (!v) return "—";
    const arr = Array.isArray(v) ? v : [];
    return arr.length ? arr.join(", ") : "—";
  };
  return (
    <div className="space-y-2">
      <Field label="Plantilla">
        <SelectInline
          value={cfg.template_id}
          onChange={(v) => setCfg({ template_id: v })}
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Field>
      {selected ? (
        <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
          <p className="text-muted-foreground">
            Los destinatarios se toman de la plantilla:
          </p>
          <p><span className="font-medium">Para:</span> {fmt(selected.to_emails)}</p>
          <p><span className="font-medium">CC:</span> {fmt(selected.cc_emails)}</p>
          <p><span className="font-medium">CCO:</span> {fmt(selected.bcc_emails)}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Selecciona una plantilla. Se usarán sus campos Para, CC y CCO al enviar.
        </p>
      )}
    </div>
  );
}

function WhatsAppActionEditor({ cfg, setCfg }: { cfg: any; setCfg: (p: any) => void }) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("templates")
        .select("id,name")
        .eq("type", "whatsapp")
        .eq("is_active", true)
        .order("name");
      setTemplates(data || []);
    })();
  }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <Field label="Plantilla">
        <SelectInline
          value={cfg.template_id}
          onChange={(v) => setCfg({ template_id: v })}
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Field>
      <Field label="Destinatario">
        <SelectInline
          value={cfg.to_type || "contacto_principal"}
          onChange={(v) => setCfg({ to_type: v })}
          options={[
            { value: "contacto_principal", label: "Contacto principal" },
            { value: "campo_telefono", label: "Campo de teléfono" },
          ]}
        />
      </Field>
    </div>
  );
}

function StageSelect({ value, onChange }: { value: any; onChange: (v: string) => void }) {
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("crm_pipeline_stages")
        .select("id,name,position")
        .order("position");
      setStages((data || []).map((s: any) => ({ id: s.id, name: s.name })));
    })();
  }, []);
  return (
    <Field label="Etapa destino">
      <SelectInline
        value={value}
        onChange={onChange}
        options={stages.map((s) => ({ value: s.id, label: s.name }))}
      />
    </Field>
  );
}

function WhatsAppApiLocalEditor({ cfg, setCfg }: { cfg: any; setCfg: (p: any) => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [waTemplates, setWaTemplates] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_message_templates")
        .select("id,nombre,activo,orden")
        .eq("activo", true)
        .order("orden");
      setWaTemplates((data || []).map((t: any) => ({ id: t.id, nombre: t.nombre })));
    })();
  }, []);
  const mode = cfg.mode || "preguntar";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Modo de envío">
          <SelectInline
            value={mode}
            onChange={(v) => setCfg({ mode: v })}
            options={[
              { value: "preguntar", label: "Preguntar al ejecutar (API o Local)" },
              { value: "api", label: "Solo API (Meta Cloud)" },
              { value: "local", label: "Solo Local (wa.me)" },
            ]}
          />
        </Field>
        <Field label="Destinatario">
          <SelectInline
            value={cfg.to_type || "contacto_principal"}
            onChange={(v) => setCfg({ to_type: v })}
            options={[
              { value: "contacto_principal", label: "Contacto principal" },
              { value: "campo_telefono", label: "Campo de teléfono" },
            ]}
          />
        </Field>
        {mode !== "api" && (
          <Field label="Plantilla local (opcional)">
            <SelectInline
              value={cfg.template_id}
              onChange={(v) => setCfg({ template_id: v })}
              options={waTemplates.map((t) => ({ value: t.id, label: t.nombre }))}
            />
          </Field>
        )}
      </div>
      {mode !== "api" && (
        <Field label="Mensaje personalizado (si no usas plantilla)">
          <Textarea
            rows={3}
            value={cfg.message || ""}
            onChange={(e) => setCfg({ message: e.target.value })}
            placeholder="Hola {contacto_nombre}, ..."
          />
        </Field>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Vista previa del diálogo
        </Button>
        <p className="text-xs text-muted-foreground">
          Al ejecutar, se abre el cuadro de diálogo "Enviar WhatsApp" donde se elige API o Local.
        </p>
      </div>
      <WhatsAppActionDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        phone={null}
        variables={{ contacto_nombre: "{contacto_nombre}", empresa_nombre: "{empresa_nombre}" } as any}
        defaultMessage={cfg.message || ""}
        context={{}}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SelectInline({
  value, onChange, options,
}: {
  value: any;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}