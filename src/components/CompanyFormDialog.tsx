import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
  "UF1", "UF2", "UF3", "UF4", "R1", "R2", "R3", "R4",
];

const TIPO_PAGO_OPTS = [
  { v: "contado", l: "Contado" }, { v: "credito", l: "Crédito" }, { v: "credito_cescemex", l: "Crédito Cescemex" },
];
const METODO_PAGO_OPTS = [
  { v: "PUE", l: "PUE - Pago en una sola exhibición" }, { v: "PPD", l: "PPD - Pago en parcialidades o diferido" },
];
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
  name: string; industry: string | null; website: string | null;
  phone: string | null; email: string | null; address: string | null;
  city: string | null; state: string | null; zip_code: string | null;
  notes: string | null; plaza_id: string | null;
  lista_precios: string | null;
  industrias: string[] | null;
  tipo_destino_lubricante: string | null; potencial_unidades: string | null;
  tomador_decision: string | null; riesgo_cambio_marca: string | null;
  origen_contacto: string | null; evaluacion_lubricante: string | null;
  rol_lubricante: string | null; tipo_cliente_comercial: string | null;
  uso_cfdi?: string | null; metodo_pago?: string | null; tipo_pago?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
  editData?: CompanyData | null;
}

const emptyForm = {
  name: "", industry: "", website: "", phone: "", email: "",
  notes: "",
  lista_precios: "",
  industrias: [] as string[],
  tipo_destino_lubricante: "", potencial_unidades: "",
  tomador_decision: "", riesgo_cambio_marca: "", origen_contacto: "",
  evaluacion_lubricante: "", rol_lubricante: "", tipo_cliente_comercial: "",
  uso_cfdi: "", metodo_pago: "", tipo_pago: "",
  plaza_ids: [] as string[],
  ejecutivo_ids: [] as string[],
};

export function CompanyFormDialog({ open, onOpenChange, onCreated, editData }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const isEdit = !!editData?.id;

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

  const toggleIndustria = (val: string) => {
    setForm(prev => ({
      ...prev,
      industrias: prev.industrias.includes(val)
        ? prev.industrias.filter(i => i !== val)
        : [...prev.industrias, val],
    }));
  };

  const togglePlaza = (plazaId: string) => {
    setForm(prev => ({
      ...prev,
      plaza_ids: prev.plaza_ids.includes(plazaId)
        ? prev.plaza_ids.filter(id => id !== plazaId)
        : [...prev.plaza_ids, plazaId],
    }));
  };

  const toggleEjecutivo = (userId: string) => {
    setForm(prev => ({
      ...prev,
      ejecutivo_ids: prev.ejecutivo_ids.includes(userId)
        ? prev.ejecutivo_ids.filter(id => id !== userId)
        : [...prev.ejecutivo_ids, userId],
    }));
  };

  const reset = () => setForm({ ...emptyForm });

  useEffect(() => {
    if (open && editData) {
      setForm({
        name: editData.name || "",
        industry: editData.industry || "",
        website: editData.website || "",
        phone: editData.phone || "",
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
        plaza_ids: [],
        ejecutivo_ids: [],
      });
    } else if (open && !editData) {
      reset();
    }
  }, [open, editData]);

  // Set plaza_ids and ejecutivo_ids from loaded data
  useEffect(() => {
    if (open && editData?.id) {
      setForm(prev => ({
        ...prev,
        ...(companyPlazas.length > 0 ? { plaza_ids: companyPlazas } : {}),
        ...(companyEjecutivos.length > 0 ? { ejecutivo_ids: companyEjecutivos } : {}),
      }));
    }
  }, [companyPlazas, companyEjecutivos, open, editData?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name, industry: form.industry || null, website: form.website || null,
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
      <Select value={value} onValueChange={v => set(key, v)}>
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
      <Select value={value} onValueChange={v => set(key, v === "none" ? "" : v)}>
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
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Nombre de Empresa *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} required className="h-9" /></div>

                {/* Plaza (multi-select) */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Plaza(s)</Label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {form.plaza_ids.map(pid => {
                      const p = plazas.find((pl: any) => pl.id === pid);
                      return p ? (
                        <Badge key={pid} variant="secondary" className="gap-1">
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
                </div>

                {/* Lista de Precios */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Lista de Precios</Label>
                  <Select value={form.lista_precios} onValueChange={v => set("lista_precios", v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar lista..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {LISTA_PRECIOS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de cliente (condición comercial) */}
                {renderSelect("Tipo de cliente (condición comercial)", form.tipo_cliente_comercial, "tipo_cliente_comercial", TIPO_CLIENTE_OPTIONS)}

                {/* Uso de CFDI */}
                {renderEnumSelect("Uso de CFDI", form.uso_cfdi, "uso_cfdi", USO_CFDI_OPTS)}

                {/* Forma de pago */}
                {renderEnumSelect("Forma de pago", form.tipo_pago, "tipo_pago", TIPO_PAGO_OPTS)}

                {/* Método de pago */}
                {renderEnumSelect("Método de pago", form.metodo_pago, "metodo_pago", METODO_PAGO_OPTS)}

                <div className="space-y-1.5"><Label className="text-xs">Sitio Web</Label><Input value={form.website} onChange={e => set("website", e.target.value)} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Teléfono</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Correo</Label><Input value={form.email} onChange={e => set("email", e.target.value)} className="h-9" /></div>

                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
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
                {renderSelect("Tomador de decisión principal", form.tomador_decision, "tomador_decision", TOMADOR_DECISION_OPTIONS)}
                {renderSelect("Riesgo percibido al cambio de marca", form.riesgo_cambio_marca, "riesgo_cambio_marca", RIESGO_OPTIONS)}
                {renderSelect("Origen de la decisión / contacto", form.origen_contacto, "origen_contacto", ORIGEN_CONTACTO_OPTIONS)}
                {renderSelect("Evaluación del lubricante actual", form.evaluacion_lubricante, "evaluacion_lubricante", EVALUACION_OPTIONS)}
                {renderSelect("Rol del lubricante en su operación", form.rol_lubricante, "rol_lubricante", ROL_LUBRICANTE_OPTIONS)}
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Empresa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
