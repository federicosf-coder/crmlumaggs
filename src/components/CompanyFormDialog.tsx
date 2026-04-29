import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyUnitsHeader } from "@/components/crm/CompanyUnitsHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ExternalLink } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
import { ContactFormDialog } from "@/components/ContactFormDialog";

// LADAs MX de 2 dígitos: formato +52 LL DDDD DDDD; resto: +52 LLL DDD DDDD.
const TWO_DIGIT_LADAS = new Set(["33", "55", "56", "81"]);
function formatMxPhoneInput(raw: string): string {
  if (!raw) return "+52";
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!hasPlus) {
    if (!digits) return "+52";
    if (!digits.startsWith("52")) digits = "52" + digits;
  } else if (!digits) {
    return "+";
  }
  if (digits.startsWith("52")) {
    const local = digits.slice(2, 12);
    if (local.length === 0) return "+52";
    if (local.length < 2) return `+52 ${local}`;
    const lada2 = local.slice(0, 2);
    if (TWO_DIGIT_LADAS.has(lada2)) {
      const rest = local.slice(2);
      const a = rest.slice(0, 4); const b = rest.slice(4, 8);
      return `+52 ${lada2}${a ? " " + a : ""}${b ? " " + b : ""}`;
    }
    if (local.length <= 3) return `+52 ${local}`;
    const lada3 = local.slice(0, 3);
    const a = local.slice(3, 6); const b = local.slice(6, 10);
    return `+52 ${lada3}${a ? " " + a : ""}${b ? " " + b : ""}`;
  }
  const cc = digits.slice(0, Math.min(3, digits.length));
  const rest = digits.slice(cc.length);
  if (!rest) return `+${cc}`;
  const groups = rest.match(/.{1,4}/g) || [];
  return `+${cc} ${groups.join(" ")}`;
}

export const INDUSTRIAS_OPTIONS = [
  "Agroindustria (campos, empacadoras, maquinaria)",
  "Construcción (obra civil, maquinaria, movimiento de tierra)",
  "Detalle / autoservicio (supermercados, mercados)",
  "Distribuidor o revendedor de lubricantes",
  "Entrega Corporativa",
  "Flota interna (consumo propio)",
  "Gasolinera",
  "Gobierno",
  "Gruas",
  "Industria – alimentos",
  "Industria – energía",
  "Industria – metalmecánica",
  "Industria – plásticos",
  "Industria – Maquiladora, Procesos varios",
  "Marítimo",
  "Minería",
  "Refaccionaria diesel",
  "Refaccionaria gasolina",
  "Revendedor / comercio industrial",
  "Servicio automotriz – taller automotriz",
  "Servicio automotriz – taller diésel",
  "Servicio transmisiones",
  "Transporte – carga",
  "Transporte – logística / paquetería",
  "Transporte – personal / pasajeros",
];


export const TIPO_DESTINO_OPTIONS = ["Usuario final", "Revendedor"];
export const POTENCIAL_UNIDADES_OPTIONS = [
  "UF1 1–10 unidades", "UF2 11–45 unidades", "UF3 46–90 unidades", "UF4 90 o más unidades",
  "R1 Menos de 45 unidades", "R2 46–90 unidades", "R3 91–135 unidades", "R4 135 o más unidades",
];
export const TOMADOR_DECISION_OPTIONS = ["Dueño-operador", "Dueño + mecánico", "Encargado de mantenimiento", "Administrador / Compras"];
export const RIESGO_OPTIONS = ["Alto", "Medio", "Bajo"];
export const ORIGEN_CONTACTO_OPTIONS = ["Cliente nos buscó", "Prospección activa (nosotros lo buscamos)", "Referido técnico"];
export const EVALUACION_OPTIONS = [
  "Premium – \"es el mejor\"", "Premium – \"cumple\"", "Medio – \"cumple\"",
  "Económico – \"cumple\"", "Económico – \"solo relleno\"",
];
export const ROL_LUBRICANTE_OPTIONS = ["Crítico para la operación", "Importante pero no estratégico", "Insumo más"];
export const TIPO_CLIENTE_OPTIONS = ["Contado", "Crédito directo", "Crédito Cescemex"];

