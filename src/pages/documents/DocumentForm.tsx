import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Save, Download, Pencil, Copy, FileText, ShoppingCart } from "lucide-react";
import { downloadCotizacionPdf } from "@/lib/generateCotizacionPdf";
import { format, addDays } from "date-fns";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Link } from "react-router-dom";

const ESTATUS_COT = [{ v: "borrador", l: "Borrador" }, { v: "impresa", l: "Impresa" }, { v: "enviada", l: "Enviada" }, { v: "aceptada", l: "Aceptada" }, { v: "rechazada", l: "Rechazada" }, { v: "vencida", l: "Vencida" }];
const ESTATUS_PED = [{ v: "pendiente", l: "Pendiente" }, { v: "confirmado", l: "Confirmado" }, { v: "en_proceso", l: "En Proceso" }, { v: "enviado", l: "Enviado" }, { v: "entregado", l: "Entregado" }, { v: "cancelado", l: "Cancelado" }];
const ESTATUS_FAC = [{ v: "pendiente", l: "Pendiente" }, { v: "pagada", l: "Pagada" }, { v: "parcial", l: "Parcial" }, { v: "vencida", l: "Vencida" }, { v: "cancelada", l: "Cancelada" }];
const TIPO_PAGO_OPTS = [{ v: "contado", l: "Contado" }, { v: "credito", l: "Crédito" }, { v: "credito_cescemex", l: "Crédito Cescemex" }];
const METODO_PAGO_OPTS = [{ v: "PUE", l: "PUE - Pago en una sola exhibición" }, { v: "PPD", l: "PPD - Pago en parcialidades o diferido" }];
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
const TIPO_DIRECCION_LABELS: Record<string, string> = { envio: "Envío", fiscal: "Fiscal", comercial: "Comercial" };

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
  const qc = useQueryClient();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState(isEdit);
  const [generatePdfAfterSave, setGeneratePdfAfterSave] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultVencimiento = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const [form, setForm] = useState({
    empresa_vendedora: "" as string,
    plaza_id: "",
    tipo_documento: "cotizacion" as string,
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
    estatus_pedido: "pendiente",
    estatus_factura: "pendiente",
    negocio_crm: "",
    notas: "",
    numero_oc_cliente: "",
    direccion_envio: "",
    cotizacion_original_id: "",
    tipo_pago: "",
    uso_cfdi: "",
    metodo_pago: "",
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
  const { data: companies = [], refetch: refetchCompanies } = useQuery({ queryKey: ["companies"], queryFn: async () => { const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name"); return data || []; } });
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
  const { data: productos = [], refetch: refetchProductos } = useQuery({ queryKey: ["productos_list"], queryFn: async () => { const { data } = await supabase.from("productos").select("id, codigo, nombre_producto, precio_base_uf1, presentaciones(unidades_equivalentes)").eq("is_active", true).order("codigo"); return data || []; } });
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

  // Auto-update fecha_vencimiento when fecha_documento changes (only if not editing existing)
  useEffect(() => {
    if (!isEdit && form.fecha_documento) {
      const venc = format(addDays(new Date(form.fecha_documento + "T12:00:00"), 7), "yyyy-MM-dd");
      set("fecha_vencimiento", venc);
    }
  }, [form.fecha_documento, isEdit]);

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
        estatus_pedido: existingDoc.estatus_pedido || "pendiente",
        estatus_factura: existingDoc.estatus_factura || "pendiente",
        negocio_crm: existingDoc.negocio_crm || "",
        notas: existingDoc.notas || "",
        numero_oc_cliente: existingDoc.numero_oc_cliente || "",
        direccion_envio: existingDoc.direccion_envio || "",
        cotizacion_original_id: existingDoc.cotizacion_original_id || "",
        tipo_pago: existingDoc.tipo_pago || "",
        uso_cfdi: existingDoc.uso_cfdi || "",
        metodo_pago: existingDoc.metodo_pago || "",
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

  const addItem = () => setItems(prev => [...prev, { producto_id: "", cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, subtotal: 0, unidades_equivalentes: 0 }]);

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: val };
      if (field === "producto_id") {
        const prod = productos.find((p: any) => p.id === val);
        if (prod) {
          item.precio_unitario = prod.precio_base_uf1;
          item._nombre = `${prod.codigo} - ${prod.nombre_producto}`;
          const ue = (prod.presentaciones as any)?.unidades_equivalentes || 1;
          item.unidades_equivalentes = item.cantidad * ue;
        }
      }
      if (["cantidad", "precio_unitario", "descuento_porcentaje", "producto_id"].includes(field)) {
        const base = item.cantidad * item.precio_unitario;
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
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await refetchAddresses();
    set("direccion_envio", data.id);
    setNewAddrCalle(""); setNewAddrCiudad(""); setNewAddrEstado(""); setNewAddrCp(""); setNewAddrTipo("envio");
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
        subtotal, iva_importe: ivaImporte, total, unidades_equivalentes_total: ueTotal,
        negocio_crm: form.negocio_crm || null,
        notas: form.notas || null,
        numero_oc_cliente: form.numero_oc_cliente || null,
        direccion_envio: direccionText,
        cotizacion_original_id: form.cotizacion_original_id || null,
        tipo_pago: form.tipo_pago || null,
        uso_cfdi: form.uso_cfdi || null,
        metodo_pago: form.metodo_pago || null,
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
        const lineItems = items.filter(i => i.producto_id).map(i => ({
          documento_id: docId!, producto_id: i.producto_id, cantidad: i.cantidad,
          precio_unitario: i.precio_unitario, descuento_porcentaje: i.descuento_porcentaje,
          subtotal: i.subtotal, unidades_equivalentes: i.unidades_equivalentes,
        }));
        if (lineItems.length > 0) {
          const { error } = await supabase.from("documento_productos").insert(lineItems);
          if (error) throw error;
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
      // Get current doc data
      const { data: srcDoc, error: srcErr } = await supabase.from("documentos").select("*").eq("id", id).single();
      if (srcErr || !srcDoc) throw srcErr || new Error("No encontrado");
      // Get line items
      const { data: srcItems } = await supabase.from("documento_productos").select("*").eq("documento_id", id);

      const { id: _id, created_at, updated_at, numero_cotizacion, numero_pedido, numero_factura, pdf_url, estatus_cotizacion, ...rest } = srcDoc;
      const newDoc: any = {
        ...rest,
        created_by: user?.id,
        pdf_url: null,
        estatus_cotizacion: srcDoc.tipo_documento === "cotizacion" ? "borrador" : null,
        numero_cotizacion: null, // auto-assigned by trigger for cotizaciones
        numero_pedido: null,
        numero_factura: null,
      };

      const { data: inserted, error: insErr } = await supabase.from("documentos").insert(newDoc).select("id").single();
      if (insErr) throw insErr;

      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map(({ id: _iid, created_at: _ca, documento_id, ...itemRest }) => ({
          ...itemRest,
          documento_id: inserted.id,
        }));
        const { error: itemErr } = await supabase.from("documento_productos").insert(newItems);
        if (itemErr) throw itemErr;
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento duplicado");
      navigate(`/documents/${inserted.id}`);
    } catch (err: any) {
      toast.error("Error al duplicar: " + (err.message || "Error desconocido"));
    }
  };

  const td = form.tipo_documento;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold text-foreground">
          {viewMode ? "Ver Documento" : isEdit ? "Editar Documento" : "Nuevo Documento"}
        </h1>
        {viewMode && (
          <div className="flex gap-2 ml-auto">
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
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </Button>
            <Button variant="outline" onClick={() => setViewMode(false)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
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
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plaza</Label>
            <Select value={form.plaza_id} onValueChange={v => set("plaza_id", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ejecutivo de Venta</Label>
            <Select value={form.ejecutivo_venta_id} onValueChange={v => set("ejecutivo_venta_id", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {users.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Empresa (Cliente) with + button */}
          <div>
            <Label>Empresa (Cliente)</Label>
            <div className="flex gap-1">
              <Select value={form.empresa_id} onValueChange={v => { set("empresa_id", v); set("contacto_id", ""); set("direccion_envio", ""); }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setShowNewCompany(true)}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Contacto with + button, filtered by empresa */}
          <div>
            <Label>Contacto</Label>
            <div className="flex gap-1">
              <Select value={form.contacto_id} onValueChange={v => set("contacto_id", v)} disabled={!form.empresa_id}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={form.empresa_id ? "Seleccionar" : "Selecciona empresa primero"} /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Input type="date" value={form.fecha_vencimiento} onChange={e => set("fecha_vencimiento", e.target.value)} />
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
            </>
          )}
          {td === "factura" && (
            <>
              <div>
                <Label>Número Factura</Label>
                <Input value={form.numero_factura} onChange={e => set("numero_factura", e.target.value)} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio Unit.</TableHead>
                  <TableHead>Desc. %</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>UE</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Select value={item.producto_id} onValueChange={v => updateItem(idx, "producto_id", v)}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                          <SelectContent>
                            {productos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nombre_producto}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewProduct(true)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                    <TableCell><Input type="number" className="w-20" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", Number(e.target.value))} /></TableCell>
                    <TableCell><Input type="number" className="w-28" value={item.precio_unitario} onChange={e => updateItem(idx, "precio_unitario", Number(e.target.value))} /></TableCell>
                    <TableCell><Input type="number" className="w-20" value={item.descuento_porcentaje} onChange={e => updateItem(idx, "descuento_porcentaje", Number(e.target.value))} /></TableCell>
                    <TableCell className="font-medium">${item.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{item.unidades_equivalentes}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Select value={form.uso_cfdi} onValueChange={v => set("uso_cfdi", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{USO_CFDI_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
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
            <Input value={form.cotizacion_original_id} onChange={e => set("cotizacion_original_id", e.target.value)} placeholder="ID de cotización" />
          </div>
          <div>
            <Label>Negocio CRM</Label>
            <Input value={form.negocio_crm} onChange={e => set("negocio_crm", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Additional */}
      <Card>
        <CardHeader><CardTitle>Información Adicional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Dirección de Envío</Label>
            <div className="flex gap-1">
              <Select value={form.direccion_envio} onValueChange={v => set("direccion_envio", v)} disabled={!form.empresa_id}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={form.empresa_id ? "Seleccionar dirección" : "Selecciona empresa primero"} /></SelectTrigger>
                <SelectContent>
                  {addresses.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      [{TIPO_DIRECCION_LABELS[a.tipo] || a.tipo}] {a.calle}{a.ciudad ? `, ${a.ciudad}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Actions */}
      {!viewMode && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => isEdit ? setViewMode(true) : navigate("/documents")}>Cancelar</Button>
          {form.tipo_documento === "cotizacion" && (
            <Button variant="secondary" onClick={() => { setGeneratePdfAfterSave(true); handleSave(); }} disabled={saving}>
              <Download className="mr-2 h-4 w-4" /> {saving && generatePdfAfterSave ? "Generando..." : "Guardar y PDF"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving && !generatePdfAfterSave ? "Guardando..." : "Guardar"}
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
                  <SelectItem value="envio">Envío</SelectItem>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Calle / Dirección *</Label><Input value={newAddrCalle} onChange={e => setNewAddrCalle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Ciudad</Label><Input value={newAddrCiudad} onChange={e => setNewAddrCiudad(e.target.value)} /></div>
              <div><Label>Estado</Label><Input value={newAddrEstado} onChange={e => setNewAddrEstado(e.target.value)} /></div>
            </div>
            <div><Label>Código Postal</Label><Input value={newAddrCp} onChange={e => setNewAddrCp(e.target.value)} /></div>
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
