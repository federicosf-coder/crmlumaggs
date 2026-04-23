import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Save, Download, Pencil, Copy, FileText, ShoppingCart, ExternalLink } from "lucide-react";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format, addDays } from "date-fns";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Link } from "react-router-dom";
import { DocumentPagosSection } from "@/components/documents/DocumentPagosSection";

const ESTATUS_COT = [{ v: "borrador", l: "Borrador" }, { v: "impresa", l: "Impresa" }, { v: "enviada", l: "Enviada" }, { v: "aceptada", l: "Aceptada" }, { v: "rechazada", l: "Rechazada" }, { v: "vencida", l: "Vencida" }];
const ESTATUS_PED = [{ v: "confirmado_cliente", l: "Confirmado Cliente" }, { v: "validado_contabilidad", l: "Validado Contabilidad" }, { v: "programado_entrega", l: "Programado Entrega" }, { v: "entregado", l: "Entregado" }, { v: "cancelado", l: "Cancelado" }];
const ESTATUS_FAC = [{ v: "pendiente", l: "Pendiente" }, { v: "pagada", l: "Pagada" }, { v: "parcial", l: "Parcial" }, { v: "vencida", l: "Vencida" }, { v: "cancelada", l: "Cancelada" }];
const ESTATUS_ENT_CORP = [
  { v: "solicitada", l: "Solicitadas" },
  { v: "programada", l: "Programadas" },
  { v: "entregada", l: "Entregadas" },
  { v: "acuse_enviado", l: "Acuse Enviado" },
];
const TIPO_PAGO_OPTS = [{ v: "contado", l: "Contado" }, { v: "credito", l: "Crédito" }, { v: "credito_cescemex", l: "Crédito Cescemex" }];
const METODO_PAGO_OPTS = [{ v: "PUE", l: "PUE - Pago en una sola exhibición" }, { v: "PPD", l: "PPD - Pago en parcialidades o diferido" }];
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
const TIPO_DIRECCION_LABELS: Record<string, string> = { envio: "Entrega", fiscal: "Fiscal", comercial: "Comercial", sucursal: "Sucursal", principal: "Principal" };

interface LineItem {
  id?: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal: number;
  unidades_equivalentes: number;
  _nombre?: string;
}

