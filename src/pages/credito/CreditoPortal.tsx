import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, Save, FileUp, ShieldCheck, Trash2, AlertCircle, CheckCircle2, FileCheck,
  Wand2, Building2, IdCard, Landmark, FileText, Home, ScrollText, BookOpen, Camera,
  MapPin, Receipt, Paperclip, Check, Plus, ChevronDown, ChevronUp, Printer, Upload, Files, PenSquare, X, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CREDITO_FIRMAS, CREDITO_ESTADO_LABEL, CREDITO_ESTADO_COLOR, CREDITO_TIPO_PERSONA_OPTIONS,
} from "@/lib/credito";
import { TEMPLATE_LABELS } from "@/lib/creditoTemplates";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const DOC_PALETTE: Record<string, { icon: any; bg: string; border: string; iconBg: string; iconColor: string; btn: string }> = {
  "Constancia de Situación Fiscal (CSF)": { icon: FileText, bg: "bg-gradient-to-br from-blue-50 to-sky-50", border: "border-blue-200", iconBg: "bg-blue-100", iconColor: "text-blue-700", btn: "border-blue-300 text-blue-700 hover:bg-blue-100" },
  "Opinión de Cumplimiento SAT (32-D)": { icon: FileCheck, bg: "bg-gradient-to-br from-emerald-50 to-teal-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconColor: "text-emerald-700", btn: "border-emerald-300 text-emerald-700 hover:bg-emerald-100" },
  "Identificación oficial": { icon: IdCard, bg: "bg-gradient-to-br from-violet-50 to-purple-50", border: "border-violet-200", iconBg: "bg-violet-100", iconColor: "text-violet-700", btn: "border-violet-300 text-violet-700 hover:bg-violet-100" },
  "Comprobante de domicilio": { icon: Home, bg: "bg-gradient-to-br from-amber-50 to-yellow-50", border: "border-amber-200", iconBg: "bg-amber-100", iconColor: "text-amber-700", btn: "border-amber-300 text-amber-700 hover:bg-amber-100" },
  "Acta Constitutiva": { icon: ScrollText, bg: "bg-gradient-to-br from-indigo-50 to-blue-50", border: "border-indigo-200", iconBg: "bg-indigo-100", iconColor: "text-indigo-700", btn: "border-indigo-300 text-indigo-700 hover:bg-indigo-100" },
  "Poder del Representante Legal": { icon: BookOpen, bg: "bg-gradient-to-br from-rose-50 to-pink-50", border: "border-rose-200", iconBg: "bg-rose-100", iconColor: "text-rose-700", btn: "border-rose-300 text-rose-700 hover:bg-rose-100" },
  "Fotos del negocio": { icon: Camera, bg: "bg-gradient-to-br from-cyan-50 to-sky-50", border: "border-cyan-200", iconBg: "bg-cyan-100", iconColor: "text-cyan-700", btn: "border-cyan-300 text-cyan-700 hover:bg-cyan-100" },
  "Croquis Google Maps": { icon: MapPin, bg: "bg-gradient-to-br from-lime-50 to-green-50", border: "border-lime-200", iconBg: "bg-lime-100", iconColor: "text-lime-700", btn: "border-lime-300 text-lime-700 hover:bg-lime-100" },
  "Estado de cuenta bancario": { icon: Receipt, bg: "bg-gradient-to-br from-orange-50 to-amber-50", border: "border-orange-200", iconBg: "bg-orange-100", iconColor: "text-orange-700", btn: "border-orange-300 text-orange-700 hover:bg-orange-100" },
  "Registro Público de la Propiedad": { icon: Landmark, bg: "bg-gradient-to-br from-slate-50 to-gray-50", border: "border-slate-300", iconBg: "bg-slate-200", iconColor: "text-slate-700", btn: "border-slate-300 text-slate-700 hover:bg-slate-100" },
  __default: { icon: Building2, bg: "bg-gradient-to-br from-neutral-50 to-stone-50", border: "border-neutral-200", iconBg: "bg-neutral-100", iconColor: "text-neutral-700", btn: "border-neutral-300 text-neutral-700 hover:bg-neutral-100" },
};

const GROUP_COLOR: Record<string, string> = {
  fiscal: "text-blue-700",
  identidad: "text-violet-700",
  domicilio: "text-amber-700",
  legal: "text-indigo-700",
  negocio: "text-cyan-700",
  bancario: "text-orange-700",
  aval: "text-rose-700",
  otros: "text-slate-700",
};

function groupFor(dt: any): { key: string; label: string } {
  const n = (dt.nombre || "").toLowerCase();
  if (dt.aplica_si_aval_distinto || n.includes("aval")) return { key: "aval", label: "Aval / Obligado solidario" };
  if (n.includes("csf") || n.includes("situación fiscal") || n.includes("opinión") || n.includes("32-d")) return { key: "fiscal", label: "Documentos fiscales" };
  if (n.includes("identificación") || n.includes("pasaporte") || n.includes("ine")) return { key: "identidad", label: "Identidad del representante" };
  if (n.includes("comprobante de domicilio")) return { key: "domicilio", label: "Domicilio" };
  if (n.includes("acta") || n.includes("poder") || n.includes("registro público")) return { key: "legal", label: "Sociedad y legal" };
  if (n.includes("foto") || n.includes("croquis") || n.includes("maps")) return { key: "negocio", label: "Negocio" };
  if (n.includes("bancario") || n.includes("cuenta")) return { key: "bancario", label: "Bancarios" };
  return { key: "otros", label: "Otros" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
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

function Repeater({ title, value, onChange, fields, minRequired }: {
  title: string;
  value: any[];
  onChange: (v: any[]) => void;
  fields: { key: string; label: string; type?: string }[];
  minRequired?: number;
}) {
  const list = Array.isArray(value) ? value : [];
  const faltan = minRequired ? Math.max(0, minRequired - list.length) : 0;
  const cumple = !minRequired || list.length >= minRequired;
  const update = (i: number, k: string, v: any) => {
    const next = list.slice();
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };
  const add = () => onChange([...list, {}]);
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">{title}</p>
          {minRequired ? (
            <p className={`text-[11px] ${cumple ? "text-emerald-700" : "text-amber-700"}`}>
              {cumple
                ? `Mínimo cumplido (${list.length}/${minRequired}).`
                : `Mínimo ${minRequired} requeridas — faltan ${faltan} (${list.length}/${minRequired}).`}
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin registros.</p>
      ) : (
        <div className="space-y-2">
          {list.map((row, i) => (
            <div key={i} className={`grid gap-2 items-end border rounded-md p-2 ${fields.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                  <Input
                    type={f.type || "text"}
                    inputMode={f.type === "number" ? "numeric" : undefined}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? 1 : undefined}
                    value={row?.[f.key] ?? ""}
                    onChange={(e) => update(i, f.key, f.type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
                  />
                </div>
              ))}
              <div className={`flex justify-end ${fields.length === 2 ? "sm:col-span-2" : "sm:col-span-3"}`}>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BcStepHeader({ open, title, badge }: { open: boolean; title: string; badge: { label: string; variant: "pending" | "ok" | "muted" } }) {
  const badgeCls =
    badge.variant === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : badge.variant === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <div className="flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 min-w-0">
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
        <span className="text-sm font-medium truncate">{title}</span>
      </div>
      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeCls} shrink-0`}>{badge.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beneficiario Controlador wizard (portal version) — usa callPortal('update_form')
// ---------------------------------------------------------------------------
function PortalBeneficiarioControladorSteps({
  form, set, token, onSaved,
}: { form: any; set: (k: string, v: any) => void; token: string; onSaved: () => void }) {
  const bcExiste: boolean | null =
    form.lfpiorpi_beneficiario_controlador == null ? null : !!form.lfpiorpi_beneficiario_controlador;
  const bcConfirmado = !!form.bc_confirmacion_no_existe;
  const rlIsBc: boolean | null =
    form.bc_es_representante_legal == null ? null : !!form.bc_es_representante_legal;
  const bcTipo: "fisica" | "moral" | null =
    form.bc_tipo_persona === "fisica" || form.bc_tipo_persona === "moral" ? form.bc_tipo_persona : null;
  const bcData: any = form.bc_data && typeof form.bc_data === "object" ? form.bc_data : {};
  const setBc = (k: string, v: any) => set("bc_data", { ...bcData, [k]: v });

  const [step1Open, setStep1Open] = useState<boolean>(bcExiste === null);
  const [step2Open, setStep2Open] = useState<boolean>(bcExiste === true && rlIsBc === null);
  const [step3Open, setStep3Open] = useState<boolean>(bcExiste === true && rlIsBc === false);
  const [savingBc, setSavingBc] = useState(false);

  useEffect(() => { setStep1Open(bcExiste === null); }, [bcExiste]);
  useEffect(() => { if (bcExiste === true) setStep2Open(rlIsBc === null); else setStep2Open(false); }, [bcExiste, rlIsBc]);
  useEffect(() => { setStep3Open(bcExiste === true && rlIsBc === false); }, [bcExiste, rlIsBc]);

  const step1Badge = useMemo(() => {
    if (bcExiste === null) return { label: "Pendiente", variant: "pending" as const };
    if (bcExiste === false) return bcConfirmado ? { label: "No aplica", variant: "muted" as const } : { label: "No existe", variant: "pending" as const };
    return { label: "Sí existe", variant: "ok" as const };
  }, [bcExiste, bcConfirmado]);

  const step2Badge = useMemo(() => {
    if (rlIsBc === null) return { label: "Pendiente", variant: "pending" as const };
    return rlIsBc ? { label: "Es el Representante Legal", variant: "ok" as const } : { label: "Es otra persona", variant: "ok" as const };
  }, [rlIsBc]);

  const step3Badge = useMemo(() => {
    if (bcTipo === null) return { label: "Pendiente", variant: "pending" as const };
    return { label: bcTipo === "fisica" ? "Persona física" : "Persona moral", variant: "ok" as const };
  }, [bcTipo]);

  const setExiste = (v: boolean) => {
    set("lfpiorpi_beneficiario_controlador", v);
    if (!v) set("bc_es_representante_legal", null);
    else set("bc_confirmacion_no_existe", false);
  };

  const saveNoExiste = async () => {
    setSavingBc(true);
    try {
      await callPortal("update_form", token, {
        fields: {
          lfpiorpi_beneficiario_controlador: false,
          bc_confirmacion_no_existe: true,
          bc_es_representante_legal: null,
        },
      });
      toast.success("Guardado: no existe Beneficiario Controlador");
      set("bc_confirmacion_no_existe", true);
      setStep1Open(false);
      onSaved();
    } catch (e: any) { toast.error(e?.message || "No se pudo guardar"); }
    finally { setSavingBc(false); }
  };

  const setRlIsBc = (v: boolean) => {
    set("bc_es_representante_legal", v);
    setStep2Open(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Beneficiario Controlador</p>

      {/* Paso 1 */}
      <Collapsible open={step1Open} onOpenChange={setStep1Open} className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left">
            <BcStepHeader open={step1Open} title="Beneficiario Controlador" badge={step1Badge} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            <p className="text-xs text-muted-foreground">
              Conforme al Art. 18 de la Ley de Beneficiario Controlador es necesario identificar si existe un Beneficiario Controlador en esta operación.
            </p>
            <RadioGroup value={bcExiste === null ? "" : bcExiste ? "si" : "no"} onValueChange={(v) => setExiste(v === "si")} className="gap-2">
              <label htmlFor="bc-existe-si" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${bcExiste === true ? "border-violet-300 bg-violet-50/40" : ""}`}>
                <RadioGroupItem value="si" id="bc-existe-si" className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Sí existe</p>
                  <p className="text-xs text-muted-foreground">Hay una persona física o persona moral que controla o se beneficia de esta operación</p>
                </div>
              </label>
              <label htmlFor="bc-existe-no" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${bcExiste === false ? "border-violet-300 bg-violet-50/40" : ""}`}>
                <RadioGroupItem value="no" id="bc-existe-no" className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">No existe</p>
                  <p className="text-xs text-muted-foreground">La operación no tiene Beneficiario Controlador identificable</p>
                </div>
              </label>
            </RadioGroup>
            {bcExiste === false && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={bcConfirmado} onCheckedChange={(v) => set("bc_confirmacion_no_existe", !!v)} className="mt-0.5" />
                  <span className="text-xs">Confirmo bajo protesta de decir verdad que no existe Beneficiario Controlador</span>
                </label>
                <div className="flex justify-end">
                  <Button type="button" size="sm" disabled={!bcConfirmado || savingBc} onClick={saveNoExiste}>
                    {savingBc ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Paso 2 */}
      {bcExiste === true && (
        <Collapsible open={step2Open} onOpenChange={setStep2Open} className="rounded-lg border bg-card">
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left">
              <BcStepHeader open={step2Open} title="Representante Legal como BC" badge={step2Badge} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 space-y-3 border-t">
              <p className="text-xs text-muted-foreground">¿El Representante Legal de la solicitud es también el Beneficiario Controlador?</p>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Representante Legal</p>
                <p className="truncate">{[form.rep_legal_nombre || "—", form.rep_legal_rfc || "—", form.rep_legal_curp || "—"].join(" · ")}</p>
              </div>
              <RadioGroup value={rlIsBc === null ? "" : rlIsBc ? "si" : "no"} onValueChange={(v) => setRlIsBc(v === "si")} className="gap-2">
                <label htmlFor="bc-rl-si" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${rlIsBc === true ? "border-violet-300 bg-violet-50/40" : ""}`}>
                  <RadioGroupItem value="si" id="bc-rl-si" className="mt-0.5" />
                  <div className="space-y-0.5"><p className="text-sm font-medium">Sí, es el mismo</p><p className="text-xs text-muted-foreground">Se usarán sus datos para prellenar el formulario</p></div>
                </label>
                <label htmlFor="bc-rl-no" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${rlIsBc === false ? "border-violet-300 bg-violet-50/40" : ""}`}>
                  <RadioGroupItem value="no" id="bc-rl-no" className="mt-0.5" />
                  <div className="space-y-0.5"><p className="text-sm font-medium">No, es otra persona o empresa</p><p className="text-xs text-muted-foreground">Se llenará el formulario con datos distintos</p></div>
                </label>
              </RadioGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Paso 3 */}
      {bcExiste === true && rlIsBc === false && (
        <Collapsible open={step3Open} onOpenChange={setStep3Open} className="rounded-lg border bg-card">
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left">
              <BcStepHeader open={step3Open} title="Datos del Beneficiario Controlador" badge={step3Badge} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 space-y-4 border-t">
              <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tipo de Beneficiario Controlador</p>
              <RadioGroup value={bcTipo ?? ""} onValueChange={(v) => set("bc_tipo_persona", v)} className="grid sm:grid-cols-2 gap-2">
                <label htmlFor="bc-tipo-fisica" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${bcTipo === "fisica" ? "border-violet-300 bg-violet-50/40" : ""}`}>
                  <RadioGroupItem value="fisica" id="bc-tipo-fisica" className="mt-0.5" />
                  <div className="space-y-0.5"><p className="text-sm font-medium">Persona física</p><p className="text-xs text-muted-foreground">Individuo (Anexo 3)</p></div>
                </label>
                <label htmlFor="bc-tipo-moral" className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 ${bcTipo === "moral" ? "border-violet-300 bg-violet-50/40" : ""}`}>
                  <RadioGroupItem value="moral" id="bc-tipo-moral" className="mt-0.5" />
                  <div className="space-y-0.5"><p className="text-sm font-medium">Persona moral</p><p className="text-xs text-muted-foreground">Empresa / entidad (Anexo 4)</p></div>
                </label>
              </RadioGroup>
              {bcTipo && (
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <Field label={bcTipo === "fisica" ? "Nombre completo" : "Razón social"}>
                    <Input value={bcData.nombre || ""} onChange={(e) => setBc("nombre", e.target.value)} />
                  </Field>
                  <Field label="RFC"><Input value={bcData.rfc || ""} onChange={(e) => setBc("rfc", e.target.value.toUpperCase())} /></Field>
                  {bcTipo === "fisica" && (
                    <>
                      <Field label="CURP"><Input value={bcData.curp || ""} onChange={(e) => setBc("curp", e.target.value.toUpperCase())} /></Field>
                      <Field label="Fecha de nacimiento"><Input type="date" value={bcData.fecha_nacimiento || ""} onChange={(e) => setBc("fecha_nacimiento", e.target.value || null)} /></Field>
                      <Field label="País de nacimiento"><Input value={bcData.pais_nacimiento || ""} onChange={(e) => setBc("pais_nacimiento", e.target.value)} /></Field>
                      <Field label="Nacionalidad"><Input value={bcData.nacionalidad || ""} onChange={(e) => setBc("nacionalidad", e.target.value)} /></Field>
                    </>
                  )}
                  <Field label="Porcentaje de control / beneficio"><Input value={bcData.porcentaje ?? ""} onChange={(e) => setBc("porcentaje", e.target.value)} placeholder="ej. 51%" /></Field>
                  <div className="sm:col-span-2">
                    <Field label="Domicilio"><Input value={bcData.domicilio || ""} onChange={(e) => setBc("domicilio", e.target.value)} placeholder="Calle, número, colonia, ciudad, estado, CP" /></Field>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const SHOW_BC_PORTAL = false;

export default function CreditoPortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [parsingCsf, setParsingCsf] = useState(false);
  const [tab, setTab] = useState("docs");
  const [formTab, setFormTab] = useState("empresa");
  const [signingKey, setSigningKey] = useState<string | null>(null);
  const [signingName, setSigningName] = useState("");
  const [multiPicker, setMultiPicker] = useState<{ file: File; b64: string }[] | null>(null);
  const [multiPickerMap, setMultiPickerMap] = useState<Record<number, string>>({});
  const [autofilling, setAutofilling] = useState<string | null>(null);
  const [autofillCollapsed, setAutofillCollapsed] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(true);

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

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const OPT_IN_DOC_COLS: Record<string, string> = {
    "Poder del Representante Legal": "poder_representante_requerido",
    "Registro Público de la Propiedad": "registro_publico_requerido",
    "Estado de cuenta bancario": "estado_cuenta_requerido",
  };
  const isOptInDoc = (nombre: string) => nombre in OPT_IN_DOC_COLS;
  const optInChecked = (nombre: string) => {
    const col = OPT_IN_DOC_COLS[nombre];
    return col ? (form as any)[col] === true : false;
  };
  const toggleOptInDoc = async (nombre: string) => {
    const col = OPT_IN_DOC_COLS[nombre];
    if (!col || !token) return;
    const actual = (form as any)[col] === true;
    const nuevo = !actual;
    set(col, nuevo);
    try {
      await callPortal("update_form", token, { fields: { [col]: nuevo } });
      toast.success(nuevo ? `${nombre} marcado como requerido` : `${nombre} marcado como no requerido`);
      load();
    } catch (e: any) {
      set(col, actual);
      toast.error(e.message || "No se pudo guardar");
    }
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const allowed = [
        "tipo_persona",
        "razon_social","nombre_comercial","rfc","telefono","correo_contacto","client_nombre_contacto",
        "domicilio_fiscal","ciudad_fiscal","estado_fiscal","antiguedad",
        "domicilio_comercial","ciudad_comercial","estado_comercial","giro_comercial",
        "monto_solicitado","dias_credito",
        "accionistas","escritura_constitutiva","datos_registro","ultima_asamblea","administrador_presidente",
        "datos_bancarios","referencias_comerciales",
        "aval_nombre","aval_direccion","aval_ciudad","aval_relacion","aval_regimen_conyugal","aval_es_distinto",
        "rep_legal_nombre","rep_legal_curp","rep_legal_rfc","rep_legal_tipo_id","rep_legal_num_id",
        "rep_legal_fecha_nacimiento","rep_legal_pais_nacimiento","rep_legal_vencimiento_id",
        "lfpiorpi_beneficiario_controlador","lfpiorpi_tiene_documentacion",
        "bc_data","bc_es_representante_legal","bc_confirmacion_no_existe","bc_tipo_persona",
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
        : e?.message === "pdf_parse_failed" ? "No se pudo leer el PDF."
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
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmSign = async () => {
    if (!signingKey || !signingName.trim()) return;
    try {
      await callPortal("sign", token!, { tipo: signingKey, nombre: signingName.trim() });
      toast.success("Firma registrada");
      setSigningKey(null);
      setSigningName("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // === Firma helpers (table + multi-upload) ===
  const openFirmaPdf = (key: string) => {
    if (!token) { toast.error("Solicitud no cargada"); return; }
    window.open(`/portal/credito/${token}/imprimir/${key}`, "_blank", "noopener");
  };

  const uploadFirmaDoc = async (
    f: { key: string; label: string; nombreCol: string },
    file: File,
    nombreOverride?: string,
  ) => {
    const nombre = (nombreOverride ?? prompt(`Nombre de quien firmó "${f.label}":`, (form as any)[f.nombreCol] || "") ?? "").trim();
    if (!nombre) { toast.error("Captura el nombre del firmante"); return; }
    toast.loading("Subiendo...", { id: `firma-${f.key}` });
    try {
      const b64 = await fileToBase64(file);
      await callPortal("upload_firma", token!, {
        tipo: f.key, file_b64: b64, filename: file.name, mime: file.type || "application/pdf", nombre,
      });
      toast.success(`${f.label}: firma registrada`, { id: `firma-${f.key}` });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error al subir", { id: `firma-${f.key}` });
    }
  };

  const classifyFirmaByFilename = (name: string, validKeys: string[]): string | null => {
    const n = name.toLowerCase();
    const rules: Array<[RegExp, string]> = [
      [/(galsa|phillips)/, "solicitud-galsa"],
      [/(lumaggs|chevron)/, "solicitud-lumaggs"],
      [/(buro|bur[oó])/, "buro"],
      [/(confidencial)/, "confidencialidad"],
      [/(subsistencia|poderes)/, "subsistencia"],
      [/(licita|l[ií]cita|lfpiorpi|procedencia)/, "lfpiorpi"],
      [/(solicitud)/, "solicitud"],
    ];
    for (const [rx, key] of rules) {
      if (rx.test(n) && validKeys.includes(key)) return key;
    }
    return null;
  };

  const handleMultiFirmaFiles = async (files: File[], allFirmas: Array<{ key: string; label: string; nombreCol: string }>) => {
    const validKeys = allFirmas.map((f) => f.key);
    const items = await Promise.all(files.map(async (file) => {
      const guess = classifyFirmaByFilename(file.name, validKeys);
      return { file, guess };
    }));
    const unresolved = items.filter((i) => !i.guess);
    if (unresolved.length > 0) {
      // Open picker
      const b64Items = await Promise.all(items.map(async (i) => ({ file: i.file, b64: await fileToBase64(i.file) })));
      const initialMap: Record<number, string> = {};
      items.forEach((it, idx) => { if (it.guess) initialMap[idx] = it.guess; });
      setMultiPickerMap(initialMap);
      setMultiPicker(b64Items);
      return;
    }
    // All classified: upload sequentially
    let ok = 0;
    for (const it of items) {
      const firma = allFirmas.find((x) => x.key === it.guess!);
      if (!firma) continue;
      const defaultName = (form as any)[firma.nombreCol] || form.rep_legal_nombre || form.razon_social || "Firmante";
      try {
        const b64 = await fileToBase64(it.file);
        await callPortal("upload_firma", token!, {
          tipo: firma.key, file_b64: b64, filename: it.file.name, mime: it.file.type || "application/pdf", nombre: defaultName,
        });
        ok++;
      } catch (e: any) {
        toast.error(`${firma.label}: ${e?.message || "error"}`);
      }
    }
    if (ok > 0) toast.success(`${ok} documento(s) clasificados y subidos`);
    load();
  };

  const confirmMultiUpload = async (allFirmas: Array<{ key: string; label: string; nombreCol: string }>) => {
    if (!multiPicker) return;
    let ok = 0;
    for (let idx = 0; idx < multiPicker.length; idx++) {
      const key = multiPickerMap[idx];
      if (!key) continue;
      const firma = allFirmas.find((x) => x.key === key);
      if (!firma) continue;
      const defaultName = (form as any)[firma.nombreCol] || form.rep_legal_nombre || form.razon_social || "Firmante";
      try {
        await callPortal("upload_firma", token!, {
          tipo: firma.key,
          file_b64: multiPicker[idx].b64,
          filename: multiPicker[idx].file.name,
          mime: multiPicker[idx].file.type || "application/pdf",
          nombre: defaultName,
        });
        ok++;
      } catch (e: any) {
        toast.error(`${firma.label}: ${e?.message || "error"}`);
      }
    }
    if (ok > 0) toast.success(`${ok} documento(s) clasificados y subidos`);
    setMultiPicker(null);
    setMultiPickerMap({});
    load();
  };

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

  const c = CREDITO_ESTADO_COLOR[data.request.estado] || "bg-slate-50 text-slate-700 border-slate-200";
  const comp = data.completeness || {};
  const tp = form.tipo_persona ?? form.csf_tipo_persona ?? "moral";

  // === Documentos ===
  const docTypes: any[] = data.docTypes || [];
  const docs: any[] = data.docs || [];
  const visibleDocTypes = docTypes.filter((dt) => {
    if (dt.aplica_si_aval_distinto && !form.aval_es_distinto) return false;
    if (tp === "moral" && dt.aplica_moral === false) return false;
    if (tp === "fisica" && dt.aplica_fisica === false) return false;
    return true;
  });
  const hasDocs = (dt: any) => docs.some((d) => d.doc_type_id === dt.id);
  const isRequerido = (dt: any) => {
    if (!dt.requerido) return false;
    if (isOptInDoc(dt.nombre)) return optInChecked(dt.nombre);
    return true;
  };
  const order = ["fiscal", "domicilio", "identidad", "legal", "negocio", "bancario", "aval", "otros"];
  const groups: Record<string, { label: string; items: any[] }> = {};
  for (const dt of visibleDocTypes) {
    const g = groupFor(dt);
    if (!groups[g.key]) groups[g.key] = { label: g.label, items: [] };
    groups[g.key].items.push(dt);
  }
  const totalReq = visibleDocTypes.filter((d) => isRequerido(d)).length;
  const doneReq = visibleDocTypes.filter((d) => isRequerido(d) && hasDocs(d)).length;
  const pct = totalReq > 0 ? Math.round((doneReq / totalReq) * 100) : 0;

  // === Autofill helpers ===
  const docTypeIdForKind = (kind: string): string | null => {
    const find = (pred: (n: string) => boolean) =>
      docTypes.find((t: any) => pred((t.nombre || "").toLowerCase()))?.id ?? null;
    if (kind === "csf") return find((n) => n.includes("csf") || n.includes("situación fiscal"));
    if (kind === "comprobante_domicilio") return find((n) => n.includes("comprobante de domicilio") && !n.includes("aval"));
    if (kind.startsWith("ine") || kind === "passport") return find((n) => n.startsWith("identificación oficial") && !n.includes("aval"));
    if (kind === "acta_constitutiva") return find((n) => n.includes("acta constitutiva"));
    return null;
  };
  const docsForKind = (kind: string): any[] => {
    const tid = docTypeIdForKind(kind);
    if (!tid) return [];
    return docs.filter((d: any) => d.doc_type_id === tid);
  };
  const autofillFromFile = async (file: File, kind: string, label: string) => {
    if (!file || !token) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    setAutofilling(kind);
    toast.loading(`Leyendo ${label}...`, { id: "af" });
    try {
      const b64 = await fileToBase64(file);
      const { data: rdata, error } = await supabase.functions.invoke("credito-autofill", {
        body: { token, kind, file_b64: b64, mime: file.type || "image/jpeg" },
      });
      if (error) throw error;
      if ((rdata as any)?.error) throw new Error((rdata as any).error);
      const filled = Object.keys((rdata as any)?.updated || {}).length;
      const docTypeId = docTypeIdForKind(kind);
      try {
        await callPortal("upload_doc", token, {
          doc_type_id: docTypeId, file_b64: b64, filename: file.name,
          mime: file.type || "application/pdf", nombre_personalizado: label,
        });
      } catch { /* ignore upload error; autofill ya guardó campos */ }
      toast.success(filled > 0 ? `${label}: ${filled} campos autocompletados` : `${label} guardada`, { id: "af" });
      load();
    } catch (e: any) {
      toast.error(e?.message || `No se pudo leer ${label}`, { id: "af" });
    } finally {
      setAutofilling(null);
    }
  };

  // === Firmas ===
  const baseFirmas = CREDITO_FIRMAS
    .filter((f) => f.key !== "solicitud")
    .filter((f) => !(f.personaMoralOnly && tp !== "moral"));
  const solicitudEntries: Array<{ key: string; label: string; fechaCol: string; nombreCol: string; personaMoralOnly: boolean }> = [];
  if ((form as any).solicita_lumaggs) {
    solicitudEntries.push({
      key: "solicitud-lumaggs",
      label: "Solicitud de crédito · Lumaggs (Chevron)",
      fechaCol: "firma_solicitud_lumaggs_fecha",
      nombreCol: "firma_solicitud_lumaggs_nombre",
      personaMoralOnly: false,
    });
  }
  if ((form as any).solicita_galsa) {
    solicitudEntries.push({
      key: "solicitud-galsa",
      label: "Solicitud de crédito · Galsa (Phillips 66)",
      fechaCol: "firma_solicitud_galsa_fecha",
      nombreCol: "firma_solicitud_galsa_nombre",
      personaMoralOnly: false,
    });
  }
  // Fallback: si no hay marcas seleccionadas, conserva la entrada genérica de "Solicitud".
  if (solicitudEntries.length === 0) {
    const orig = CREDITO_FIRMAS.find((f) => f.key === "solicitud");
    if (orig) solicitudEntries.push({ ...orig } as any);
  }
  const allFirmas = [...solicitudEntries, ...baseFirmas] as Array<{ key: string; label: string; fechaCol: string; nombreCol: string; personaMoralOnly: boolean }>;

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
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

        {/* Instrucciones — colapsable */}
        <Card>
          <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-violet-800">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  Instrucciones
                </span>
                {instructionsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4 text-xs text-slate-700 leading-relaxed border-t pt-3">
                <div className="flex gap-3">
                  <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold text-[11px]">1</div>
                  <div>
                    <p className="font-semibold text-violet-700 uppercase tracking-wide text-[11px] mb-1">Envíenos su información</p>
                    <p>
                      Indíquenos primero el nombre y correo electrónico de la persona que realizará el trámite. Después súbanos, en este orden, sus documentos: Constancia de Situación Fiscal (CSF), Opinión positiva de Cumplimiento SAT (32-D), Comprobante de domicilio, Identificación oficial del Representante Legal o del solicitante (si es Persona Física), y si se trata de una empresa, Acta Constitutiva y, en su caso, los Poderes del Representante Legal. Pueden subirlos aquí en la pestaña Documentos o enviarlos por correo.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">2</div>
                  <div>
                    <p className="font-semibold text-blue-700 uppercase tracking-wide text-[11px] mb-1">Prellenamos su solicitud</p>
                    <p>Con esos documentos completamos automáticamente los datos posibles del formulario y generamos los demás formatos que se requieren.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">3</div>
                  <div>
                    <p className="font-semibold text-emerald-700 uppercase tracking-wide text-[11px] mb-1">Termine de editar en línea</p>
                    <p>Revise y complete el Formulario (pestañas Empresa, Representación, Financiero) en esta misma liga.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-[11px]">4</div>
                  <div>
                    <p className="font-semibold text-amber-700 uppercase tracking-wide text-[11px] mb-1">Imprima, firme y envíe</p>
                    <p>Descargue los formatos de la pestaña "Formatos y Firmas", fírmelos (a mano o en línea) y súbalos de regreso, o envíelos escaneados.</p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-violet-50 via-blue-50 to-emerald-50 p-1 h-auto gap-1 border border-violet-100">
            <TabsTrigger value="docs" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md text-violet-700 text-[11px] sm:text-sm px-2 py-2 leading-tight whitespace-normal break-words min-w-0 h-auto">
              Documentos
            </TabsTrigger>
            <TabsTrigger value="datos" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-blue-700 text-[11px] sm:text-sm px-2 py-2 leading-tight whitespace-normal break-words min-w-0 h-auto">
              Formulario
            </TabsTrigger>
            <TabsTrigger value="firmas" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-emerald-700 text-[11px] sm:text-sm px-2 py-2 leading-tight whitespace-normal break-words min-w-0 h-auto">
              Formatos y Firmas
            </TabsTrigger>
          </TabsList>

          {/* ============ FORMULARIO ============ */}
          <TabsContent value="datos" className="space-y-6 mt-4">
            <Card><CardContent className="pt-6 space-y-6">
              <Tabs value={formTab} onValueChange={setFormTab}>
                <TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-1 h-auto gap-1 border border-blue-100">
                  <TabsTrigger value="empresa" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-blue-700 text-[11px] sm:text-sm h-auto whitespace-normal break-words min-w-0 leading-tight flex items-center gap-1.5 py-1.5">
                    <Building2 className="h-3.5 w-3.5" /><span>Empresa</span>
                  </TabsTrigger>
                  <TabsTrigger value="representacion" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-violet-700 text-[11px] sm:text-sm h-auto whitespace-normal break-words min-w-0 leading-tight flex items-center gap-1.5 py-1.5">
                    <IdCard className="h-3.5 w-3.5" /><span>Representación</span>
                  </TabsTrigger>
                  <TabsTrigger value="financiero" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-emerald-700 text-[11px] sm:text-sm h-auto whitespace-normal break-words min-w-0 leading-tight flex items-center gap-1.5 py-1.5">
                    <Landmark className="h-3.5 w-3.5" /><span>Financiero</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tipo de persona — visible en todas las pestañas */}
                <div className="mt-4 rounded-md border border-violet-200 bg-violet-50/40 p-3">
                  <Field label="Tipo de persona">
                    <Select value={form.tipo_persona ?? form.csf_tipo_persona ?? "moral"} onValueChange={(v) => set("tipo_persona", v)}>
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CREDITO_TIPO_PERSONA_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Autocompletar con documentos (opcional) */}
                {(() => {
                  const palCsf  = DOC_PALETTE["Constancia de Situación Fiscal (CSF)"];
                  const palIne  = DOC_PALETTE["Identificación oficial"];
                  const palDom  = DOC_PALETTE["Comprobante de domicilio"];
                  const palActa = DOC_PALETTE["Acta Constitutiva"];
                  const cardCls = (has: boolean, p: any) =>
                    `rounded-lg border-2 ${has ? "border-emerald-300" : p.border} bg-transparent p-3 flex flex-col gap-2 relative`;
                  const badge = (has: boolean) =>
                    `absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${has ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-200 text-slate-700 border-slate-300"}`;
                  const hasCsf  = docsForKind("csf").length > 0;
                  const hasIne  = docsForKind("ine_front").length > 0;
                  const hasDom  = docsForKind("comprobante_domicilio").length > 0;
                  const hasActa = docsForKind("acta_constitutiva").length > 0;
                  return (
                    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 mt-4">
                      <CardContent className="pt-3 pb-3 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                            <Wand2 className="h-4 w-4 text-violet-700" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold flex items-center gap-1.5 leading-tight">
                              Autocompletar con documentos
                              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                                <Sparkles className="h-3 w-3" /> Opcional
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Sube los documentos del solicitante y se autocompletarán los datos posibles del formulario. Es opcional pero ahorra mucha captura.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button type="button" variant="outline" size="sm"
                              className="h-8 border-violet-300 text-violet-700 hover:bg-violet-100"
                              onClick={() => setAutofillCollapsed((v) => !v)}
                              title={autofillCollapsed ? "Mostrar documentos" : "Ocultar documentos"}>
                              {autofillCollapsed ? (
                                <><ChevronDown className="h-3.5 w-3.5 mr-1" />Mostrar</>
                              ) : (
                                <><ChevronUp className="h-3.5 w-3.5 mr-1" />Ocultar</>
                              )}
                            </Button>
                            <Button type="button" size="sm" className="h-8" onClick={saveForm} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                              Guardar
                            </Button>
                          </div>
                        </div>
                        {!autofillCollapsed && (<>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            {/* CSF */}
                            <div className={cardCls(hasCsf, palCsf)}>
                              <span className={badge(hasCsf)}>
                                {hasCsf ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                              </span>
                              <div className="flex items-start gap-2.5 min-w-0 pr-20">
                                <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palCsf.iconBg}`}>
                                  <FileText className={`h-4 w-4 ${palCsf.iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm leading-tight">Constancia de Situación Fiscal</p>
                                </div>
                              </div>
                              <label className="cursor-pointer block">
                                <input type="file" accept="application/pdf,image/*" className="hidden"
                                  disabled={autofilling !== null}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "csf", "CSF"); e.currentTarget.value = ""; }} />
                                <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palCsf.btn}`}>
                                  {autofilling === "csf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                  {hasCsf ? "Reemplazar CSF" : "Subir CSF"}
                                </span>
                              </label>
                              {docsForKind("csf").map((it) => (
                                <button key={it.id} onClick={() => openDoc(it.id)} className="flex items-center gap-1 text-[10px] text-blue-700 hover:underline truncate w-full">
                                  <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                                </button>
                              ))}
                            </div>
                            {/* INE / Pasaporte */}
                            <div className={cardCls(hasIne, palIne)}>
                              <span className={badge(hasIne)}>
                                {hasIne ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                              </span>
                              <div className="flex items-start gap-2.5 min-w-0 pr-20">
                                <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palIne.iconBg}`}>
                                  <IdCard className={`h-4 w-4 ${palIne.iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm leading-tight">INE / Pasaporte del Representante</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <label className="cursor-pointer">
                                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={autofilling !== null}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_front", "INE frente"); e.currentTarget.value = ""; }} />
                                  <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                    {autofilling === "ine_front" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}Frente
                                  </span>
                                </label>
                                <label className="cursor-pointer">
                                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={autofilling !== null}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_back", "INE reverso"); e.currentTarget.value = ""; }} />
                                  <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                    {autofilling === "ine_back" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}Reverso
                                  </span>
                                </label>
                                <label className="cursor-pointer">
                                  <input type="file" accept="application/pdf,image/*" className="hidden" disabled={autofilling !== null}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_full", "INE completa"); e.currentTarget.value = ""; }} />
                                  <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                    {autofilling === "ine_full" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}PDF INE
                                  </span>
                                </label>
                                <label className="cursor-pointer">
                                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={autofilling !== null}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "passport", "Pasaporte"); e.currentTarget.value = ""; }} />
                                  <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                    {autofilling === "passport" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}Pasaporte
                                  </span>
                                </label>
                              </div>
                              {docsForKind("ine_front").map((it) => (
                                <button key={it.id} onClick={() => openDoc(it.id)} className="flex items-center gap-1 text-[10px] text-violet-700 hover:underline truncate w-full">
                                  <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                                </button>
                              ))}
                            </div>
                            {/* Comprobante */}
                            <div className={cardCls(hasDom, palDom)}>
                              <span className={badge(hasDom)}>
                                {hasDom ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                              </span>
                              <div className="flex items-start gap-2.5 min-w-0 pr-20">
                                <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palDom.iconBg}`}>
                                  <Home className={`h-4 w-4 ${palDom.iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm leading-tight">Comprobante de domicilio</p>
                                </div>
                              </div>
                              <label className="cursor-pointer block">
                                <input type="file" accept="application/pdf,image/*" className="hidden" disabled={autofilling !== null}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "comprobante_domicilio", "Comprobante"); e.currentTarget.value = ""; }} />
                                <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palDom.btn}`}>
                                  {autofilling === "comprobante_domicilio" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                  {hasDom ? "Reemplazar comprobante" : "Subir comprobante"}
                                </span>
                              </label>
                              {docsForKind("comprobante_domicilio").map((it) => (
                                <button key={it.id} onClick={() => openDoc(it.id)} className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline truncate w-full">
                                  <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                                </button>
                              ))}
                            </div>
                            {/* Acta Constitutiva */}
                            {tp === "moral" && (
                              <div className={cardCls(hasActa, palActa)}>
                                <span className={badge(hasActa)}>
                                  {hasActa ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                                </span>
                                <div className="flex items-start gap-2.5 min-w-0 pr-20">
                                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palActa.iconBg}`}>
                                    <ScrollText className={`h-4 w-4 ${palActa.iconColor}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm leading-tight">Acta Constitutiva</p>
                                  </div>
                                </div>
                                <label className="cursor-pointer block">
                                  <input type="file" accept="application/pdf,image/*" className="hidden" disabled={autofilling !== null}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "acta_constitutiva", "Acta Constitutiva"); e.currentTarget.value = ""; }} />
                                  <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palActa.btn}`}>
                                    {autofilling === "acta_constitutiva" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                    {hasActa ? "Reemplazar acta" : "Subir acta"}
                                  </span>
                                </label>
                                {docsForKind("acta_constitutiva").map((it) => (
                                  <button key={it.id} onClick={() => openDoc(it.id)} className="flex items-center gap-1 text-[10px] text-indigo-700 hover:underline truncate w-full">
                                    <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            Solo se llenarán los campos que estén vacíos; los datos ya capturados no se sobrescriben.
                          </p>
                        </>)}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* === EMPRESA === */}
                <TabsContent value="empresa" className="space-y-6 mt-5">
                  <Section title="Datos generales">
                    <Field label="Razón social"><Input value={form.razon_social || ""} onChange={(e) => set("razon_social", e.target.value)} /></Field>
                    <Field label="Nombre comercial"><Input value={form.nombre_comercial || ""} onChange={(e) => set("nombre_comercial", e.target.value)} /></Field>
                    <Field label="RFC"><Input value={form.rfc || ""} onChange={(e) => set("rfc", e.target.value.toUpperCase())} /></Field>
                    <Field label="Teléfono"><Input value={form.telefono || ""} onChange={(e) => set("telefono", e.target.value)} /></Field>
                    <Field label="Correo de contacto"><Input value={form.correo_contacto || ""} onChange={(e) => set("correo_contacto", e.target.value)} /></Field>
                    <Field label="Nombre de quien realiza el trámite"><Input value={form.client_nombre_contacto || ""} onChange={(e) => set("client_nombre_contacto", e.target.value)} /></Field>
                    <Field label="Giro comercial"><Input value={form.giro_comercial || ""} onChange={(e) => set("giro_comercial", e.target.value)} /></Field>
                    <Field label="Antigüedad"><Input value={form.antiguedad || ""} onChange={(e) => set("antiguedad", e.target.value)} /></Field>
                  </Section>

                  <Section title="Domicilio fiscal">
                    <div className="sm:col-span-2">
                      <Field label="Domicilio"><Input value={form.domicilio_fiscal || ""} onChange={(e) => set("domicilio_fiscal", e.target.value)} placeholder="Calle, número, colonia, CP" /></Field>
                    </div>
                    <Field label="Ciudad"><Input value={form.ciudad_fiscal || ""} onChange={(e) => set("ciudad_fiscal", e.target.value)} /></Field>
                    <Field label="Estado"><Input value={form.estado_fiscal || ""} onChange={(e) => set("estado_fiscal", e.target.value)} /></Field>
                  </Section>

                  <Section title="Domicilio comercial">
                    <div className="sm:col-span-2">
                      <Field label="Domicilio"><Input value={form.domicilio_comercial || ""} onChange={(e) => set("domicilio_comercial", e.target.value)} placeholder="Calle, número, colonia, CP" /></Field>
                    </div>
                    <Field label="Ciudad"><Input value={form.ciudad_comercial || ""} onChange={(e) => set("ciudad_comercial", e.target.value)} /></Field>
                    <Field label="Estado"><Input value={form.estado_comercial || ""} onChange={(e) => set("estado_comercial", e.target.value)} /></Field>
                  </Section>

                  {tp === "moral" && (
                    <Section title="Persona moral">
                      <Field label="Escritura constitutiva"><Input value={form.escritura_constitutiva || ""} onChange={(e) => set("escritura_constitutiva", e.target.value)} /></Field>
                      <Field label="Datos de registro"><Input value={form.datos_registro || ""} onChange={(e) => set("datos_registro", e.target.value)} /></Field>
                      <Field label="Última asamblea"><Input value={form.ultima_asamblea || ""} onChange={(e) => set("ultima_asamblea", e.target.value)} /></Field>
                      <Field label="Administrador / Presidente"><Input value={form.administrador_presidente || ""} onChange={(e) => set("administrador_presidente", e.target.value)} /></Field>
                    </Section>
                  )}
                </TabsContent>

                {/* === REPRESENTACIÓN === */}
                <TabsContent value="representacion" className="space-y-6 mt-5">
                  <Section title="Representante legal">
                    <Field label="Nombre"><Input value={form.rep_legal_nombre || ""} onChange={(e) => set("rep_legal_nombre", e.target.value)} /></Field>
                    <Field label="CURP"><Input value={form.rep_legal_curp || ""} onChange={(e) => set("rep_legal_curp", e.target.value.toUpperCase())} /></Field>
                    <Field label="RFC"><Input value={form.rep_legal_rfc || ""} onChange={(e) => set("rep_legal_rfc", e.target.value.toUpperCase())} /></Field>
                    <Field label="Tipo ID"><Input value={form.rep_legal_tipo_id || ""} onChange={(e) => set("rep_legal_tipo_id", e.target.value)} /></Field>
                    <Field label="Núm. ID"><Input value={form.rep_legal_num_id || ""} onChange={(e) => set("rep_legal_num_id", e.target.value)} /></Field>
                    <Field label="Vencimiento ID"><Input type="date" value={form.rep_legal_vencimiento_id || ""} onChange={(e) => set("rep_legal_vencimiento_id", e.target.value || null)} /></Field>
                    <Field label="Fecha nacimiento"><Input type="date" value={form.rep_legal_fecha_nacimiento || ""} onChange={(e) => set("rep_legal_fecha_nacimiento", e.target.value || null)} /></Field>
                    <Field label="País nacimiento"><Input value={form.rep_legal_pais_nacimiento || ""} onChange={(e) => set("rep_legal_pais_nacimiento", e.target.value)} /></Field>
                  </Section>

                  <Section title="Aval / Obligado solidario">
                    <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 leading-snug">
                      <span className="font-medium">Regla:</span> En <span className="font-medium">crédito directo</span> con <span className="font-medium">Persona Física</span>, el aval debe ser una persona <span className="font-medium">distinta</span> al solicitante. Para <span className="font-medium">Persona Moral</span>, el propio representante legal puede fungir como aval. Si el aval es otra persona, se requiere también su identificación oficial y comprobante de domicilio.
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="¿El aval es una persona distinta?">
                        <div className="flex items-center gap-2 h-9">
                          <Switch checked={!!form.aval_es_distinto} onCheckedChange={(v) => set("aval_es_distinto", v)} />
                          <span className="text-sm">{form.aval_es_distinto ? "Sí, es otra persona" : "No, es el mismo representante legal / solicitante"}</span>
                        </div>
                      </Field>
                    </div>
                    {form.aval_es_distinto && (
                      <>
                        <Field label="Nombre"><Input value={form.aval_nombre || ""} onChange={(e) => set("aval_nombre", e.target.value)} /></Field>
                        <Field label="Relación"><Input value={form.aval_relacion || ""} onChange={(e) => set("aval_relacion", e.target.value)} /></Field>
                        <div className="sm:col-span-2">
                          <Field label="Dirección"><Input value={form.aval_direccion || ""} onChange={(e) => set("aval_direccion", e.target.value)} /></Field>
                        </div>
                        <Field label="Ciudad"><Input value={form.aval_ciudad || ""} onChange={(e) => set("aval_ciudad", e.target.value)} /></Field>
                        <Field label="Régimen conyugal">
                          <Select value={form.aval_regimen_conyugal || ""} onValueChange={(v) => set("aval_regimen_conyugal", v)}>
                            <SelectTrigger><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Sociedad conyugal">Sociedad conyugal</SelectItem>
                              <SelectItem value="Separación de bienes">Separación de bienes</SelectItem>
                              <SelectItem value="Sociedad legal">Sociedad legal</SelectItem>
                              <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
                              <SelectItem value="No aplica">No aplica</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </>
                    )}
                  </Section>

                  {SHOW_BC_PORTAL && (
                    <PortalBeneficiarioControladorSteps form={form} set={set} token={token!} onSaved={load} />
                  )}
                </TabsContent>

                {/* === FINANCIERO === */}
                <TabsContent value="financiero" className="space-y-6 mt-5">
                  <Section title="Crédito solicitado">
                    <Field label="Monto solicitado"><Input type="number" value={form.monto_solicitado ?? ""} onChange={(e) => set("monto_solicitado", e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Días de crédito"><Input type="number" value={form.dias_credito ?? ""} onChange={(e) => set("dias_credito", e.target.value ? Number(e.target.value) : null)} /></Field>
                  </Section>
                  {tp === "moral" && (
                    <Repeater
                      title="Accionistas"
                      value={form.accionistas || []}
                      onChange={(v) => set("accionistas", v)}
                      fields={[
                        { key: "nombre", label: "Nombre accionista" },
                        { key: "acciones", label: "Número de acciones", type: "number" },
                      ]}
                    />
                  )}
                  <Repeater
                    title="Datos bancarios"
                    value={form.datos_bancarios || []}
                    onChange={(v) => set("datos_bancarios", v)}
                    fields={[
                      { key: "banco", label: "Banco" },
                      { key: "cuenta", label: "Número de cuenta" },
                      { key: "clabe", label: "CLABE interbancaria" },
                    ]}
                  />
                  <Repeater
                    title="Referencias comerciales"
                    value={form.referencias_comerciales || []}
                    onChange={(v) => set("referencias_comerciales", v)}
                    fields={[
                      { key: "empresa", label: "Empresa" },
                      { key: "contacto", label: "Contacto" },
                      { key: "telefono", label: "Teléfono" },
                    ]}
                    minRequired={3}
                  />
                </TabsContent>
              </Tabs>
            </CardContent></Card>
            <div className="flex justify-end">
              <Button onClick={saveForm} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </TabsContent>

          {/* ============ DOCUMENTOS ============ */}
          <TabsContent value="docs" className="space-y-4 mt-4">
            <Card><CardContent className="pt-6 space-y-4">
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

              {visibleDocTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay documentos solicitados.</p>
              ) : (
                <div className="space-y-5">
                  {/* Progreso global */}
                  <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-violet-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-blue-900">Progreso del expediente</span>
                      <span className="text-blue-700 font-semibold">{doneReq} de {totalReq} requeridos · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  {order.filter((k) => groups[k]).map((k) => {
                    const g = groups[k];
                    const reqCount = g.items.filter((d) => isRequerido(d)).length;
                    const reqDone = g.items.filter((d) => isRequerido(d) && hasDocs(d)).length;
                    const allDone = g.items.every((d) => !isRequerido(d) || hasDocs(d));
                    return (
                      <div key={k} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                          <h3 className={`text-sm font-semibold uppercase tracking-wide ${GROUP_COLOR[k] || "text-slate-700"}`}>{g.label}</h3>
                          {reqCount > 0 && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${allDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                              {reqDone}/{reqCount} requeridos
                            </span>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {g.items.map((dt) => {
                            const items = docs.filter((d) => d.doc_type_id === dt.id);
                            const palette = DOC_PALETTE[dt.nombre] || DOC_PALETTE.__default;
                            const Icon = palette.icon;
                            const canAdd = dt.permite_multiples || items.length === 0;
                            const hasItems = items.length > 0;
                            return (
                              <div key={dt.id} className={`rounded-lg border-2 ${hasItems ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white" : (isRequerido(dt) ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white" : palette.border + " " + palette.bg)} p-3 flex flex-col gap-2 relative`}>
                                <span className={`absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${hasItems ? "bg-emerald-500 text-white border-emerald-600" : (isRequerido(dt) ? "bg-amber-500 text-white border-amber-600" : "bg-slate-200 text-slate-700 border-slate-300")}`}>
                                  {hasItems ? (<><Check className="h-2.5 w-2.5" />Subido{items.length > 1 ? ` (${items.length})` : ""}</>) : (isRequerido(dt) ? "Pendiente" : "Opcional")}
                                </span>
                                <div className="flex items-start gap-2.5 min-w-0 pr-20">
                                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palette.iconBg}`}>
                                    <Icon className={`h-4 w-4 ${palette.iconColor}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm leading-tight">
                                      {dt.nombre} {isRequerido(dt) && <span className="text-red-600">*</span>}
                                      {dt.permite_multiples && (
                                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">(múltiples)</span>
                                      )}
                                    </p>
                                    {dt.instrucciones_cliente && <p className="text-[11px] text-muted-foreground mt-0.5">{dt.instrucciones_cliente}</p>}
                                    {isOptInDoc(dt.nombre) && (
                                      <label className="mt-1.5 inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-100 transition-colors">
                                        <Switch
                                          checked={optInChecked(dt.nombre)}
                                          onCheckedChange={() => toggleOptInDoc(dt.nombre)}
                                          className="scale-75"
                                        />
                                        <span>Requerido</span>
                                      </label>
                                    )}
                                  </div>
                                </div>
                                {canAdd && (
                                  <label className="cursor-pointer block">
                                    <input type="file" accept="application/pdf,image/*" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f, dt.id); e.currentTarget.value = ""; }} />
                                    <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palette.btn}`}>
                                      <FileUp className="h-3.5 w-3.5" />
                                      {items.length > 0 ? "Agregar otro" : "Subir documento"}
                                    </span>
                                  </label>
                                )}
                                {items.length > 0 && (
                                  <div className="space-y-1">
                                    {items.map((it: any) => (
                                      <div key={it.id} className="bg-white/70 rounded border border-white px-2 py-1.5 flex items-center justify-between gap-2 text-xs">
                                        <button onClick={() => openDoc(it.id)} className="truncate text-left hover:underline flex-1 flex items-center gap-1">
                                          <Paperclip className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{it.nombre_archivo}</span>
                                        </button>
                                        {it.subido_por_cliente && (
                                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteDoc(it.id)} title="Eliminar">
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ============ FORMATOS Y FIRMAS ============ */}
          <TabsContent value="firmas" className="space-y-4 mt-4">
            <Card><CardContent className="pt-6 space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 hover:from-violet-100 hover:to-blue-100 hover:text-violet-800 text-[10px] font-semibold uppercase tracking-widest"
                  onClick={() => {
                    if (!token || allFirmas.length === 0) return;
                    const joined = allFirmas.map((f) => f.key).join(",");
                    const w = window.open(`/portal/credito/${token}/imprimir/${joined}`, "_blank");
                    if (!w) toast.error("Tu navegador bloqueó la ventana emergente.");
                    else toast.success(`Generando ${allFirmas.length} documento(s)`);
                  }}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />Generar Todos los PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 hover:text-blue-800 text-[10px] font-semibold uppercase tracking-widest"
                  asChild
                >
                  <label className="cursor-pointer">
                    <Files className="h-3.5 w-3.5 mr-1.5" />Subir varios PDFs
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        e.currentTarget.value = "";
                        if (files.length === 0) return;
                        await handleMultiFirmaFiles(files, allFirmas);
                      }}
                    />
                  </label>
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFirmas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sin documentos para firmar.</TableCell>
                    </TableRow>
                  ) : allFirmas.map((f) => {
                    const fecha = (form as any)[f.fechaCol];
                    const nombre = (form as any)[f.nombreCol];
                    return (
                      <TableRow key={f.key}>
                        <TableCell>
                          <div className="flex items-start gap-2 min-w-0">
                            <ShieldCheck className={`h-4 w-4 mt-0.5 shrink-0 ${fecha ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                            <span className="font-medium">{f.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {fecha ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className="w-fit border-emerald-300 text-emerald-700">Firmado</Badge>
                              <span className="text-xs text-muted-foreground">{nombre} · {format(new Date(fecha), "dd/MM/yyyy HH:mm")}</span>
                            </div>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openFirmaPdf(f.key)} title="Generar PDF" className="h-auto py-1">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <FileText className="h-4 w-4" />
                                <span className="text-[9px] leading-none font-medium">PDF</span>
                              </div>
                            </Button>
                            <Button size="icon" variant="ghost" asChild title={fecha ? "Reemplazar firmado" : "Subir firmado"} className="h-auto py-1">
                              <label className="cursor-pointer flex flex-col items-center justify-center gap-0.5">
                                <Upload className="h-4 w-4" />
                                <span className="text-[9px] leading-none font-medium">Subir</span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.currentTarget.value = "";
                                    if (file) await uploadFirmaDoc(f, file);
                                  }}
                                />
                              </label>
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setSigningKey(f.key); setSigningName(""); }} title="Firmar en línea">
                              <PenSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground pt-2">
                Genera el PDF, imprime y firma físicamente, luego sube el documento escaneado, o usa "Subir varios PDFs" para cargar todos en un paso.
              </p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Diálogo simple para firmar */}
        {signingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSigningKey(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Firma electrónica</p>
                <h3 className="text-base font-semibold mt-0.5">
                  {CREDITO_FIRMAS.find((x) => x.key === signingKey)?.label || "Documento"}
                </h3>
              </div>
              <Field label="Escribe tu nombre completo">
                <Input value={signingName} onChange={(e) => setSigningName(e.target.value)} autoFocus />
              </Field>
              <p className="text-[11px] text-muted-foreground">
                Al firmar declaras bajo protesta de decir verdad que la información proporcionada es veraz.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSigningKey(null)}>Cancelar</Button>
                <Button size="sm" onClick={confirmSign} disabled={!signingName.trim()}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />Firmar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Diálogo para clasificar PDFs múltiples */}
        <Dialog open={!!multiPicker} onOpenChange={(o) => { if (!o) { setMultiPicker(null); setMultiPickerMap({}); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Clasificar PDFs</DialogTitle>
              <DialogDescription>
                Selecciona a qué formato corresponde cada archivo. Los que dejes sin asignar se ignorarán.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(multiPicker || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 border rounded p-2">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs flex-1 truncate" title={item.file.name}>{item.file.name}</span>
                  <Select
                    value={multiPickerMap[idx] || ""}
                    onValueChange={(v) => setMultiPickerMap((m) => ({ ...m, [idx]: v }))}
                  >
                    <SelectTrigger className="w-[260px] h-8 text-xs">
                      <SelectValue placeholder="Selecciona documento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allFirmas.map((f) => (
                        <SelectItem key={f.key} value={f.key} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setMultiPicker(null); setMultiPickerMap({}); }}>Cancelar</Button>
              <Button size="sm" onClick={() => confirmMultiUpload(allFirmas)}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />Subir clasificados
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
