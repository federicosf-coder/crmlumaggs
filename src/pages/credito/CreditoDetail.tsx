import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Save, Send, FileUp, Plus, Trash2, Check, X, Copy, ExternalLink, MessageSquare, History, FileCheck, ShieldCheck, Pencil, FileText, IdCard, Home, ScrollText, Camera, MapPin, Landmark, BookOpen, Receipt, Building2, Paperclip, Wand2, Sparkles, AlertTriangle, CalendarClock, Briefcase, Phone, Mail, ChevronDown, ChevronUp, HelpCircle, Printer, Upload, PenSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CREDITO_ESTADO_LABEL, CREDITO_ESTADO_COLOR, CREDITO_TIPO_LABEL, CREDITO_ESTADO_OPTIONS, CREDITO_TIPO_OPTIONS, CREDITO_FIRMAS, CREDITO_TIPO_PERSONA_OPTIONS } from "@/lib/credito";
import { AddressAutocompleteInput, emptyAddress, type AddressValue } from "@/components/AddressAutocompleteInput";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { INDUSTRIAS_OPTIONS } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";

type Req = any;

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

function BcStepHeader({ open, title, badge }: { open: boolean; title: string; badge: { label: string; variant: "pending" | "ok" | "muted" } }) {
  const badgeCls =
    badge.variant === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : badge.variant === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-200"
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

function BeneficiarioControladorSteps({
  form,
  set,
  creditId,
  onSavedBc,
  onOpenInfo,
  uploadDoc,
  openDoc,
  docs,
}: {
  form: any;
  set: (k: string, v: any) => void;
  creditId: string;
  onSavedBc: () => void;
  onOpenInfo: () => void;
  uploadDoc: (file: File, docTypeId: string | null, displayName?: string, extra?: any) => Promise<void>;
  openDoc: (path: string) => void;
  docs: any[];
}) {
  const bcExiste: boolean | null =
    form.lfpiorpi_beneficiario_controlador == null ? null : !!form.lfpiorpi_beneficiario_controlador;
  const bcConfirmado = !!form.bc_confirmacion_no_existe;
  const rlIsBc: boolean | null =
    form.bc_es_representante_legal == null ? null : !!form.bc_es_representante_legal;
  const bcTipo: "fisica" | "moral" | null =
    form.bc_tipo_persona === "fisica" || form.bc_tipo_persona === "moral" ? form.bc_tipo_persona : null;
  const bcData: any = form.bc_data && typeof form.bc_data === "object" ? form.bc_data : {};
  const setBc = (k: string, v: any) => set("bc_data", { ...bcData, [k]: v });

  // Default-open Paso 1 cuando es indeterminado.
  const [step1Open, setStep1Open] = useState<boolean>(bcExiste === null);
  const [step2Open, setStep2Open] = useState<boolean>(bcExiste === true && rlIsBc === null);
  const [step3Open, setStep3Open] = useState<boolean>(bcExiste === true && rlIsBc === false);
  const [savingBc, setSavingBc] = useState(false);

  // Sincroniza estado de apertura cuando cambian los datos cargados.
  useEffect(() => {
    setStep1Open(bcExiste === null);
  }, [bcExiste]);
  useEffect(() => {
    if (bcExiste === true) setStep2Open(rlIsBc === null);
    else setStep2Open(false);
  }, [bcExiste, rlIsBc]);
  useEffect(() => {
    setStep3Open(bcExiste === true && rlIsBc === false);
  }, [bcExiste, rlIsBc]);

  const step1Badge = useMemo(() => {
    if (bcExiste === null) return { label: "Pendiente", variant: "pending" as const };
    if (bcExiste === false) {
      return bcConfirmado
        ? { label: "No aplica", variant: "muted" as const }
        : { label: "No existe", variant: "pending" as const };
    }
    return { label: "Sí existe", variant: "ok" as const };
  }, [bcExiste, bcConfirmado]);

  const step2Badge = useMemo(() => {
    if (rlIsBc === null) return { label: "Pendiente", variant: "pending" as const };
    return rlIsBc
      ? { label: "Es el Representante Legal", variant: "ok" as const }
      : { label: "Es otra persona", variant: "ok" as const };
  }, [rlIsBc]);

  const step3Badge = useMemo(() => {
    if (bcTipo === null) return { label: "Pendiente", variant: "pending" as const };
    return { label: bcTipo === "fisica" ? "Persona física" : "Persona moral", variant: "ok" as const };
  }, [bcTipo]);

  const setExiste = (v: boolean) => {
    set("lfpiorpi_beneficiario_controlador", v);
    if (!v) {
      set("bc_es_representante_legal", null);
    } else {
      set("bc_confirmacion_no_existe", false);
    }
  };

  const saveNoExiste = async () => {
    setSavingBc(true);
    const { error } = await supabase
      .from("credit_requests")
      .update({
        lfpiorpi_beneficiario_controlador: false,
        bc_confirmacion_no_existe: true,
        bc_es_representante_legal: null,
      })
      .eq("id", creditId);
    setSavingBc(false);
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
    toast.success("Guardado: no existe Beneficiario Controlador");
    set("bc_confirmacion_no_existe", true);
    setStep1Open(false);
    onSavedBc();
  };

  const setRlIsBc = (v: boolean) => {
    set("bc_es_representante_legal", v);
    // Auto-colapsa Paso 2 al elegir; Paso 3 (no implementado en este alcance) tomará el foco.
    setStep2Open(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center" style={{ gap: "3mm" }}>
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
          Beneficiario Controlador
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
          onClick={onOpenInfo}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Conoce más
        </Button>
      </div>

      {/* Paso 1 */}
      <Collapsible open={step1Open} onOpenChange={setStep1Open} className="rounded-lg border bg-card transition-all duration-200">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left">
            <BcStepHeader open={step1Open} title="Beneficiario Controlador" badge={step1Badge} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            <p className="text-xs text-muted-foreground">
              Conforme al Art. 18 de la Ley de Beneficiario Controlador es necesario identificar si existe un Beneficiario Controlador en esta operación.
            </p>
            <RadioGroup
              value={bcExiste === null ? "" : bcExiste ? "si" : "no"}
              onValueChange={(v) => setExiste(v === "si")}
              className="gap-2"
            >
              <label
                htmlFor="bc-existe-si"
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${bcExiste === true ? "border-violet-300 bg-violet-50/40" : ""}`}
              >
                <RadioGroupItem value="si" id="bc-existe-si" className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Sí existe</p>
                  <p className="text-xs text-muted-foreground">Hay una persona física o persona moral que controla o se beneficia de esta operación</p>
                </div>
              </label>
              <label
                htmlFor="bc-existe-no"
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${bcExiste === false ? "border-violet-300 bg-violet-50/40" : ""}`}
              >
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
                  <Checkbox
                    id="bc-confirma"
                    checked={bcConfirmado}
                    onCheckedChange={(v) => set("bc_confirmacion_no_existe", !!v)}
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    Confirmo bajo protesta de decir verdad que no existe Beneficiario Controlador
                  </span>
                </label>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!bcConfirmado || savingBc}
                    onClick={saveNoExiste}
                  >
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
        <Collapsible open={step2Open} onOpenChange={setStep2Open} className="rounded-lg border bg-card transition-all duration-200">
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left">
              <BcStepHeader open={step2Open} title="Representante Legal como BC" badge={step2Badge} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-3 pb-3 pt-1 space-y-3 border-t">
              <p className="text-xs text-muted-foreground">
                ¿El Representante Legal de la solicitud es también el Beneficiario Controlador?
              </p>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Representante Legal</p>
                <p className="truncate">
                  {[form.rep_legal_nombre || "—", form.rep_legal_rfc || "—", form.rep_legal_curp || "—"].join(" · ")}
                </p>
              </div>
              <RadioGroup
                value={rlIsBc === null ? "" : rlIsBc ? "si" : "no"}
                onValueChange={(v) => setRlIsBc(v === "si")}
                className="gap-2"
              >
                <label
                  htmlFor="bc-rl-si"
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${rlIsBc === true ? "border-violet-300 bg-violet-50/40" : ""}`}
                >
                  <RadioGroupItem value="si" id="bc-rl-si" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Sí, es el mismo</p>
                    <p className="text-xs text-muted-foreground">Se usarán sus datos para prellenar el formulario</p>
                  </div>
                </label>
                <label
                  htmlFor="bc-rl-no"
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${rlIsBc === false ? "border-violet-300 bg-violet-50/40" : ""}`}
                >
                  <RadioGroupItem value="no" id="bc-rl-no" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">No, es otra persona o empresa</p>
                    <p className="text-xs text-muted-foreground">Se llenará el formulario con datos distintos</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Paso 3 - Datos del BC (cuando es otra persona/empresa) */}
      {bcExiste === true && rlIsBc === false && (
        <Collapsible open={step3Open} onOpenChange={setStep3Open} className="rounded-lg border bg-card transition-all duration-200">
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left">
              <BcStepHeader open={step3Open} title="Datos del Beneficiario Controlador" badge={step3Badge} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-3 pb-3 pt-1 space-y-4 border-t">
              <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
                Tipo de Beneficiario Controlador
              </p>
              <RadioGroup
                value={bcTipo ?? ""}
                onValueChange={(v) => set("bc_tipo_persona", v)}
                className="grid sm:grid-cols-2 gap-2"
              >
                <label
                  htmlFor="bc-tipo-fisica"
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${bcTipo === "fisica" ? "border-violet-300 bg-violet-50/40" : ""}`}
                >
                  <RadioGroupItem value="fisica" id="bc-tipo-fisica" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Persona física</p>
                    <p className="text-xs text-muted-foreground">Individuo (Anexo 3)</p>
                  </div>
                </label>
                <label
                  htmlFor="bc-tipo-moral"
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors ${bcTipo === "moral" ? "border-violet-300 bg-violet-50/40" : ""}`}
                >
                  <RadioGroupItem value="moral" id="bc-tipo-moral" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Persona moral</p>
                    <p className="text-xs text-muted-foreground">Empresa / entidad (Anexo 4)</p>
                  </div>
                </label>
              </RadioGroup>

              {bcTipo === "fisica" && (
                <BcPersonaFisicaForm
                  bcData={bcData}
                  setBc={setBc}
                  uploadDoc={uploadDoc}
                  openDoc={openDoc}
                  docs={docs}
                  creditId={creditId}
                />
              )}
              {bcTipo === "moral" && (
                <BcPersonaMoralForm
                  bcData={bcData}
                  setBc={setBc}
                  uploadDoc={uploadDoc}
                  openDoc={openDoc}
                  docs={docs}
                  creditId={creditId}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function BcField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BcDomicilioField({ bcData, setBc, label }: { bcData: any; setBc: (k: string, v: any) => void; label: string }) {
  const value = {
    direccion_completa: bcData?.domicilio || "",
    latitud: bcData?.domicilio_lat ?? null,
    longitud: bcData?.domicilio_lng ?? null,
    ciudad: bcData?.domicilio_ciudad ?? null,
    estado: bcData?.domicilio_estado ?? null,
    pais: bcData?.domicilio_pais ?? null,
    codigo_postal: bcData?.domicilio_cp ?? null,
    codigo_google: bcData?.domicilio_place_id ?? null,
  };
  return (
    <AddressAutocompleteInput
      label={label}
      value={value}
      showCoords={false}
      showLocateButton
      onChange={(v) => {
        setBc("domicilio", v.direccion_completa);
        setBc("domicilio_lat", v.latitud);
        setBc("domicilio_lng", v.longitud);
        setBc("domicilio_ciudad", v.ciudad);
        setBc("domicilio_estado", v.estado);
        setBc("domicilio_pais", v.pais);
        setBc("domicilio_cp", v.codigo_postal);
        setBc("domicilio_place_id", v.codigo_google);
      }}
    />
  );
}

function BcDocUploader({
  docKey,
  label,
  uploadDoc,
  openDoc,
  docs,
  creditId,
  autofillKind,
  onParsed,
}: {
  docKey: string;
  label: string;
  uploadDoc: (file: File, docTypeId: string | null, displayName?: string, extra?: any) => Promise<void>;
  openDoc: (path: string) => void;
  docs: any[];
  creditId?: string;
  autofillKind?: string;
  onParsed?: (parsed: any) => number;
}) {
  const [uploading, setUploading] = useState(false);
  const items = (docs || []).filter((d: any) => d?.metadata?.bc_doc === docKey);
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    setUploading(true);
    try {
      if (autofillKind && creditId && onParsed) {
        const tid = `bcdoc-${docKey}`;
        toast.loading(`Leyendo ${label}...`, { id: tid });
        try {
          const b64: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => { const s = String(r.result || ""); const i = s.indexOf(","); resolve(i >= 0 ? s.slice(i + 1) : s); };
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          });
          const { data, error } = await supabase.functions.invoke("credito-autofill", {
            body: { request_id: creditId, kind: autofillKind, file_b64: b64, mime: f.type || "image/jpeg", skip_db_update: true },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          const parsed: any = (data as any)?.parsed || {};
          const filled = onParsed(parsed) || 0;
          toast.success(filled > 0 ? `${label}: ${filled} campos autocompletados` : `${label} guardado (sin campos nuevos)`, { id: tid });
        } catch (err: any) {
          toast.error(err?.message || `No se pudo leer ${label}`, { id: tid });
        }
      }
      await uploadDoc(f, null, `BC - ${label}`, { metadata: { bc_doc: docKey, bc_doc_label: label } });
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        <label className="inline-flex">
          <input type="file" className="hidden" onChange={onChange} disabled={uploading} accept="image/*,application/pdf" />
          <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-violet-300 text-violet-700 hover:bg-violet-50 text-[11px] cursor-pointer">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : (autofillKind ? <Wand2 className="h-3 w-3" /> : <FileUp className="h-3 w-3" />)}
            {items.length > 0 ? (autofillKind ? "Subir y extraer otro" : "Agregar otro") : (autofillKind ? "Subir y extraer" : "Subir")}
          </span>
        </label>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it: any) => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => openDoc(it.url_archivo)}
                className="truncate text-violet-700 hover:underline text-left"
                title={it.nombre_archivo}
              >
                <Paperclip className="h-3 w-3 inline mr-1" />
                {it.nombre_archivo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BcPersonaFisicaForm({ bcData, setBc, uploadDoc, openDoc, docs, creditId }: any) {
  const setIfEmpty = (key: string, val: any) => {
    if (val === null || val === undefined || val === "") return 0;
    if (bcData?.[key]) return 0;
    setBc(key, val);
    return 1;
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Documentos</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <BcDocUploader docKey="bc_pf_id" label="Identificación oficial" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="ine_full"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("nombre", p.nombre_completo);
              n += setIfEmpty("curp", p.curp ? String(p.curp).toUpperCase() : null);
              n += setIfEmpty("fecha_nacimiento", p.fecha_nacimiento);
              n += setIfEmpty("pais_nacimiento", p.pais_nacimiento);
              n += setIfEmpty("nacionalidad", p.nacionalidad);
              n += setIfEmpty("id_tipo", p.tipo_documento === "pasaporte" ? "Pasaporte" : "INE");
              n += setIfEmpty("id_numero", p.numero_identificacion || p.cic);
              return n;
            }} />
          <BcDocUploader docKey="bc_pf_curp" label="CURP" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="curp"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("curp", p.curp ? String(p.curp).toUpperCase() : null);
              n += setIfEmpty("nombre", p.nombre_completo);
              n += setIfEmpty("fecha_nacimiento", p.fecha_nacimiento);
              n += setIfEmpty("pais_nacimiento", p.pais_nacimiento);
              n += setIfEmpty("nacionalidad", p.nacionalidad);
              return n;
            }} />
          <BcDocUploader docKey="bc_pf_csf" label="Cédula fiscal (CSF)" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="csf"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("rfc", p.rfc ? String(p.rfc).toUpperCase() : null);
              n += setIfEmpty("nombre", p.nombre_completo || p.razon_social);
              n += setIfEmpty("domicilio", p.domicilio);
              return n;
            }} />
          <BcDocUploader docKey="bc_pf_domicilio" label="Comprobante de domicilio" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="comprobante_domicilio"
            onParsed={(p) => setIfEmpty("domicilio", p.domicilio)} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Datos personales (Anexo 3)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <BcField label="Nombre completo"><Input value={bcData.nombre || ""} onChange={(e) => setBc("nombre", e.target.value)} /></BcField>
          <BcField label="Fecha de nacimiento"><Input type="date" value={bcData.fecha_nacimiento || ""} onChange={(e) => setBc("fecha_nacimiento", e.target.value)} /></BcField>
          <BcField label="País de nacimiento"><Input value={bcData.pais_nacimiento || ""} onChange={(e) => setBc("pais_nacimiento", e.target.value)} /></BcField>
          <BcField label="Nacionalidad"><Input value={bcData.nacionalidad || ""} onChange={(e) => setBc("nacionalidad", e.target.value)} /></BcField>
          <BcField label="CURP"><Input value={bcData.curp || ""} onChange={(e) => setBc("curp", e.target.value.toUpperCase())} /></BcField>
          <BcField label="RFC"><Input value={bcData.rfc || ""} onChange={(e) => setBc("rfc", e.target.value.toUpperCase())} /></BcField>
          <BcField label="Teléfono"><Input value={bcData.telefono || ""} onChange={(e) => setBc("telefono", e.target.value)} /></BcField>
          <BcField label="Correo"><Input type="email" value={bcData.correo || ""} onChange={(e) => setBc("correo", e.target.value)} /></BcField>
        </div>
        <BcDomicilioField bcData={bcData} setBc={setBc} label="Domicilio completo" />
        <div className="grid sm:grid-cols-2 gap-3">
          <BcField label="Tipo de identificación oficial"><Input placeholder="INE, Pasaporte..." value={bcData.id_tipo || ""} onChange={(e) => setBc("id_tipo", e.target.value)} /></BcField>
          <BcField label="Número de identificación"><Input value={bcData.id_numero || ""} onChange={(e) => setBc("id_numero", e.target.value)} /></BcField>
        </div>
      </div>
    </div>
  );
}

