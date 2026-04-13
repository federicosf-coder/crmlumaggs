import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { format } from "date-fns";

const EMPRESA_LABELS: Record<string, string> = { lumaggs_chevron: "Lumaggs Chevron", galsa_phillips66: "Galsa Phillips 66" };
const TIPO_DOC_LABELS: Record<string, string> = { cotizacion: "Cotización", pedido: "Pedido", factura: "Factura" };
const ESTATUS_COT = [{ v: "borrador", l: "Borrador" }, { v: "enviada", l: "Enviada" }, { v: "aceptada", l: "Aceptada" }, { v: "rechazada", l: "Rechazada" }, { v: "vencida", l: "Vencida" }];
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

  // Form state
  const [form, setForm] = useState({
    empresa_vendedora: "" as string,
    plaza_id: "",
    tipo_documento: "cotizacion" as string,
    ejecutivo_venta_id: "",
    empresa_id: "",
    contacto_id: "",
    fecha_documento: format(new Date(), "yyyy-MM-dd"),
    fecha_vencimiento: "",
    iva_porcentaje: "16",
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

  // Lookup data
  const { data: plazas = [] } = useQuery({ queryKey: ["plazas"], queryFn: async () => { const { data } = await supabase.from("plazas").select("*").eq("is_active", true).order("nombre"); return data || []; } });
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: async () => { const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name"); return data || []; } });
  const { data: contacts = [] } = useQuery({ queryKey: ["contacts", form.empresa_id], queryFn: async () => { let q = supabase.from("contacts").select("id, first_name, last_name, company_id").eq("is_active", true).order("first_name"); if (form.empresa_id) q = q.eq("company_id", form.empresa_id); const { data } = await q; return data || []; }, enabled: true });
  const { data: users = [] } = useQuery({ queryKey: ["profiles_list"], queryFn: async () => { const { data } = await supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"); return data || []; } });
  const { data: productos = [] } = useQuery({ queryKey: ["productos_list"], queryFn: async () => { const { data } = await supabase.from("productos").select("id, codigo, nombre_producto, precio_base_uf1, presentaciones(unidades_equivalentes)").eq("is_active", true).order("codigo"); return data || []; } });

  // Load existing document
  const { data: existingDoc } = useQuery({
    queryKey: ["documento", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("documentos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingItems = [] } = useQuery({
    queryKey: ["documento_productos", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase.from("documento_productos").select("*, productos(codigo, nombre_producto)").eq("documento_id", id);
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

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
        id: it.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento_porcentaje: it.descuento_porcentaje,
        subtotal: it.subtotal,
        unidades_equivalentes: it.unidades_equivalentes,
        _nombre: `${it.productos?.codigo} - ${it.productos?.nombre_producto}`,
      })));
    }
  }, [existingItems]);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // Calculate totals
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const ivaPct = Number(form.iva_porcentaje) || 0;
  const ivaImporte = subtotal * (ivaPct / 100);
  const total = subtotal + ivaImporte;
  const ueTotal = items.reduce((s, i) => s + i.unidades_equivalentes, 0);

  // Add line item
  const addItem = () => {
    setItems(prev => [...prev, { producto_id: "", cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, subtotal: 0, unidades_equivalentes: 0 }]);
  };

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

  // Save
  const handleSave = async () => {
    if (!form.empresa_vendedora) { toast.error("Selecciona la empresa vendedora"); return; }
    if (!form.tipo_documento) { toast.error("Selecciona el tipo de documento"); return; }
    setSaving(true);
    try {
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
        numero_cotizacion: form.numero_cotizacion || null,
        numero_pedido: form.numero_pedido || null,
        numero_factura: form.numero_factura || null,
        estatus_cotizacion: form.tipo_documento === "cotizacion" ? form.estatus_cotizacion : null,
        estatus_pedido: form.tipo_documento === "pedido" ? form.estatus_pedido : null,
        estatus_factura: form.tipo_documento === "factura" ? form.estatus_factura : null,
        subtotal,
        iva_importe: ivaImporte,
        total,
        unidades_equivalentes_total: ueTotal,
        negocio_crm: form.negocio_crm || null,
        notas: form.notas || null,
        numero_oc_cliente: form.numero_oc_cliente || null,
        direccion_envio: form.direccion_envio || null,
        cotizacion_original_id: form.cotizacion_original_id || null,
        tipo_pago: form.tipo_pago || null,
        uso_cfdi: form.uso_cfdi || null,
        metodo_pago: form.metodo_pago || null,
      };

      let docId = id;
      if (isEdit) {
        const { error } = await supabase.from("documentos").update(docData).eq("id", id!);
        if (error) throw error;
        // Delete old items and re-insert
        await supabase.from("documento_productos").delete().eq("documento_id", id!);
      } else {
        const { data, error } = await supabase.from("documentos").insert(docData).select("id").single();
        if (error) throw error;
        docId = data.id;
      }

      // Insert line items
      if (items.length > 0) {
        const lineItems = items.filter(i => i.producto_id).map(i => ({
          documento_id: docId!,
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento_porcentaje: i.descuento_porcentaje,
          subtotal: i.subtotal,
          unidades_equivalentes: i.unidades_equivalentes,
        }));
        if (lineItems.length > 0) {
          const { error } = await supabase.from("documento_productos").insert(lineItems);
          if (error) throw error;
        }
      }

      qc.invalidateQueries({ queryKey: ["documentos"] });
      toast.success(isEdit ? "Documento actualizado" : "Documento creado");
      navigate("/documents");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEdit ? "Editar Documento" : "Nuevo Documento"}</h1>
        </div>
      </div>

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
          <div>
            <Label>Empresa (Cliente)</Label>
            <Select value={form.empresa_id} onValueChange={v => { set("empresa_id", v); set("contacto_id", ""); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contacto</Label>
            <Select value={form.contacto_id} onValueChange={v => set("contacto_id", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dates & Numbers */}
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
          <div>
            <Label>Número Cotización</Label>
            <Input value={form.numero_cotizacion} onChange={e => set("numero_cotizacion", e.target.value)} />
          </div>
          <div>
            <Label>Número Pedido</Label>
            <Input value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
          </div>
          <div>
            <Label>Número Factura</Label>
            <Input value={form.numero_factura} onChange={e => set("numero_factura", e.target.value)} />
          </div>
          {form.tipo_documento === "cotizacion" && (
            <div>
              <Label>Estatus Cotización</Label>
              <Select value={form.estatus_cotizacion} onValueChange={v => set("estatus_cotizacion", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTATUS_COT.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.tipo_documento === "pedido" && (
            <div>
              <Label>Estatus Pedido</Label>
              <Select value={form.estatus_pedido} onValueChange={v => set("estatus_pedido", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTATUS_PED.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.tipo_documento === "factura" && (
            <div>
              <Label>Estatus Factura</Label>
              <Select value={form.estatus_factura} onValueChange={v => set("estatus_factura", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTATUS_FAC.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
                      <Select value={item.producto_id} onValueChange={v => updateItem(idx, "producto_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                        <SelectContent>
                          {productos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nombre_producto}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
            <Textarea value={form.direccion_envio} onChange={e => set("direccion_envio", e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={e => set("notas", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/documents")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