export const LISTA_PRECIOS_OPTIONS = [
  { v: "UF1", l: "UF1 1–10 unidades" },
  { v: "UF2", l: "UF2 11–45 unidades" },
  { v: "UF3", l: "UF3 46–90 unidades" },
  { v: "UF4", l: "UF4 90 o más unidades" },
  { v: "R1", l: "R1 Menos de 45 unidades" },
  { v: "R2", l: "R2 46–90 unidades" },
  { v: "R3", l: "R3 91–135 unidades" },
  { v: "R4", l: "R4 135 o más unidades" },
];

const TIPO_PAGO_OPTS = [
  { v: "contado", l: "Contado" }, { v: "credito", l: "Crédito" }, { v: "credito_cescemex", l: "Crédito Cescemex" },
];
const METODO_PAGO_OPTS = [
  { v: "PUE", l: "PUE - Pago en una sola exhibición" }, { v: "PPD", l: "PPD - Pago en parcialidades o diferido" },
];
const FORMA_PAGO_OPTS = [
  { v: "01", l: "01 - Efectivo" },
  { v: "02", l: "02 - Cheque nominativo" },
  { v: "03", l: "03 - Transferencia electrónica" },
  { v: "04", l: "04 - Tarjeta de crédito" },
  { v: "05", l: "05 - Monedero electrónico" },
  { v: "06", l: "06 - Dinero electrónico" },
  { v: "08", l: "08 - Vales de despensa" },
  { v: "12", l: "12 - Dación en pago" },
  { v: "13", l: "13 - Pago por subrogación" },
  { v: "14", l: "14 - Pago por consignación" },
  { v: "15", l: "15 - Condonación" },
  { v: "17", l: "17 - Compensación" },
  { v: "23", l: "23 - Novación" },
  { v: "24", l: "24 - Confusión" },
  { v: "25", l: "25 - Remisión de deuda" },
  { v: "26", l: "26 - Prescripción o caducidad" },
  { v: "27", l: "27 - A satisfacción del acreedor" },
  { v: "28", l: "28 - Tarjeta de débito" },
  { v: "29", l: "29 - Tarjeta de servicios" },
  { v: "30", l: "30 - Aplicación de anticipos" },
  { v: "31", l: "31 - Intermediario pagos" },
  { v: "99", l: "99 - Por definir" },
];
export { FORMA_PAGO_OPTS };
const USO_CFDI_OPTS = [
  { v: "G01", l: "G01 - Adquisición de mercancías" }, { v: "G02", l: "G02 - Devoluciones, descuentos o bonificaciones" }, { v: "G03", l: "G03 - Gastos en general" },
  { v: "I01", l: "I01 - Construcciones" }, { v: "I02", l: "I02 - Mobiliario y equipo de oficina" }, { v: "I03", l: "I03 - Equipo de transporte" },
  { v: "I04", l: "I04 - Equipo de computo y accesorios" }, { v: "I05", l: "I05 - Dados, troqueles, moldes, matrices" }, { v: "I06", l: "I06 - Comunicaciones telefónicas" },
  { v: "I07", l: "I07 - Comunicaciones satelitales" }, { v: "I08", l: "I08 - Otra maquinaria y equipo" },
  { v: "D01", l: "D01 - Honorarios médicos" }, { v: "D02", l: "D02 - Gastos médicos por incapacidad" }, { v: "D03", l: "D03 - Gastos funerales" },
  { v: "D04", l: "D04 - Donativos" }, { v: "D05", l: "D05 - Intereses de créditos hipotecarios" }, { v: "D06", l: "D06 - Aportaciones voluntarias al SAR" },
  { v: "D07", l: "D07 - Primas por seguros de gastos médicos" }, { v: "D08", l: "D08 - Gastos de transportación escolar" }, { v: "D09", l: "D09 - Depósitos en cuentas de ahorro" },
  { v: "D10", l: "D10 - Pagos por servicios educativos" }, { v: "P01", l: "P01 - Por definir" }, { v: "S01", l: "S01 - Sin efectos fiscales" },
  { v: "CP01", l: "CP01 - Pagos" }, { v: "CN01", l: "CN01 - Nómina" },
];

