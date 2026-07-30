import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, FileBadge, Plus, Send, AlertTriangle, CheckCircle2, Clock, Trash2, Phone, Link2, MessageSquare, Ban, Search, Pencil } from "lucide-react";
import {
  compileTemplateBody,
  buildExampleValues,
  extractNamedPlaceholders,
} from "@/lib/whatsappTemplateVars";
import { MarketingPromoUpload, PromoPlaceholderHint } from "@/components/whatsapp/MarketingPromoUpload";
import { WhatsAppChatPreview } from "@/components/whatsapp/WhatsAppChatPreview";

type ButtonKind = "quick_reply" | "opt_out" | "phone" | "url";
type TemplateButton = {
  kind: ButtonKind;
  text: string;
  phone?: string;
  url?: string;
};

const BUTTON_KIND_OPTIONS: { value: ButtonKind; label: string; icon: typeof MessageSquare }[] = [
  { value: "quick_reply", label: "Respuesta rápida", icon: MessageSquare },
  { value: "opt_out", label: "Darse de baja (Opt-out)", icon: Ban },
  { value: "phone", label: "Llamar al número", icon: Phone },
  { value: "url", label: "Visitar sitio web", icon: Link2 },
];

type Template = {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  body: string | null;
  source_body: string | null;
  variable_map: string[] | null;
  last_synced_at: string | null;
  header_type?: string | null;
  header_image_url?: string | null;
  header_video_url?: string | null;
  rejection_reason?: string | null;
  buttons?: TemplateButton[] | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "APPROVED") return "default";
  if (s === "PENDING" || s === "IN_APPEAL" || s === "PENDING_DELETION") return "secondary";
  if (s === "REJECTED" || s === "DISABLED") return "destructive";
  return "outline";
};

