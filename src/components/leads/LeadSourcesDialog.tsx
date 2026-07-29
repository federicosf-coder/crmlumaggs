import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy, Plus, Power, KeyRound, Facebook, Trash2, History, Link2, Check, RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeadSources, generateApiKey, sha256Hex } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeleteIntegration, useDeleteIntegrationPage, useLeadIntegrationEvents,
  useLeadIntegrationPages, useLeadIntegrations, useSaveIntegration,
  useSaveIntegrationPage, type LeadIntegration,
} from "@/hooks/useLeadIntegrations";

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/lead-intake`;
const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-leads-webhook`;
const HEADER = "bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4 border-b";
const LABEL = "text-[11px] uppercase tracking-wide text-muted-foreground";

function useAutomationsList() {
  return useQuery({
    queryKey: ["automations", "picker"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("automations").select("id, name, is_active").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; is_active: boolean }[];
    },
  });
}

export function LeadSourcesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sources = [] } = useLeadSources();
  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-simple"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("plazas").select("id, nombre").order("nombre");
      return data ?? [];
    },
  });

  // Landing state
  const [nombre, setNombre] = useState("");
  const [dominio, setDominio] = useState("");
  const [plazaId, setPlazaId] = useState("");
  const [whats, setWhats] = useState("");
  const [nuevaKey, setNuevaKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // FB state
  const { data: integrations = [] } = useLeadIntegrations();
  const { data: pages = [] } = useLeadIntegrationPages();
  const { data: automations = [] } = useAutomationsList();
  const saveIntegration = useSaveIntegration();
  const deleteIntegration = useDeleteIntegration();
  const savePage = useSaveIntegrationPage();
  const deletePage = useDeleteIntegrationPage();
  const [editing, setEditing] = useState<Partial<LeadIntegration> | null>(null);
  const [pageDialog, setPageDialog] = useState<LeadIntegration | null>(null);
  const [eventsFor, setEventsFor] = useState<LeadIntegration | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const pagesByIntegration = useMemo(() => {
    const m: Record<string, typeof pages> = {};
    for (const p of pages) (m[p.integration_id] ||= []).push(p);
    return m;
  }, [pages]);

  const crear = async () => {
    if (!nombre.trim() || !plazaId) {
      toast.error("Nombre y plaza son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const key = generateApiKey();
      const hash = await sha256Hex(key);
      const { error } = await (supabase as any).from("lead_sources").insert({
        nombre: nombre.trim(),
        dominio_permitido: dominio.trim() || null,
        api_key_hash: hash,
        api_key_prefix: key.slice(0, 12),
        plaza_id: plazaId,
        notificar_whatsapp: whats.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setNuevaKey(key);
      setNombre(""); setDominio(""); setWhats("");
      qc.invalidateQueries({ queryKey: ["lead-sources"] });
      toast.success("Fuente creada. Copia la clave, no se volverá a mostrar.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo crear la fuente");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, activo: boolean) => {
    await (supabase as any).from("lead_sources").update({ is_active: !activo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["lead-sources"] });
  };

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  const snippet = (key: string) => `fetch("${FUNCTIONS_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": "${key}" },
  body: JSON.stringify({
    nombre: "Nombre del prospecto",
    email: "correo@ejemplo.com",
    telefono: "6861234567",
    empresa: "Empresa S.A. de C.V.",
    mensaje: "Estoy interesado en lubricantes",
    utm_source: "google", utm_campaign: "verano",
    page_url: window.location.href
  })
});`;

  const guardarIntegracion = async () => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className={HEADER}>
          <DialogTitle className="text-lg font-light flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Fuentes de captación de prospectos
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-8">
          {/* ===================== LANDING PAGES ===================== */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Link2 className="h-3 w-3" /> Landings y sitios web (API)
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label className="text-xs">Nombre del sitio / landing</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Landing Chevron Mexicali" /></div>
              <div><Label className="text-xs">Dominio permitido (opcional)</Label>
                <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="lumaggs.com.mx" /></div>
              <div><Label className="text-xs">Plaza por defecto</Label>
                <Select value={plazaId} onValueChange={setPlazaId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona plaza" /></SelectTrigger>
                  <SelectContent>
                    {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label className="text-xs">WhatsApp de aviso (opcional)</Label>
                <Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="526861234567" /></div>
            </div>
            <Button onClick={crear} disabled={saving} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Crear fuente y generar clave
            </Button>
          </div>

          {nuevaKey && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-xs font-medium text-amber-900">
                Guarda esta clave ahora, no se volverá a mostrar:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1 break-all">{nuevaKey}</code>
                <Button size="sm" variant="outline" onClick={() => copiar(nuevaKey)}><Copy className="h-3 w-3" /></Button>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-amber-900">Snippet para la landing</p>
                <pre className="text-[10px] bg-white border rounded p-2 overflow-x-auto">{snippet(nuevaKey)}</pre>
                <Button size="sm" variant="outline" onClick={() => copiar(snippet(nuevaKey))}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar snippet
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fuentes registradas</p>
            <div className="rounded-md border divide-y">
              {sources.length === 0 && <p className="text-xs text-muted-foreground p-4">Aún no hay fuentes.</p>}
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-blue-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.nombre}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.api_key_prefix}••••  {s.dominio_permitido ? `· ${s.dominio_permitido}` : ""}
                      {s.notificar_whatsapp ? ` · WA ${s.notificar_whatsapp}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Activa" : "Revocada"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggle(s.id, s.is_active)}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            <p><strong>Endpoint:</strong> {FUNCTIONS_URL}</p>
            <p>Método POST, header <code>x-api-key</code>. Campos aceptados: nombre, apellido, email, telefono, empresa, mensaje, interes, ciudad, estado, utm_*, page_url. Se ignoran envíos con el campo trampa <code>_hp</code>.</p>
          </div>

          {/* ===================== FACEBOOK LEAD ADS ===================== */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Facebook className="h-3 w-3 text-blue-600" /> Facebook Lead Ads
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1" /> Datos del webhook
                </Button>
                <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["lead_integrations"] }); qc.invalidateQueries({ queryKey: ["lead_integration_pages"] }); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
                </Button>
                <Button size="sm" onClick={() => setEditing({ nombre: "", is_active: true, tipo: "facebook_lead_ads" })}>
                  <Plus className="h-4 w-4 mr-1" /> Nueva integración
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Recepción automática de leads de Facebook. Los prospectos entran a esta misma bandeja con su SLA y notificaciones.
            </p>

            {integrations.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 border rounded-md">Aún no hay integraciones de Facebook. Crea una y registra el ID de la página.</p>
            )}

            <div className="grid gap-3">
              {integrations.map((it) => {
                const itPages = pagesByIntegration[it.id] ?? [];
                return (
                  <div key={it.id} className="rounded-md border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Facebook className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{it.nombre}</p>
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
                            <TableHead className={LABEL}>Token</TableHead>
                            <TableHead className={LABEL}>Estado</TableHead>
                            <TableHead className="text-right"> </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itPages.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">
                              Sin páginas registradas
                            </TableCell></TableRow>
                          )}
                          {itPages.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-light">
                                {p.page_name ?? p.page_id}
                                <span className="block text-[11px] text-muted-foreground">{p.page_id}</span>
                              </TableCell>
                              <TableCell className="font-light">
                                {p.tiene_token
                                  ? <Badge variant="secondary">Configurado</Badge>
                                  : <Badge variant="outline">Pendiente</Badge>}
                              </TableCell>
                              <TableCell className="font-light">
                                {p.is_active ? "Activa" : "Inactiva"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm"
                                  onClick={async () => {
                                    if (!confirm("¿Eliminar esta página?")) return;
                                    await deletePage.mutateAsync(p.id);
                                    toast.success("Página eliminada");
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
                      <Plus className="h-4 w-4 mr-1" /> Registrar página de Facebook
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog: crear/editar integración FB */}
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
            <Button onClick={guardarIntegracion} disabled={saveIntegration.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar página FB */}
      {pageDialog && (
        <PageDialog
          integration={pageDialog}
          onClose={() => setPageDialog(null)}
          onSave={async (row) => {
            await savePage.mutateAsync({ integration_id: pageDialog.id, ...row });
            toast.success("Página registrada");
            setPageDialog(null);
          }}
        />
      )}

      {/* Dialog: historial de eventos */}
      {eventsFor && <EventsDialog integration={eventsFor} onClose={() => setEventsFor(null)} />}

      {/* Dialog: datos del webhook */}
      <WebhookConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </Dialog>
  );
}

function PageDialog({ integration, onClose, onSave }: {
  integration: LeadIntegration;
  onClose: () => void;
  onSave: (row: { page_id: string; page_name: string | null; page_access_token: string | null }) => Promise<void>;
}) {
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Registrar página de Facebook</DialogTitle>
          <DialogDescription className="font-light">{integration.nombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className={LABEL}>ID de la página</Label>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label className={LABEL}>Nombre de la página</Label>
            <Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1">
            <Label className={LABEL}>Token de la página</Label>
            <Input
              type="password" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="Page access token con permiso leads_retrieval"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Se guarda solo del lado del servidor y se usa para descargar el lead desde Meta.
            </p>
          </div>
        </div>
        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || !pageId.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  page_id: pageId.trim(),
                  page_name: pageName.trim() || null,
                  page_access_token: token.trim() || null,
                });
              } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventsDialog({ integration, onClose }: { integration: LeadIntegration; onClose: () => void }) {
  const { data: events = [], isLoading } = useLeadIntegrationEvents(integration.id);
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">
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
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className={HEADER}>
          <DialogTitle className="font-light">Datos del webhook de Meta</DialogTitle>
          <DialogDescription className="font-light">
            Pégalos en tu app de Meta → Webhooks → Página → campo <strong>leadgen</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className={LABEL}>URL de devolución de llamada</Label>
            <div className="flex gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button
                variant="outline" size="icon"
                onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-light">
            El token de verificación es el valor guardado en el secreto <strong>FB_LEADGEN_VERIFY_TOKEN</strong>.
            La firma de los eventos se valida con el App Secret de la misma app de Meta que usa WhatsApp.
          </p>
        </div>
        <DialogFooter className="bg-muted/40 -m-6 mt-4 p-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
