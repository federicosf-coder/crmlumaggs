import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _sb } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Mail, ExternalLink, Send, ChevronDown, ChevronUp, FileText, Phone, UserPlus, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { normalizePhoneForWhatsApp, buildWaMeLink } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;

interface FacturaLite {
  id: string;
  empresa_id: string;
  numero_factura: string | null;
  saldo_pendiente_cobranza: number | null;
  fecha_vencimiento: string | null;
  total: number | null;
  empresa_vendedora?: string | null;
}

interface Props {
  factura: FacturaLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "whatsapp" | "email";
  empresaNombre?: string;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

function renderPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\s*([\w_]+)\s*\}/g, (_m, k) => (vars[k] != null ? vars[k] : `{${k}}`))
             .replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, k) => (vars[k] != null ? vars[k] : `{{${k}}}`));
}

export function CobranzaComunicacionDialog({ factura, open, onOpenChange, defaultTab = "whatsapp", empresaNombre }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"whatsapp" | "email">(defaultTab);
  useEffect(() => { setTab(defaultTab); }, [defaultTab, open]);

  // Contactos de la empresa
  const { data: contactos } = useQuery({
    queryKey: ["cobranza-comm-contactos", factura?.empresa_id],
    enabled: !!factura?.empresa_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, phone, mobile, whatsapp_phone, email, email2, is_active")
        .eq("company_id", factura!.empresa_id)
        .eq("is_active", true)
        .order("first_name");
      return (data || []) as any[];
    },
  });

  // Otras facturas pendientes del cliente
  const { data: otrasFacturas } = useQuery({
    queryKey: ["cobranza-comm-otras", factura?.empresa_id, factura?.id],
    enabled: !!factura?.empresa_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("documentos")
        .select("id, numero_factura, fecha_vencimiento, saldo_pendiente_cobranza, total")
        .eq("tipo_documento", "factura")
        .eq("empresa_id", factura!.empresa_id)
        .neq("id", factura!.id)
        .neq("estatus_factura", "cancelada")
        .gt("saldo_pendiente_cobranza", 0)
        .order("fecha_vencimiento");
      return (data || []) as any[];
    },
  });

  // Plantillas
  const { data: waTemplates } = useQuery({
    queryKey: ["cobranza-comm-templates-wa"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, body")
        .eq("type", "whatsapp")
        .eq("category", "cobranza")
        .eq("is_active", true)
        .order("name");
      return (data || []) as any[];
    },
  });
  const { data: emailTemplates } = useQuery({
    queryKey: ["cobranza-comm-templates-email"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("templates")
        .select("id, name, subject, body")
        .eq("type", "email")
        .eq("category", "cobranza")
        .eq("is_active", true)
        .order("name");
      return (data || []) as any[];
    },
  });

  // WhatsApp accounts y plantillas Meta
  const { data: waAccounts } = useQuery({
    queryKey: ["cobranza-comm-wa-accounts"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("business_phone_number_id, label, display_phone, waba_id, is_active")
        .eq("is_active", true);
      return (data || []) as any[];
    },
  });
  const { data: metaTemplates } = useQuery({
    queryKey: ["cobranza-comm-meta-templates"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, name, language, body, status, business_phone_number_id")
        .eq("status", "APPROVED")
        .order("name");
      return (data || []) as any[];
    },
  });

  // Estado del form
  const [contactoId, setContactoId] = useState<string>("");
  const [telefonoManual, setTelefonoManual] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [incEstadoCuenta, setIncEstadoCuenta] = useState(true);
  const [incEstaFactura, setIncEstaFactura] = useState(true);
  const [incOtras, setIncOtras] = useState(false);
  const [otrasOpen, setOtrasOpen] = useState(false);
  const [otrasSel, setOtrasSel] = useState<Record<string, boolean>>({});

  const [waMetodo, setWaMetodo] = useState<"api" | "local">("local");
  const [waTemplateId, setWaTemplateId] = useState<string>("");
  const [waMsg, setWaMsg] = useState("");
  const [waAccountId, setWaAccountId] = useState<string>("");
  const [metaTemplateId, setMetaTemplateId] = useState<string>("");

  const [emailTemplateId, setEmailTemplateId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const contactoSel = useMemo(
    () => (contactos || []).find((c) => c.id === contactoId) || null,
    [contactos, contactoId],
  );

  useEffect(() => {
    if (!open || !contactos) return;
    if (!contactoId && contactos.length > 0) setContactoId(contactos[0].id);
  }, [open, contactos, contactoId]);

  useEffect(() => {
    if (contactoSel?.email) setEmailTo(contactoSel.email);
  }, [contactoSel]);

  // Reset al cambiar de factura
  useEffect(() => {
    if (!open) {
      setContactoId(""); setTelefonoManual(""); setEmailTo(""); setEmailCc("");
      setIncEstadoCuenta(true); setIncEstaFactura(true); setIncOtras(false); setOtrasSel({});
      setWaMetodo("local"); setWaTemplateId(""); setWaMsg(""); setWaAccountId(""); setMetaTemplateId("");
      setEmailTemplateId(""); setEmailSubject(""); setEmailBody("");
    }
  }, [open]);

  const vars = useMemo<Record<string, string>>(() => {
    const saldo = Number(factura?.saldo_pendiente_cobranza || 0);
    const nombreContacto = contactoSel ? `${contactoSel.first_name || ""} ${contactoSel.last_name || ""}`.trim() : "";
    return {
      nombre_contacto: nombreContacto,
      contacto_nombre: nombreContacto,
      empresa_nombre: empresaNombre || "",
      numero_factura: factura?.numero_factura || "",
      folio_cotizacion: factura?.numero_factura || "",
      saldo_pendiente: fmtMoney(saldo),
      total_factura: fmtMoney(Number(factura?.total || 0)),
      fecha_vencimiento: factura?.fecha_vencimiento || "",
    };
  }, [factura, contactoSel, empresaNombre]);

  const onSelectWaTemplate = (id: string) => {
    setWaTemplateId(id);
    const t = (waTemplates || []).find((x) => x.id === id);
    if (t) setWaMsg(renderPlaceholders(t.body || "", vars));
  };
  const onSelectEmailTemplate = (id: string) => {
    setEmailTemplateId(id);
    const t = (emailTemplates || []).find((x) => x.id === id);
    if (t) {
      setEmailSubject(renderPlaceholders(t.subject || "", vars));
      setEmailBody(renderPlaceholders(t.body || "", vars));
    }
  };

  const telefonoDestino = useMemo(() => {
    const raw = telefonoManual || contactoSel?.whatsapp_phone || contactoSel?.mobile || contactoSel?.phone || "";
    return normalizePhoneForWhatsApp(raw) || "";
  }, [telefonoManual, contactoSel]);

  async function registrarActividad(canal: "whatsapp" | "email", descripcion: string) {
    if (!user || !factura) return;
    try {
      await supabase.from("crm_activities").insert({
        company_id: factura.empresa_id,
        contact_id: contactoSel?.id || null,
        user_id: user.id,
        type: canal,
        title: `Cobranza · Factura ${factura.numero_factura || ""}`.trim(),
        description: descripcion,
        activity_date: new Date().toISOString(),
        documento_id: factura.id,
      });
    } catch (e) {
      console.warn("[CobranzaComunicacion] no se pudo registrar actividad", e);
    }
  }

  const otrasIncluidas = useMemo(
    () => (incOtras ? (otrasFacturas || []).filter((f) => otrasSel[f.id]) : []),
    [incOtras, otrasFacturas, otrasSel],
  );

  const docsResumen = (): string => {
    const partes: string[] = [];
    if (incEstadoCuenta) partes.push("Estado de cuenta (PDF)");
    if (incEstaFactura) partes.push(`Factura ${factura?.numero_factura || ""}`);
    if (otrasIncluidas.length > 0) partes.push(`+${otrasIncluidas.length} factura(s) adicionales`);
    return partes.join(" · ");
  };

  // ---- Envíos ----
  const enviarWaLocal = async () => {
    if (!telefonoDestino) { toast.error("Falta teléfono del destinatario"); return; }
    if (!waMsg.trim()) { toast.error("El mensaje está vacío"); return; }
    window.open(buildWaMeLink(telefonoDestino, waMsg), "_blank", "noopener");
    await registrarActividad("whatsapp", `WhatsApp local a ${telefonoDestino}. ${docsResumen()}`);
    toast.success("WhatsApp abierto en pestaña nueva");
    onOpenChange(false);
  };

  const enviarWaApi = async () => {
    if (!telefonoDestino) { toast.error("Falta teléfono del destinatario"); return; }
    if (!waAccountId) { toast.error("Selecciona la cuenta de WhatsApp"); return; }
    if (!metaTemplateId) { toast.error("Selecciona una plantilla aprobada por Meta"); return; }
    const tpl = (metaTemplates || []).find((t) => t.id === metaTemplateId);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          business_phone_number_id: waAccountId,
          to: telefonoDestino,
          type: "template",
          template: { name: tpl?.name, language: tpl?.language || "es_MX" },
          company_id: factura?.empresa_id,
          contact_id: contactoSel?.id || null,
          documento_id: factura?.id,
        },
      });
      if (error) throw error;
      await registrarActividad("whatsapp", `WhatsApp API · plantilla "${tpl?.name}" a ${telefonoDestino}. ${docsResumen()}`);
      toast.success("Mensaje enviado por API");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Error al enviar: ${e?.message || e}`);
    }
  };

  const enviarEmail = async () => {
    if (!emailTo.trim()) { toast.error("Falta el correo destinatario"); return; }
    if (!emailSubject.trim()) { toast.error("Falta el asunto"); return; }
    await registrarActividad(
      "email",
      `Email preparado a ${emailTo}${emailCc ? ` (cc: ${emailCc})` : ""}. Asunto: "${emailSubject}". ${docsResumen()}`,
    );
    toast.success("Correo preparado. La integración de envío estará disponible próximamente.");
    onOpenChange(false);
  };

  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Comunicación de cobranza
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-light">
            {empresaNombre ? <>{empresaNombre} · </> : null}
            Factura <span className="font-mono">{factura.numero_factura || factura.id.slice(0, 8)}</span> · Saldo {fmtMoney(Number(factura.saldo_pendiente_cobranza || 0))}
          </DialogDescription>
          {factura.empresa_id && (
            <a
              href={`/directory?tab=companies&select=${factura.empresa_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 w-fit"
            >
              <ExternalLink className="h-3 w-3" /> Ver perfil de empresa
            </a>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="whatsapp"><MessageCircle className="h-4 w-4 mr-1.5 text-green-600" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1.5 text-blue-600" /> Correo electrónico</TabsTrigger>
            </TabsList>

            {/* ============ WHATSAPP ============ */}
            <TabsContent value="whatsapp" className="space-y-5 mt-0">
              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Método de envío</Label>
                <RadioGroup value={waMetodo} onValueChange={(v) => setWaMetodo(v as any)} className="grid sm:grid-cols-2 gap-2">
                  <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="local" className="mt-0.5" />
                    <div className="text-sm font-light">
                      <div className="font-medium">Abrir en WhatsApp local</div>
                      <div className="text-xs text-muted-foreground">Genera link wa.me y abre el navegador</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="api" className="mt-0.5" />
                    <div className="text-sm font-light">
                      <div className="font-medium">Enviar por API (Business)</div>
                      <div className="text-xs text-muted-foreground">Envía desde el número oficial</div>
                    </div>
                  </label>
                </RadioGroup>
              </section>

              <ContactoSelector
                contactos={contactos || []}
                contactoId={contactoId}
                onChange={setContactoId}
                modo="phone"
                telefonoManual={telefonoManual}
                setTelefonoManual={setTelefonoManual}
                empresaId={factura.empresa_id}
                onContactCreated={(id) => {
                  setContactoId(id);
                  queryClient.invalidateQueries({ queryKey: ["cobranza-comm-contactos", factura.empresa_id] });
                }}
              />

              <DocumentosSection
                factura={factura}
                otrasFacturas={otrasFacturas || []}
                incEstadoCuenta={incEstadoCuenta} setIncEstadoCuenta={setIncEstadoCuenta}
                incEstaFactura={incEstaFactura} setIncEstaFactura={setIncEstaFactura}
                incOtras={incOtras} setIncOtras={setIncOtras}
                otrasOpen={otrasOpen} setOtrasOpen={setOtrasOpen}
                otrasSel={otrasSel} setOtrasSel={setOtrasSel}
              />

              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla</Label>
                <Select value={waTemplateId} onValueChange={onSelectWaTemplate}>
                  <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {(waTemplates || []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {(waTemplates || []).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>}
                  </SelectContent>
                </Select>
                <Textarea
                  value={waMsg}
                  onChange={(e) => setWaMsg(e.target.value)}
                  placeholder="Escribe el mensaje…"
                  className="min-h-[140px] font-light"
                />
              </section>

              {waMetodo === "api" && (
                <section className="space-y-2 border-t pt-4">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cuenta de envío</Label>
                  <Select value={waAccountId} onValueChange={setWaAccountId}>
                    <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                    <SelectContent>
                      {(waAccounts || []).map((a) => (
                        <SelectItem key={a.business_phone_number_id} value={a.business_phone_number_id}>
                          {a.label} {a.display_phone ? `· ${a.display_phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla Meta (aprobada)</Label>
                  <Select value={metaTemplateId} onValueChange={setMetaTemplateId}>
                    <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla" /></SelectTrigger>
                    <SelectContent>
                      {(metaTemplates || [])
                        .filter((t) => !waAccountId || !t.business_phone_number_id || t.business_phone_number_id === waAccountId)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name} <Badge variant="outline" className="ml-2 text-[10px]">{t.language}</Badge></SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </section>
              )}
            </TabsContent>

            {/* ============ EMAIL ============ */}
            <TabsContent value="email" className="space-y-5 mt-0">
              <ContactoSelector
                contactos={contactos || []}
                contactoId={contactoId}
                onChange={setContactoId}
                modo="email"
                empresaId={factura.empresa_id}
                onContactCreated={(id) => {
                  setContactoId(id);
                  queryClient.invalidateQueries({ queryKey: ["cobranza-comm-contactos", factura.empresa_id] });
                }}
              />
              <section className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Para</Label>
                  <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="h-9 font-light" placeholder="cliente@correo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">CC (opcional)</Label>
                  <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} className="h-9 font-light" placeholder="cc@correo.com" />
                </div>
              </section>

              <DocumentosSection
                factura={factura}
                otrasFacturas={otrasFacturas || []}
                incEstadoCuenta={incEstadoCuenta} setIncEstadoCuenta={setIncEstadoCuenta}
                incEstaFactura={incEstaFactura} setIncEstaFactura={setIncEstaFactura}
                incOtras={incOtras} setIncOtras={setIncOtras}
                otrasOpen={otrasOpen} setOtrasOpen={setOtrasOpen}
                otrasSel={otrasSel} setOtrasSel={setOtrasSel}
              />

              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plantilla</Label>
                <Select value={emailTemplateId} onValueChange={onSelectEmailTemplate}>
                  <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona plantilla (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {(emailTemplates || []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {(emailTemplates || []).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sin plantillas</div>}
                  </SelectContent>
                </Select>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Asunto</Label>
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="h-9 font-light" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cuerpo</Label>
                  <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="min-h-[180px] font-light" />
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "whatsapp" && waMetodo === "local" && (
            <Button onClick={enviarWaLocal} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir WhatsApp
            </Button>
          )}
          {tab === "whatsapp" && waMetodo === "api" && (
            <Button onClick={enviarWaApi} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-4 w-4 mr-1.5" /> Enviar por API
            </Button>
          )}
          {tab === "email" && (
            <Button onClick={enviarEmail}>
              <Mail className="h-4 w-4 mr-1.5" /> Enviar correo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
function ContactoSelector({
  contactos, contactoId, onChange, modo, telefonoManual, setTelefonoManual,
}: {
  contactos: any[];
  contactoId: string;
  onChange: (id: string) => void;
  modo: "phone" | "email";
  telefonoManual?: string;
  setTelefonoManual?: (v: string) => void;
}) {
  const sel = contactos.find((c) => c.id === contactoId);
  const phone = sel?.whatsapp_phone || sel?.mobile || sel?.phone || "";
  const email = sel?.email || "";
  return (
    <section className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Contacto destinatario</Label>
      {contactos.length === 0 ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
          Esta empresa no tiene contactos activos registrados.
        </div>
      ) : (
        <Select value={contactoId} onValueChange={onChange}>
          <SelectTrigger className="h-9 font-light"><SelectValue placeholder="Selecciona contacto" /></SelectTrigger>
          <SelectContent>
            {contactos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {(`${c.first_name || ""} ${c.last_name || ""}`).trim() || "(sin nombre)"} —{" "}
                <span className="text-muted-foreground">
                  {modo === "phone" ? (c.whatsapp_phone || c.mobile || c.phone || "sin teléfono") : (c.email || "sin email")}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {modo === "phone" && sel && !phone && setTelefonoManual && (
        <div className="space-y-1.5">
          <div className="text-xs text-amber-700">Este contacto no tiene teléfono. Ingrésalo manualmente:</div>
          <Input
            value={telefonoManual || ""}
            onChange={(e) => setTelefonoManual(e.target.value)}
            placeholder="55 1234 5678"
            className="h-9 font-light"
          />
        </div>
      )}
      {modo === "email" && sel && !email && (
        <div className="text-xs text-amber-700">Este contacto no tiene correo. Edita el campo "Para" abajo.</div>
      )}
    </section>
  );
}

function DocumentosSection({
  factura, otrasFacturas,
  incEstadoCuenta, setIncEstadoCuenta,
  incEstaFactura, setIncEstaFactura,
  incOtras, setIncOtras,
  otrasOpen, setOtrasOpen,
  otrasSel, setOtrasSel,
}: {
  factura: FacturaLite;
  otrasFacturas: any[];
  incEstadoCuenta: boolean; setIncEstadoCuenta: (v: boolean) => void;
  incEstaFactura: boolean; setIncEstaFactura: (v: boolean) => void;
  incOtras: boolean; setIncOtras: (v: boolean) => void;
  otrasOpen: boolean; setOtrasOpen: (v: boolean) => void;
  otrasSel: Record<string, boolean>; setOtrasSel: (v: Record<string, boolean>) => void;
}) {
  return (
    <section className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Documentos a incluir</Label>
      <div className="space-y-2 border rounded-md p-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={incEstadoCuenta} onCheckedChange={(v) => setIncEstadoCuenta(!!v)} className="mt-0.5" />
          <div className="text-sm font-light">
            <div className="font-medium flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Estado de cuenta</div>
            <div className="text-xs text-muted-foreground">El PDF se generará y se enviará como adjunto.</div>
          </div>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={incEstaFactura} onCheckedChange={(v) => setIncEstaFactura(!!v)} className="mt-0.5" />
          <div className="text-sm font-light">
            <div className="font-medium">Esta factura</div>
            <div className="text-xs text-muted-foreground">
              {factura.numero_factura || factura.id.slice(0, 8)} · {fmtMoney(Number(factura.saldo_pendiente_cobranza || 0))} · vence {factura.fecha_vencimiento || "—"}
            </div>
          </div>
        </label>
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={incOtras} onCheckedChange={(v) => setIncOtras(!!v)} className="mt-0.5" />
            <div className="text-sm font-light flex-1">
              <div className="font-medium flex items-center justify-between">
                <span>Otras facturas pendientes ({otrasFacturas.length})</span>
                {otrasFacturas.length > 0 && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setOtrasOpen(!otrasOpen); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {otrasOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {otrasOpen ? "Ocultar" : "Ver lista"}
                  </button>
                )}
              </div>
            </div>
          </label>
          {incOtras && otrasOpen && otrasFacturas.length > 0 && (
            <div className="mt-2 ml-6 max-h-40 overflow-y-auto border rounded-md divide-y">
              {otrasFacturas.map((f) => (
                <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={!!otrasSel[f.id]} onCheckedChange={(v) => setOtrasSel({ ...otrasSel, [f.id]: !!v })} />
                  <span className="font-mono">{f.numero_factura || f.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">vence {f.fecha_vencimiento || "—"}</span>
                  <span className="ml-auto font-medium">{fmtMoney(Number(f.saldo_pendiente_cobranza || 0))}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const fmtMoneyHelper = fmtMoney; // re-export to avoid TS unused warnings
export default CobranzaComunicacionDialog;