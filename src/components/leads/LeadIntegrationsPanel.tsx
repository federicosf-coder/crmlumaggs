import { useMemo, useState } from "react";
import {
  Plus, Facebook, RefreshCw, Trash2, Link2, FileText, History, Copy, Check, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeadSources } from "@/hooks/useLeads";
import {
  fbAdmin, useDeleteIntegration, useDeleteIntegrationForm, useLeadIntegrationEvents,
  useLeadIntegrationForms, useLeadIntegrationPages, useLeadIntegrations, useSaveIntegration,
  useSaveIntegrationForm, type LeadIntegration,
} from "@/hooks/useLeadIntegrations";

const CAMPOS_CRM = [
  { value: "", label: "No mapear" },
  { value: "nombre", label: "Nombre" },
  { value: "apellido", label: "Apellido" },
  { value: "email", label: "Correo" },
  { value: "telefono", label: "Teléfono" },
  { value: "empresa", label: "Empresa" },
  { value: "mensaje", label: "Mensaje" },
  { value: "interes", label: "Interés" },
  { value: "ciudad", label: "Ciudad" },
  { value: "estado", label: "Estado" },
];

const HEADER = "bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-4 p-6 border-b";
const LABEL = "text-[11px] uppercase tracking-wide text-muted-foreground";

