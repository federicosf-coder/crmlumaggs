import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const INDUSTRIAS_OPTIONS = [
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

const EQUIPO_OPTIONS = ["Ensenada", "Mexicali", "San Luis", "San Quintín", "Tijuana", "Morelos"];
const TIPO_DESTINO_OPTIONS = ["Usuario final", "Revendedor"];
const POTENCIAL_UNIDADES_OPTIONS = [
  "UF1 1–10 unidades", "UF2 11–45 unidades", "UF3 46–90 unidades", "UF4 90 o más unidades",
  "R1 Menos de 45 unidades", "R2 46–90 unidades", "R3 91–135 unidades", "R4 135 o más unidades",
];
const TOMADOR_DECISION_OPTIONS = ["Dueño-operador", "Dueño + mecánico", "Encargado de mantenimiento", "Administrador / Compras"];
const RIESGO_OPTIONS = ["Alto", "Medio", "Bajo"];
const ORIGEN_CONTACTO_OPTIONS = ["Cliente nos buscó", "Prospección activa (nosotros lo buscamos)", "Referido técnico"];
const EVALUACION_OPTIONS = [
  "Premium – \"es el mejor\"", "Premium – \"cumple\"", "Medio – \"cumple\"",
  "Económico – \"cumple\"", "Económico – \"solo relleno\"",
];
const ROL_LUBRICANTE_OPTIONS = ["Crítico para la operación", "Importante pero no estratégico", "Insumo más"];
const TIPO_CLIENTE_OPTIONS = ["Contado", "Crédito directo", "Crédito Cescemex"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CompanyFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", industry: "", website: "", phone: "", email: "",
    address: "", city: "", state: "", zip_code: "", notes: "",
    // Classification fields
    industrias: [] as string[],
    equipo: "",
    tipo_destino_lubricante: "",
    potencial_unidades: "",
    tomador_decision: "",
    riesgo_cambio_marca: "",
    origen_contacto: "",
    evaluacion_lubricante: "",
    rol_lubricante: "",
    tipo_cliente_comercial: "",
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

  const reset = () => setForm({
    name: "", industry: "", website: "", phone: "", email: "",
    address: "", city: "", state: "", zip_code: "", notes: "",
    industrias: [], equipo: "", tipo_destino_lubricante: "", potencial_unidades: "",
    tomador_decision: "", riesgo_cambio_marca: "", origen_contacto: "",
    evaluacion_lubricante: "", rol_lubricante: "", tipo_cliente_comercial: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("companies").insert({
      name: form.name, industry: form.industry || null, website: form.website || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null,
      city: form.city || null, state: form.state || null, zip_code: form.zip_code || null,
      notes: form.notes || null, created_by: user?.id,
      industrias: form.industrias.length > 0 ? form.industrias : [],
      equipo: form.equipo || null,
      tipo_destino_lubricante: form.tipo_destino_lubricante || null,
      potencial_unidades: form.potencial_unidades || null,
      tomador_decision: form.tomador_decision || null,
      riesgo_cambio_marca: form.riesgo_cambio_marca || null,
      origen_contacto: form.origen_contacto || null,
      evaluacion_lubricante: form.evaluacion_lubricante || null,
      rol_lubricante: form.rol_lubricante || null,
      tipo_cliente_comercial: form.tipo_cliente_comercial || null,
    } as any).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa creada");
    reset();
    onOpenChange(false);
    onCreated?.(data.id);
  };

  const renderSelect = (label: string, value: string, key: string, options: string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={v => set(key, v)}>
        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva Empresa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2"><Label>Nombre de Empresa *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} required /></div>
                <div className="space-y-2"><Label>Industria</Label><Input value={form.industry} onChange={e => set("industry", e.target.value)} /></div>
                <div className="space-y-2"><Label>Sitio Web</Label><Input value={form.website} onChange={e => set("website", e.target.value)} /></div>
                <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
                <div className="space-y-2"><Label>Correo</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
                <div className="col-span-2 space-y-2"><Label>Dirección</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
                <div className="space-y-2"><Label>Ciudad</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
                <div className="space-y-2"><Label>Estado</Label><Input value={form.state} onChange={e => set("state", e.target.value)} /></div>
                <div className="space-y-2"><Label>Código Postal</Label><Input value={form.zip_code} onChange={e => set("zip_code", e.target.value)} /></div>
                <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
              </div>
            </TabsContent>

            <TabsContent value="clasificacion" className="space-y-4 mt-4">
              {/* Industrias - multi-select */}
              <div className="space-y-2">
                <Label>Industria (multiopción)</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-1 gap-2">
                  {INDUSTRIAS_OPTIONS.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.industrias.includes(opt)}
                        onCheckedChange={() => toggleIndustria(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderSelect("Equipo", form.equipo, "equipo", EQUIPO_OPTIONS)}
                {renderSelect("Tipo según destino del lubricante", form.tipo_destino_lubricante, "tipo_destino_lubricante", TIPO_DESTINO_OPTIONS)}
                {renderSelect("Potencial de unidades", form.potencial_unidades, "potencial_unidades", POTENCIAL_UNIDADES_OPTIONS)}
                {renderSelect("Tomador de decisión principal", form.tomador_decision, "tomador_decision", TOMADOR_DECISION_OPTIONS)}
                {renderSelect("Riesgo percibido al cambio de marca", form.riesgo_cambio_marca, "riesgo_cambio_marca", RIESGO_OPTIONS)}
                {renderSelect("Origen de la decisión / contacto", form.origen_contacto, "origen_contacto", ORIGEN_CONTACTO_OPTIONS)}
                {renderSelect("Evaluación del lubricante actual", form.evaluacion_lubricante, "evaluacion_lubricante", EVALUACION_OPTIONS)}
                {renderSelect("Rol del lubricante en su operación", form.rol_lubricante, "rol_lubricante", ROL_LUBRICANTE_OPTIONS)}
                {renderSelect("Tipo de cliente (condición comercial)", form.tipo_cliente_comercial, "tipo_cliente_comercial", TIPO_CLIENTE_OPTIONS)}
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Guardando..." : "Crear Empresa"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