export default function DocumentForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTipo = searchParams.get("tipo");
  const qc = useQueryClient();
  const { user, profile, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [viewMode, setViewMode] = useState(isEdit);
  const [generatePdfAfterSave, setGeneratePdfAfterSave] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultVencimiento = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const [form, setForm] = useState({
    empresa_vendedora: (initialTipo === "entrega_corporativa" ? "lumaggs_chevron" : "") as string,
    plaza_id: "",
    tipo_documento: (initialTipo === "entrega_corporativa" ? "entrega_corporativa" : "cotizacion") as string,
    ejecutivo_venta_id: "",
    empresa_id: "",
    contacto_id: "",
    fecha_documento: today,
    fecha_vencimiento: defaultVencimiento,
    iva_porcentaje: "8",
    numero_cotizacion: "",
    numero_pedido: "",
    numero_factura: "",
    estatus_cotizacion: "borrador",
    estatus_pedido: "confirmado_cliente",
    estatus_factura: "pendiente",
    estatus_entrega_corporativa: "solicitada",
    negocio_crm: "",
    notas: "",
    numero_oc_cliente: "",
    fecha_oc_cliente: "",
    direccion_envio: "",
    cotizacion_original_id: "",
    tipo_pago: "",
    uso_cfdi: "",
    metodo_pago: "",
    forma_pago: "",
    fecha_entrega_programada: "",
  });
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddrCalle, setNewAddrCalle] = useState("");
  const [newAddrCiudad, setNewAddrCiudad] = useState("");
  const [newAddrEstado, setNewAddrEstado] = useState("");
  const [newAddrCp, setNewAddrCp] = useState("");
  const [newAddrTipo, setNewAddrTipo] = useState("envio");
  const [newAddrLat, setNewAddrLat] = useState("");
  const [newAddrLng, setNewAddrLng] = useState("");
  const [newAddrGoogle, setNewAddrGoogle] = useState("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    codigo: "", nombre_producto: "", descripcion: "", presentacion_id: "",
    is_active: true, marca_id: "", aplicacion_id: "", uso_id: "", formula_id: "",
    viscosidad_id: "", categoria_id: "", linea_id: "",
    costo_actual: 0, precio_base_uf1: 0, precio_uf2: 0, precio_uf3: 0, precio_uf4: 0,
    precio_r1: 0, precio_r2: 0, precio_r3: 0, precio_r4: 0, precio_lista_galper: 0,
  });
  const setNP = (k: string, v: any) => setNewProductForm(prev => ({ ...prev, [k]: v }));

  // Lookups
  const { data: plazas = [] } = useQuery({ queryKey: ["plazas"], queryFn: async () => { const { data } = await supabase.from("plazas").select("*").eq("is_active", true).order("nombre"); return data || []; } });
  const { data: companies = [], refetch: refetchCompanies } = useQuery({ queryKey: ["companies"], queryFn: async () => { const { data } = await supabase.from("companies").select("id, name, lista_precios, uso_cfdi, metodo_pago, tipo_pago, id_contpaq").eq("is_active", true).order("name"); return data || []; } });
  // Note: forma_pago is also fetched but typed as any via spread below
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", form.empresa_id],
    queryFn: async () => {
      if (!form.empresa_id) return [];
      const { data } = await supabase.from("contacts").select("id, first_name, last_name, company_id").eq("is_active", true).eq("company_id", form.empresa_id).order("first_name");
      return data || [];
    },
  });
  const { data: addresses = [], refetch: refetchAddresses } = useQuery({
    queryKey: ["direcciones_empresa", form.empresa_id],
    queryFn: async () => {
      if (!form.empresa_id) return [];
      const { data } = await supabase.from("direcciones_empresa").select("*").eq("empresa_id", form.empresa_id).eq("is_active", true).order("tipo");
      return data || [];
    },
  });
  const { data: users = [] } = useQuery({ queryKey: ["profiles_list"], queryFn: async () => { const { data } = await supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"); return data || []; } });
  const { data: productos = [], refetch: refetchProductos } = useQuery({ queryKey: ["productos_list"], queryFn: async () => { const { data } = await supabase.from("productos").select("id, codigo, nombre_producto, descripcion, marca_id, precio_base_uf1, precio_uf2, precio_uf3, precio_uf4, precio_r1, precio_r2, precio_r3, precio_r4, presentaciones(nombre, unidades_equivalentes)").eq("is_active", true).order("codigo"); return data || []; } });
  const { data: empresaMarcas = [] } = useQuery({
    queryKey: ["empresa_marcas_filter", form.empresa_vendedora],
    queryFn: async () => {
      if (!form.empresa_vendedora) return [];
      const { data } = await supabase.from("empresa_marcas").select("marca_id").eq("empresa_vendedora", form.empresa_vendedora as any);
      return data || [];
    },
    enabled: !!form.empresa_vendedora,
  });
  const allowedMarcaIds = empresaMarcas.map((em: any) => em.marca_id);
  const filteredProductos = allowedMarcaIds.length > 0
    ? productos.filter((p: any) => p.marca_id && allowedMarcaIds.includes(p.marca_id))
    : productos;
  const { data: presentacionesList = [] } = useQuery({ queryKey: ["presentaciones"], queryFn: async () => { const { data } = await supabase.from("presentaciones").select("*").eq("is_active", true).order("nombre"); return data || []; } });
  const { data: allOptionValues = [] } = useQuery({ queryKey: ["product_option_values"], queryFn: async () => { const { data } = await supabase.from("product_option_values").select("*").eq("is_active", true).order("value"); return data || []; } });
  const optionsFor = (type: string) => allOptionValues.filter((o: any) => o.option_type === type);

  // Fetch cotizacion original info
  const { data: cotizacionOriginalDoc } = useQuery({
    queryKey: ["cotizacion_original", form.cotizacion_original_id],
    queryFn: async () => {
      if (!form.cotizacion_original_id) return null;
      const { data } = await supabase.from("documentos").select("id, numero_cotizacion").eq("id", form.cotizacion_original_id).single();
      return data;
    },
    enabled: !!form.cotizacion_original_id,
  });

  // Load existing
  const { data: existingDoc } = useQuery({
    queryKey: ["documento", id],
    queryFn: async () => { if (!id) return null; const { data, error } = await supabase.from("documentos").select("*").eq("id", id).single(); if (error) throw error; return data; },
    enabled: isEdit,
  });
  const { data: existingItems = [] } = useQuery({
    queryKey: ["documento_productos", id],
    queryFn: async () => { if (!id) return []; const { data, error } = await supabase.from("documento_productos").select("*, productos(codigo, nombre_producto)").eq("documento_id", id); if (error) throw error; return data; },
    enabled: isEdit,
  });

  // Set default ejecutivo for new documents
  useEffect(() => {
    if (!isEdit && user?.id && !form.ejecutivo_venta_id) {
      set("ejecutivo_venta_id", user.id);
    }
  }, [user?.id, isEdit]);

  // Set default plaza for new documents (user's plaza, or "Plaza Predeterminada" fallback)
  useEffect(() => {
    if (isEdit || form.plaza_id || plazas.length === 0) return;
    if (profile?.plaza_id) {
      set("plaza_id", profile.plaza_id);
    } else {
      const def = plazas.find((p: any) => p.nombre === "Plaza Predeterminada");
      if (def) set("plaza_id", def.id);
    }
  }, [profile?.plaza_id, plazas, isEdit, form.plaza_id]);

  // Auto-update fecha_vencimiento when fecha_documento changes (only if not editing existing)
  useEffect(() => {
    if (!isEdit && form.fecha_documento) {
      const venc = format(addDays(new Date(form.fecha_documento + "T12:00:00"), 7), "yyyy-MM-dd");
      set("fecha_vencimiento", venc);
    }
  }, [form.fecha_documento, isEdit]);

  // Auto-calculate fecha_vencimiento for Facturas based on tipo_pago
  // Contado => same day; Crédito / Crédito Cescemex => +30 days
  useEffect(() => {
    if (form.tipo_documento !== "factura") return;
    if (!form.fecha_documento || !form.tipo_pago) return;
    const base = new Date(form.fecha_documento + "T12:00:00");
    const days = form.tipo_pago === "contado" ? 0 : 30;
    const venc = format(addDays(base, days), "yyyy-MM-dd");
    if (venc !== form.fecha_vencimiento) {
      set("fecha_vencimiento", venc);
    }
  }, [form.tipo_documento, form.tipo_pago, form.fecha_documento]);

  useEffect(() => {
    if (existingDoc) {
      setForm({
        empresa_vendedora: existingDoc.empresa_vendedora,
        plaza_id: existingDoc.plaza_id || "",
        tipo_documento: existingDoc.tipo_documento,
        ejecutivo_venta_id: existingDoc.ejecutivo_venta_id || "",
        empresa_id: existingDoc.empresa_id || "",
        contacto_id: existingDoc.contacto_id || "",
        fecha_documento: existingDoc.fecha_documento,
        fecha_vencimiento: existingDoc.fecha_vencimiento || "",
        iva_porcentaje: String(existingDoc.iva_porcentaje),
        numero_cotizacion: existingDoc.numero_cotizacion || "",
        numero_pedido: existingDoc.numero_pedido || "",
        numero_factura: existingDoc.numero_factura || "",
        estatus_cotizacion: existingDoc.estatus_cotizacion || "borrador",
        estatus_pedido: existingDoc.estatus_pedido || "confirmado_cliente",
        estatus_factura: existingDoc.estatus_factura || "pendiente",
        estatus_entrega_corporativa: (existingDoc as any).estatus_entrega_corporativa || "solicitada",
        negocio_crm: existingDoc.negocio_crm || "",
        notas: existingDoc.notas || "",
        numero_oc_cliente: existingDoc.numero_oc_cliente || "",
        fecha_oc_cliente: (existingDoc as any).fecha_oc_cliente || "",
        direccion_envio: existingDoc.direccion_envio || "",
        cotizacion_original_id: existingDoc.cotizacion_original_id || "",
        tipo_pago: existingDoc.tipo_pago || "",
        uso_cfdi: existingDoc.uso_cfdi || "",
        metodo_pago: existingDoc.metodo_pago || "",
        fecha_entrega_programada: (existingDoc as any).fecha_entrega_programada || "",
      });
    }
  }, [existingDoc]);

  useEffect(() => {
    if (existingItems.length > 0) {
      setItems(existingItems.map((it: any) => ({
        id: it.id, producto_id: it.producto_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario,
        descuento_porcentaje: it.descuento_porcentaje, subtotal: it.subtotal, unidades_equivalentes: it.unidades_equivalentes,
        _nombre: `${it.productos?.codigo} - ${it.productos?.nombre_producto}`,
      })));
    }
  }, [existingItems]);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const ivaPct = Number(form.iva_porcentaje) || 0;
  const ivaImporte = subtotal * (ivaPct / 100);
  const total = subtotal + ivaImporte;
  const ueTotal = items.reduce((s, i) => s + i.unidades_equivalentes, 0);

  const isEntregaCorp = form.tipo_documento === "entrega_corporativa";
  const addItem = () => setItems(prev => [...prev, { producto_id: "", cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, subtotal: 0, unidades_equivalentes: 0 }]);

  const getDefaultPrice = (prod: any) => {
    const selectedCompany = companies.find((c: any) => c.id === form.empresa_id);
    const lista = selectedCompany?.lista_precios?.toLowerCase();
    const priceMap: Record<string, string> = {
      uf1: "precio_base_uf1", uf2: "precio_uf2", uf3: "precio_uf3", uf4: "precio_uf4",
      r1: "precio_r1", r2: "precio_r2", r3: "precio_r3", r4: "precio_r4",
    };
    const field = lista ? priceMap[lista] : null;
    return field ? (prod[field] ?? prod.precio_base_uf1) : prod.precio_base_uf1;
  };

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: val };
      if (field === "producto_id") {
        const prod = productos.find((p: any) => p.id === val);
        if (prod) {
          item.precio_unitario = isEntregaCorp ? 0 : getDefaultPrice(prod);
          item._nombre = `${prod.codigo} - ${prod.nombre_producto}`;
          const ue = (prod.presentaciones as any)?.unidades_equivalentes || 1;
          item.unidades_equivalentes = item.cantidad * ue;
        }
      }
      if (isEntregaCorp && field === "precio_unitario") {
        item.precio_unitario = 0;
      }
      if (["cantidad", "precio_unitario", "descuento_porcentaje", "producto_id"].includes(field)) {
        const unit = isEntregaCorp ? 0 : item.precio_unitario;
        item.precio_unitario = unit;
        const base = item.cantidad * unit;
        item.subtotal = base - (base * item.descuento_porcentaje / 100);
        const prod = productos.find((p: any) => p.id === item.producto_id);
        const ue = (prod?.presentaciones as any)?.unidades_equivalentes || 1;
        item.unidades_equivalentes = item.cantidad * ue;
      }
      updated[idx] = item;
      return updated;
    });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Auto-fill commercial fields from company when selecting a new client (not on edit load)
  const [companyAutoFilled, setCompanyAutoFilled] = useState(false);
  useEffect(() => {
    if (isEdit && !companyAutoFilled) { setCompanyAutoFilled(true); return; }
    if (!form.empresa_id) return;
    const company = companies.find((c: any) => c.id === form.empresa_id);
    if (company) {
      setForm(prev => ({
        ...prev,
        uso_cfdi: (company as any).uso_cfdi || prev.uso_cfdi,
        metodo_pago: (company as any).metodo_pago || prev.metodo_pago,
        tipo_pago: (company as any).tipo_pago || prev.tipo_pago,
      }));
    }
  }, [form.empresa_id, companies]);

  // Auto-select address: if exactly 1 "envio" address, auto-select it
  const [addrAutoFilled, setAddrAutoFilled] = useState(false);
  useEffect(() => {
    if (isEdit && !addrAutoFilled) { setAddrAutoFilled(true); return; }
    if (!form.empresa_id || addresses.length === 0) return;
    const envioAddrs = addresses.filter((a: any) => {
      const tipos = Array.isArray(a.tipos) && a.tipos.length > 0 ? a.tipos : [a.tipo];
      return tipos.includes("envio");
    });
    if (envioAddrs.length === 1) {
      set("direccion_envio", envioAddrs[0].id);
    }
  }, [addresses]);

  // Quick-add handlers via shared dialogs
  const handleCompanyCreated = async (id: string) => {
    await refetchCompanies();
    set("empresa_id", id);
    set("contacto_id", "");
  };

  const handleContactCreated = async (id: string) => {
    await refetchContacts();
    set("contacto_id", id);
  };

  const handleAddAddress = async () => {
    if (!newAddrCalle.trim()) return;
    const { data, error } = await supabase.from("direcciones_empresa").insert({
      empresa_id: form.empresa_id, tipo: newAddrTipo as any, calle: newAddrCalle.trim(),
      ciudad: newAddrCiudad.trim() || null, estado: newAddrEstado.trim() || null, codigo_postal: newAddrCp.trim() || null,
      coordenadas_lat: newAddrLat ? Number(newAddrLat) : null,
      coordenadas_lng: newAddrLng ? Number(newAddrLng) : null,
      codigo_google: newAddrGoogle.trim() || null,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    await refetchAddresses();
    set("direccion_envio", data.id);
    setNewAddrCalle(""); setNewAddrCiudad(""); setNewAddrEstado(""); setNewAddrCp(""); setNewAddrTipo("envio");
    setNewAddrLat(""); setNewAddrLng(""); setNewAddrGoogle("");
    setShowNewAddress(false);
    toast.success("Dirección creada");
  };

  const handleAddProduct = async () => {
    if (!newProductForm.codigo.trim() || !newProductForm.nombre_producto.trim()) return;
    const payload: any = { ...newProductForm };
    for (const k of ["presentacion_id", "marca_id", "aplicacion_id", "uso_id", "formula_id", "viscosidad_id", "categoria_id", "linea_id"]) {
      if (!payload[k]) payload[k] = null;
    }
    const { error } = await supabase.from("productos").insert(payload);
    if (error) { toast.error(error.message); return; }
    await refetchProductos();
    setNewProductForm({
      codigo: "", nombre_producto: "", descripcion: "", presentacion_id: "",
      is_active: true, marca_id: "", aplicacion_id: "", uso_id: "", formula_id: "",
      viscosidad_id: "", categoria_id: "", linea_id: "",
      costo_actual: 0, precio_base_uf1: 0, precio_uf2: 0, precio_uf3: 0, precio_uf4: 0,
      precio_r1: 0, precio_r2: 0, precio_r3: 0, precio_r4: 0, precio_lista_galper: 0,
    });
    setShowNewProduct(false);
    toast.success("Producto creado");
  };

  // Save
  const handleSave = async () => {
    if (!form.empresa_vendedora) { toast.error("Selecciona la empresa vendedora"); return; }
    if (!form.tipo_documento) { toast.error("Selecciona el tipo de documento"); return; }
    if (!form.plaza_id) { toast.error("La plaza es obligatoria"); return; }
    if (form.tipo_documento === "pedido" && !form.direccion_envio) { toast.error("La dirección de envío es obligatoria para pedidos"); return; }
    if (form.tipo_documento === "entrega_corporativa") {
      if (!form.empresa_id) { toast.error("El cliente es obligatorio"); return; }
      if (!form.direccion_envio) { toast.error("La dirección de envío es obligatoria"); return; }
      if (!form.numero_oc_cliente) { toast.error("El número de OC del cliente es obligatorio"); return; }
      if (!form.fecha_oc_cliente) { toast.error("La fecha de OC del cliente es obligatoria"); return; }
      if (!form.fecha_entrega_programada) { toast.error("La fecha de entrega solicitada es obligatoria"); return; }
    }
    if (form.tipo_documento === "factura" && form.numero_factura && /\s/.test(form.numero_factura)) {
      toast.error("El número de factura no puede contener espacios");
      return;
    }
    if (form.tipo_documento === "factura") {
      if (!form.tipo_pago) { toast.error("La forma de pago es obligatoria para facturas"); return; }
      if (!form.fecha_vencimiento) { toast.error("La fecha de vencimiento es obligatoria para facturas"); return; }
    }
    setSaving(true);
    try {
      // resolve address text from selected address
      const selectedAddr = addresses.find((a: any) => a.id === form.direccion_envio);
      const direccionText = selectedAddr ? `${selectedAddr.calle}${selectedAddr.ciudad ? ', ' + selectedAddr.ciudad : ''}${selectedAddr.estado ? ', ' + selectedAddr.estado : ''}${selectedAddr.codigo_postal ? ' C.P. ' + selectedAddr.codigo_postal : ''}` : (form.direccion_envio || null);

      const docData: any = {
        empresa_vendedora: form.empresa_vendedora,
        plaza_id: form.plaza_id || null,
        tipo_documento: form.tipo_documento,
        created_by: user?.id,
        ejecutivo_venta_id: form.ejecutivo_venta_id || null,
        empresa_id: form.empresa_id || null,
        contacto_id: form.contacto_id || null,
        fecha_documento: form.fecha_documento,
        fecha_vencimiento: form.fecha_vencimiento || null,
        iva_porcentaje: Number(form.iva_porcentaje),
        numero_cotizacion: form.tipo_documento === "cotizacion" ? (form.numero_cotizacion || null) : null, // auto-assigned by DB trigger
        numero_pedido: form.tipo_documento === "pedido" ? (form.numero_pedido || null) : null,
        numero_factura: form.tipo_documento === "factura" ? (form.numero_factura || null) : null,
        estatus_cotizacion: form.tipo_documento === "cotizacion" ? form.estatus_cotizacion : null,
        estatus_pedido: form.tipo_documento === "pedido" ? form.estatus_pedido : null,
        estatus_factura: form.tipo_documento === "factura" ? form.estatus_factura : null,
        estatus_entrega_corporativa: form.tipo_documento === "entrega_corporativa" ? form.estatus_entrega_corporativa : null,
        subtotal, iva_importe: ivaImporte, total, unidades_equivalentes_total: ueTotal,
        negocio_crm: form.negocio_crm || null,
        notas: form.notas || null,
        numero_oc_cliente: form.numero_oc_cliente || null,
        fecha_oc_cliente: form.tipo_documento === "entrega_corporativa" ? (form.fecha_oc_cliente || null) : null,
        direccion_envio: direccionText,
        cotizacion_original_id: form.cotizacion_original_id || null,
        tipo_pago: form.tipo_pago || null,
        uso_cfdi: form.uso_cfdi || null,
        metodo_pago: form.metodo_pago || null,
        fecha_entrega_programada: (form.tipo_documento === "pedido" || form.tipo_documento === "entrega_corporativa") ? (form.fecha_entrega_programada || null) : null,
      };

      let docId = id;
      if (isEdit) {
        const { error } = await supabase.from("documentos").update(docData).eq("id", id!);
        if (error) throw error;
        await supabase.from("documento_productos").delete().eq("documento_id", id!);
      } else {
        const { data, error } = await supabase.from("documentos").insert(docData).select("id").single();
        if (error) throw error;
        docId = data.id;
      }

      if (items.length > 0) {
        const forceZero = form.tipo_documento === "entrega_corporativa";
        const lineItems = items.filter(i => i.producto_id).map(i => ({
          documento_id: docId!, producto_id: i.producto_id, cantidad: i.cantidad,
          precio_unitario: forceZero ? 0 : i.precio_unitario,
          descuento_porcentaje: i.descuento_porcentaje,
          subtotal: forceZero ? 0 : i.subtotal,
          unidades_equivalentes: i.unidades_equivalentes,
        }));
        if (lineItems.length > 0) {
          const { error } = await supabase.from("documento_productos").insert(lineItems);
          if (error) throw error;
        }
      }

      // Sync forma de pago / uso CFDI / método de pago back to the company
      if (form.empresa_id && (form.tipo_pago || form.uso_cfdi || form.metodo_pago)) {
        const companyUpdate: {
          tipo_pago?: any;
          uso_cfdi?: any;
          metodo_pago?: any;
        } = {};
        if (form.tipo_pago) companyUpdate.tipo_pago = form.tipo_pago;
        if (form.uso_cfdi) companyUpdate.uso_cfdi = form.uso_cfdi;
        if (form.metodo_pago) companyUpdate.metodo_pago = form.metodo_pago;
        if (Object.keys(companyUpdate).length > 0) {
          const { error: companyErr } = await supabase
            .from("companies")
            .update(companyUpdate as any)
            .eq("id", form.empresa_id);
          if (companyErr) console.error("No se pudo sincronizar la empresa:", companyErr);
          else qc.invalidateQueries({ queryKey: ["companies"] });
        }
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      qc.invalidateQueries({ queryKey: ["documento", docId] });
      toast.success(isEdit ? "Documento actualizado" : "Documento creado");

      if (generatePdfAfterSave && form.tipo_documento === "cotizacion" && docId) {
        setGeneratePdfAfterSave(false);
        await downloadCotizacionPdf(docId, () => {
          qc.invalidateQueries({ queryKey: ["documento", docId] });
          qc.invalidateQueries({ queryKey: ["documentos"] });
        });
      }

      if (!isEdit) {
        navigate(`/documents/${docId}`);
      } else {
        setViewMode(true);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setGeneratePdfAfterSave(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      toast.info("Duplicando documento...");
      const { data: srcDoc, error: srcErr } = await supabase.from("documentos").select("*").eq("id", id).single();
      if (srcErr || !srcDoc) throw srcErr || new Error("No encontrado");
      const { data: srcItems } = await supabase.from("documento_productos").select("*").eq("documento_id", id);

      const { id: _id, created_at, updated_at, numero_cotizacion, numero_pedido, numero_factura, pdf_url, estatus_cotizacion, ...rest } = srcDoc;
      const newDoc: any = {
        ...rest,
        created_by: user?.id,
        pdf_url: null,
        estatus_cotizacion: srcDoc.tipo_documento === "cotizacion" ? "borrador" : null,
        numero_cotizacion: null,
        numero_pedido: null,
        numero_factura: null,
        cotizacion_original_id: srcDoc.tipo_documento === "cotizacion" ? id : (srcDoc.cotizacion_original_id || null),
      };

      const { data: inserted, error: insErr } = await supabase.from("documentos").insert(newDoc).select("id").single();
      if (insErr) throw insErr;

      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map(({ id: _iid, created_at: _ca, documento_id, ...itemRest }) => ({
          ...itemRest, documento_id: inserted.id,
        }));
        await supabase.from("documento_productos").insert(newItems);
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento duplicado");
      navigate(`/documents/${inserted.id}`);
    } catch (err: any) {
      toast.error("Error al duplicar: " + (err.message || "Error desconocido"));
    }
  };

  const handleConvertTo = async (targetType: "pedido" | "factura") => {
    if (!id) return;
    const label = targetType === "pedido" ? "Pedido" : "Factura";
    try {
      toast.info(`Convirtiendo a ${label}...`);
      const { data: srcDoc, error: srcErr } = await supabase.from("documentos").select("*").eq("id", id).single();
      if (srcErr || !srcDoc) throw srcErr || new Error("No encontrado");
      const { data: srcItems } = await supabase.from("documento_productos").select("*").eq("documento_id", id);

      const { id: _id, created_at, updated_at, numero_cotizacion, numero_pedido, numero_factura, pdf_url, estatus_cotizacion, estatus_pedido, estatus_factura, tipo_documento, ...rest } = srcDoc;
      const newDoc: any = {
        ...rest,
        tipo_documento: targetType,
        created_by: user?.id,
        pdf_url: null,
        numero_cotizacion: null,
        numero_pedido: null,
        numero_factura: null,
        estatus_cotizacion: null,
        estatus_pedido: targetType === "pedido" ? "confirmado_cliente" : null,
        estatus_factura: targetType === "factura" ? "pendiente" : null,
        cotizacion_original_id: srcDoc.tipo_documento === "cotizacion" ? id : (srcDoc.cotizacion_original_id || null),
      };

      const { data: inserted, error: insErr } = await supabase.from("documentos").insert(newDoc).select("id").single();
      if (insErr) throw insErr;

      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map(({ id: _iid, created_at: _ca, documento_id, ...itemRest }) => ({
          ...itemRest, documento_id: inserted.id,
        }));
        await supabase.from("documento_productos").insert(newItems);
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      toast.success(`${label} creado desde cotización`);
      navigate(`/documents/${inserted.id}`);
    } catch (err: any) {
      toast.error(`Error al convertir: ${err.message}`);
    }
  };

  const td = form.tipo_documento;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold text-foreground">
          {viewMode ? "Ver Documento" : isEdit ? "Editar Documento" : "Nuevo Documento"}
        </h1>
        {viewMode && (
          <div className="flex gap-2 flex-wrap">
            {existingDoc?.pdf_url && (
              <Button variant="default" asChild>
                <a href={existingDoc.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Ver PDF
                </a>
              </Button>
            )}
            {form.tipo_documento === "cotizacion" && !existingDoc?.pdf_url && (
              <Button onClick={() => downloadCotizacionPdf(id!, () => {
                qc.invalidateQueries({ queryKey: ["documento", id] });
                qc.invalidateQueries({ queryKey: ["documentos"] });
              })}>
                <Download className="mr-2 h-4 w-4" /> Generar PDF
              </Button>
            )}
            {form.tipo_documento === "cotizacion" && (
              <>
                <Button variant="secondary" onClick={() => handleConvertTo("pedido")}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Convertir a Pedido
                </Button>
                <Button variant="secondary" onClick={() => handleConvertTo("factura")}>
                  <FileText className="mr-2 h-4 w-4" /> Convertir a Factura
                </Button>
              </>
            )}
            {form.tipo_documento === "pedido" && (
              <Button variant="secondary" onClick={() => handleConvertTo("factura")}>
                <FileText className="mr-2 h-4 w-4" /> Convertir a Factura
              </Button>
            )}
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </Button>
            {(!existingDoc?.pdf_url || isAdmin) && (
              <Button variant="outline" onClick={() => setViewMode(false)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            )}
            {existingDoc?.pdf_url && !isAdmin && (
              <span className="text-sm text-muted-foreground italic">Documento con PDF — solo Admin puede editar</span>
            )}
          </div>
        )}
      </div>

      <fieldset disabled={viewMode} className="space-y-6">
      {/* General Info */}
      <Card>
        <CardHeader><CardTitle>Información General</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Empresa Vendedora *</Label>
            <Select value={form.empresa_vendedora} onValueChange={v => set("empresa_vendedora", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lumaggs_chevron">Lumaggs Chevron</SelectItem>
                <SelectItem value="galsa_phillips66">Galsa Phillips 66</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Documento *</Label>
            <Select value={form.tipo_documento} onValueChange={v => set("tipo_documento", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cotizacion">Cotización</SelectItem>
                <SelectItem value="pedido">Pedido</SelectItem>
                <SelectItem value="factura">Factura</SelectItem>
                <SelectItem value="entrega_corporativa">Entrega Corporativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plaza *</Label>
            <SearchableSelect
              value={form.plaza_id}
              onValueChange={v => set("plaza_id", v)}
              placeholder="Seleccionar"
              options={plazas.map((p: any) => ({ value: p.id, label: p.nombre }))}
            />
          </div>
          <div>
            <Label>Ejecutivo de Venta</Label>
            <SearchableSelect
              value={form.ejecutivo_venta_id}
              onValueChange={v => set("ejecutivo_venta_id", v)}
              placeholder="Seleccionar"
              options={users.map((u: any) => ({ value: u.user_id, label: u.full_name || u.user_id }))}
            />
          </div>

          {/* Empresa (Cliente) with + button */}
          <div>
            <Label className="flex items-center gap-1">
              Empresa (Cliente)
              {form.empresa_id && (
                <Link
                  to={`/directory?tab=companies&select=${form.empresa_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex"
                  title="Abrir empresa para editar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </Label>
            <div className="flex gap-1">
              <SearchableSelect
                value={form.empresa_id}
                onValueChange={v => { set("empresa_id", v); set("contacto_id", ""); set("direccion_envio", ""); }}
                placeholder="Seleccionar"
                options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setShowNewCompany(true)}><Plus className="h-4 w-4" /></Button>
            </div>
            {form.empresa_id && (
              <CompanyContpaqInline
                companyId={form.empresa_id}
                initial={(companies.find((c: any) => c.id === form.empresa_id) as any)?.id_contpaq || ""}
                onSaved={() => refetchCompanies()}
              />
            )}
          </div>

          {/* Contacto with + button, filtered by empresa */}
          <div>
            <Label className="flex items-center gap-1">
              Contacto
              {form.contacto_id && (
                <Link
                  to={`/directory?tab=contacts&select=${form.contacto_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex"
                  title="Abrir contacto para editar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </Label>
            <div className="flex gap-1">
              <SearchableSelect
                value={form.contacto_id}
                onValueChange={v => set("contacto_id", v)}
                placeholder={form.empresa_id ? "Seleccionar" : "Selecciona empresa primero"}
                disabled={!form.empresa_id}
                options={contacts.map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setShowNewContact(true)} disabled={!form.empresa_id}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates & Numbers — conditional fields by tipo_documento */}
      <Card>
        <CardHeader><CardTitle>Fechas y Números</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Fecha Documento</Label>
            <Input type="date" value={form.fecha_documento} onChange={e => set("fecha_documento", e.target.value)} />
          </div>
          <div>
            <Label>Fecha Vencimiento</Label>
            <Input
              type="date"
              value={form.fecha_vencimiento}
              onChange={e => set("fecha_vencimiento", e.target.value)}
              disabled={form.tipo_documento === "factura" && !isAdmin}
            />
            {form.tipo_documento === "factura" && (
              <p className="text-xs text-muted-foreground mt-1">
                Se calcula automáticamente según la forma de pago{!isAdmin ? " (sólo admin puede editar)" : ""}.
              </p>
            )}
          </div>
          <div>
            <Label>IVA %</Label>
            <Select value={form.iva_porcentaje} onValueChange={v => set("iva_porcentaje", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8%</SelectItem>
                <SelectItem value="16">16%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show only fields relevant to the selected document type */}
          {td === "cotizacion" && (
            <>
              <div>
                <Label>Número Cotización</Label>
                <Input value={form.numero_cotizacion || "(Se asignará automáticamente)"} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Estatus Cotización</Label>
                <Select value={form.estatus_cotizacion} onValueChange={v => set("estatus_cotizacion", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTATUS_COT.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {td === "pedido" && (
            <>
              <div>
                <Label>Número Pedido</Label>
                <Input value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              </div>
              <div>
                <Label>Estatus Pedido</Label>
                <Select value={form.estatus_pedido} onValueChange={v => set("estatus_pedido", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTATUS_PED.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha Entrega Programada</Label>
                <Input type="date" value={form.fecha_entrega_programada} onChange={e => set("fecha_entrega_programada", e.target.value)} />
              </div>
            </>
          )}
          {td === "factura" && (
            <>
              <div>
                <Label>Número Factura</Label>
                <Input value={form.numero_factura} onChange={e => set("numero_factura", e.target.value.replace(/\s+/g, ""))} />
              </div>
              <div>
                <Label>Estatus Factura</Label>
                <Select value={form.estatus_factura} onValueChange={v => set("estatus_factura", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTATUS_FAC.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {td === "entrega_corporativa" && (
            <>
              <div>
                <Label>Estatus Entrega <span className="text-destructive">*</span></Label>
                <Select value={form.estatus_entrega_corporativa} onValueChange={v => set("estatus_entrega_corporativa", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTATUS_ENT_CORP.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Núm. OC Cliente <span className="text-destructive">*</span></Label>
                <Input value={form.numero_oc_cliente} onChange={e => set("numero_oc_cliente", e.target.value)} />
              </div>
              <div>
                <Label>Fecha OC Cliente <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.fecha_oc_cliente} onChange={e => set("fecha_oc_cliente", e.target.value)} />
              </div>
              <div>
                <Label>Fecha Entrega Solicitada <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.fecha_entrega_programada} onChange={e => set("fecha_entrega_programada", e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Productos</CardTitle>
            <Button size="sm" onClick={addItem}><Plus className="mr-1 h-4 w-4" /> Agregar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Sin productos. Haz clic en "Agregar" para añadir.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => {
                const prod = productos.find((p: any) => p.id === item.producto_id);
                return (
                  <div key={idx} className="border rounded-lg p-3 space-y-3">
                    <div className="flex gap-1 items-start">
                      <SearchableSelect
                        value={item.producto_id}
                        onValueChange={v => updateItem(idx, "producto_id", v)}
                        placeholder="Seleccionar producto"
                        options={filteredProductos.map((p: any) => {
                          const pres = (p.presentaciones as any)?.nombre || '';
                          const label = `${p.codigo} - ${p.nombre_producto}${pres ? ` [${pres}]` : ''}`;
                          const searchStr = `${p.codigo} ${p.nombre_producto} ${p.descripcion || ''} ${pres}`;
                          return { value: p.id, label, searchText: searchStr };
                        })}
                        popoverClassName="min-w-[420px] sm:min-w-[520px]"
                        className="flex-1"
                      />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewProduct(true)}><Plus className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>

                    {prod && (
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                        <div className="text-center"><span className="font-semibold block">UF1</span>{Number(prod.precio_base_uf1).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">UF2</span>{Number(prod.precio_uf2).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">UF3</span>{Number(prod.precio_uf3).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">UF4</span>{Number(prod.precio_uf4).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">R1</span>{Number(prod.precio_r1).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">R2</span>{Number(prod.precio_r2).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">R3</span>{Number(prod.precio_r3).toFixed(2)}</div>
                        <div className="text-center"><span className="font-semibold block">R4</span>{Number(prod.precio_r4).toFixed(2)}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Cant.</Label>
                        <Input type="number" className="h-9" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="text-xs">Precio Unit.</Label>
                        <Input
                          type="number"
                          className="h-9"
                          value={isEntregaCorp ? 0 : item.precio_unitario}
                          disabled={isEntregaCorp}
                          readOnly={isEntregaCorp}
                          title={isEntregaCorp ? "Precio fijo en 0 para Entrega Corporativa" : undefined}
                          onChange={e => updateItem(idx, "precio_unitario", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Desc. %</Label>
                        <Input type="number" className="h-9" value={item.descuento_porcentaje} onChange={e => updateItem(idx, "descuento_porcentaje", Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="text-xs">Subtotal</Label>
                        <div className="h-9 flex items-center font-medium text-sm">${item.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <Label className="text-xs">UE</Label>
                        <div className="h-9 flex items-center text-sm">{item.unidades_equivalentes}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Separator className="my-4" />
          <div className="flex flex-col items-end gap-1 text-sm">
            <div>Subtotal: <span className="font-medium">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
            <div>IVA ({ivaPct}%): <span className="font-medium">${ivaImporte.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
            <div className="text-lg font-bold">Total: ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
            <div className="text-muted-foreground">Unidades Equivalentes: {ueTotal}</div>
          </div>
        </CardContent>
      </Card>

      {/* Fiscal & Payment */}
      {td !== "entrega_corporativa" && (
      <Card>
        <CardHeader><CardTitle>Datos Fiscales y Pago</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Tipo de Pago</Label>
            <Select value={form.tipo_pago} onValueChange={v => set("tipo_pago", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{TIPO_PAGO_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Uso CFDI</Label>
            <SearchableSelect
              value={form.uso_cfdi}
              onValueChange={v => set("uso_cfdi", v)}
              placeholder="Seleccionar"
              options={USO_CFDI_OPTS.map(o => ({ value: o.v, label: o.l }))}
            />
          </div>
          <div>
            <Label>Método de Pago</Label>
            <Select value={form.metodo_pago} onValueChange={v => set("metodo_pago", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{METODO_PAGO_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número OC Cliente</Label>
            <Input value={form.numero_oc_cliente} onChange={e => set("numero_oc_cliente", e.target.value)} />
          </div>
          <div>
            <Label>Cotización Original (referencia)</Label>
            {cotizacionOriginalDoc ? (
              <div className="flex items-center gap-2 h-10">
                <Link
                  to={`/documents/${cotizacionOriginalDoc.id}`}
                  className="text-primary underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {cotizacionOriginalDoc.numero_cotizacion || "Sin número"}
                </Link>
              </div>
            ) : form.cotizacion_original_id ? (
              <Input value={form.cotizacion_original_id} disabled className="bg-muted" />
            ) : (
              <Input value="" disabled placeholder="N/A" className="bg-muted" />
            )}
          </div>
          <div>
            <Label>Negocio CRM</Label>
            <Input value={form.negocio_crm} onChange={e => set("negocio_crm", e.target.value)} />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Additional */}
      <Card>
        <CardHeader><CardTitle>Información Adicional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Dirección de Envío {form.tipo_documento === "pedido" && <span className="text-destructive">*</span>}</Label>
            <div className="flex gap-1">
              <SearchableSelect
                value={form.direccion_envio}
                onValueChange={v => set("direccion_envio", v)}
                placeholder={form.empresa_id ? "Seleccionar dirección" : "Selecciona empresa primero"}
                disabled={!form.empresa_id}
                options={addresses.map((a: any) => ({
                  value: a.id,
                  label: `[${TIPO_DIRECCION_LABELS[a.tipo] || a.tipo}] ${a.calle}${a.ciudad ? `, ${a.ciudad}` : ""}`,
                }))}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setShowNewAddress(true)} disabled={!form.empresa_id}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={e => set("notas", e.target.value)} />
          </div>
        </CardContent>
      </Card>
      </fieldset>

      {/* Pagos relacionados — solo en modo vista para Facturas/Pedidos/Cotizaciones */}
      {viewMode && isEdit && id && form.tipo_documento !== "entrega_corporativa" && (
        <DocumentPagosSection documentoId={id} empresaId={form.empresa_id || null} />
      )}

      {/* Actions */}
      {!viewMode && (
        <div className="flex justify-start gap-3">
          <Button variant="outline" onClick={() => isEdit ? setViewMode(true) : navigate("/documents")}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      )}

      {/* Dialog: Nueva Empresa (formulario completo) */}
      <CompanyFormDialog open={showNewCompany} onOpenChange={setShowNewCompany} onCreated={handleCompanyCreated} />

      {/* Dialog: Nuevo Contacto (formulario completo) */}
      <ContactFormDialog open={showNewContact} onOpenChange={setShowNewContact} defaultCompanyId={form.empresa_id} onCreated={handleContactCreated} />

      {/* Dialog: Nueva Dirección */}
      <Dialog open={showNewAddress} onOpenChange={setShowNewAddress}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Dirección</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={newAddrTipo} onValueChange={setNewAddrTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="envio">Entrega</SelectItem>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="sucursal">Sucursal</SelectItem>
                  <SelectItem value="principal">Principal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Calle / Dirección *</Label><Input value={newAddrCalle} onChange={e => setNewAddrCalle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Ciudad</Label><Input value={newAddrCiudad} onChange={e => setNewAddrCiudad(e.target.value)} /></div>
              <div><Label>Estado</Label><Input value={newAddrEstado} onChange={e => setNewAddrEstado(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Código Postal</Label><Input value={newAddrCp} onChange={e => setNewAddrCp(e.target.value)} /></div>
              <div><Label>Código Google</Label><Input value={newAddrGoogle} onChange={e => setNewAddrGoogle(e.target.value)} placeholder="Ej: ChIJ..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitud</Label><Input type="number" step="any" value={newAddrLat} onChange={e => setNewAddrLat(e.target.value)} placeholder="25.6866" /></div>
              <div><Label>Longitud</Label><Input type="number" step="any" value={newAddrLng} onChange={e => setNewAddrLng(e.target.value)} placeholder="-100.3161" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddAddress} disabled={!newAddrCalle.trim()}>Crear Dirección</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nuevo Producto */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Código *</Label><Input value={newProductForm.codigo} onChange={e => setNP("codigo", e.target.value)} /></div>
            <div><Label>Nombre Producto *</Label><Input value={newProductForm.nombre_producto} onChange={e => setNP("nombre_producto", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Descripción</Label><Textarea value={newProductForm.descripcion} onChange={e => setNP("descripcion", e.target.value)} /></div>
            <div>
              <Label>Presentación</Label>
              <Select value={newProductForm.presentacion_id} onValueChange={v => setNP("presentacion_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{presentacionesList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidades Equivalentes</Label>
              <Input disabled value={presentacionesList.find((p: any) => p.id === newProductForm.presentacion_id)?.unidades_equivalentes ?? ""} />
            </div>
            {(["marca", "aplicacion", "uso", "formula", "viscosidad", "categoria", "linea"] as const).map(t => (
              <div key={t}>
                <Label>{t === "marca" ? "Marca" : t === "aplicacion" ? "Aplicación" : t === "uso" ? "Uso" : t === "formula" ? "Fórmula" : t === "viscosidad" ? "Viscosidad" : t === "categoria" ? "Categoría" : "Línea"}</Label>
                <Select value={(newProductForm as any)[`${t}_id`] || ""} onValueChange={v => setNP(`${t}_id`, v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{optionsFor(t).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div className="md:col-span-2 border-t pt-3 mt-2">
              <h4 className="font-semibold text-sm mb-3">Precios</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ["costo_actual", "Costo Actual"], ["precio_base_uf1", "Base UF1"], ["precio_uf2", "UF2"], ["precio_uf3", "UF3"], ["precio_uf4", "UF4"],
                  ["precio_r1", "R1"], ["precio_r2", "R2"], ["precio_r3", "R3"], ["precio_r4", "R4"], ["precio_lista_galper", "Lista Galper"],
                ].map(([k, label]) => (
                  <div key={k}><Label className="text-xs">{label}</Label><Input type="number" value={(newProductForm as any)[k]} onChange={e => setNP(k, Number(e.target.value))} /></div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddProduct} disabled={!newProductForm.codigo.trim() || !newProductForm.nombre_producto.trim()}>Crear Producto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyContpaqInline({ companyId, initial, onSaved }: { companyId: string; initial: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initial);
    setEditing(false);
  }, [companyId, initial]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ id_contpaq: value.trim() || null })
      .eq("id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ID Contpaq actualizado");
    setEditing(false);
    onSaved();
  };

  if (!editing && initial) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>ID Contpaq:</span>
        <span className="font-mono font-medium text-foreground">{initial}</span>
        <button type="button" className="text-primary hover:underline" onClick={() => setEditing(true)}>
          Editar
        </button>
      </div>
    );
  }

  if (!editing && !initial) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">ID Contpaq: —</span>
        <button type="button" className="text-primary hover:underline" onClick={() => setEditing(true)}>
          Capturar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <span className="text-xs text-muted-foreground">ID Contpaq:</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 text-xs w-32"
        placeholder="ID"
        autoFocus
      />
      <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={save} disabled={saving}>
        {saving ? "..." : "Guardar"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setValue(initial); setEditing(false); }}>
        Cancelar
      </Button>
    </div>
  );
}