function useAutomationsList() {
  return useQuery({
    queryKey: ["automations", "picker"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automations")
        .select("id, name, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; is_active: boolean }[];
    },
  });
}

export function LeadIntegrationsPanel() {
  const { data: integrations = [], isLoading, refetch } = useLeadIntegrations();
  const { data: pages = [], refetch: refetchPages } = useLeadIntegrationPages();
  const { data: forms = [], refetch: refetchForms } = useLeadIntegrationForms();
  const { data: sources = [] } = useLeadSources();
  const { data: automations = [] } = useAutomationsList();
  const saveIntegration = useSaveIntegration();
  const deleteIntegration = useDeleteIntegration();

  const [editing, setEditing] = useState<Partial<LeadIntegration> | null>(null);
  const [pageDialog, setPageDialog] = useState<LeadIntegration | null>(null);
  const [formsDialog, setFormsDialog] = useState<{ integration: LeadIntegration; pageId: string; pageName: string } | null>(null);
  const [eventsFor, setEventsFor] = useState<LeadIntegration | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const pagesByIntegration = useMemo(() => {
    const m: Record<string, typeof pages> = {};
    for (const p of pages) (m[p.integration_id] ||= []).push(p);
    return m;
  }, [pages]);

  const formsByIntegration = useMemo(() => {
    const m: Record<string, typeof forms> = {};
    for (const f of forms) (m[f.integration_id] ||= []).push(f);
    return m;
  }, [forms]);

  const guardar = async () => {
    if (!editing?.nombre?.trim()) return toast.error("El nombre es obligatorio");
    if (!editing.source_id) return toast.error("Selecciona la fuente de prospectos");
    try {
      await saveIntegration.mutateAsync({
        id: editing.id,
        nombre: editing.nombre.trim(),
        tipo: "facebook_lead_ads",
        descripcion: editing.descripcion ?? null,
        source_id: editing.source_id,
        automation_id: editing.automation_id || null,
        is_active: editing.is_active ?? true,
      } as any);
      toast.success("Integración guardada");
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground font-light">
          Conecta páginas y formularios de Facebook Lead Ads. Los prospectos entran a esta misma bandeja con su SLA y notificaciones.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Link2 className="h-4 w-4 mr-1" /> Datos del webhook
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchPages(); refetchForms(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setEditing({ nombre: "", is_active: true, tipo: "facebook_lead_ads" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva integración
          </Button>
        </div>
      </div>

      {integrations.length === 0 && !isLoading && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground font-light">
          Aún no hay integraciones. Crea una y conéctala a una página de Facebook.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {integrations.map((it) => {
          const itPages = pagesByIntegration[it.id] ?? [];
          const itForms = formsByIntegration[it.id] ?? [];
          return (
            <Card key={it.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Facebook className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">{it.nombre}</p>
                      <p className="text-xs text-muted-foreground font-light">
                        Fuente: {it.lead_sources?.nombre ?? "—"} · Workflow: {it.automations?.name ?? "sin automatización"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={it.is_active ? "default" : "secondary"}>
                      {it.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    <Switch
                      checked={it.is_active}
                      onCheckedChange={async (v) => {
                        await saveIntegration.mutateAsync({ id: it.id, nombre: it.nombre, is_active: v } as any);
                      }}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEventsFor(it)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        if (!confirm(`¿Eliminar la integración "${it.nombre}"?`)) return;
                        await deleteIntegration.mutateAsync(it.id);
                        toast.success("Integración eliminada");
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                        <TableHead className={LABEL}>Página</TableHead>
                        <TableHead className={LABEL}>Suscripción</TableHead>
                        <TableHead className={LABEL}>Formularios</TableHead>
                        <TableHead className="text-right"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itPages.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                          Sin páginas conectadas
                        </TableCell></TableRow>
                      )}
                      {itPages.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-light">
                            {p.page_name ?? p.page_id}
                            <span className="block text-[11px] text-muted-foreground">{p.page_id}</span>
                          </TableCell>
                          <TableCell className="font-light">
                            {p.subscribed_at ? <Badge variant="secondary">Suscrita a leadgen</Badge> : <Badge variant="outline">Pendiente</Badge>}
                          </TableCell>
                          <TableCell className="font-light">
                            {itForms.filter((f) => f.page_id === p.page_id && f.is_active).length} activos
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => setFormsDialog({ integration: it, pageId: p.page_id, pageName: p.page_name ?? p.page_id })}
                            >
                              <FileText className="h-4 w-4 mr-1" /> Formularios
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={async () => {
                                if (!confirm("¿Desconectar esta página?")) return;
                                try {
                                  await fbAdmin("unsubscribe_page", { page_id: p.page_id, integration_id: it.id });
                                  toast.success("Página desconectada");
                                  refetchPages(); refetchForms();
                                } catch (e: any) { toast.error(e.message); }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button variant="outline" size="sm" onClick={() => setPageDialog(it)}>
                  <Plus className="h-4 w-4 mr-1" /> Conectar página de Facebook
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alta / edición */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className={HEADER}>
            <DialogTitle className="font-light">
              {editing?.id ? "Editar integración" : "Nueva integración"}
            </DialogTitle>
            <DialogDescription className="font-light">Facebook Lead Ads</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className={LABEL}>Nombre</Label>
              <Input value={editing?.nombre ?? ""} onChange={(e) => setEditing({ ...editing!, nombre: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className={LABEL}>Fuente de prospectos</Label>
              <Select value={editing?.source_id ?? ""} onValueChange={(v) => setEditing({ ...editing!, source_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona la fuente" /></SelectTrigger>
                <SelectContent>
                  {sources.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Define plaza, marca y el WhatsApp de aviso.</p>
            </div>
            <div className="space-y-1">
              <Label className={LABEL}>Workflow (automatización)</Label>
              <Select
                value={editing?.automation_id ?? "none"}
                onValueChange={(v) => setEditing({ ...editing!, automation_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin automatización" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin automatización</SelectItem>
                  {automations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className={LABEL}>Descripción</Label>
              <Textarea rows={2} value={editing?.descripcion ?? ""} onChange={(e) => setEditing({ ...editing!, descripcion: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing!, is_active: v })} />
              <span className="text-sm font-light">Integración activa</span>
            </div>
          </div>
          <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saveIntegration.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pageDialog && (
        <ConnectPageDialog
          integration={pageDialog}
          onClose={() => setPageDialog(null)}
          onDone={() => { setPageDialog(null); refetchPages(); }}
        />
      )}

      {formsDialog && (
        <FormsDialog
          integration={formsDialog.integration}
          pageId={formsDialog.pageId}
          pageName={formsDialog.pageName}
          onClose={() => { setFormsDialog(null); refetchForms(); }}
        />
      )}

      {eventsFor && <EventsDialog integration={eventsFor} onClose={() => setEventsFor(null)} />}
      <WebhookConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}

function ConnectPageDialog({ integration, onClose, onDone }: { integration: LeadIntegration; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);

  const cargar = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fbAdmin<{ pages: { id: string; name: string }[] }>("list_pages");
      setPages(res.pages ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Conectar página de Facebook</DialogTitle>
          <DialogDescription className="font-light">{integration.nombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Cargar páginas disponibles
          </Button>
          {error && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2 max-h-72 overflow-auto">
            {pages.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.id}</p>
                </div>
                <Button
                  size="sm" disabled={saving === p.id}
                  onClick={async () => {
                    setSaving(p.id);
                    try {
                      await fbAdmin("subscribe_page", { page_id: p.id, page_name: p.name, integration_id: integration.id });
                      toast.success("Página conectada y suscrita a leadgen");
                      onDone();
                    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
                  }}
                >
                  Conectar
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormsDialog({ integration, pageId, pageName, onClose }: {
  integration: LeadIntegration; pageId: string; pageName: string; onClose: () => void;
}) {
  const { data: saved = [], refetch } = useLeadIntegrationForms();
  const saveForm = useSaveIntegrationForm();
  const deleteForm = useDeleteIntegrationForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<any[]>([]);

  const savedForPage = saved.filter((f) => f.integration_id === integration.id && f.page_id === pageId);

  const cargar = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fbAdmin<{ forms: any[] }>("list_forms", { page_id: pageId });
      setRemote(res.forms ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const asociar = async (form: any) => {
    const map: Record<string, string> = {};
    for (const q of form.questions ?? []) {
      const key = String(q.key ?? "");
      const t = String(q.type ?? "").toLowerCase();
      if (t.includes("email")) map[key] = "email";
      else if (t.includes("phone")) map[key] = "telefono";
      else if (t.includes("full_name") || t === "name") map[key] = "nombre";
      else if (t.includes("first_name")) map[key] = "nombre";
      else if (t.includes("last_name")) map[key] = "apellido";
      else if (t.includes("company")) map[key] = "empresa";
      else if (t.includes("city")) map[key] = "ciudad";
      else if (t.includes("state")) map[key] = "estado";
    }
    try {
      await saveForm.mutateAsync({
        integration_id: integration.id,
        page_id: pageId,
        form_id: String(form.id),
        form_name: form.name ?? null,
        field_map: map,
        is_active: true,
      });
      toast.success("Formulario asociado");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Formularios de {pageName}</DialogTitle>
          <DialogDescription className="font-light">{integration.nombre}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className={LABEL}>Formularios asociados</p>
            {savedForPage.length === 0 && <p className="text-sm text-muted-foreground font-light mt-2">Ninguno todavía.</p>}
            <div className="space-y-3 mt-2">
              {savedForPage.map((f) => (
                <div key={f.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{f.form_name ?? f.form_id}</p>
                      <p className="text-[11px] text-muted-foreground">{f.form_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={f.is_active}
                        onCheckedChange={async (v) => {
                          await saveForm.mutateAsync({ ...f, is_active: v } as any);
                          refetch();
                        }}
                      />
                      <Button variant="ghost" size="sm" onClick={async () => { await deleteForm.mutateAsync(f.id); refetch(); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.keys(f.field_map ?? {}).length === 0 && (
                      <p className="text-[11px] text-muted-foreground">Sin mapeo: se usará la detección automática de campos.</p>
                    )}
                    {Object.entries(f.field_map ?? {}).map(([metaKey, crmField]) => (
                      <div key={metaKey} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate w-1/2" title={metaKey}>{metaKey}</span>
                        <Select
                          value={String(crmField ?? "")}
                          onValueChange={async (v) => {
                            const next = { ...(f.field_map ?? {}) } as Record<string, string>;
                            if (v === "__none") delete next[metaKey]; else next[metaKey] = v;
                            await saveForm.mutateAsync({ ...f, field_map: next } as any);
                            refetch();
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CAMPOS_CRM.map((c) => (
                              <SelectItem key={c.value || "__none"} value={c.value || "__none"}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Ver formularios de la página
            </Button>
            {error && (
              <div className="mt-2 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="space-y-2 mt-3">
              {remote.map((form) => {
                const ya = savedForPage.some((f) => f.form_id === String(form.id));
                return (
                  <div key={form.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm">{form.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {form.id} · {(form.questions ?? []).length} campos · {form.status}
                      </p>
                    </div>
                    <Button size="sm" variant={ya ? "secondary" : "default"} disabled={ya} onClick={() => asociar(form)}>
                      {ya ? "Asociado" : "Asociar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventsDialog({ integration, onClose }: { integration: LeadIntegration; onClose: () => void }) {
  const { data: events = [], refetch, isLoading } = useLeadIntegrationEvents(integration.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Historial de eventos</DialogTitle>
          <DialogDescription className="font-light">{integration.nombre}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                <TableHead className={LABEL}>Fecha</TableHead>
                <TableHead className={LABEL}>Formulario</TableHead>
                <TableHead className={LABEL}>Resultado</TableHead>
                <TableHead className={LABEL}>Detalle</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                  {isLoading ? "Cargando..." : "Sin eventos registrados"}
                </TableCell></TableRow>
              )}
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-light text-xs">{new Date(e.created_at).toLocaleString("es-MX")}</TableCell>
                  <TableCell className="font-light text-xs">{e.form_id ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.resultado === "procesado" ? "default" : e.resultado === "error" ? "destructive" : "secondary"}>
                      {e.resultado}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-light text-xs max-w-xs truncate" title={e.error ?? ""}>{e.error ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try {
                          await fbAdmin("reprocess", { leadgen_id: e.leadgen_id, page_id: e.page_id, form_id: e.form_id });
                          toast.success("Evento reprocesado");
                          refetch();
                        } catch (err: any) { toast.error(err.message); }
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebhookConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const cargar = async () => {
    try { setCfg(await fbAdmin("get_config")); } catch (e: any) { toast.error(e.message); }
  };

  const copiar = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) cargar(); else onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Datos del webhook de Meta</DialogTitle>
          <DialogDescription className="font-light">
            Pégalos en tu app de Meta → Webhooks → Página → campo <strong>leadgen</strong>.
          </DialogDescription>
        </DialogHeader>
        {!cfg ? (
          <Button variant="outline" size="sm" onClick={cargar}>Cargar datos</Button>
        ) : (
          <div className="space-y-3">
            {[
              { label: "URL de devolución de llamada", value: cfg.webhook_url },
              { label: "Token de verificación", value: cfg.verify_token ?? "" },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <Label className={LABEL}>{row.label}</Label>
                <div className="flex gap-2">
                  <Input readOnly value={row.value} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copiar(row.label, row.value)}>
                    {copied === row.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
            {!cfg.tiene_token_usuario && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Falta el token de usuario de Meta (FB_USER_ACCESS_TOKEN) con permisos pages_show_list, pages_manage_metadata y leads_retrieval.</span>
              </div>
            )}
            {!cfg.tiene_app_secret && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Sin FB_APP_SECRET no se valida la firma de los eventos de Meta. Se recomienda configurarlo.</span>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}