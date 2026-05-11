import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Settings2, Smartphone, Cloud, Search, ArrowUpDown, FileText, Check } from "lucide-react";
import { renderTemplate } from "@/lib/whatsapp";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type WaTemplate = { id: string; name: string; language: string | null; category: string | null; status: string | null; body: string | null };

type Mode = "api" | "local";

export interface WhatsAppPersonalizadoConfig {
  mode: Mode;
  template_id?: string | null;
  template_name?: string | null;
  default_message?: string;
  to_type?: "contacto_principal" | "campo_telefono";
  phone_field?: string;
  require_confirmation?: boolean;
}

export function WhatsAppPersonalizadoEditor({
  cfg, setCfg,
}: {
  cfg: WhatsAppPersonalizadoConfig;
  setCfg: (patch: Partial<WhatsAppPersonalizadoConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = cfg?.mode
    ? cfg.mode === "api"
      ? `Mensaje API · ${cfg.template_name || "(sin plantilla)"}`
      : `Mensaje Local · ${(cfg.default_message || "").slice(0, 40) || "(sin mensaje)"}${(cfg.default_message || "").length > 40 ? "…" : ""}`
    : "Sin configurar";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Configuración</div>
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {cfg?.mode === "local" ? <Smartphone className="h-3.5 w-3.5 text-primary" /> : cfg?.mode === "api" ? <Cloud className="h-3.5 w-3.5 text-primary" /> : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="truncate">{summary}</span>
            {cfg?.require_confirmation !== false && (
              <Badge variant="outline" className="text-[10px] ml-1">Confirmar antes de enviar</Badge>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurar
        </Button>
      </div>
      <ConfigDialog open={open} onOpenChange={setOpen} cfg={cfg} setCfg={setCfg} />
    </div>
  );
}

function ConfigDialog({
  open, onOpenChange, cfg, setCfg,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cfg: WhatsAppPersonalizadoConfig;
  setCfg: (patch: Partial<WhatsAppPersonalizadoConfig>) => void;
}) {
  const [mode, setMode] = useState<Mode>(cfg?.mode || "local");
  const [templateId, setTemplateId] = useState<string>(cfg?.template_id || "");
  const [defaultMessage, setDefaultMessage] = useState<string>(cfg?.default_message || "");
  const [toType, setToType] = useState<"contacto_principal" | "campo_telefono">(cfg?.to_type || "contacto_principal");
  const [phoneField, setPhoneField] = useState<string>(cfg?.phone_field || "");
  const [requireConfirm, setRequireConfirm] = useState<boolean>(cfg?.require_confirmation !== false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_templates")
        .select("id,name,language,category,status,body")
        .order("name", { ascending: true });
      setTemplates((data || []) as WaTemplate[]);
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      setMode(cfg?.mode || "local");
      setTemplateId(cfg?.template_id || "");
      setDefaultMessage(cfg?.default_message || "");
      setToType(cfg?.to_type || "contacto_principal");
      setPhoneField(cfg?.phone_field || "");
      setRequireConfirm(cfg?.require_confirmation !== false);
    }
  }, [open]); // eslint-disable-line

  const selectedTpl = templates.find((t) => t.id === templateId);

  const handleSave = () => {
    setCfg({
      mode,
      template_id: mode === "api" ? templateId || null : null,
      template_name: mode === "api" ? selectedTpl?.name || null : null,
      default_message: mode === "local" ? defaultMessage : undefined,
      to_type: toType,
      phone_field: toType === "campo_telefono" ? phoneField : undefined,
      require_confirmation: requireConfirm,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> Enviar WhatsApp personalizado
            </DialogTitle>
            <DialogDescription>
              Configura el modo de envío. Antes de ejecutarse se solicitará confirmación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Tipo de mensaje</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2 mt-1.5">
                <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "api" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="api" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" /> API</div>
                    <div className="text-xs text-muted-foreground">Envío por la API oficial usando una plantilla aprobada.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "local" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="local" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Local</div>
                    <div className="text-xs text-muted-foreground">Abre WhatsApp Web/móvil con el mensaje precargado.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {mode === "api" && (
              <div className="space-y-2">
                <Label className="text-sm">Plantilla</Label>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {selectedTpl
                        ? <>{selectedTpl.name}{selectedTpl.language ? <span className="text-muted-foreground"> · {selectedTpl.language}</span> : null}{selectedTpl.status ? <span className="text-muted-foreground"> · {selectedTpl.status}</span> : null}</>
                        : <span className="text-muted-foreground">Selecciona una plantilla...</span>}
                    </span>
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </div>
            )}

            {mode === "local" && (
              <div className="space-y-2">
                <Label className="text-sm">Mensaje predeterminado</Label>
                <Textarea
                  rows={5}
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                  placeholder="Hola {{contacto_nombre}}, te escribo de {{empresa_vendedora}}..."
                />
                <p className="text-xs text-muted-foreground">
                  Puedes usar variables como {`{{contacto_nombre}}`}, {`{{empresa_nombre}}`}, {`{{folio_cotizacion}}`}.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Destinatario</Label>
              <Select value={toType} onValueChange={(v) => setToType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacto_principal">Contacto principal</SelectItem>
                  <SelectItem value="campo_telefono">Campo de teléfono</SelectItem>
                </SelectContent>
              </Select>
              {toType === "campo_telefono" && (
                <Input
                  value={phoneField}
                  onChange={(e) => setPhoneField(e.target.value)}
                  placeholder="ej. company.phone o contact.mobile"
                />
              )}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={requireConfirm}
                onChange={(e) => setRequireConfirm(e.target.checked)}
              />
              Confirmar antes de enviar
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar configuración</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        templates={templates}
        selectedId={templateId}
        onSelect={(id) => { setTemplateId(id); setPickerOpen(false); }}
      />
    </>
  );
}

function TemplatePickerDialog({
  open, onOpenChange, templates, selectedId, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: WaTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "language" | "category">("name");
  const [activeId, setActiveId] = useState<string>(selectedId || "");

  useEffect(() => {
    if (open) setActiveId(selectedId || "");
  }, [open, selectedId]);

  const statuses = Array.from(new Set(templates.map((t) => t.status).filter(Boolean))) as string[];
  const languages = Array.from(new Set(templates.map((t) => t.language).filter(Boolean))) as string[];
  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean))) as string[];

  const filtered = templates
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (langFilter !== "all" && t.language !== langFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${t.name || ""} ${t.body || ""} ${t.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = (a[sortBy] || "").toString().toLowerCase();
      const bv = (b[sortBy] || "").toString().toLowerCase();
      return av.localeCompare(bv);
    });

  const active = templates.find((t) => t.id === activeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Seleccionar plantilla de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Busca, filtra y ordena. Selecciona una plantilla para ver su previsualización.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-0 border-t">
          {/* List side */}
          <div className="flex flex-col border-r min-h-[480px]">
            <div className="p-3 space-y-2 border-b bg-muted/30">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, contenido o categoría..."
                  className="pl-8 h-9"
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={langFilter} onValueChange={setLangFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Idioma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los idiomas</SelectItem>
                    {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Ordenar: Nombre</SelectItem>
                    <SelectItem value="status">Ordenar: Estado</SelectItem>
                    <SelectItem value="language">Ordenar: Idioma</SelectItem>
                    <SelectItem value="category">Ordenar: Categoría</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                {filtered.length} de {templates.length} plantillas
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[420px]">
              <ul className="divide-y">
                {filtered.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        onDoubleClick={() => onSelect(t.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-2",
                          isActive && "bg-primary/10 hover:bg-primary/15"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            <span className="truncate">{t.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {(t.body || "").slice(0, 80)}{(t.body || "").length > 80 ? "…" : ""}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {t.status && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.status}</Badge>}
                            {t.language && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t.language}</Badge>}
                            {t.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.category}</Badge>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Sin resultados
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>

          {/* Preview side */}
          <div className="flex flex-col bg-muted/20 min-h-[480px]">
            <div className="p-3 border-b bg-background">
              <div className="text-xs text-muted-foreground">Previsualización</div>
              <div className="text-sm font-medium truncate">
                {active?.name || "Selecciona una plantilla"}
              </div>
              {active && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {active.status && <Badge variant="outline" className="text-[10px]">{active.status}</Badge>}
                  {active.language && <Badge variant="secondary" className="text-[10px]">{active.language}</Badge>}
                  {active.category && <Badge variant="outline" className="text-[10px]">{active.category}</Badge>}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 max-h-[420px]">
              <div className="p-4">
                {active ? (
                  <div className="rounded-lg bg-[#dcf8c6] dark:bg-emerald-900/40 text-foreground p-3 text-sm whitespace-pre-wrap shadow-sm max-w-md">
                    {renderTemplate(active.body || "", {
                      contacto_nombre: "[Nombre del contacto]",
                      empresa_nombre: "[Empresa]",
                      empresa_vendedora: "[Empresa vendedora]",
                      folio_cotizacion: "[Folio]",
                      total_cotizacion: "[Total]",
                      fecha_vencimiento: "[Fecha]",
                      ejecutivo_nombre: "[Ejecutivo]",
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    Selecciona una plantilla del lado izquierdo para previsualizar.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!activeId} onClick={() => onSelect(activeId)}>
            <Check className="h-4 w-4 mr-1" /> Usar esta plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}