function BcRlIneUploader({
  creditId,
  setBc,
  uploadDoc,
  openDoc,
  docs,
}: {
  creditId: string;
  setBc: (k: string, v: any) => void;
  uploadDoc: (file: File, docTypeId: string | null, displayName?: string, extra?: any) => Promise<void>;
  openDoc: (path: string) => void;
  docs: any[];
}) {
  const [busy, setBusy] = useState(false);
  const items = (docs || []).filter((d: any) => d?.metadata?.bc_doc === "bc_pm_rl_ine");
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    setBusy(true);
    toast.loading("Leyendo Identificación del Representante Legal...", { id: "bcrl-ine" });
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ""); const i = s.indexOf(","); resolve(i >= 0 ? s.slice(i + 1) : s); };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      const { data, error } = await supabase.functions.invoke("credito-autofill", {
        body: { request_id: creditId, kind: "ine_full", file_b64: b64, mime: f.type || "image/jpeg" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const parsed: any = (data as any)?.parsed || {};
      let filled = 0;
      if (parsed.nombre_completo) { setBc("rl_nombre", parsed.nombre_completo); filled++; }
      if (parsed.curp) { setBc("rl_curp", String(parsed.curp).toUpperCase()); filled++; }
      if (parsed.rfc) { setBc("rl_rfc", String(parsed.rfc).toUpperCase()); filled++; }
      await uploadDoc(f, null, "BC - Identificación Representante Legal", {
        metadata: { bc_doc: "bc_pm_rl_ine", bc_doc_label: "Identificación Representante Legal" },
      });
      toast.success(filled > 0 ? `Identificación leída: ${filled} campos autocompletados` : "Identificación guardada (sin campos nuevos)", { id: "bcrl-ine" });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo leer la Identificación", { id: "bcrl-ine" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-md border border-violet-200 bg-violet-50/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium">Identificación oficial del Representante Legal</p>
          <p className="text-[10px] text-muted-foreground">Sube INE o Pasaporte y se extraerán Nombre, CURP y RFC automáticamente.</p>
        </div>
        <label className="inline-flex shrink-0">
          <input type="file" className="hidden" onChange={onChange} disabled={busy} accept="image/*,application/pdf" />
          <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-violet-300 text-violet-700 hover:bg-violet-100 text-[11px] cursor-pointer">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {items.length > 0 ? "Subir otra" : "Subir y extraer"}
          </span>
        </label>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it: any) => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-[11px]">
              <button type="button" onClick={() => openDoc(it.url_archivo)} className="truncate text-violet-700 hover:underline text-left" title={it.nombre_archivo}>
                <Paperclip className="h-3 w-3 inline mr-1" />{it.nombre_archivo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BcPersonaMoralForm({ bcData, setBc, uploadDoc, openDoc, docs, creditId }: any) {
  const setIfEmpty = (key: string, val: any) => {
    if (val === null || val === undefined || val === "") return 0;
    if (bcData?.[key]) return 0;
    setBc(key, val);
    return 1;
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Documentos</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <BcDocUploader docKey="bc_pm_acta" label="Acta constitutiva" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="acta_constitutiva"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("razon_social", p.razon_social);
              n += setIfEmpty("fecha_constitucion", p.fecha_constitucion);
              n += setIfEmpty("rl_nombre", p.administrador_presidente);
              return n;
            }} />
          <BcDocUploader docKey="bc_pm_csf" label="Cédula fiscal (CSF)" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="csf"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("razon_social", p.razon_social || p.nombre_completo);
              n += setIfEmpty("rfc", p.rfc ? String(p.rfc).toUpperCase() : null);
              n += setIfEmpty("domicilio", p.domicilio);
              return n;
            }} />
          <BcDocUploader docKey="bc_pm_domicilio" label="Comprobante de domicilio" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="comprobante_domicilio"
            onParsed={(p) => setIfEmpty("domicilio", p.domicilio)} />
          <BcDocUploader docKey="bc_pm_poderes" label="Poderes del representante legal" uploadDoc={uploadDoc} openDoc={openDoc} docs={docs}
            creditId={creditId} autofillKind="poderes"
            onParsed={(p) => {
              let n = 0;
              n += setIfEmpty("rl_nombre", p.rl_nombre);
              n += setIfEmpty("rl_curp", p.rl_curp ? String(p.rl_curp).toUpperCase() : null);
              n += setIfEmpty("rl_rfc", p.rl_rfc ? String(p.rl_rfc).toUpperCase() : null);
              return n;
            }} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Datos de la empresa (Anexo 4)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <BcField label="Razón social"><Input value={bcData.razon_social || ""} onChange={(e) => setBc("razon_social", e.target.value)} /></BcField>
          <BcField label="RFC"><Input value={bcData.rfc || ""} onChange={(e) => setBc("rfc", e.target.value.toUpperCase())} /></BcField>
          <BcField label="Fecha de constitución"><Input type="date" value={bcData.fecha_constitucion || ""} onChange={(e) => setBc("fecha_constitucion", e.target.value)} /></BcField>
          <BcField label="País"><Input value={bcData.pais || ""} onChange={(e) => setBc("pais", e.target.value)} /></BcField>
          <BcField label="Teléfono"><Input value={bcData.telefono || ""} onChange={(e) => setBc("telefono", e.target.value)} /></BcField>
          <BcField label="Correo"><Input type="email" value={bcData.correo || ""} onChange={(e) => setBc("correo", e.target.value)} /></BcField>
        </div>
        <BcDomicilioField bcData={bcData} setBc={setBc} label="Domicilio" />
      </div>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Representante legal</p>
        <BcRlIneUploader creditId={creditId} setBc={setBc} uploadDoc={uploadDoc} openDoc={openDoc} docs={docs} />
        <div className="grid sm:grid-cols-3 gap-3">
          <BcField label="Nombre"><Input value={bcData.rl_nombre || ""} onChange={(e) => setBc("rl_nombre", e.target.value)} /></BcField>
          <BcField label="CURP"><Input value={bcData.rl_curp || ""} onChange={(e) => setBc("rl_curp", e.target.value.toUpperCase())} /></BcField>
          <BcField label="RFC"><Input value={bcData.rl_rfc || ""} onChange={(e) => setBc("rl_rfc", e.target.value.toUpperCase())} /></BcField>
        </div>
      </div>
    </div>
  );
}

