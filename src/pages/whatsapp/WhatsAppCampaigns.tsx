import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Megaphone, Play, Plus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { MarketingPromoUpload, PromoPlaceholderHint } from "@/components/whatsapp/MarketingPromoUpload";
import { WhatsAppChatPreview } from "@/components/whatsapp/WhatsAppChatPreview";

type Campaign = {
  id: string;
  nombre: string;
  template_name: string;
  template_language: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type Template = {
  id: string;
  name: string;
  language: string;
  status: string;
  body: string | null;
  source_body: string | null;
  variable_map: string[] | null;
  header_type: string | null;
  header_image_url: string | null;
  rejection_reason: string | null;
};

type Account = {
  id: string;
  business_phone_number_id: string;
  label: string;
  display_phone: string | null;
  is_active: boolean;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp_phone: string | null;
  mobile: string | null;
  company_id: string | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "running") return "secondary";
  if (s === "failed") return "destructive";
  return "outline";
};

export default function WhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tplName, setTplName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [linePhoneId, setLinePhoneId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("id,nombre,template_name,template_language,status,total_recipients,sent_count,failed_count,skipped_count,created_at,started_at,finished_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setCampaigns((data ?? []) as Campaign[]);
  };

  useEffect(() => {
    load();
    const loadTpls = () =>
      supabase
        .from("whatsapp_templates")
        .select("id,name,language,status,body,source_body,variable_map,header_type,header_image_url,rejection_reason")
        .order("name")
        .then(({ data }) => setTemplates(((data ?? []) as unknown) as Template[]));
    loadTpls();
    supabase
      .from("whatsapp_accounts")
      .select("id,business_phone_number_id,label,display_phone,is_active")
      .eq("is_active", true)
      .order("label")
      .then(({ data }) => {
        const accs = ((data ?? []) as unknown) as Account[];
        setAccounts(accs);
        if (!linePhoneId && accs[0]) setLinePhoneId(accs[0].business_phone_number_id);
      });
    supabase
      .from("contacts")
      .select("id,first_name,last_name,whatsapp_phone,mobile,company_id")
      .eq("is_active", true)
      .order("first_name")
      .limit(2000)
      .then(({ data }) => setContacts((data ?? []) as Contact[]));

    const ch = supabase
      .channel("wa-campaigns")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_campaigns" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_templates" }, loadTpls)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligible = useMemo(() => {
    return contacts.filter((c) => c.whatsapp_phone || c.mobile);
  }, [contacts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return eligible;
    return eligible.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) ||
      (c.whatsapp_phone || c.mobile || "").toLowerCase().includes(s),
    );
  }, [eligible, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const reset = () => {
    setName("");
    setTplName("");
    setSearch("");
    setSelected(new Set());
    setHeaderImageUrl(null);
    setVariables({});
  };

  const selectedTpl = useMemo(
    () => templates.find((t) => t.name === tplName) || null,
    [templates, tplName],
  );
  const requiresImage = selectedTpl?.header_type === "IMAGE";
  const isApproved = selectedTpl?.status === "APPROVED";
  const variableKeys: string[] = Array.isArray(selectedTpl?.variable_map)
    ? (selectedTpl!.variable_map as string[])
    : [];
  const missingVars = variableKeys.filter((k) => !(variables[k] ?? "").trim());
  const selectedLine = accounts.find((a) => a.business_phone_number_id === linePhoneId);

  const createAndLaunch = async () => {
    if (!name.trim() || !tplName) {
      toast.error("Nombre y plantilla son obligatorios");
      return;
    }
    if (!isApproved) {
      toast.error("Solo puedes lanzar plantillas APROBADAS por Meta");
      return;
    }
    if (requiresImage && !headerImageUrl) {
      toast.error("Esta plantilla requiere una imagen de encabezado");
      return;
    }
    if (missingVars.length > 0) {
      toast.error(`Faltan variables: ${missingVars.join(", ")}`);
      return;
    }
    if (!linePhoneId) {
      toast.error("Selecciona la línea de salida (Tijuana o Mexicali)");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos un destinatario");
      return;
    }
    const tpl = selectedTpl;
    if (!tpl) {
      toast.error("Plantilla no encontrada");
      return;
    }
    setCreating(true);
    const { data: ures } = await supabase.auth.getUser();
    const { data: camp, error: cErr } = await supabase
      .from("whatsapp_campaigns")
      .insert({
        nombre: name.trim(),
        template_id: tpl.id,
        template_name: tpl.name,
        template_language: tpl.language,
        status: "draft",
        total_recipients: selected.size,
        created_by: ures.user?.id,
        header_image_url: headerImageUrl,
        business_phone_number_id: linePhoneId,
        template_variables: Object.keys(variables).length > 0 ? variables : null,
      })
      .select("id")
      .single();
    if (cErr || !camp) {
      setCreating(false);
      toast.error(cErr?.message ?? "No se pudo crear");
      return;
    }
    const recips = Array.from(selected).map((cid) => {
      const c = contacts.find((x) => x.id === cid)!;
      return {
        campaign_id: camp.id,
        contact_id: cid,
        wa_phone: (c.whatsapp_phone || c.mobile || "").replace(/\D/g, ""),
        status: "pending",
      };
    }).filter((r) => r.wa_phone);
    const { error: rErr } = await supabase.from("whatsapp_campaign_recipients").insert(recips);
    if (rErr) {
      setCreating(false);
      toast.error(rErr.message);
      return;
    }
    const { error: lErr } = await supabase.functions.invoke("whatsapp-campaign-runner", {
      body: { campaign_id: camp.id },
    });
    setCreating(false);
    if (lErr) {
      toast.error(lErr.message ?? "No se pudo lanzar");
      return;
    }
    toast.success(`Campaña lanzada con ${recips.length} destinatarios`);
    setOpen(false);
    reset();
    load();
  };

  const tplStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Aprobada</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Rechazada</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Campañas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Envíos masivos con plantillas aprobadas. Solo plantillas — Meta no permite texto libre en masivos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nueva campaña</Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nueva campaña</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo abril 2026" />
                </div>
                <div>
                  <Label>Plantilla</Label>
                  <Select value={tplName} onValueChange={(v) => { setTplName(v); setVariables({}); setHeaderImageUrl(null); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>
                      ) : templates.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name} ({t.language}) — {t.status}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedTpl && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {tplStatusBadge(selectedTpl.status)}
                      {selectedTpl.status === "REJECTED" && selectedTpl.rejection_reason && (
                        <span className="text-xs text-destructive">{selectedTpl.rejection_reason}</span>
                      )}
                      {selectedTpl.status === "PENDING" && (
                        <span className="text-xs text-muted-foreground">Meta está revisando esta plantilla. El envío se habilitará al aprobarse.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Línea de salida</Label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay líneas configuradas en Ajustes &gt; WhatsApp.</p>
                ) : (
                  <Select value={linePhoneId} onValueChange={setLinePhoneId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona línea…" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.business_phone_number_id}>
                          {a.label}{a.display_phone ? ` · ${a.display_phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {requiresImage && (
                <div className="space-y-2">
                  <Label>Imagen del encabezado</Label>
                  <MarketingPromoUpload value={headerImageUrl} onChange={setHeaderImageUrl} />
                  <PromoPlaceholderHint />
                </div>
              )}

              {variableKeys.length > 0 && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                  <Label className="text-xs uppercase text-muted-foreground">Variables del mensaje</Label>
                  {variableKeys.map((k) => (
                    <div key={k} className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground truncate">{k}</span>
                      <Input
                        placeholder={`Valor para ${k}`}
                        value={variables[k] ?? ""}
                        onChange={(e) => setVariables({ ...variables, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">El sistema convierte estos campos a {`{{1}}, {{2}}…`} automáticamente al enviar a Meta.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Destinatarios ({selected.size} de {filtered.length})</Label>
                  <Button size="sm" variant="outline" onClick={toggleAll}>
                    {selected.size === filtered.length && filtered.length > 0 ? "Deseleccionar" : "Seleccionar todos"}
                  </Button>
                </div>
                <Input
                  placeholder="Buscar por nombre o teléfono…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-72 border rounded">
                  {filtered.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No hay contactos con WhatsApp/móvil.
                    </div>
                  ) : filtered.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 border-b cursor-pointer hover:bg-accent/40">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-muted-foreground">+{(c.whatsapp_phone || c.mobile || "").replace(/\D/g, "")}</div>
                      </div>
                    </label>
                  ))}
                </ScrollArea>
              </div>
              </div>

              {/* Preview lateral */}
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Vista previa</Label>
                <WhatsAppChatPreview
                  imageUrl={headerImageUrl}
                  bodyText={selectedTpl?.source_body || selectedTpl?.body || "Selecciona una plantilla para ver la vista previa…"}
                  variables={variables}
                  contactName="Cliente"
                  linePhone={selectedLine?.label}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={createAndLaunch}
                disabled={
                  creating ||
                  !isApproved ||
                  (requiresImage && !headerImageUrl) ||
                  missingVars.length > 0 ||
                  !linePhoneId ||
                  selected.size === 0
                }
              >
                <Play className="h-4 w-4 mr-2" />
                {creating
                  ? "Lanzando…"
                  : !isApproved
                  ? "Plantilla no aprobada"
                  : `Lanzar a ${selected.size} destinatarios`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Fallidos</TableHead>
              <TableHead className="text-right">Omitidos</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Aún no hay campañas.
                </TableCell>
              </TableRow>
            ) : campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell className="text-sm">{c.template_name} ({c.template_language})</TableCell>
                <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">{c.total_recipients}</TableCell>
                <TableCell className="text-right text-primary">{c.sent_count}</TableCell>
                <TableCell className="text-right text-destructive">{c.failed_count}</TableCell>
                <TableCell className="text-right text-muted-foreground">{c.skipped_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}