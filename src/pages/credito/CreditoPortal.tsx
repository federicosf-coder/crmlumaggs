import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileUp, ShieldCheck, Trash2, AlertCircle, CheckCircle2, FileCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CREDITO_FIRMAS, CREDITO_ESTADO_LABEL, CREDITO_ESTADO_COLOR, CREDITO_TIPO_PERSONA_OPTIONS } from "@/lib/credito";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function callPortal(action: string, token: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("credito-portal", {
    body: { action, token, ...extra },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = String(fr.result || "");
      res(r.split(",")[1] || "");
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

export default function CreditoPortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [parsingCsf, setParsingCsf] = useState(false);
  const [tab, setTab] = useState("datos");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const d = await callPortal("get", token);
      setData(d);
      setForm(d.request || {});
    } catch (e: any) {
      setError(e.message || "No se pudo cargar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive/70" />
            <p className="font-semibold">Liga inválida o expirada</p>
            <p className="text-sm text-muted-foreground">{error || "Verifica el enlace o solicita uno nuevo a tu ejecutivo."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const saveForm = async () => {
    setSaving(true);
    try {
      const allowed = [
        "razon_social","nombre_comercial","rfc","telefono","correo_contacto",
        "domicilio_fiscal","ciudad_fiscal","estado_fiscal","antiguedad",
        "domicilio_comercial","ciudad_comercial","giro_comercial",
        "monto_solicitado","dias_credito",
        "accionistas","escritura_constitutiva","datos_registro","ultima_asamblea","administrador_presidente",
        "datos_bancarios","referencias_comerciales",
        "aval_nombre","aval_direccion","aval_ciudad","aval_relacion","aval_regimen_conyugal",
        "aval_es_distinto",
        "rep_legal_nombre","rep_legal_curp","rep_legal_rfc",
        "lfpiorpi_beneficiario_controlador","lfpiorpi_tiene_documentacion",
      ];
      const fields: Record<string, any> = {};
      for (const k of allowed) if (k in form) fields[k] = form[k];
      await callPortal("update_form", token!, { fields });
      toast.success("Datos guardados");
      load();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (file: File, docTypeId: string | null) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    toast.loading("Subiendo...", { id: "up" });
    try {
      const b64 = await fileToBase64(file);
      await callPortal("upload_doc", token!, {
        doc_type_id: docTypeId, file_b64: b64, filename: file.name, mime: file.type,
      });
      toast.success("Documento subido", { id: "up" });
      load();
    } catch (e: any) {
      toast.error(e.message || "Error al subir", { id: "up" });
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await callPortal("delete_doc", token!, { doc_id: docId });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const parseCsf = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    setParsingCsf(true);
    toast.loading("Leyendo CSF...", { id: "csf" });
    try {
      const b64 = await fileToBase64(file);
      const r = await callPortal("parse_csf", token!, {
        file_b64: b64, filename: file.name, mime: file.type || "application/pdf",
      });
      toast.success(`CSF procesada: ${r?.parsed?.csf_rfc || ""}`, { id: "csf" });
      load();
    } catch (e: any) {
      const msg = e?.message === "csf_no_rfc"
        ? "No se pudo detectar el RFC. Verifica que sea la CSF original del SAT."
        : e?.message === "pdf_parse_failed"
        ? "No se pudo leer el PDF."
        : (e?.message || "Error al procesar CSF");
      toast.error(msg, { id: "csf" });
    } finally {
      setParsingCsf(false);
    }
  };

  const openDoc = async (docId: string) => {
    try {
      const r = await callPortal("signed_url", token!, { doc_id: docId });
      if (r.url) window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const signFirma = async (key: typeof CREDITO_FIRMAS[number]) => {
    const nombre = prompt(`Firma con tu nombre completo (${key.label}):`);
    if (!nombre) return;
    try {
      await callPortal("sign", token!, { tipo: key.key, nombre });
      toast.success("Firma registrada");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const c = CREDITO_ESTADO_COLOR[data.request.estado] || "bg-slate-50 text-slate-700 border-slate-200";
  const comp = data.completeness || {};

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">PROCESADORA DE SERVICIOS MAGG'S</p>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Portal de Solicitud de Crédito
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="font-mono text-xs text-muted-foreground">{data.request.folio}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c}`}>
                {CREDITO_ESTADO_LABEL[data.request.estado] || data.request.estado}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Formulario</p>
                <Progress value={comp.form_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{comp.form_pct || 0}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documentos</p>
                <Progress value={comp.docs_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{comp.docs_received || 0}/{comp.docs_required || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Firmas</p>
                <Progress value={comp.sigs_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{comp.sigs_done || 0}/{comp.sigs_required || 0}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="datos">Mis datos</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
            <TabsTrigger value="firmas">Firmas</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="mt-4">
            <Card><CardContent className="pt-6 space-y-4">
              <Field label="Tipo de persona">
                <Select
                  value={form.tipo_persona ?? form.csf_tipo_persona ?? "moral"}
                  onValueChange={(v) => set("tipo_persona", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDITO_TIPO_PERSONA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Razón social"><Input value={form.razon_social || ""} onChange={(e) => set("razon_social", e.target.value)} /></Field>
                <Field label="Nombre comercial"><Input value={form.nombre_comercial || ""} onChange={(e) => set("nombre_comercial", e.target.value)} /></Field>
                <Field label="RFC"><Input value={form.rfc || ""} onChange={(e) => set("rfc", e.target.value.toUpperCase())} /></Field>
                <Field label="Teléfono"><Input value={form.telefono || ""} onChange={(e) => set("telefono", e.target.value)} /></Field>
                <Field label="Correo de contacto"><Input value={form.correo_contacto || ""} onChange={(e) => set("correo_contacto", e.target.value)} /></Field>
                <Field label="Giro comercial"><Input value={form.giro_comercial || ""} onChange={(e) => set("giro_comercial", e.target.value)} /></Field>
                <Field label="Domicilio fiscal"><Input value={form.domicilio_fiscal || ""} onChange={(e) => set("domicilio_fiscal", e.target.value)} /></Field>
                <Field label="Ciudad / Estado fiscal"><Input value={`${form.ciudad_fiscal || ""}${form.estado_fiscal ? `, ${form.estado_fiscal}` : ""}`} onChange={(e) => {
                  const [c, s] = e.target.value.split(",").map((x) => x.trim());
                  set("ciudad_fiscal", c || ""); set("estado_fiscal", s || "");
                }} /></Field>
                <Field label="Monto solicitado"><Input type="number" value={form.monto_solicitado ?? ""} onChange={(e) => set("monto_solicitado", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Días de crédito"><Input type="number" value={form.dias_credito ?? ""} onChange={(e) => set("dias_credito", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Representante legal"><Input value={form.rep_legal_nombre || ""} onChange={(e) => set("rep_legal_nombre", e.target.value)} /></Field>
                <Field label="CURP RL"><Input value={form.rep_legal_curp || ""} onChange={(e) => set("rep_legal_curp", e.target.value.toUpperCase())} /></Field>
              </div>
              <div className="border-t pt-3 grid sm:grid-cols-2 gap-3">
                <Field label="¿Beneficiario controlador? (LFPIORPI)">
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={!!form.lfpiorpi_beneficiario_controlador} onCheckedChange={(v) => set("lfpiorpi_beneficiario_controlador", v)} />
                    <span className="text-sm">{form.lfpiorpi_beneficiario_controlador ? "Sí" : "No"}</span>
                  </div>
                </Field>
                <Field label="¿Tiene documentación?">
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={!!form.lfpiorpi_tiene_documentacion} onCheckedChange={(v) => set("lfpiorpi_tiene_documentacion", v)} />
                    <span className="text-sm">{form.lfpiorpi_tiene_documentacion ? "Sí" : "No"}</span>
                  </div>
                </Field>
              </div>
              <div className="border-t pt-3 space-y-3">
                <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 leading-snug">
                  <span className="font-medium">Aval / Obligado solidario:</span> En crédito directo siendo Persona Física, el aval debe ser una persona distinta al solicitante. Si eres Persona Moral, el propio representante legal puede ser el aval. Si el aval es otra persona, deberás subir su identificación y comprobante de domicilio.
                </div>
                <Field label="¿El aval es una persona distinta al solicitante / representante legal?">
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={!!form.aval_es_distinto} onCheckedChange={(v) => set("aval_es_distinto", v)} />
                    <span className="text-sm">{form.aval_es_distinto ? "Sí, es otra persona" : "No, es la misma persona"}</span>
                  </div>
                </Field>
                {form.aval_es_distinto && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Nombre del aval"><Input value={form.aval_nombre || ""} onChange={(e) => set("aval_nombre", e.target.value)} /></Field>
                    <Field label="Relación"><Input value={form.aval_relacion || ""} onChange={(e) => set("aval_relacion", e.target.value)} /></Field>
                    <Field label="Dirección"><Input value={form.aval_direccion || ""} onChange={(e) => set("aval_direccion", e.target.value)} /></Field>
                    <Field label="Ciudad"><Input value={form.aval_ciudad || ""} onChange={(e) => set("aval_ciudad", e.target.value)} /></Field>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={saveForm} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar mis datos
                </Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <Card><CardContent className="pt-6 space-y-3">
              {/* CSF autocompletar */}
              <div className="border-2 border-dashed rounded-md p-3 bg-violet-50/40">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-violet-600" />
                      Constancia de Situación Fiscal (autocompletar)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sube tu CSF en PDF y completaremos automáticamente RFC, razón social, régimen, domicilio fiscal y más.
                    </p>
                    {data.request.csf_parseado && (
                      <p className="text-[11px] mt-1 text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        CSF ya procesada · RFC {data.request.csf_rfc}
                      </p>
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-violet-600 text-white hover:bg-violet-700">
                    {parsingCsf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                    Subir CSF
                    <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={parsingCsf}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCsf(f); e.currentTarget.value = ""; }} />
                  </label>
                </div>
              </div>
              {(data.docTypes as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay documentos solicitados.</p>
              ) : (
                (data.docTypes as any[])
                  .filter((dt) => !(dt.aplica_si_aval_distinto && !form.aval_es_distinto))
                  .map((dt) => {
                  const items = (data.docs as any[]).filter((d) => d.doc_type_id === dt.id);
                  return (
                    <div key={dt.id} className="border rounded-md p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-sm">{dt.nombre} {dt.requerido && <span className="text-red-600">*</span>}</p>
                          {dt.instrucciones_cliente && <p className="text-xs text-muted-foreground">{dt.instrucciones_cliente}</p>}
                        </div>
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-accent">
                          <FileUp className="h-3.5 w-3.5" />Subir
                          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f, dt.id); e.currentTarget.value = ""; }} />
                        </label>
                      </div>
                      {items.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {items.map((it: any) => (
                            <div key={it.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                              <button onClick={() => openDoc(it.id)} className="truncate text-left hover:underline flex-1">{it.nombre_archivo}</button>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                it.estado === "recibido" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                it.estado === "rechazado" ? "bg-red-50 text-red-700 border-red-200" :
                                "bg-slate-50 text-slate-700 border-slate-200"
                              }`}>{it.estado}</span>
                              {it.subido_por_cliente && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteDoc(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              )}
                            </div>
                          ))}
                          {items.some((i: any) => i.estado === "rechazado") && (
                            <p className="text-xs text-red-600 mt-1">Algún archivo fue rechazado. Vuelve a subirlo corrigiendo el problema indicado por el equipo.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="firmas" className="mt-4">
            <Card><CardContent className="pt-6 space-y-3">
              {CREDITO_FIRMAS.map((f) => {
                const fecha = data.request[f.fechaCol];
                const nombre = data.request[f.nombreCol];
                return (
                  <div key={f.key} className="flex items-center justify-between gap-2 border rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className={`h-5 w-5 ${fecha ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                      <div>
                        <p className="font-medium text-sm">{f.label}</p>
                        {fecha ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            {nombre} · {format(new Date(fecha), "dd/MM/yyyy HH:mm")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Pendiente</p>
                        )}
                      </div>
                    </div>
                    {!fecha && <Button size="sm" onClick={() => signFirma(f)}>Firmar</Button>}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2">
                Al firmar declaras bajo protesta de decir verdad que la información proporcionada es correcta.
              </p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[10px] text-muted-foreground/70 pt-4">
          ¿Necesitas ayuda? Contacta a tu ejecutivo.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