export default function CreditoDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const isInternal = hasAnyRole(["admin", "manager", "customer_service", "accounting", "sales"]);
  const isAdminMgr = hasAnyRole(["admin", "manager"]);

  const [form, setForm] = useState<Req | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("datos");
  const [formTab, setFormTab] = useState("empresa");
  const [shareOpen, setShareOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentVis, setNewCommentVis] = useState<"interna" | "publica">("interna");
  const [uploadCtx, setUploadCtx] = useState<{ docTypeId: string | null; docTypeName: string } | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [autofilling, setAutofilling] = useState<string | null>(null);
  const [editFechaDoc, setEditFechaDoc] = useState<any | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [autofillCollapsed, setAutofillCollapsed] = useState(true);
  const [bcInfoOpen, setBcInfoOpen] = useState(false);
  const [editFechaValue, setEditFechaValue] = useState<string>("");
  const [verifyDoc, setVerifyDoc] = useState<any | null>(null);

  const { data: req, isLoading } = useQuery({
    queryKey: ["credit_request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_requests")
        .select("*, companies(id, name, razon_social, industrias, plaza_id)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => { if (req) setForm(req); }, [req]);

  const companyId = (req?.companies as any)?.id || (req as any)?.company_id || null;

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-credito"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").order("nombre");
      return data || [];
    },
  });

  const { data: companyContacts = [] } = useQuery({
    queryKey: ["credit-company-contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, email, phone, mobile, whatsapp_phone")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["credit_doc_types_active"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_doc_types").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: docs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["credit_request_docs", id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_request_docs").select("*").eq("credit_request_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["credit_request_history", id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_request_history").select("*").eq("credit_request_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["credit_request_comments", id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_request_comments").select("*").eq("credit_request_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: completeness } = useQuery({
    queryKey: ["credit_completeness", id, req?.updated_at, docs.length],
    queryFn: async () => {
      const { data } = await supabase.rpc("credit_request_completeness", { req_id: id! });
      return data as any;
    },
    enabled: !!id,
  });

  if (!isInternal) return <Navigate to="/" replace />;

  if (isLoading || !form) {
    return (
      <div className="container mx-auto py-10 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin inline mr-2" />Cargando solicitud...
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const { id: _id, created_at, updated_at, companies, folio, client_token, ...payload } = form;
    const { error } = await supabase.from("credit_requests").update(payload).eq("id", id!);
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Cambios guardados");
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
  };

  const changeEstado = async (nuevo: string) => {
    if (!nuevo || nuevo === form.estado) return;
    const anterior = form.estado;
    const { error } = await supabase.from("credit_requests").update({ estado: nuevo as any }).eq("id", id!);
    if (error) { toast.error("No se pudo cambiar el estado"); return; }
    await supabase.from("credit_request_history").insert({
      credit_request_id: id!, estado_anterior: anterior as any, estado_nuevo: nuevo as any, user_id: user?.id,
    });
    toast.success("Estado actualizado");
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
    qc.invalidateQueries({ queryKey: ["credit_request_history", id] });
  };

  const uploadDoc = async (
    file: File,
    docTypeId: string | null,
    displayName?: string,
    extra?: { fecha_emision?: string | null; fecha_vencimiento?: string | null; metadata?: any },
  ) => {
    const path = `${id}/${crypto.randomUUID()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("credit-docs").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { toast.error("Upload: " + upErr.message); return; }
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const finalName = (displayName?.trim() ? (displayName.trim().toLowerCase().endsWith(ext.toLowerCase()) ? displayName.trim() : displayName.trim() + ext) : file.name);
    const payload: any = {
      credit_request_id: id!, doc_type_id: docTypeId, url_archivo: path, nombre_archivo: finalName,
      tipo_archivo: file.type, estado: "recibido", visibilidad: "publica", subido_por: user?.id,
    };
    if (extra?.fecha_emision) payload.fecha_emision = extra.fecha_emision;
    if (extra?.fecha_vencimiento) payload.fecha_vencimiento = extra.fecha_vencimiento;
    if (extra?.metadata) payload.metadata = extra.metadata;
    const { error: insErr } = await supabase.from("credit_request_docs").insert(payload);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Documento subido");
    refetchDocs();
  };

  const openUploadDialog = (docTypeId: string | null, docTypeName: string) => {
    setUploadCtx({ docTypeId, docTypeName });
    setUploadName(docTypeName === "Otro" ? "" : docTypeName);
    setUploadFile(null);
  };

  const confirmUpload = async () => {
    if (!uploadFile) { toast.error("Selecciona un archivo"); return; }
    if (!uploadName.trim()) { toast.error("Escribe un nombre para el documento"); return; }
    setUploadingDoc(true);
    await uploadDoc(uploadFile, uploadCtx?.docTypeId ?? null, uploadName);
    setUploadingDoc(false);
    setUploadCtx(null);
    setUploadName("");
    setUploadFile(null);
  };

  const fileToB64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const autofillFromFile = async (file: File, kind: string, label: string) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo supera 15 MB"); return; }
    setAutofilling(kind);
    toast.loading(`Leyendo ${label}...`, { id: "af" });
    try {
      const b64 = await fileToB64(file);
      const { data, error } = await supabase.functions.invoke("credito-autofill", {
        body: { request_id: id, kind, file_b64: b64, mime: file.type || "image/jpeg" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const filled = Object.keys((data as any)?.updated || {}).length;
      // También guardar el archivo en la sección Documentos
      const matchType = (pred: (n: string) => boolean) =>
        (docTypes || []).find((t: any) => pred((t.nombre || "").toLowerCase()))?.id ?? null;
      let docTypeId: string | null = null;
      if (kind === "csf") docTypeId = matchType((n) => n.includes("csf") || n.includes("situación fiscal"));
      else if (kind === "comprobante_domicilio") docTypeId = matchType((n) => n.includes("comprobante de domicilio") && !n.includes("aval"));
      else if (kind.startsWith("ine") || kind === "passport") docTypeId = matchType((n) => n.startsWith("identificación oficial") && !n.includes("aval"));
      else if (kind === "acta_constitutiva") docTypeId = matchType((n) => n.includes("acta constitutiva"));
      else if (kind === "aval_comprobante_domicilio") docTypeId = matchType((n) => n.includes("comprobante de domicilio") && n.includes("aval"));
      else if (kind.startsWith("aval_ine") || kind === "aval_passport") docTypeId = matchType((n) => n.includes("identificación") && n.includes("aval"));
      // Para comprobante: guardar el domicilio extraído en metadata para verificación posterior
      const meta: any = {};
      const parsed = (data as any)?.parsed || {};
      if (kind === "comprobante_domicilio") {
        meta.domicilio_extraido = parsed.domicilio || null;
        meta.ciudad_extraida = parsed.municipio || parsed.ciudad || null;
        meta.cp_extraido = parsed.codigo_postal || null;
        meta.titular_extraido = parsed.titular || null;
        meta.proveedor = parsed.proveedor || null;
        meta.requiere_verificacion = true;
      }
      await uploadDoc(file, docTypeId, label, {
        fecha_emision: (data as any)?.fecha_emision || null,
        fecha_vencimiento: (data as any)?.fecha_vencimiento || null,
        metadata: Object.keys(meta).length ? meta : undefined,
      });
      toast.success(filled > 0 ? `${label}: ${filled} campos autocompletados y archivo guardado` : `${label} guardada (sin campos nuevos)`, { id: "af" });
      qc.invalidateQueries({ queryKey: ["credit_request", id] });
    } catch (e: any) {
      toast.error(e?.message || `No se pudo leer ${label}`, { id: "af" });
    } finally {
      setAutofilling(null);
    }
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("credit-docs").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const setDocEstado = async (docId: string, estado: string, notas?: string) => {
    const payload: any = { estado, aprobado_por: user?.id, aprobado_fecha: new Date().toISOString() };
    if (notas !== undefined) payload.notas_rechazo = notas;
    const { error } = await supabase.from("credit_request_docs").update(payload).eq("id", docId);
    if (error) { toast.error(error.message); return; }
    refetchDocs();
  };

  // Compute fecha_vencimiento from fecha_emision and doc_type rules
  const computeVencimiento = (emision: string | null, dt: any | null): string | null => {
    if (!emision || !dt) return null;
    if (dt.validez_tipo === "fin_mes_emision") {
      const d = new Date(emision + "T00:00:00Z");
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      return end.toISOString().slice(0, 10);
    }
    if (dt.vigencia_dias) {
      const d = new Date(emision + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + Number(dt.vigencia_dias));
      return d.toISOString().slice(0, 10);
    }
    return null;
  };

  const vencStatus = (venc: string | null) => {
    if (!venc) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const v = new Date(venc + "T00:00:00");
    const days = Math.round((v.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { label: "Vencido", days, cls: "bg-red-50 text-red-700 border-red-200" };
    if (days <= 7) return { label: `Vence en ${days}d`, days, cls: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: `Vigente (${days}d)`, days, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  };

  const openEditFecha = (doc: any) => {
    setEditFechaDoc(doc);
    setEditFechaValue(doc.fecha_emision || "");
  };

  // Resolve docType id given an autofill "kind"
  const docTypeIdForKind = (kind: string): string | null => {
    const find = (pred: (n: string) => boolean) =>
      (docTypes as any[]).find((t) => pred((t.nombre || "").toLowerCase()))?.id ?? null;
    if (kind === "csf") return find((n) => n.includes("csf") || n.includes("situación fiscal"));
    if (kind === "comprobante_domicilio") return find((n) => n.includes("comprobante de domicilio") && !n.includes("aval"));
    if (kind.startsWith("ine") || kind === "passport") return find((n) => n.startsWith("identificación oficial") && !n.includes("aval"));
    if (kind === "acta_constitutiva") return find((n) => n.includes("acta constitutiva"));
    if (kind === "aval_comprobante_domicilio") return find((n) => n.includes("comprobante de domicilio") && n.includes("aval"));
    if (kind.startsWith("aval_ine") || kind === "aval_passport") return find((n) => n.includes("identificación") && n.includes("aval"));
    return null;
  };
  const docsForKind = (kind: string): any[] => {
    const tid = docTypeIdForKind(kind);
    if (!tid) return [];
    return (docs as any[]).filter((d) => d.doc_type_id === tid);
  };

  const saveEditFecha = async () => {
    if (!editFechaDoc) return;
    const dt = (docTypes as any[]).find((t) => t.id === editFechaDoc.doc_type_id);
    const vencimiento = computeVencimiento(editFechaValue || null, dt);
    const { error } = await supabase.from("credit_request_docs").update({
      fecha_emision: editFechaValue || null,
      fecha_vencimiento: vencimiento,
    }).eq("id", editFechaDoc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fechas actualizadas");
    setEditFechaDoc(null);
    refetchDocs();
  };

  const approveVerificacion = async () => {
    if (!verifyDoc) return;
    const meta = { ...(verifyDoc.metadata || {}), requiere_verificacion: false, verificado_por: user?.id, verificado_fecha: new Date().toISOString() };
    const { error } = await supabase.from("credit_request_docs").update({
      metadata: meta,
      estado: "recibido",
      aprobado_por: user?.id,
      aprobado_fecha: new Date().toISOString(),
    }).eq("id", verifyDoc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comprobante verificado y aprobado");
    setVerifyDoc(null);
    refetchDocs();
  };

  const deleteDoc = async (docId: string, path: string | null) => {
    if (!confirm("¿Eliminar este documento?")) return;
    if (path) await supabase.storage.from("credit-docs").remove([path]);
    await supabase.from("credit_request_docs").delete().eq("id", docId);
    refetchDocs();
  };

  const addComment = async () => {
    if (!newCommentText.trim()) return;
    const { error } = await supabase.from("credit_request_comments").insert({
      credit_request_id: id!, user_id: user?.id, contenido: newCommentText.trim(), visibilidad: newCommentVis as any,
    });
    if (error) { toast.error(error.message); return; }
    setNewCommentText(""); refetchComments();
  };

  const openFirmaPdf = (key: { key: string }) => {
    window.open(`/credito/${id}/imprimir/${key.key}`, "_blank", "noopener");
  };

  const uploadFirmaDoc = async (key: { key: string; label: string; fechaCol: string; nombreCol: string }, file: File) => {
    const nombre =
      prompt(`Nombre de quien firmó "${key.label}":`, (form as any)[key.nombreCol] || "") || "";
    if (!nombre.trim()) { toast.error("Captura el nombre del firmante"); return; }
    const path = `${id}/${crypto.randomUUID()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("credit-docs").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) { toast.error("Upload: " + upErr.message); return; }
    const docPayload: any = {
      credit_request_id: id!,
      doc_type_id: null,
      url_archivo: path,
      nombre_archivo: file.name,
      tipo_archivo: file.type,
      estado: "recibido",
      visibilidad: "publica",
      subido_por: user?.id,
      metadata: { firma_key: key.key, firma_label: key.label },
    };
    const { data: docRow, error: insErr } = await supabase
      .from("credit_request_docs")
      .insert(docPayload)
      .select("id")
      .single();
    if (insErr || !docRow) { toast.error(insErr?.message || "Error al registrar"); return; }
    const docIdCol = `${key.fechaCol.replace("_fecha", "")}_doc_id`;
    const upd: any = {
      [key.fechaCol]: new Date().toISOString(),
      [key.nombreCol]: nombre.trim(),
      [docIdCol]: docRow.id,
    };
    const { error } = await supabase.from("credit_requests").update(upd).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success(`${key.label}: firma registrada y archivo guardado`);
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
    refetchDocs();
  };

  const clearFirma = async (key: { fechaCol: string; nombreCol: string }) => {
    if (!confirm("¿Limpiar esta firma?")) return;
    const docIdCol = `${key.fechaCol.replace("_fecha", "")}_doc_id`;
    const upd: any = { [key.fechaCol]: null, [key.nombreCol]: null, [docIdCol]: null };
    await supabase.from("credit_requests").update(upd).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
  };

  const portalUrl = form.short_code
    ? `${window.location.origin}/p/${form.short_code}`
    : `${window.location.origin}/portal/credito/${form.client_token}`;

  const updateCompany = async (patch: any) => {
    if (!companyId) return;
    const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
  };

  const company = (form.companies || {}) as any;
  const companyIndustrias: string[] = company.industrias || [];
  const removeIndustria = async (val: string) => {
    await updateCompany({ industrias: companyIndustrias.filter((i) => i !== val) });
  };
  const addIndustria = async (val: string) => {
    if (!val || companyIndustrias.includes(val)) return;
    await updateCompany({ industrias: [...companyIndustrias, val] });
    // mantener compatibilidad con credit_requests.giro_comercial
    const joined = [...companyIndustrias, val].join(", ");
    set("giro_comercial", joined);
    await supabase.from("credit_requests").update({ giro_comercial: joined }).eq("id", id!);
  };

  const setContact = async (contactId: string) => {
    const cc = (companyContacts as any[]).find((c) => c.id === contactId);
    set("contact_id", contactId);
    const upd: any = { contact_id: contactId };
    if (cc) {
      const fullName = `${cc.first_name || ""} ${cc.last_name || ""}`.trim();
      if (cc.email && !form.correo_contacto) { upd.correo_contacto = cc.email; set("correo_contacto", cc.email); }
      if ((cc.whatsapp_phone || cc.mobile || cc.phone) && !form.telefono) {
        const t = cc.whatsapp_phone || cc.mobile || cc.phone;
        upd.telefono = t; set("telefono", t);
      }
      if (fullName && !form.client_nombre_contacto) { upd.client_nombre_contacto = fullName; set("client_nombre_contacto", fullName); }
    }
    await supabase.from("credit_requests").update(upd).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["credit_request", id] });
  };

  const sendToPortal = async () => {
    if (form.estado === "borrador") {
      await supabase.from("credit_requests").update({ estado: "portal_enviado" }).eq("id", id!);
      await supabase.from("credit_request_history").insert({
        credit_request_id: id!, estado_anterior: "borrador" as any, estado_nuevo: "portal_enviado" as any, user_id: user?.id,
        nota: "Liga del portal generada y compartida con el cliente",
      });
      qc.invalidateQueries({ queryKey: ["credit_request", id] });
    }
    setShareOpen(true);
  };

  const c = CREDITO_ESTADO_COLOR[form.estado] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className="container mx-auto py-6 space-y-4">
      <BackButton fallback="/credito" />

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">{(form.companies as any)?.name || "Sin cliente"}</CardTitle>
                {companyId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCompanyDialogOpen(true)}
                    title="Editar empresa"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <span className="font-mono text-xs text-muted-foreground">{form.folio}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c}`}>
                  {CREDITO_ESTADO_LABEL[form.estado] || form.estado}
                </span>
                {form.tipo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-blue-50 text-blue-700 border-blue-200">
                    {CREDITO_TIPO_LABEL[form.tipo]}
                  </span>
                )}
              </div>
              {company?.razon_social && company.razon_social !== company.name && (
                <p className="text-xs text-muted-foreground mt-1">{company.razon_social}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={sendToPortal}>
                <Send className="h-4 w-4 mr-2" />Enviar al cliente
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </div>

          {/* Progress */}
          {completeness && (
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Formulario</p>
                <Progress value={completeness.form_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{completeness.form_pct || 0}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documentos</p>
                <Progress value={completeness.docs_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{completeness.docs_received}/{completeness.docs_required}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Firmas</p>
                <Progress value={completeness.sigs_pct || 0} className="h-2 mt-1" />
                <p className="text-xs mt-0.5">{completeness.sigs_done}/{completeness.sigs_required}</p>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Información rápida — sincronizada con Directorio */}
      <Card>
        <CardHeader className="pb-2 bg-gradient-to-br from-violet-50 to-blue-50 border-b">
          <CardTitle className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
            Información rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Tipo de Persona */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de persona</Label>
              <Select
                value={form.tipo_persona ?? form.csf_tipo_persona ?? "moral"}
                onValueChange={async (v) => {
                  set("tipo_persona", v);
                  await supabase.from("credit_requests").update({ tipo_persona: v }).eq("id", id!);
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREDITO_TIPO_PERSONA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Empresas solicitantes (Lumaggs / Galsa) con su monto */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Crédito solicitado por empresa
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { key: "lumaggs", label: "Lumaggs (Chevron)", flagCol: "solicita_lumaggs", montoCol: "monto_solicitado_lumaggs" },
                  { key: "galsa",   label: "Galsa (Phillips 66)", flagCol: "solicita_galsa",   montoCol: "monto_solicitado_galsa" },
                ] as const).map((e) => {
                  const activo = !!(form as any)[e.flagCol];
                  const monto = (form as any)[e.montoCol];
                  return (
                    <div
                      key={e.key}
                      className={`rounded-md border p-2 flex flex-col gap-1.5 transition-colors ${
                        activo ? "border-violet-300 bg-violet-50/60" : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{e.label}</span>
                        <Switch
                          checked={activo}
                          onCheckedChange={async (checked) => {
                            const otroFlag = e.key === "lumaggs" ? "solicita_galsa" : "solicita_lumaggs";
                            const otroActivo = !!(form as any)[otroFlag];
                            if (!checked && !otroActivo) {
                              toast.error("Debe haber al menos una empresa activa");
                              return;
                            }
                            set(e.flagCol as any, checked);
                            const upd: any = { [e.flagCol]: checked };
                            if (!checked) { upd[e.montoCol] = null; set(e.montoCol as any, null); }
                            await (supabase as any).from("credit_requests").update(upd).eq("id", id!);
                          }}
                        />
                      </div>
                      <Input
                        type="number"
                        className="h-8 text-right"
                        placeholder="Monto solicitado"
                        disabled={!activo}
                        value={monto ?? ""}
                        onChange={(ev) => set(e.montoCol as any, ev.target.value ? Number(ev.target.value) : null)}
                        onBlur={async (ev) => {
                          const v = ev.target.value ? Number(ev.target.value) : null;
                          await (supabase as any).from("credit_requests").update({ [e.montoCol]: v }).eq("id", id!);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Días de crédito */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Días de crédito</Label>
              <Input
                type="number"
                className="h-9"
                placeholder="30"
                value={form.dias_credito ?? ""}
                onChange={(e) => set("dias_credito", e.target.value ? Number(e.target.value) : null)}
                onBlur={async (e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  await supabase.from("credit_requests").update({ dias_credito: v }).eq("id", id!);
                }}
              />
            </div>

            {/* Plaza (sincronizada con la Empresa del directorio) */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Plaza</Label>
              <Select
                value={company.plaza_id || ""}
                onValueChange={(v) => updateCompany({ plaza_id: v || null })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Sin plaza" /></SelectTrigger>
                <SelectContent>
                  {(plazas as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Giro Comercial (Industrias, multi) — sincronizado con la Empresa */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Giro comercial (Industrias)
              </Label>
              <div className="flex flex-wrap gap-1 min-h-[28px]">
                {companyIndustrias.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin industrias asignadas.</span>
                )}
                {companyIndustrias.map((i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    {i}
                    <button type="button" onClick={() => removeIndustria(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select value="" onValueChange={addIndustria}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Agregar industria..." /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIAS_OPTIONS.filter((o) => !companyIndustrias.includes(o)).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contacto para seguimiento */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto para seguimiento</Label>
              <div className="flex gap-1">
                <div className="flex-1">
                  <SearchableSelect
                    value={form.contact_id || ""}
                    onValueChange={setContact}
                    options={(companyContacts as any[]).map((c) => ({
                      value: c.id,
                      label: `${c.first_name || ""} ${c.last_name || ""}`.trim() + (c.job_title ? ` — ${c.job_title}` : ""),
                    }))}
                    placeholder="Seleccionar contacto..."
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={!companyId}
                  title={companyId ? "Agregar contacto a la empresa" : "Primero vincula una empresa"}
                  onClick={() => setContactDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.contact_id && (() => {
                const cc = (companyContacts as any[]).find((c) => c.id === form.contact_id);
                if (!cc) return null;
                const phone = cc.whatsapp_phone || cc.mobile || cc.phone;
                return (
                  <div className="text-[11px] text-muted-foreground space-x-3 pt-0.5">
                    {cc.email && <span><Mail className="inline h-3 w-3 mr-0.5" />{cc.email}</span>}
                    {phone && <span><Phone className="inline h-3 w-3 mr-0.5" />{phone}</span>}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full sm:w-auto bg-gradient-to-r from-violet-50 via-blue-50 to-emerald-50 p-1 h-auto gap-1 border border-violet-100">
          <TabsTrigger value="docs" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white data-[state=active]:shadow-md text-violet-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="datos" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-blue-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
            Formulario
          </TabsTrigger>
          <TabsTrigger value="firmas" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-emerald-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
            <span className="sm:hidden">Formatos<br/>y Firmas</span><span className="hidden sm:inline">Formatos y Firmas</span>
          </TabsTrigger>
          <TabsTrigger value="seguimiento" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-amber-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
            Seguimiento
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md text-rose-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
            Comentarios
          </TabsTrigger>
        </TabsList>

        {/* ============ FORMULARIO ============ */}
        <TabsContent value="datos" className="space-y-6 mt-4">
          <Card><CardContent className="pt-6 space-y-6">
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-1 h-auto gap-1 border border-blue-100">
                <TabsTrigger value="empresa" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-blue-700 text-[10px] sm:text-xs h-auto whitespace-normal break-words min-w-0 leading-tight flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-1.5">
                  <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span>Empresa</span>
                </TabsTrigger>
                <TabsTrigger value="representacion" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-violet-700 text-[10px] sm:text-xs h-auto whitespace-normal break-words min-w-0 leading-tight flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-1.5">
                  <IdCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span>Representación</span>
                </TabsTrigger>
                <TabsTrigger value="financiero" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-emerald-700 text-[10px] sm:text-xs h-auto whitespace-normal break-words min-w-0 leading-tight flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-1.5">
                  <Landmark className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span>Financiero</span>
                </TabsTrigger>
              </TabsList>

              {/* Autocompletar con documentos (opcional) — visible en todas las pestañas internas */}
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
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <Wand2 className="h-5 w-5 text-violet-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            Autocompletar con documentos
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                              <Sparkles className="h-3 w-3" /> Opcional
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sube los documentos del solicitante y se autocompletarán los datos posibles del formulario. Es opcional pero ahorra mucha captura.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100"
                          onClick={() => setAutofillCollapsed(v => !v)}
                          title={autofillCollapsed ? "Mostrar documentos" : "Ocultar documentos"}
                        >
                          {autofillCollapsed ? (
                            <><ChevronDown className="h-3.5 w-3.5 mr-1" />Mostrar</>
                          ) : (
                            <><ChevronUp className="h-3.5 w-3.5 mr-1" />Ocultar</>
                          )}
                        </Button>
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
                            <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-blue-700 hover:underline truncate w-full">
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
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_front", "INE frente"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "ine_front" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                Frente
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_back", "INE reverso"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "ine_back" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                Reverso
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="application/pdf,image/*" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "ine_full", "INE completa"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "ine_full" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                                PDF INE
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "passport", "Pasaporte"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "passport" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                                Pasaporte
                              </span>
                            </label>
                          </div>
                          {docsForKind("ine_front").map((it) => (
                            <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-violet-700 hover:underline truncate w-full">
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
                            <input type="file" accept="application/pdf,image/*" className="hidden"
                              disabled={autofilling !== null}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "comprobante_domicilio", "Comprobante"); e.currentTarget.value = ""; }} />
                            <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palDom.btn}`}>
                              {autofilling === "comprobante_domicilio" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                              {hasDom ? "Reemplazar comprobante" : "Subir comprobante"}
                            </span>
                          </label>
                          {docsForKind("comprobante_domicilio").map((it) => (
                            <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline truncate w-full">
                              <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                            </button>
                          ))}
                        </div>
                        {/* Acta Constitutiva */}
                        {(form.tipo_persona ?? form.csf_tipo_persona ?? "moral") === "moral" && (
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
                              <input type="file" accept="application/pdf,image/*" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "acta_constitutiva", "Acta Constitutiva"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palActa.btn}`}>
                                {autofilling === "acta_constitutiva" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                {hasActa ? "Reemplazar acta" : "Subir acta"}
                              </span>
                            </label>
                            {docsForKind("acta_constitutiva").map((it) => (
                              <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-indigo-700 hover:underline truncate w-full">
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

              <TabsContent value="empresa" className="space-y-6 mt-5">
            <Section title="Datos generales">
              <Field label="Razón social"><Input value={form.razon_social || ""} onChange={(e) => set("razon_social", e.target.value)} /></Field>
              <Field label="Nombre comercial"><Input value={form.nombre_comercial || ""} onChange={(e) => set("nombre_comercial", e.target.value)} /></Field>
              <Field label="RFC"><Input value={form.rfc || ""} onChange={(e) => set("rfc", e.target.value.toUpperCase())} /></Field>
              <Field label="Teléfono"><Input value={form.telefono || ""} onChange={(e) => set("telefono", e.target.value)} /></Field>
              <Field label="Correo de contacto"><Input value={form.correo_contacto || ""} onChange={(e) => set("correo_contacto", e.target.value)} /></Field>
              <Field label="Antigüedad"><Input value={form.antiguedad || ""} onChange={(e) => set("antiguedad", e.target.value)} /></Field>
            </Section>
            <Section title="Domicilio fiscal">
              <div className="sm:col-span-2">
                <Field label="Domicilio">
                  <AddressAutocompleteInput
                    label=""
                    showCoords={false}
                    showLocateButton={false}
                    placeholder="Buscar dirección en Google Maps..."
                    value={{
                      ...emptyAddress,
                      direccion_completa: form.domicilio_fiscal || "",
                      ciudad: form.ciudad_fiscal || null,
                      estado: form.estado_fiscal || null,
                    }}
                    onChange={(v: AddressValue) => {
                      setForm((f: any) => ({
                        ...f,
                        domicilio_fiscal: v.direccion_completa || "",
                        ciudad_fiscal: v.ciudad ?? f.ciudad_fiscal,
                        estado_fiscal: v.estado ?? f.estado_fiscal,
                      }));
                    }}
                  />
                </Field>
              </div>
              <Field label="Ciudad"><Input value={form.ciudad_fiscal || ""} onChange={(e) => set("ciudad_fiscal", e.target.value)} /></Field>
              <Field label="Estado"><Input value={form.estado_fiscal || ""} onChange={(e) => set("estado_fiscal", e.target.value)} /></Field>
            </Section>
            <Section title="Domicilio comercial">
              <div className="sm:col-span-2">
                <Field label="Domicilio">
                  <AddressAutocompleteInput
                    label=""
                    showCoords={false}
                    showLocateButton={false}
                    placeholder="Buscar dirección en Google Maps..."
                    value={{
                      ...emptyAddress,
                      direccion_completa: form.domicilio_comercial || "",
                      ciudad: form.ciudad_comercial || null,
                    }}
                    onChange={(v: AddressValue) => {
                      setForm((f: any) => ({
                        ...f,
                        domicilio_comercial: v.direccion_completa || "",
                        ciudad_comercial: v.ciudad ?? f.ciudad_comercial,
                      }));
                    }}
                  />
                </Field>
              </div>
              <Field label="Ciudad"><Input value={form.ciudad_comercial || ""} onChange={(e) => set("ciudad_comercial", e.target.value)} /></Field>
            </Section>
            {(form.tipo_persona ?? form.csf_tipo_persona ?? "moral") === "moral" && (
              <Section title="Persona moral">
                <Field label="Escritura constitutiva"><Input value={form.escritura_constitutiva || ""} onChange={(e) => set("escritura_constitutiva", e.target.value)} /></Field>
                <Field label="Datos de registro"><Input value={form.datos_registro || ""} onChange={(e) => set("datos_registro", e.target.value)} /></Field>
                <Field label="Última asamblea"><Input value={form.ultima_asamblea || ""} onChange={(e) => set("ultima_asamblea", e.target.value)} /></Field>
                <Field label="Administrador / Presidente"><Input value={form.administrador_presidente || ""} onChange={(e) => set("administrador_presidente", e.target.value)} /></Field>
              </Section>
            )}
              </TabsContent>

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
                  {(() => {
                    const palIne = DOC_PALETTE["Identificación oficial"];
                    const palDom = DOC_PALETTE["Comprobante de domicilio"];
                    const hasIne = docsForKind("aval_ine_front").length > 0;
                    const hasDom = docsForKind("aval_comprobante_domicilio").length > 0;
                     const cardCls = (has: boolean, p: any) =>
                       `rounded-lg border-2 ${has ? "border-emerald-300" : p.border} bg-transparent p-3 flex flex-col gap-2 relative`;
                    const badge = (has: boolean) =>
                      `absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${has ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-200 text-slate-700 border-slate-300"}`;
                    return (
                      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                        {/* INE / Pasaporte del Aval */}
                        <div className={cardCls(hasIne, palIne)}>
                          <span className={badge(hasIne)}>
                            {hasIne ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                          </span>
                          <div className="flex items-start gap-2.5 min-w-0 pr-20">
                            <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palIne.iconBg}`}>
                              <IdCard className={`h-4 w-4 ${palIne.iconColor}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-tight">INE / Pasaporte del Aval</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "aval_ine_front", "INE Aval frente"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "aval_ine_front" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                Frente
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "aval_ine_back", "INE Aval reverso"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "aval_ine_back" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                Reverso
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="application/pdf,image/*" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "aval_ine_full", "INE Aval completa"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "aval_ine_full" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                                PDF INE
                              </span>
                            </label>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="hidden"
                                disabled={autofilling !== null}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "aval_passport", "Pasaporte Aval"); e.currentTarget.value = ""; }} />
                              <span className={`inline-flex items-center justify-center gap-1 w-full text-[11px] px-2 py-1.5 rounded-md border bg-white ${palIne.btn}`}>
                                {autofilling === "aval_passport" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                                Pasaporte
                              </span>
                            </label>
                          </div>
                          {docsForKind("aval_ine_front").map((it) => (
                            <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-violet-700 hover:underline truncate w-full">
                              <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                            </button>
                          ))}
                        </div>
                        {/* Comprobante de domicilio del Aval */}
                        <div className={cardCls(hasDom, palDom)}>
                          <span className={badge(hasDom)}>
                            {hasDom ? (<><Check className="h-2.5 w-2.5" />Subido</>) : "Opcional"}
                          </span>
                          <div className="flex items-start gap-2.5 min-w-0 pr-20">
                            <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${palDom.iconBg}`}>
                              <Home className={`h-4 w-4 ${palDom.iconColor}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-tight">Comprobante de domicilio del Aval</p>
                            </div>
                          </div>
                          <label className="cursor-pointer block">
                            <input type="file" accept="application/pdf,image/*" className="hidden"
                              disabled={autofilling !== null}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) autofillFromFile(f, "aval_comprobante_domicilio", "Comprobante Aval"); e.currentTarget.value = ""; }} />
                            <span className={`inline-flex items-center justify-center gap-1 w-full text-xs px-3 py-1.5 rounded-md border bg-white ${palDom.btn}`}>
                              {autofilling === "aval_comprobante_domicilio" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                              {hasDom ? "Reemplazar comprobante" : "Subir comprobante"}
                            </span>
                          </label>
                          {docsForKind("aval_comprobante_domicilio").map((it) => (
                            <button key={it.id} onClick={() => openDoc(it.url_archivo)} className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline truncate w-full">
                              <Paperclip className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{it.nombre_archivo}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <Field label="Nombre"><Input value={form.aval_nombre || ""} onChange={(e) => set("aval_nombre", e.target.value)} /></Field>
                  <Field label="Relación"><Input value={form.aval_relacion || ""} onChange={(e) => set("aval_relacion", e.target.value)} /></Field>
                  <Field label="Dirección"><Input value={form.aval_direccion || ""} onChange={(e) => set("aval_direccion", e.target.value)} /></Field>
                  <Field label="Ciudad"><Input value={form.aval_ciudad || ""} onChange={(e) => set("aval_ciudad", e.target.value)} /></Field>
                  <Field label="Régimen conyugal"><Input value={form.aval_regimen_conyugal || ""} onChange={(e) => set("aval_regimen_conyugal", e.target.value)} /></Field>
                </>
              )}
            </Section>
              </TabsContent>

              <TabsContent value="financiero" className="space-y-6 mt-5">
            <Repeater
              title="Accionistas"
              value={form.accionistas || []}
              onChange={(v) => set("accionistas", v)}
              fields={[
                { key: "nombre", label: "Nombre" },
                { key: "porcentaje", label: "% participación", type: "number" },
                { key: "rfc", label: "RFC" },
              ]}
            />
            <Repeater
              title="Datos bancarios"
              value={form.datos_bancarios || []}
              onChange={(v) => set("datos_bancarios", v)}
              fields={[
                { key: "banco", label: "Banco" },
                { key: "cuenta", label: "Cuenta / CLABE" },
                { key: "sucursal", label: "Sucursal" },
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
        </TabsContent>

        {/* ============ DOCUMENTOS ============ */}
        <TabsContent value="docs" className="space-y-4 mt-4">
          <Card><CardContent className="pt-6 space-y-4">
            {docTypes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tipos de documento configurados.</p>
            ) : (
              (() => {
                const poderRequerido = form.poder_representante_requerido === true;
                const registroRequerido = form.registro_publico_requerido === true;
                const estadoCuentaRequerido = form.estado_cuenta_requerido === true;
                const OPT_IN_DOC_COLS: Record<string, string> = {
                  "Poder del Representante Legal": "poder_representante_requerido",
                  "Registro Público de la Propiedad": "registro_publico_requerido",
                  "Estado de cuenta bancario": "estado_cuenta_requerido",
                };
                const isOptInDoc = (nombre: string) => nombre in OPT_IN_DOC_COLS;
                const optInChecked = (nombre: string) => {
                  if (nombre === "Poder del Representante Legal") return poderRequerido;
                  if (nombre === "Registro Público de la Propiedad") return registroRequerido;
                  if (nombre === "Estado de cuenta bancario") return estadoCuentaRequerido;
                  return false;
                };
                const isRequerido = (dt: any) => {
                  if (!dt.requerido) return false;
                  if (isOptInDoc(dt.nombre)) return optInChecked(dt.nombre);
                  return true;
                };
                const visible = (docTypes as any[]).filter((dt) => {
                  if (form.tipo === "cescemex" && !dt.aplica_cescemex) return false;
                  if (form.tipo === "directo" && !dt.aplica_directo) return false;
                  if (dt.aplica_si_aval_distinto && !form.aval_es_distinto) return false;
                  const tp = form.tipo_persona ?? form.csf_tipo_persona ?? "moral";
                  if (tp === "moral" && dt.aplica_moral === false) return false;
                  if (tp === "fisica" && dt.aplica_fisica === false) return false;
                  return true;
                });
                const hasDocs = (dt: any) => (docs as any[]).some((d) => d.doc_type_id === dt.id);
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
                const groupFor = (dt: any): { key: string; label: string } => {
                  const n = (dt.nombre || "").toLowerCase();
                  if (dt.aplica_si_aval_distinto || n.includes("aval")) return { key: "aval", label: "Aval / Obligado solidario" };
                  if (n.includes("csf") || n.includes("situación fiscal") || n.includes("opinión") || n.includes("32-d")) return { key: "fiscal", label: "Documentos fiscales" };
                  if (n.includes("identificación") || n.includes("pasaporte") || n.includes("ine")) return { key: "identidad", label: "Identidad del representante" };
                  if (n.includes("comprobante de domicilio")) return { key: "domicilio", label: "Domicilio" };
                  if (n.includes("acta") || n.includes("poder") || n.includes("registro público")) return { key: "legal", label: "Sociedad y legal" };
                  if (n.includes("foto") || n.includes("croquis") || n.includes("maps")) return { key: "negocio", label: "Negocio" };
                  if (n.includes("bancario") || n.includes("cuenta")) return { key: "bancario", label: "Bancarios" };
                  return { key: "otros", label: "Otros" };
                };
                const order = ["fiscal", "identidad", "domicilio", "legal", "negocio", "bancario", "aval", "otros"];
                const groups: Record<string, { label: string; items: any[] }> = {};
                for (const dt of visible) {
                  const g = groupFor(dt);
                  if (!groups[g.key]) groups[g.key] = { label: g.label, items: [] };
                  groups[g.key].items.push(dt);
                }
                const totalReq = visible.filter((d) => isRequerido(d)).length;
                const doneReq = visible.filter((d) => isRequerido(d) && hasDocs(d)).length;
                const pct = totalReq > 0 ? Math.round((doneReq / totalReq) * 100) : 0;
                const toggleDocRequerido = async (nombre: string) => {
                  const col = OPT_IN_DOC_COLS[nombre];
                  if (!col) return;
                  const actual = (form as any)[col] === true;
                  const nuevo = !actual;
                  set(col as any, nuevo);
                  await (supabase as any).from("credit_requests").update({ [col]: nuevo }).eq("id", id!);
                  toast.success(nuevo ? `${nombre} marcado como requerido` : `${nombre} marcado como no requerido`);
                };
                return (
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
                      const isLegalGroup = k === "legal";
                      const reqCount = g.items.filter((d) => isRequerido(d)).length;
                      const reqDone = g.items.filter((d) => isRequerido(d) && hasDocs(d)).length;
                      const allDone = g.items.every((d) => !isRequerido(d) || hasDocs(d));
                      return (
                        <div key={k} className="space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm font-semibold uppercase tracking-wide ${GROUP_COLOR[k] || "text-slate-700"}`}>{g.label}</h3>
                            </div>
                            {reqCount > 0 && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${allDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                {reqDone}/{reqCount} requeridos
                              </span>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {g.items.map((dt) => {
                              const items = (docs as any[]).filter((d) => d.doc_type_id === dt.id);
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
                              <Icon className={`h-4.5 w-4.5 ${palette.iconColor}`} />
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
                                    onCheckedChange={() => toggleDocRequerido(dt.nombre)}
                                    className="scale-75"
                                  />
                                  <span>Requerido</span>
                                </label>
                              )}
                            </div>
                        </div>
                        {canAdd && (
                          <Button size="sm" variant="outline" className={`h-7 px-2 text-xs w-full ${palette.btn}`} onClick={() => openUploadDialog(dt.id, dt.nombre)}>
                            <FileUp className="h-3.5 w-3.5 mr-1" />{items.length > 0 ? "Agregar otro" : "Subir documento"}
                          </Button>
                        )}
                        {items.length > 0 && (
                          <div className="space-y-1">
                            {items.map((it: any) => (
                              (() => {
                                const vs = vencStatus(it.fecha_vencimiento);
                                const requiereVerif = it.metadata?.requiere_verificacion;
                                return (
                                  <div key={it.id} className="bg-white/70 rounded border border-white px-2 py-1.5 space-y-1">
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                      <button onClick={() => openDoc(it.url_archivo)} className="truncate text-left hover:underline flex-1">{it.nombre_archivo}</button>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                        it.estado === "recibido" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        it.estado === "rechazado" ? "bg-red-50 text-red-700 border-red-200" :
                                        it.estado === "vencido" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        "bg-slate-50 text-slate-700 border-slate-200"
                                      }`}>{it.estado}</span>
                                      {requiereVerif && (
                                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setVerifyDoc(it)}>
                                          <AlertTriangle className="h-3 w-3 mr-1" />Verificar
                                        </Button>
                                      )}
                                      {it.estado !== "recibido" && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Aprobar" onClick={() => setDocEstado(it.id, "recibido")}><Check className="h-3.5 w-3.5" /></Button>
                                      )}
                                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Rechazar" onClick={() => { const m = prompt("Motivo de rechazo:"); if (m) setDocEstado(it.id, "rechazado", m); }}><X className="h-3.5 w-3.5" /></Button>
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Eliminar" onClick={() => deleteDoc(it.id, it.url_archivo)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                      <button onClick={() => openEditFecha(it)} className="inline-flex items-center gap-1 hover:text-foreground">
                                        <CalendarClock className="h-3 w-3" />
                                        {it.fecha_emision ? `Emitido ${format(new Date(it.fecha_emision + "T00:00:00"), "dd/MM/yyyy")}` : "Sin fecha de emisión"}
                                      </button>
                                      {it.fecha_vencimiento && (
                                        <span>· Vence {format(new Date(it.fecha_vencimiento + "T00:00:00"), "dd/MM/yyyy")}</span>
                                      )}
                                      {vs && <span className={`px-1.5 py-0.5 rounded border ${vs.cls}`}>{vs.label}</span>}
                                    </div>
                                  </div>
                                );
                              })()
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
                );
              })()
            )}

            {/* Documentos adicionales (sin tipo) */}
            <div className="rounded-lg border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-fuchsia-100 flex items-center justify-center">
                    <Paperclip className="h-4 w-4 text-fuchsia-700" />
                  </div>
                  <p className="text-sm font-medium">Otros documentos</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-100" onClick={() => openUploadDialog(null, "Otro")}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adjuntar archivo
                </Button>
              </div>
              <div className="space-y-1">
                {(docs as any[]).filter((d) => !d.doc_type_id).map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between gap-2 text-xs bg-white/70 rounded px-2 py-1.5 border border-white">
                    <button onClick={() => openDoc(it.url_archivo)} className="truncate text-left hover:underline flex-1">{it.nombre_archivo}</button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteDoc(it.id, it.url_archivo)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ============ FIRMAS ============ */}
        <TabsContent value="firmas" className="space-y-4 mt-4">
          <Card><CardContent className="pt-6 space-y-3">
            {(() => {
              const tp = form.tipo_persona ?? form.csf_tipo_persona ?? "moral";
              const base = CREDITO_FIRMAS.filter((f) => {
                if (f.key === "lfpiorpi") return false;
                if (f.key === "solicitud") return false; // se reemplaza por entrada por empresa
                return !(f.personaMoralOnly && tp !== "moral");
              });
              const solicitudEntries: any[] = [];
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
              return [...solicitudEntries, ...base];
            })().map((f) => {
              const fecha = (form as any)[f.fechaCol];
              const nombre = (form as any)[f.nombreCol];
              const docIdCol = `${f.fechaCol.replace("_fecha", "")}_doc_id`;
              const docId = (form as any)[docIdCol];
              const doc = (docs as any[] | undefined)?.find((d) => d.id === docId);
              return (
                <div key={f.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-md p-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <ShieldCheck className={`h-5 w-5 mt-0.5 ${fecha ? "text-emerald-600" : "text-muted-foreground/40"}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{f.label}</p>
                      {fecha ? (
                        <p className="text-xs text-muted-foreground">
                          {nombre} · {format(new Date(fecha), "dd/MM/yyyy HH:mm")}
                          {doc?.url_archivo && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="text-emerald-700 hover:underline"
                                onClick={() => openDoc(doc.url_archivo)}
                              >
                                Ver documento firmado
                              </button>
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Pendiente de firmar</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openFirmaPdf(f)}>
                      <Printer className="h-4 w-4 mr-1" />Generar PDF
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-1" />
                        {fecha ? "Reemplazar firmado" : "Subir firmado"}
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
                    <Button size="sm" variant="ghost" disabled title="Próximamente">
                      <PenSquare className="h-4 w-4 mr-1" />Firmar en línea
                    </Button>
                    {fecha && (
                      <Button size="sm" variant="ghost" onClick={() => clearFirma(f)} title="Limpiar">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-2">
              Genera el PDF, imprime y firma físicamente, luego sube el documento escaneado. La firma en línea estará disponible próximamente.
            </p>
          </CardContent></Card>
        </TabsContent>

        {/* ============ SEGUIMIENTO ============ */}
        <TabsContent value="seguimiento" className="space-y-4 mt-4">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Estado">
                <Select value={form.estado} onValueChange={changeEstado} disabled={!isAdminMgr && !hasAnyRole(["customer_service","accounting"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDITO_ESTADO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de crédito">
                <Select value={form.tipo || ""} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>
                    {CREDITO_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fecha límite"><Input type="date" value={form.fecha_limite || ""} onChange={(e) => set("fecha_limite", e.target.value || null)} /></Field>
              <Field label="Motivo de rechazo"><Input value={form.motivo_rechazo || ""} onChange={(e) => set("motivo_rechazo", e.target.value)} /></Field>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aprobaciones internas</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={!!form.direccion_aprobo} onCheckedChange={(v) => set("direccion_aprobo", v)} />
                  <span className="text-sm">Aprobado Dirección</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!form.lista_69_ok} onCheckedChange={(v) => set("lista_69_ok", v)} />
                  <span className="text-sm">Lista 69 OK</span>
                </div>
                <Field label="Resultado Cescemex">
                  <Input value={form.cescemex_resultado || ""} onChange={(e) => set("cescemex_resultado", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Historial */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><History className="h-3.5 w-3.5" />Historial</p>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                <div className="space-y-1">
                  {(history as any[]).map((h) => (
                    <div key={h.id} className="text-xs flex items-center gap-2 border-l-2 border-primary/40 pl-2 py-1">
                      <span className="text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}</span>
                      <span>{CREDITO_ESTADO_LABEL[h.estado_anterior || ""] || "—"} → <strong>{CREDITO_ESTADO_LABEL[h.estado_nuevo] || h.estado_nuevo}</strong></span>
                      {h.nota && <span className="text-muted-foreground">· {h.nota}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ============ COMENTARIOS ============ */}
        <TabsContent value="comentarios" className="space-y-4 mt-4">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Escribe un comentario..." rows={3} />
              <div className="flex items-center justify-between">
                <Select value={newCommentVis} onValueChange={(v) => setNewCommentVis(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interna">Interna</SelectItem>
                    <SelectItem value="publica">Visible al cliente</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addComment} disabled={!newCommentText.trim()}>
                  <MessageSquare className="h-4 w-4 mr-2" />Publicar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no hay comentarios.</p>
              ) : (
                (comments as any[]).map((c) => (
                  <div key={c.id} className="border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${c.visibilidad === "publica" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {c.visibilidad === "publica" ? "Cliente" : "Interna"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.contenido}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Share portal dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight">Enviar al cliente</DialogTitle>
            <DialogDescription className="text-xs">Comparte esta liga única con el cliente. Le da acceso al portal sin necesidad de cuenta.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-3 font-light">
            <div className="bg-muted rounded-md p-2 text-xs break-all font-mono">{portalUrl}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success("Copiado"); }}>
                <Copy className="h-4 w-4 mr-2" />Copiar
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(portalUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />Abrir
              </Button>
            </div>
            {form.correo_contacto && (
              <Button size="sm" className="w-full" onClick={() => window.location.href = `mailto:${form.correo_contacto}?subject=Solicitud de crédito ${form.folio}&body=Hola,%0D%0A%0D%0AAccede a tu portal para continuar con tu solicitud:%0D%0A${encodeURIComponent(portalUrl)}`}>
                <Send className="h-4 w-4 mr-2" />Enviar por correo
              </Button>
            )}
          </div>
          <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={!!uploadCtx} onOpenChange={(o) => { if (!o) { setUploadCtx(null); setUploadFile(null); setUploadName(""); } }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight">Subir documento</DialogTitle>
            <DialogDescription className="text-xs">{uploadCtx?.docTypeName}</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 font-light">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nombre del documento</Label>
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Ej. INE Juan Pérez, Predial 2025..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Archivo</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              {uploadFile && <p className="text-xs text-muted-foreground truncate">{uploadFile.name} · {(uploadFile.size / 1024).toFixed(0)} KB</p>}
            </div>
          </div>
          <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
            <Button variant="outline" onClick={() => { setUploadCtx(null); setUploadFile(null); setUploadName(""); }}>Cancelar</Button>
            <Button onClick={confirmUpload} disabled={uploadingDoc || !uploadFile || !uploadName.trim()}>
              {uploadingDoc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit fecha emisión dialog */}
      <Dialog open={!!editFechaDoc} onOpenChange={(o) => { if (!o) setEditFechaDoc(null); }}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-5 py-4 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight">Fecha de emisión</DialogTitle>
            <DialogDescription className="text-xs">{editFechaDoc?.nombre_archivo}</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-5 space-y-3 font-light">
            <Field label="Fecha de emisión del documento">
              <Input type="date" value={editFechaValue} onChange={(e) => setEditFechaValue(e.target.value)} />
            </Field>
            {(() => {
              const dt = (docTypes as any[]).find((t) => t.id === editFechaDoc?.doc_type_id);
              const venc = computeVencimiento(editFechaValue || null, dt);
              if (!dt) return null;
              return (
                <p className="text-[11px] text-muted-foreground">
                  Validez: {dt.validez_tipo === "fin_mes_emision" ? "hasta el último día del mes de emisión" : (dt.vigencia_dias ? `${dt.vigencia_dias} días desde la emisión` : "sin caducidad configurada")}
                  {venc && ` · Vencerá el ${format(new Date(venc + "T00:00:00"), "dd/MM/yyyy")}`}
                </p>
              );
            })()}
          </div>
          <DialogFooter className="bg-muted/40 px-5 py-3 border-t">
            <Button variant="outline" onClick={() => setEditFechaDoc(null)}>Cancelar</Button>
            <Button onClick={saveEditFecha}><Save className="h-4 w-4 mr-2" />Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify comprobante dialog */}
      <Dialog open={!!verifyDoc} onOpenChange={(o) => { if (!o) setVerifyDoc(null); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-amber-50 to-yellow-50 px-5 py-4 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />Verificar comprobante de domicilio
            </DialogTitle>
            <DialogDescription className="text-xs">Compara el domicilio extraído del comprobante con el domicilio comercial de la CSF. Pueden existir ligeras variaciones.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-5 space-y-4 font-light">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">Domicilio comercial (CSF)</p>
                <p className="text-sm">{form.domicilio_comercial || <span className="text-muted-foreground italic">No capturado</span>}</p>
                {form.ciudad_comercial && <p className="text-xs text-muted-foreground">{form.ciudad_comercial}</p>}
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-amber-700 font-medium">Extraído del comprobante</p>
                <p className="text-sm">{verifyDoc?.metadata?.domicilio_extraido || <span className="text-muted-foreground italic">No detectado</span>}</p>
                <div className="text-xs text-muted-foreground space-x-2">
                  {verifyDoc?.metadata?.ciudad_extraida && <span>{verifyDoc.metadata.ciudad_extraida}</span>}
                  {verifyDoc?.metadata?.cp_extraido && <span>· CP {verifyDoc.metadata.cp_extraido}</span>}
                </div>
                {verifyDoc?.metadata?.titular_extraido && (
                  <p className="text-[11px] text-muted-foreground">Titular: {verifyDoc.metadata.titular_extraido}</p>
                )}
                {verifyDoc?.metadata?.proveedor && (
                  <p className="text-[11px] text-muted-foreground">Proveedor: {verifyDoc.metadata.proveedor}</p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si las direcciones coinciden razonablemente (mismas calle, colonia y CP), apruébalo. Si no, rechaza el documento e indica al cliente subir uno correcto.
            </p>
          </div>
          <DialogFooter className="bg-muted/40 px-5 py-3 border-t gap-2">
            <Button variant="outline" onClick={() => setVerifyDoc(null)}>Cerrar</Button>
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => {
              const m = prompt("Motivo de rechazo:"); if (!m) return;
              setDocEstado(verifyDoc.id, "rechazado", m);
              setVerifyDoc(null);
            }}><X className="h-4 w-4 mr-1" />Rechazar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={approveVerificacion}>
              <Check className="h-4 w-4 mr-1" />Aprobar coincidencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={companyId || undefined}
        onCreated={async (newId) => {
          await qc.invalidateQueries({ queryKey: ["credit-company-contacts", companyId] });
          setContact(newId);
        }}
      />
      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        editData={companyId ? ({ id: companyId, ...company } as any) : null}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["credit_request", id] });
        }}
      />
      <Dialog open={bcInfoOpen} onOpenChange={setBcInfoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 py-4 bg-gradient-to-br from-violet-50 to-blue-50 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-violet-700" />
              Beneficiario Controlador en México (SAT)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Información de referencia sobre el concepto y obligaciones aplicables.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-5 text-sm font-light leading-relaxed">
            <p>
              El <strong>beneficiario controlador</strong> es la persona física que,
              de manera directa o indirecta, ejerce control sobre una persona moral,
              fideicomiso u otra figura jurídica, o que se beneficia económicamente
              de ellas.
            </p>

            <section className="space-y-1.5 rounded-md border border-violet-100 bg-violet-50/50 p-3">
              <h4 className="text-[11px] uppercase tracking-wide font-medium text-violet-900">¿Por qué se solicita?</h4>
              <p>
                El <strong>artículo 17 de la Ley de Beneficiario Controlador</strong> incluye como Actividad Vulnerable:
              </p>
              <blockquote className="border-l-2 border-violet-300 pl-3 italic text-muted-foreground">
                "La comercialización o distribución de hidrocarburos, petrolíferos o petroquímicos."
              </blockquote>
              <p>
                Los combustibles (gasolina, diésel, turbosina) son <strong>petrolíferos</strong> conforme
                a la <strong>Ley de Hidrocarburos</strong>. Si la empresa matriz comercializa combustibles,
                cae directamente en esta categoría y está obligada a identificar a su Beneficiario Controlador.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Base legal</h4>
              <p>
                Surge de las reformas al <strong>Código Fiscal de la Federación (CFF)</strong>,
                artículos <strong>32-B Ter</strong>, <strong>32-B Quáter</strong> y <strong>32-B Quinquies</strong>,
                vigentes desde enero de 2022, en cumplimiento de estándares internacionales
                del <strong>GAFI</strong> (Grupo de Acción Financiera Internacional).
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">¿Quién es considerado beneficiario controlador?</h4>
              <p>Se considera como tal a quien cumpla alguno de estos criterios:</p>

              <div className="rounded-md border border-violet-100 bg-violet-50/50 p-3 space-y-1.5">
                <p className="font-medium text-violet-900">Por control directo o indirecto</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Posee el <strong>25% o más</strong> de acciones, partes sociales o derechos de voto.</li>
                  <li>Ejerce control sobre la administración, estrategia o políticas de la entidad.</li>
                  <li>Obtiene el <strong>25% o más</strong> de los beneficios o rendimientos.</li>
                </ul>
              </div>

              <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 space-y-1.5">
                <p className="font-medium text-blue-900">Por control de hecho</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Toma decisiones clave aunque no aparezca formalmente en documentos.</li>
                  <li>Es el <em>"dueño real"</em> detrás de la estructura jurídica.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Obligaciones para personas morales y figuras jurídicas</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Identificar a su(s) beneficiario(s) controlador(es).</li>
                <li>Obtener y conservar información actualizada (nombre, RFC, CURP, domicilio, participación, etc.).</li>
                <li>Proporcionar la información al <strong>SAT</strong> cuando sea requerida.</li>
                <li>Actualizar los datos ante cualquier cambio.</li>
              </ol>
            </section>
          </div>
          <DialogFooter className="px-6 py-3 bg-muted/40 border-t">
            <Button variant="outline" onClick={() => setBcInfoOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Generic JSONB array editor
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
            <div key={i} className="grid sm:grid-cols-3 gap-2 items-end border rounded-md p-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                  <Input type={f.type || "text"} value={row?.[f.key] ?? ""} onChange={(e) => update(i, f.key, f.type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value)} />
                </div>
              ))}
              <div className="sm:col-span-3 flex justify-end">
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