export interface CompanyData {
  id?: string;
  name: string; razon_social?: string | null; industry: string | null; website: string | null;
  phone: string | null; email: string | null; address: string | null;
  city: string | null; state: string | null; zip_code: string | null;
  notes: string | null; plaza_id: string | null;
  lista_precios: string | null;
  industrias: string[] | null;
  tipo_destino_lubricante: string | null; potencial_unidades: string | null;
  tomador_decision: string | null; riesgo_cambio_marca: string | null;
  origen_contacto: string | null; evaluacion_lubricante: string | null;
  rol_lubricante: string | null; tipo_cliente_comercial: string | null;
  uso_cfdi?: string | null; metodo_pago?: string | null; tipo_pago?: string | null; forma_pago?: string | null;
  id_contpaq?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
  editData?: CompanyData | null;
}

const emptyForm = {
  name: "", razon_social: "", industry: "", website: "", phone: "+52", email: "",
  notes: "",
  lista_precios: "",
  industrias: [] as string[],
  tipo_destino_lubricante: "", potencial_unidades: "",
  tomador_decision: "", riesgo_cambio_marca: "", origen_contacto: "",
  evaluacion_lubricante: "", rol_lubricante: "", tipo_cliente_comercial: "",
  uso_cfdi: "", metodo_pago: "", tipo_pago: "", forma_pago: "",
  id_contpaq: "",
  plaza_ids: [] as string[],
  ejecutivo_ids: [] as string[],
};

