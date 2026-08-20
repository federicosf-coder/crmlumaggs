import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyUnitsHeader } from "@/components/crm/CompanyUnitsHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ExternalLink, FileText } from "lucide-react";
import { MapPin } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { CompanyAddressDialog } from "@/components/directory/CompanyAddressDialog";
import { useIndustriasCatalog } from "@/hooks/useIndustriasCatalog";

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
export const TIPO_CLIENTE_OPTIONS = ["Contado", "Crédito Directo", "Crédito Cescemex"];

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
  { v: "contado", l: "Contado" },
  { v: "credito", l: "Crédito (sin clasificar)" },
  { v: "credito_directo", l: "Crédito Directo" },
  { v: "credito_cescemex", l: "Crédito Cescemex" },
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
export const USO_CFDI_OPTS = [
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
  clabe_bancaria?: string | null;
  tarjeta_ultimos4?: string | null;
  limite_credito?: number | null;
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
  clabe_bancaria: "",
  tarjeta_ultimos4: "",
  limite_credito: 0,
  plaza_ids: [] as string[],
  ejecutivo_ids: [] as string[],
};


export function CompanyFormDialog({ open, onOpenChange, onCreated, editData }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: industriasCatalog = [] } = useIndustriasCatalog();
  const [form, setForm] = useState({ ...emptyForm });
  const isEdit = !!editData?.id;
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  // Contactos seleccionados/creados en modo nuevo (se vinculan al crear la empresa)
  const [pendingContactIds, setPendingContactIds] = useState<string[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  // Contacto principal (id) — vinculado a companies.primary_contact_id
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);

  // Cargar contacto principal actual de la empresa en modo edición
  useQuery({
    queryKey: ["company_primary_contact", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return null;
      const { data } = await supabase
        .from("companies")
        .select("primary_contact_id")
        .eq("id", editData.id)
        .maybeSingle();
      setPrimaryContactId((data as any)?.primary_contact_id ?? null);
      return data;
    },
    enabled: !!editData?.id && open,
  });

  const updatePrimaryContact = async (contactId: string | null) => {
    setPrimaryContactId(contactId);
    if (isEdit && editData?.id) {
      const { error } = await supabase
        .from("companies")
        .update({ primary_contact_id: contactId } as any)
        .eq("id", editData.id);
      if (error) {
        toast.error("No se pudo actualizar el contacto principal");
      } else {
        toast.success("Contacto principal actualizado");
      }
    }
  };

  // Load contacts linked to this company
  const { data: companyContacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["company_contacts_form", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, email2, phone, mobile, whatsapp_phone, tel_emp, job_title, department, company_id, notes, comm_email, comm_email2, comm_whatsapp, comm_cel, comm_tel, comm_tel_emp, is_active")
        .eq("company_id", editData.id)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
    enabled: !!editData?.id && open,
  });

  // Direcciones vinculadas a la empresa (para pestaña Direcciones)
  const { data: companyAddresses = [] } = useQuery({
    queryKey: ["company_addresses_form", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("id, nombre, tipo, tipos, calle, ciudad, estado, codigo_postal, direccion_completa, referencia, coordenadas_lat, coordenadas_lng")
        .eq("empresa_id", editData.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!editData?.id && open,
  });

  const { data: tiposDireccionCatalog = [] } = useQuery({
    queryKey: ["tipos_direccion_catalog_form"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion")
        .select("clave, etiqueta")
        .eq("is_active", true);
      return (data || []) as { clave: string; etiqueta: string }[];
    },
    enabled: open,
  });
  const labelTipoDireccion = (clave: string) =>
    tiposDireccionCatalog.find((t) => t.clave === clave)?.etiqueta || clave;

  // Contactos disponibles para vincular al crear empresa (sin company_id o seleccionados)
  const { data: pendingContactsData = [], refetch: refetchPendingContacts } = useQuery({
    queryKey: ["pending_contacts_for_new_company", pendingContactIds.join(",")],
    queryFn: async () => {
      if (pendingContactIds.length === 0) return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, job_title")
        .in("id", pendingContactIds);
      return data || [];
    },
    enabled: !isEdit && open && pendingContactIds.length > 0,
  });

  // Catálogo de contactos sin empresa para seleccionar al crear empresa
  const { data: unlinkedContacts = [], refetch: refetchUnlinkedContacts } = useQuery({
    queryKey: ["unlinked_contacts_for_new_company"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, job_title")
        .is("company_id", null)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
    enabled: !isEdit && open,
  });

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
      } else if (k === "id_contpaq" || k === "clabe_bancaria" || k === "tarjeta_ultimos4") {
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
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name").range(from, to));
      return data;
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

  const reset = () => { setForm({ ...emptyForm }); setPendingContactIds([]); };

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
        clabe_bancaria: (editData as any).clabe_bancaria || "",
        tarjeta_ultimos4: (editData as any).tarjeta_ultimos4 || "",
        limite_credito: Number((editData as any).limite_credito ?? 0),
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
        clabe_bancaria: (editData as any).clabe_bancaria || "",
        tarjeta_ultimos4: (editData as any).tarjeta_ultimos4 || "",
        limite_credito: Number((editData as any).limite_credito ?? 0),
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
    const trimmedName = form.name.trim().toUpperCase();
    if (!trimmedName) {
      toast.error("El nombre de la empresa es obligatorio");
      return;
    }
    if (form.plaza_ids.length === 0) {
      toast.error("La plaza es obligatoria");
      return;
    }
    setSaving(true);

    // Pre-insert: verificar duplicado por nombre (case-insensitive) en modo creación
    if (!isEdit) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id, name, is_active")
        .ilike("name", trimmedName)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        setSaving(false);
        toast.error(`Ya existe una empresa con el nombre "${existing.name}"`, {
          description: existing.is_active === false
            ? "Está marcada como inactiva. Ábrela para reactivarla."
            : "Abre la empresa existente para editarla o agregar información.",
          action: {
            label: "Abrir empresa",
            onClick: () => {
              onOpenChange(false);
              window.location.href = `/directory?company=${existing.id}&select=${existing.id}`;
            },
          },
          duration: 10000,
        });
        return;
      }
    }

    const payload = {
      name: trimmedName,
      razon_social: (form.razon_social?.trim().toUpperCase()) || trimmedName,
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
      clabe_bancaria: form.clabe_bancaria?.trim() || null,
      tarjeta_ultimos4: form.tarjeta_ultimos4?.trim() || null,
      limite_credito: Number((form as any).limite_credito ?? 0),
    } as any;


    let result;
    if (isEdit) {
      result = await supabase.from("companies").update(payload).eq("id", editData!.id!).select("id").single();
    } else {
      payload.created_by = user?.id;
      result = await supabase.from("companies").insert(payload).select("id").single();
    }

    if (result.error) {
      setSaving(false);
      const code = (result.error as any).code;
      if (code === "23505") {
        toast.error("Ya existe un registro con esos datos", {
          description: "Revisa el nombre de la empresa o busca el registro existente en el listado.",
          duration: 8000,
        });
      } else if (code === "42501" || /row-level security/i.test(result.error.message)) {
        toast.error("No tienes permisos para crear esta empresa", {
          description: "Contacta al administrador para revisar tus permisos del módulo Directorio.",
        });
      } else {
        toast.error(`No se pudo guardar: ${result.error.message}`);
      }
      return;
    }

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

    // Vincular contactos pendientes (sólo en modo creación)
    if (!isEdit && pendingContactIds.length > 0) {
      await supabase
        .from("contacts")
        .update({ company_id: companyId })
        .in("id", pendingContactIds);
    }

    // Guardar contacto principal si fue seleccionado durante la creación
    if (!isEdit && primaryContactId) {
      await supabase
        .from("companies")
        .update({ primary_contact_id: primaryContactId } as any)
        .eq("id", companyId);
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
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Header refinado con gradiente */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEdit ? "Editar Empresa" : "Nueva Empresa"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isEdit && editData?.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    navigate(`/documents/new?empresa_id=${editData.id}`);
                    onOpenChange(false);
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Agregar documento
                </Button>
              )}
              {isEdit && <AutosaveIndicator status={autosave.status} />}
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            {isEdit ? "Actualiza los datos comerciales y fiscales." : "Captura los datos para registrar una nueva empresa."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 font-light">
          {isEdit && editData?.id && <CompanyUnitsHeader companyId={editData.id} />}
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              {isEdit && <TabsTrigger value="direcciones" className="flex-1">Direcciones</TabsTrigger>}
              <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
              <TabsTrigger value="facturacion" className="flex-1">Detalles Facturación</TabsTrigger>
              <TabsTrigger value="decision" className="flex-1">Proceso Decisión</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre Comercial *</Label>
                  <Input
                    value={form.name}
                     onChange={e => {
                       const v = e.target.value.toUpperCase();
                      setForm(prev => {
                        const shouldSync = !prev.razon_social || prev.razon_social === prev.name;
                        return { ...prev, name: v, razon_social: shouldSync ? v : prev.razon_social };
                      });
                      autosave.scheduleSave("name", v);
                    }}
                    onBlur={e => autosave.saveNow("name", e.target.value.toUpperCase())}
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
                    onChange={e => setAndSchedule("razon_social", e.target.value.toUpperCase())}
                    onBlur={e => autosave.saveNow("razon_social", e.target.value.toUpperCase())}
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

              {/* Sitio Web + Ejecutivo(s) de Venta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sitio Web</Label>
                  <Input value={form.website} onChange={e => setAndSchedule("website", e.target.value)} onBlur={e => autosave.saveNow("website", e.target.value)} className="h-9" />
                </div>
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
              </div>

              {/* Datos comerciales y fiscales — compactos */}

              {/* Contactos de la empresa (visible en alta y edición) */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Contactos de la empresa</Label>
                  <div className="flex gap-2">
                    {!isEdit && (
                      <SearchableSelect
                        value=""
                        onValueChange={(v) => {
                          if (v && !pendingContactIds.includes(v)) {
                            setPendingContactIds(prev => [...prev, v]);
                          }
                        }}
                        options={unlinkedContacts
                          .filter((c: any) => !pendingContactIds.includes(c.id))
                          .map((c: any) => ({
                            value: c.id,
                            label: `${c.first_name} ${c.last_name}${c.job_title ? ` — ${c.job_title}` : ""}`,
                          }))}
                        placeholder="Seleccionar contacto existente..."
                      />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingContact(null); setContactDialogOpen(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Agregar contacto
                    </Button>
                  </div>
                </div>
                {isEdit ? (
                  companyContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin contactos vinculados.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        Selecciona el contacto principal de la empresa
                      </p>
                      {companyContacts.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5 text-sm">
                          <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="radio"
                              name="primary-contact"
                              checked={primaryContactId === c.id}
                              onChange={() => updatePrimaryContact(c.id)}
                              className="h-3.5 w-3.5"
                              title="Marcar como contacto principal"
                            />
                            <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {c.first_name} {c.last_name}
                              {c.job_title && <span className="text-muted-foreground font-normal"> — {c.job_title}</span>}
                              {primaryContactId === c.id && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">Principal</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                              <span className="truncate">{c.email || "—"}</span>
                              <span>·</span>
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-[#25D366]" aria-label="WhatsApp">
                                <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91a9.82 9.82 0 0 0-2.91-7.02ZM12.04 20.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.06 0 1.21.88 2.38 1 2.55.12.16 1.74 2.66 4.21 3.73.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.18-.47-.3Z"/>
                              </svg>
                              <span className="truncate">{c.whatsapp_phone || "—"}</span>
                            </div>
                            </div>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingContact(c); setContactDialogOpen(true); }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  pendingContactsData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aún no hay contactos. Crea uno nuevo o selecciona uno existente; se vincularán al guardar.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        Selecciona el contacto principal de la empresa
                      </p>
                      {pendingContactsData.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5 text-sm">
                          <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="radio"
                              name="primary-contact-pending"
                              checked={primaryContactId === c.id}
                              onChange={() => setPrimaryContactId(c.id)}
                              className="h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {c.first_name} {c.last_name}
                              {c.job_title && <span className="text-muted-foreground font-normal"> — {c.job_title}</span>}
                              {primaryContactId === c.id && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">Principal</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                              <span className="truncate">{c.email || "—"}</span>
                              <span>·</span>
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-[#25D366]" aria-label="WhatsApp">
                                <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91a9.82 9.82 0 0 0-2.91-7.02ZM12.04 20.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.06 0 1.21.88 2.38 1 2.55.12.16 1.74 2.66 4.21 3.73.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.18-.47-.3Z"/>
                              </svg>
                              <span className="truncate">{c.whatsapp_phone || "—"}</span>
                            </div>
                            </div>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPendingContactIds(prev => prev.filter(id => id !== c.id));
                              if (primaryContactId === c.id) setPrimaryContactId(null);
                            }}
                            title="Quitar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Notas — al final del formulario */}
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs">Notas</Label>
                <Textarea value={form.notes} onChange={e => setAndSchedule("notes", e.target.value)} onBlur={e => autosave.saveNow("notes", e.target.value)} rows={3} placeholder="Notas internas sobre la empresa..." />
              </div>
            </TabsContent>

            {isEdit && (
              <TabsContent value="direcciones" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <MapPin className="h-3.5 w-3.5" /> Direcciones de envío relacionadas
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingAddress(null); setAddressDialogOpen(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Agregar dirección
                    </Button>
                  </div>
                  {companyAddresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin direcciones vinculadas.</p>
                  ) : (
                    <div className="space-y-2">
                      {companyAddresses.map((a: any) => {
                        const tipos = (a.tipos && a.tipos.length ? a.tipos : [a.tipo]).filter(Boolean);
                        return (
                          <div key={a.id} className="rounded border bg-muted/30 px-3 py-2 text-sm space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="font-medium truncate">{a.nombre || a.direccion_completa || a.calle}</div>
                              <div className="flex items-center gap-1">
                                <div className="flex flex-wrap gap-1">
                                  {tipos.map((t: string) => (
                                    <Badge key={t} variant="outline" className="text-xs">{labelTipoDireccion(t)}</Badge>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => { setEditingAddress(a); setAddressDialogOpen(true); }}
                                  title="Abrir dirección"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <AddressDisplay
                                address={a.direccion_completa || a.calle}
                                lat={a.coordenadas_lat}
                                lng={a.coordenadas_lng}
                              />
                            </div>
                            {a.referencia && (
                              <p className="text-xs text-muted-foreground italic">Ref: {a.referencia}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="clasificacion" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
              {/* Industrias as searchable chips */}
              <div className="space-y-1.5">
                <Label className="text-xs">Industria (multiopción)</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.industrias.map(ind => (
                    <Badge key={ind} variant="secondary" className="gap-1 text-xs">
                      {industriasCatalog.find(c => c.clave === ind)?.etiqueta || ind}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleIndustria(ind)} />
                    </Badge>
                  ))}
                </div>
                <Select value="" onValueChange={v => { if (v && !form.industrias.includes(v)) toggleIndustria(v); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Agregar industria..." /></SelectTrigger>
                  <SelectContent>
                    {industriasCatalog
                      .filter(o => !form.industrias.includes(o.clave))
                      .map(o => (
                        <SelectItem key={o.clave} value={o.clave}>{o.etiqueta}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderSelect("Tipo según destino del lubricante", form.tipo_destino_lubricante, "tipo_destino_lubricante", TIPO_DESTINO_OPTIONS)}
                {/* Lista de precios (sustituye visualmente a "Potencial de Unidades") */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Lista de precios</Label>
                  <Select value={form.lista_precios} onValueChange={v => setAndSaveNow("lista_precios", v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {LISTA_PRECIOS_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="facturacion" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
              {/* Límite de crédito */}
              <LimiteCreditoField
                companyId={isEdit ? editData?.id : undefined}
                value={Number((form as any).limite_credito ?? 0)}
                onChange={(v) => {
                  setForm(prev => ({ ...prev, limite_credito: v } as any));
                  autosave.saveNow("limite_credito", v);
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                {renderEnumSelect("Tipo de Pago", form.tipo_pago, "tipo_pago", TIPO_PAGO_OPTS)}
                {renderEnumSelect("Forma de Pago (SAT)", form.forma_pago, "forma_pago", FORMA_PAGO_OPTS)}
                {renderEnumSelect("Método de Pago", form.metodo_pago, "metodo_pago", METODO_PAGO_OPTS)}
                {renderEnumSelect("Uso de CFDI", form.uso_cfdi, "uso_cfdi", USO_CFDI_OPTS)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">CLABE Bancaria</Label>
                  <Input
                    value={form.clabe_bancaria}
                    onChange={e => setAndSchedule("clabe_bancaria", e.target.value.replace(/\D/g, ""))}
                    onBlur={e => autosave.saveNow("clabe_bancaria", e.target.value.replace(/\D/g, ""))}
                    className="h-9"
                    placeholder="18 dígitos"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Últimos 4 dígitos de tarjeta</Label>
                  <Input
                    value={form.tarjeta_ultimos4}
                    onChange={e => setAndSchedule("tarjeta_ultimos4", e.target.value.replace(/\D/g, ""))}
                    onBlur={e => autosave.saveNow("tarjeta_ultimos4", e.target.value.replace(/\D/g, ""))}
                    className="h-9"
                    placeholder="0000"
                    maxLength={4}
                  />
                </div>
              </div>

            </TabsContent>

            <TabsContent value="decision" className="space-y-4 mt-4 min-h-[580px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {renderSelect("Tomador de decisión principal", form.tomador_decision, "tomador_decision", TOMADOR_DECISION_OPTIONS)}
                {renderSelect("Riesgo percibido al cambio de marca", form.riesgo_cambio_marca, "riesgo_cambio_marca", RIESGO_OPTIONS)}
                {renderSelect("Origen de la decisión / contacto", form.origen_contacto, "origen_contacto", ORIGEN_CONTACTO_OPTIONS)}
                {renderSelect("Evaluación del lubricante actual", form.evaluacion_lubricante, "evaluacion_lubricante", EVALUACION_OPTIONS)}
                {renderSelect("Rol del lubricante en su operación", form.rol_lubricante, "rol_lubricante", ROL_LUBRICANTE_OPTIONS)}
              </div>
            </TabsContent>
          </Tabs>
          </div>
          {/* Footer fijo */}
          <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || form.plaza_ids.length === 0}>
              {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Empresa"}
            </Button>
          </div>
        </form>
        <ContactFormDialog
          open={contactDialogOpen}
          onOpenChange={(o) => {
            setContactDialogOpen(o);
            if (!o) {
              setEditingContact(null);
              if (isEdit) refetchContacts();
              else refetchUnlinkedContacts();
            }
          }}
          defaultCompanyId={isEdit ? editData?.id : undefined}
          defaultEjecutivoIds={form.ejecutivo_ids}
          pendingCompanyName={!isEdit ? (form.name || "Nueva empresa") : undefined}
          editData={editingContact}
          onCreated={(newId) => {
            if (isEdit) {
              refetchContacts();
            } else {
              // En modo nuevo: agregar a pendientes y refrescar catálogo
              setPendingContactIds(prev => prev.includes(newId) ? prev : [...prev, newId]);
              refetchUnlinkedContacts();
            }
          }}
        />
        {isEdit && editData?.id && (
          <CompanyAddressDialog
            open={addressDialogOpen}
            onOpenChange={(v) => { setAddressDialogOpen(v); if (!v) setEditingAddress(null); }}
            empresaId={editData.id}
            empresaName={form.name}
            editing={editingAddress}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LimiteCreditoField({
  companyId,
  value,
  onChange,
}: {
  companyId?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [inputVal, setInputVal] = useState(value > 0 ? value.toString() : "");
  const [saving, setSaving] = useState(false);
  const [creditoUtilizado, setCreditoUtilizado] = useState<number | null>(null);

  useEffect(() => { setInputVal(value > 0 ? value.toString() : ""); }, [value]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("documentos")
      .select("saldo_pendiente_cobranza")
      .eq("empresa_id", companyId)
      .neq("estatus_factura", "cancelada")
      .then(({ data }) => {
        const total = (data || []).reduce((s: number, d: any) => s + Number(d.saldo_pendiente_cobranza || 0), 0);
        setCreditoUtilizado(total);
      });
  }, [companyId]);

  const handleSave = async () => {
    const num = parseFloat(inputVal.replace(/,/g, "")) || 0;
    setSaving(true);
    onChange(num);
    setSaving(false);
    toast.success("Límite de crédito actualizado");
  };

  const limite = value;
  const utilizado = creditoUtilizado ?? 0;
  const disponible = Math.max(0, limite - utilizado);

  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Límite de crédito</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">$</span>
        <Input
          type="number"
          min={0}
          step={100}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="h-9 w-44"
          placeholder="0.00"
        />
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "..." : "Guardar"}
        </Button>
      </div>
      {companyId && creditoUtilizado !== null && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Utilizado: <span className="font-medium text-foreground">${utilizado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></span>
          <span>Disponible: <span className={`font-medium ${disponible <= 0 ? "text-destructive" : "text-primary"}`}>${disponible.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></span>
        </div>
      )}
    </div>
  );
}
