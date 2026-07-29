import { useMemo, useState } from "react";
import { Plus, Facebook, RefreshCw, Trash2, Link2, History, Copy, Check } from "lucide-react";
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
  useDeleteIntegration, useDeleteIntegrationPage, useLeadIntegrationEvents,
  useLeadIntegrationPages, useLeadIntegrations, useSaveIntegration,
  useSaveIntegrationPage, type LeadIntegration,
} from "@/hooks/useLeadIntegrations";

const HEADER = "bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-4 p-6 border-b";
const LABEL = "text-[11px] uppercase tracking-wide text-muted-foreground";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-leads-webhook`;

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
  const { data: sources = [] } = useLeadSources();
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
          Recepción automática de Facebook Lead Ads. Los prospectos entran a esta misma bandeja con su SLA y notificaciones.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Link2 className="h-4 w-4 mr-1" /> Datos del webhook
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchPages(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setEditing({ nombre: "", is_active: true, tipo: "facebook_lead_ads" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva integración
          </Button>
        </div>
      </div>

      {integrations.length === 0 && !isLoading && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground font-light">
          Aún no hay integraciones. Crea una y registra el ID de la página de Facebook.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {integrations.map((it) => {
          const itPages = pagesByIntegration[it.id] ?? [];
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
                        <TableHead className={LABEL}>Token</TableHead>
                        <TableHead className={LABEL}>Estado</TableHead>
                        <TableHead className="text-right"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itPages.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
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
                            <Button
                              variant="ghost" size="sm"
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

      {eventsFor && <EventsDialog integration={eventsFor} onClose={() => setEventsFor(null)} />}
      <WebhookConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
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