export default function WhatsAppTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("es_MX");
  const [bodyText, setBodyText] = useState("");
  const [headerType, setHeaderType] = useState<"NONE" | "IMAGE" | "VIDEO" | "TEXT">("NONE");
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const placeholders = useMemo(() => extractNamedPlaceholders(bodyText), [bodyText]);
  const compiled = useMemo(() => compileTemplateBody(bodyText), [bodyText]);
  const examples = useMemo(() => buildExampleValues(placeholders), [placeholders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      [t.name, t.body, t.source_body, t.category, t.status, t.language]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("id,name,language,category,status,body,source_body,variable_map,last_synced_at,header_type,header_image_url,header_video_url,rejection_reason,buttons")
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data ?? []) as unknown as Template[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("wa-templates-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_templates" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-sync-templates", { body: {} });
    setSyncing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${data?.upserted ?? 0} plantillas sincronizadas`);
    load();
  };

  const resetForm = () => {
    setName("");
    setCategory("UTILITY");
    setLanguage("es_MX");
    setBodyText("");
    setHeaderType("NONE");
    setHeaderImageUrl(null);
    setHeaderVideoUrl(null);
    setHeaderText("");
    setButtons([]);
  };

  const startEdit = (t: Template) => {
    setName(t.name);
    setCategory(t.category || "UTILITY");
    setLanguage(t.language || "es_MX");
    setBodyText(t.source_body || t.body || "");
    const ht = (t.header_type || "NONE").toUpperCase();
    setHeaderType((["NONE", "IMAGE", "VIDEO", "TEXT"].includes(ht) ? ht : "NONE") as typeof headerType);
    setHeaderImageUrl(t.header_image_url ?? null);
    setHeaderVideoUrl(t.header_video_url ?? null);
    setHeaderText("");
    setButtons(Array.isArray(t.buttons) ? t.buttons : []);
    setOpen(true);
  };

  const submit = async () => {
    if (!name.trim() || !bodyText.trim()) {
      toast.error("Completa nombre y cuerpo");
      return;
    }
    if (headerType === "IMAGE" && !headerImageUrl) {
      toast.error("Sube una imagen para el encabezado");
      return;
    }
    if (headerType === "VIDEO" && !headerVideoUrl) {
      toast.error("Sube un video MP4 para el encabezado");
      return;
    }
    if (headerType === "TEXT" && !headerText.trim()) {
      toast.error("Escribe el texto del encabezado");
      return;
    }
    // Validar botones
    for (const b of buttons) {
      if (!b.text.trim()) { toast.error("Cada botón requiere texto"); return; }
      if (b.text.length > 25) { toast.error("Cada botón admite máx. 25 caracteres"); return; }
      if (b.kind === "phone" && !b.phone?.trim()) { toast.error("Botón de llamada requiere teléfono"); return; }
      if (b.kind === "url" && !b.url?.trim()) { toast.error("Botón de URL requiere sitio web"); return; }
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-create-template", {
      body: {
        name, body: bodyText, category, language,
        header_type: headerType,
        header_image_url: headerType === "IMAGE" ? headerImageUrl : null,
        header_video_url: headerType === "VIDEO" ? headerVideoUrl : null,
        header_text: headerType === "TEXT" ? headerText : null,
        buttons,
      },
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success(`Plantilla enviada a Meta (estatus: ${(data as any)?.status ?? "PENDING"})`);
    setOpen(false);
    resetForm();
    load();
  };

  const addButton = (kind: ButtonKind) => {
    if (buttons.length >= 3) {
      toast.error("Máximo 3 botones por plantilla (límite de Meta)");
      return;
    }
    const defaults: Record<ButtonKind, TemplateButton> = {
      quick_reply: { kind: "quick_reply", text: "Quiero más info" },
      opt_out: { kind: "opt_out", text: "No me interesa" },
      phone: { kind: "phone", text: "Llamar", phone: "+52" },
      url: { kind: "url", text: "Ver sitio", url: "https://" },
    };
    setButtons((bs) => [...bs, defaults[kind]]);
  };

  const updateButton = (i: number, patch: Partial<TemplateButton>) => {
    setButtons((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const removeButton = (i: number) => {
    setButtons((bs) => bs.filter((_, idx) => idx !== i));
  };

  const statusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />APPROVED</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />REJECTED</Badge>;
    if (s === "PENDING") return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />PENDING</Badge>;
    return <Badge variant={statusVariant(s)}>{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBadge className="h-6 w-6 text-primary" /> Plantillas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Solo plantillas APPROVED pueden enviarse. Usa <code>{"{nombre_cliente}"}</code>,{" "}
            <code>{"{folio_cotizacion}"}</code>, etc. — se convierten a <code>{"{{1}}, {{2}}"}</code> al enviarse a Meta.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar estatus
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva plantilla
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Cuerpo</TableHead>
              <TableHead>Sincronizada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay plantillas. Crea una nueva o pulsa "Sincronizar estatus".
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>
                    {statusBadge(t.status)}
                    {t.status === "REJECTED" && t.rejection_reason && (
                      <div className="text-[11px] text-destructive mt-1 max-w-[220px]">{t.rejection_reason}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {Array.isArray(t.variable_map) && t.variable_map.length > 0
                      ? t.variable_map.map((v, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-muted">
                            {`{{${i + 1}}}`}={v}
                          </span>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">
                    {t.header_image_url && (
                      <img src={t.header_image_url} alt="" className="h-10 w-16 object-cover rounded mb-1" />
                    )}
                    <div className="truncate">{t.body || "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.last_synced_at ? new Date(t.last_synced_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva plantilla WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label>Nombre</Label>
                <Input
                  placeholder="seguimiento_cotizacion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Se normalizará a minúsculas y guiones bajos.</p>
              </div>
              <div className="space-y-1">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es_MX">es_MX</SelectItem>
                    <SelectItem value="es">es</SelectItem>
                    <SelectItem value="en_US">en_US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">UTILITY</SelectItem>
                  <SelectItem value="MARKETING">MARKETING</SelectItem>
                  <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Encabezado</Label>
              <Select value={headerType} onValueChange={(v) => setHeaderType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin encabezado</SelectItem>
                  <SelectItem value="IMAGE">Imagen</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="TEXT">Texto</SelectItem>
                </SelectContent>
              </Select>
              {headerType === "IMAGE" && (
                <>
                  <MarketingPromoUpload value={headerImageUrl} onChange={setHeaderImageUrl} />
                  <PromoPlaceholderHint />
                </>
              )}
              {headerType === "VIDEO" && (
                <>
                  <MarketingPromoUpload
                    value={headerVideoUrl}
                    onChange={setHeaderVideoUrl}
                    kind="video"
                    aspectRatio="16/9"
                  />
                  <p className="text-xs text-muted-foreground">
                    MP4 · máx 16 MB. Meta valida la plantilla con este video como ejemplo.
                  </p>
                </>
              )}
              {headerType === "TEXT" && (
                <Input
                  placeholder="Encabezado de la plantilla"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>Cuerpo</Label>
              <Textarea
                rows={6}
                placeholder="Hola {nombre_cliente}, te compartimos la cotización {folio_cotizacion} por {total_cotizacion}."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usa placeholders nombrados entre llaves. Se convertirán automáticamente al formato Meta.
              </p>
            </div>

            {placeholders.length > 0 && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Mapa de variables</div>
                <div className="flex flex-wrap gap-1">
                  {placeholders.map((p, i) => (
                    <Badge key={p} variant="secondary">{`{{${i + 1}}}`} = {p}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  <div className="font-semibold mb-1">Vista enviada a Meta:</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{compiled.body}</pre>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">Ejemplos generados:</span> {examples.join(" · ")}
                </div>
              </div>
            )}

            {/* Botones interactivos */}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Botones interactivos</Label>
                  <p className="text-xs text-muted-foreground">Hasta 3 botones. Si la plantilla es de campañas marketing, agrega un botón de Opt-out.</p>
                </div>
                <Select value="" onValueChange={(v) => addButton(v as ButtonKind)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={buttons.length >= 3 ? "Máximo 3 botones" : "+ Añadir botón"} />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_KIND_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          disabled={opt.value === "opt_out" && buttons.some((b) => b.kind === "opt_out")}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" /> {opt.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {buttons.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin botones configurados.</p>
              ) : (
                <div className="space-y-2">
                  {buttons.map((b, i) => {
                    const meta = BUTTON_KIND_OPTIONS.find((x) => x.value === b.kind);
                    const Icon = meta?.icon ?? MessageSquare;
                    return (
                      <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-start rounded-md border bg-muted/20 p-2">
                        <Badge variant="outline" className="mt-1.5 inline-flex items-center gap-1">
                          <Icon className="h-3 w-3" /> {meta?.label}
                        </Badge>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Texto del botón (máx. 25)</Label>
                          <Input
                            value={b.text}
                            maxLength={25}
                            onChange={(e) => updateButton(i, { text: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          {b.kind === "phone" && (
                            <>
                              <Label className="text-[11px]">Teléfono (con +código país)</Label>
                              <Input
                                placeholder="+526641234567"
                                value={b.phone || ""}
                                onChange={(e) => updateButton(i, { phone: e.target.value })}
                              />
                            </>
                          )}
                          {b.kind === "url" && (
                            <>
                              <Label className="text-[11px]">URL del sitio</Label>
                              <Input
                                placeholder="https://www.lumaggs.com.mx"
                                value={b.url || ""}
                                onChange={(e) => updateButton(i, { url: e.target.value })}
                              />
                            </>
                          )}
                          {b.kind === "opt_out" && (
                            <p className="text-[11px] text-muted-foreground pt-5">
                              Al presionarlo, el contacto se marcará como “No contactar”.
                            </p>
                          )}
                          {b.kind === "quick_reply" && (
                            <p className="text-[11px] text-muted-foreground pt-5">
                              Respuesta rápida que el cliente envía al pulsarlo.
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(i)}
                          className="text-destructive"
                          aria-label="Eliminar botón"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Vista previa</Label>
            <WhatsAppChatPreview
              imageUrl={headerType === "IMAGE" ? headerImageUrl : null}
              bodyText={bodyText || "Escribe el cuerpo del mensaje…"}
              contactName="Cliente"
            />
          </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={submit} disabled={creating || !name.trim() || !bodyText.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {creating ? "Enviando…" : "Crear y enviar a Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