export function CompanyFormDialog({ open, onOpenChange, onCreated, editData }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const isEdit = !!editData?.id;

  // Autosave (only meaningful in edit mode)
  const autosave = useAutosaveStatus(async (changes) => {
    if (!isEdit || !editData?.id) return;
    // Map form keys to db payload (skip junction-table keys)
    const dbPayload: Record<string, any> = {};
    for (const k of Object.keys(changes)) {
      if (k === "plaza_ids" || k === "ejecutivo_ids") continue;
      if (k === "industrias") {
        dbPayload.industrias = changes.industrias || [];
        continue;
      }
      const v = changes[k];
      // empty string -> null for nullable text/select fields, except name/razon_social
      if (k === "name" || k === "razon_social") {
        dbPayload[k] = (v ?? "").toString();
      } else if (k === "id_contpaq") {
        dbPayload[k] = (v ?? "").toString().trim() || null;
      } else {
        dbPayload[k] = v === "" || v == null ? null : v;
      }
    }
    if (Object.keys(dbPayload).length > 0) {
      const { error } = await supabase.from("companies").update(dbPayload as any).eq("id", editData!.id!);
      if (error) throw error;
    }
    // Junction syncs
    if ("plaza_ids" in changes) {
      await supabase.from("company_plazas").delete().eq("company_id", editData!.id!);
      if ((changes.plaza_ids || []).length > 0) {
        await supabase.from("company_plazas").insert(
          (changes.plaza_ids as string[]).map((pid) => ({ company_id: editData!.id!, plaza_id: pid }))
        );
      }
    }
    if ("ejecutivo_ids" in changes) {
      await supabase.from("company_ejecutivos").delete().eq("company_id", editData!.id!);
      if ((changes.ejecutivo_ids || []).length > 0) {
        await supabase.from("company_ejecutivos").insert(
          (changes.ejecutivo_ids as string[]).map((uid) => ({ company_id: editData!.id!, user_id: uid }))
        );
      }
    }
  });

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas_active"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_active"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
    },
  });

  // Load company plazas for edit
  const { data: companyPlazas = [] } = useQuery({
    queryKey: ["company_plazas", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await supabase.from("company_plazas").select("plaza_id").eq("company_id", editData.id);
      return (data || []).map((cp: any) => cp.plaza_id);
    },
    enabled: !!editData?.id && open,
  });

  // Load company ejecutivos for edit
  const { data: companyEjecutivos = [] } = useQuery({
    queryKey: ["company_ejecutivos", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await supabase.from("company_ejecutivos").select("user_id").eq("company_id", editData.id);
      return (data || []).map((ce: any) => ce.user_id);
    },
    enabled: !!editData?.id && open,
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Debounced autosave for text inputs; immediate for selects/blur
  const setAndSchedule = (k: string, v: string) => {
    set(k, v);
    autosave.scheduleSave(k, v);
  };
  const setAndSaveNow = (k: string, v: string) => {
    set(k, v);
    autosave.saveNow(k, v);
  };

  const toggleIndustria = (val: string) => {
    setForm(prev => {
      const next = prev.industrias.includes(val)
        ? prev.industrias.filter(i => i !== val)
        : [...prev.industrias, val];
      autosave.saveNow("industrias", next);
      return { ...prev, industrias: next };
    });
  };

  const togglePlaza = (plazaId: string) => {
    setForm(prev => {
      const next = prev.plaza_ids.includes(plazaId)
        ? prev.plaza_ids.filter(id => id !== plazaId)
        : [...prev.plaza_ids, plazaId];
      autosave.saveNow("plaza_ids", next);
      return { ...prev, plaza_ids: next };
    });
  };

  const toggleEjecutivo = (userId: string) => {
    setForm(prev => {
      const next = prev.ejecutivo_ids.includes(userId)
        ? prev.ejecutivo_ids.filter(id => id !== userId)
        : [...prev.ejecutivo_ids, userId];
      autosave.saveNow("ejecutivo_ids", next);
      return { ...prev, ejecutivo_ids: next };
    });
  };

  const reset = () => setForm({ ...emptyForm });

  useEffect(() => {
    if (open && editData) {
      autosave.setEnabled(false);
      setForm({
        name: editData.name || "",
        razon_social: (editData as any).razon_social || "",
        industry: editData.industry || "",
        website: editData.website || "",
        phone: formatMxPhoneInput(editData.phone || ""),
        email: editData.email || "",
        notes: editData.notes || "",
        lista_precios: editData.lista_precios || "",
        industrias: editData.industrias || [],
        tipo_destino_lubricante: editData.tipo_destino_lubricante || "",
        potencial_unidades: editData.potencial_unidades || "",
        tomador_decision: editData.tomador_decision || "",
        riesgo_cambio_marca: editData.riesgo_cambio_marca || "",
        origen_contacto: editData.origen_contacto || "",
        evaluacion_lubricante: editData.evaluacion_lubricante || "",
        rol_lubricante: editData.rol_lubricante || "",
        tipo_cliente_comercial: editData.tipo_cliente_comercial || "",
        uso_cfdi: (editData as any).uso_cfdi || "",
        metodo_pago: (editData as any).metodo_pago || "",
        tipo_pago: (editData as any).tipo_pago || "",
        forma_pago: (editData as any).forma_pago || "",
        id_contpaq: (editData as any).id_contpaq || "",
        plaza_ids: [],
        ejecutivo_ids: [],
      });
      // Seed last-saved snapshot to avoid duplicate saves
      autosave.seed({
        name: editData.name || "",
        razon_social: (editData as any).razon_social || "",
        industry: editData.industry || "",
        website: editData.website || "",
        phone: formatMxPhoneInput(editData.phone || ""),
        email: editData.email || "",
        notes: editData.notes || "",
        lista_precios: editData.lista_precios || "",
        industrias: editData.industrias || [],
        tipo_destino_lubricante: editData.tipo_destino_lubricante || "",
        potencial_unidades: editData.potencial_unidades || "",
        tomador_decision: editData.tomador_decision || "",
        riesgo_cambio_marca: editData.riesgo_cambio_marca || "",
        origen_contacto: editData.origen_contacto || "",
        evaluacion_lubricante: editData.evaluacion_lubricante || "",
        rol_lubricante: editData.rol_lubricante || "",
        tipo_cliente_comercial: editData.tipo_cliente_comercial || "",
        uso_cfdi: (editData as any).uso_cfdi || "",
        metodo_pago: (editData as any).metodo_pago || "",
        tipo_pago: (editData as any).tipo_pago || "",
        forma_pago: (editData as any).forma_pago || "",
        id_contpaq: (editData as any).id_contpaq || "",
        plaza_ids: [],
        ejecutivo_ids: [],
      });
      // Enable after mount tick so initial state changes don't trigger saves
      setTimeout(() => autosave.setEnabled(isEdit), 0);
    } else if (open && !editData) {
      autosave.setEnabled(false);
      reset();
    }
  }, [open, editData, isEdit]);

  // Set plaza_ids and ejecutivo_ids from loaded data
  useEffect(() => {
    if (open && editData?.id) {
      setForm(prev => ({
        ...prev,
        ...(companyPlazas.length > 0 ? { plaza_ids: companyPlazas } : {}),
        ...(companyEjecutivos.length > 0 ? { ejecutivo_ids: companyEjecutivos } : {}),
      }));
      autosave.seed({
        plaza_ids: companyPlazas,
        ejecutivo_ids: companyEjecutivos,
      });
    }
  }, [companyPlazas, companyEjecutivos, open, editData?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.plaza_ids.length === 0) {
      toast.error("La plaza es obligatoria");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name,
      razon_social: form.razon_social?.trim() || form.name,
      industry: form.industry || null, website: form.website || null,
      phone: form.phone || null, email: form.email || null,
      notes: form.notes || null,
      plaza_id: form.plaza_ids.length > 0 ? form.plaza_ids[0] : null,
      lista_precios: form.lista_precios || null,
      industrias: form.industrias.length > 0 ? form.industrias : [],
      tipo_destino_lubricante: form.tipo_destino_lubricante || null,
      potencial_unidades: form.potencial_unidades || null,
      tomador_decision: form.tomador_decision || null,
      riesgo_cambio_marca: form.riesgo_cambio_marca || null,
      origen_contacto: form.origen_contacto || null,
      evaluacion_lubricante: form.evaluacion_lubricante || null,
      rol_lubricante: form.rol_lubricante || null,
      tipo_cliente_comercial: form.tipo_cliente_comercial || null,
      uso_cfdi: form.uso_cfdi || null,
      metodo_pago: form.metodo_pago || null,
      tipo_pago: form.tipo_pago || null,
      forma_pago: form.forma_pago || null,
      id_contpaq: form.id_contpaq?.trim() || null,
    } as any;

    let result;
    if (isEdit) {
      result = await supabase.from("companies").update(payload).eq("id", editData!.id!).select("id").single();
    } else {
      payload.created_by = user?.id;
      result = await supabase.from("companies").insert(payload).select("id").single();
    }

    if (result.error) { setSaving(false); toast.error(result.error.message); return; }

    // Sync company_plazas
    const companyId = result.data.id;
    await supabase.from("company_plazas").delete().eq("company_id", companyId);
    if (form.plaza_ids.length > 0) {
      await supabase.from("company_plazas").insert(
        form.plaza_ids.map(pid => ({ company_id: companyId, plaza_id: pid }))
      );
    }

    // Sync company_ejecutivos
    await supabase.from("company_ejecutivos").delete().eq("company_id", companyId);
    if (form.ejecutivo_ids.length > 0) {
      await supabase.from("company_ejecutivos").insert(
        form.ejecutivo_ids.map(uid => ({ company_id: companyId, user_id: uid }))
      );
    }

    setSaving(false);
    toast.success(isEdit ? "Empresa actualizada" : "Empresa creada");
    reset();
    onOpenChange(false);
    onCreated?.(companyId);
  };

  const renderSelect = (label: string, value: string, key: string, options: string[]) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={v => setAndSaveNow(key, v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const renderEnumSelect = (label: string, value: string, key: string, options: { v: string; l: string }[]) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={v => setAndSaveNow(key, v === "none" ? "" : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin asignar</SelectItem>
          {options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && (
            <div className="sticky top-0 z-10 -mx-6 -mt-2 px-6 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-3">
              <AutosaveIndicator status={autosave.status} />
              <Button type="submit" size="sm" disabled={saving || form.plaza_ids.length === 0}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
          {isEdit && editData?.id && <CompanyUnitsHeader companyId={editData.id} />}
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre Comercial *</Label>
                  <Input
                    value={form.name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(prev => {
                        const shouldSync = !prev.razon_social || prev.razon_social === prev.name;
                        return { ...prev, name: v, razon_social: shouldSync ? v : prev.razon_social };
                      });
                      autosave.scheduleSave("name", v);
                    }}
                    onBlur={e => autosave.saveNow("name", e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">ID Contpaq</Label><Input value={form.id_contpaq} onChange={e => setAndSchedule("id_contpaq", e.target.value)} onBlur={e => autosave.saveNow("id_contpaq", e.target.value)} className="h-9" placeholder="—" /></div>
              </div>
              {/* Razón Social + Plaza */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Razón Social</Label>
                  <Input
                    value={form.razon_social}
                    onChange={e => setAndSchedule("razon_social", e.target.value)}
                    onBlur={e => autosave.saveNow("razon_social", e.target.value)}
                    className="h-9"
                    placeholder="Nombre legal/fiscal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Plaza(s) <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[0]">
                    {form.plaza_ids.map(pid => {
                      const p = plazas.find((pl: any) => pl.id === pid);
                      return p ? (
                        <Badge key={pid} variant="secondary" className="gap-1 text-xs">
                          {p.nombre}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => togglePlaza(pid)} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                  <Select value="" onValueChange={v => { if (v && !form.plaza_ids.includes(v)) togglePlaza(v); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Agregar plaza..." /></SelectTrigger>
                    <SelectContent>
                      {plazas.filter((p: any) => !form.plaza_ids.includes(p.id)).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.plaza_ids.length === 0 && (
                    <p className="text-xs text-destructive">La plaza es obligatoria</p>
                  )}
                </div>
              </div>

              {/* Contacto: Correo, Teléfono, Sitio Web */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Correo</Label><Input type="email" value={form.email} onChange={e => setAndSchedule("email", e.target.value)} onBlur={e => autosave.saveNow("email", e.target.value)} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Teléfono</Label><Input type="tel" inputMode="tel" placeholder="+52..." value={form.phone} onChange={e => setAndSchedule("phone", formatMxPhoneInput(e.target.value))} onBlur={e => autosave.saveNow("phone", formatMxPhoneInput(e.target.value))} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Sitio Web</Label><Input value={form.website} onChange={e => setAndSchedule("website", e.target.value)} onBlur={e => autosave.saveNow("website", e.target.value)} className="h-9" /></div>
              </div>

              {/* Ejecutivo de Venta (multi-select) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ejecutivo(s) de Venta</Label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {form.ejecutivo_ids.map(uid => {
                    const p = profiles.find((pr: any) => pr.user_id === uid);
                    return p ? (
                      <Badge key={uid} variant="secondary" className="gap-1">
                        {p.full_name || p.email}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEjecutivo(uid)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
                <SearchableSelect
                  value=""
                  onValueChange={v => { if (v && !form.ejecutivo_ids.includes(v)) toggleEjecutivo(v); }}
                  options={profiles.filter((p: any) => !form.ejecutivo_ids.includes(p.user_id)).map((p: any) => ({ value: p.user_id, label: p.full_name || p.email || "Sin nombre" }))}
                  placeholder="Agregar ejecutivo..."
                />
              </div>

              {/* Datos comerciales y fiscales — compactos */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                {/* Lista de Precios */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Lista de Precios</Label>
                  <Select value={form.lista_precios} onValueChange={v => setAndSaveNow("lista_precios", v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {LISTA_PRECIOS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Pago (condición comercial) */}
                {renderEnumSelect("Tipo de Pago", form.tipo_pago, "tipo_pago", TIPO_PAGO_OPTS)}

                {/* Forma de Pago (SAT) */}
                {renderEnumSelect("Forma de Pago (SAT)", form.forma_pago, "forma_pago", FORMA_PAGO_OPTS)}

                {/* Método de pago */}
                {renderEnumSelect("Método de Pago", form.metodo_pago, "metodo_pago", METODO_PAGO_OPTS)}

                {/* Uso de CFDI */}
                <div className="col-span-2 md:col-span-2">
                  {renderEnumSelect("Uso de CFDI", form.uso_cfdi, "uso_cfdi", USO_CFDI_OPTS)}
                </div>
              </div>

              {/* Notas — al final del formulario */}
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs">Notas</Label>
                <Textarea value={form.notes} onChange={e => setAndSchedule("notes", e.target.value)} onBlur={e => autosave.saveNow("notes", e.target.value)} rows={3} placeholder="Notas internas sobre la empresa..." />
              </div>
            </TabsContent>

            <TabsContent value="clasificacion" className="space-y-4 mt-4">
              {/* Industrias as searchable chips */}
              <div className="space-y-1.5">
                <Label className="text-xs">Industria (multiopción)</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.industrias.map(ind => (
                    <Badge key={ind} variant="secondary" className="gap-1 text-xs">
                      {ind}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleIndustria(ind)} />
                    </Badge>
                  ))}
                </div>
                <Select value="" onValueChange={v => { if (v && !form.industrias.includes(v)) toggleIndustria(v); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Agregar industria..." /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIAS_OPTIONS.filter(o => !form.industrias.includes(o)).map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderSelect("Tipo según destino del lubricante", form.tipo_destino_lubricante, "tipo_destino_lubricante", TIPO_DESTINO_OPTIONS)}
                {renderSelect("Potencial de unidades", form.potencial_unidades, "potencial_unidades", POTENCIAL_UNIDADES_OPTIONS)}
                {renderSelect("Tipo de cliente (clasificación)", form.tipo_cliente_comercial, "tipo_cliente_comercial", TIPO_CLIENTE_OPTIONS)}
                {renderSelect("Tomador de decisión principal", form.tomador_decision, "tomador_decision", TOMADOR_DECISION_OPTIONS)}
                {renderSelect("Riesgo percibido al cambio de marca", form.riesgo_cambio_marca, "riesgo_cambio_marca", RIESGO_OPTIONS)}
                {renderSelect("Origen de la decisión / contacto", form.origen_contacto, "origen_contacto", ORIGEN_CONTACTO_OPTIONS)}
                {renderSelect("Evaluación del lubricante actual", form.evaluacion_lubricante, "evaluacion_lubricante", EVALUACION_OPTIONS)}
                {renderSelect("Rol del lubricante en su operación", form.rol_lubricante, "rol_lubricante", ROL_LUBRICANTE_OPTIONS)}
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full" disabled={saving || form.plaza_ids.length === 0}>
            {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Empresa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
