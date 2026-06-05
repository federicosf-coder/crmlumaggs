import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CrmActivityItem } from "@/components/crm/CrmActivityItem";
import { CreateCrmActivityTaskDialog } from "@/components/crm/CreateCrmActivityTaskDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { EstadoCobranzaBadge } from "@/components/cobranza/EstadoCobranzaBadge";
import { openWhatsApp, normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import type { TaskTypeKey } from "@/lib/taskTypes";
import {
  TrendingUp,
  Calendar as CalendarIcon,
  Plus,
  Phone,
  Mail,
  FileText,
  MessageCircle,
  AlertTriangle,
  ClipboardList,
  Users,
  FileSignature,
  Receipt,
  PackageCheck,
  UserPlus,
  XCircle,
  RotateCcw,
  TrendingDown,
  Package,
} from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import {
  type EmpresaVendedora,
  type SeguimientoEstatus,
  type SeguimientoVentasRow,
  useUpdateSeguimientoEstatusManual,
} from "@/hooks/useSeguimientoVentas";

interface Props {
  row: SeguimientoVentasRow | null;
  empresaVendedora: EmpresaVendedora;
  catalog: SeguimientoEstatus[];
  onOpenChange: (open: boolean) => void;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

export function SeguimientoDetailDialog({ row, empresaVendedora, catalog, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateManual = useUpdateSeguimientoEstatusManual();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<TaskTypeKey | undefined>(undefined);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [perderDialogOpen, setPerderDialogOpen] = useState(false);
  const [registrarPerdidaOpen, setRegistrarPerdidaOpen] = useState(false);

  const open = !!row;
  const tieneVenta = !!row?.tiene_venta;

  // ---- Contactos de la empresa ----
  const { data: contacts } = useQuery({
    queryKey: ["seguimiento_contacts", row?.company_id],
    enabled: !!row?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, email, phone, mobile, whatsapp_phone")
        .eq("company_id", row!.company_id)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
  });

  const primaryContact = contacts?.[0] || null;

  // ---- Actividades y tareas vinculadas a ESTE seguimiento (tablas puente) ----
  const { data: linkedActivities } = useQuery({
    queryKey: ["seguimiento_activities_linked", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("crm_activity_seguimiento")
        .select("activity_id")
        .eq("seguimiento_venta_id", row!.id);
      const ids = (links || []).map((l: any) => l.activity_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("crm_activities")
        .select("*, contacts(id, first_name, last_name), companies(id, name)")
        .in("id", ids)
        .order("activity_date", { ascending: false });
      return data || [];
    },
  });

  const { data: linkedTasks } = useQuery({
    queryKey: ["seguimiento_tasks_linked", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("crm_task_seguimiento")
        .select("task_id")
        .eq("seguimiento_venta_id", row!.id);
      const ids = (links || []).map((l: any) => l.task_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("crm_tasks")
        .select("*, contacts(id, first_name, last_name), companies(id, name)")
        .in("id", ids)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data || [];
    },
  });

  // ---- Documentos relacionados (empresa + marca) ----
  const { data: documentos } = useQuery({
    queryKey: ["seguimiento_docs", row?.company_id, empresaVendedora],
    enabled: !!row?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("documentos")
        .select("id, tipo_documento, numero_cotizacion, numero_pedido, numero_factura, fecha_documento, fecha_entrega_real, total, estado_cobranza, estatus_factura, saldo_pendiente_cobranza")
        .eq("empresa_id", row!.company_id)
        .eq("empresa_vendedora", empresaVendedora)
        .order("fecha_documento", { ascending: false })
        .limit(80);
      return (data || []) as any[];
    },
  });

  const docsByTipo = useMemo(() => {
    const groups: Record<string, any[]> = { cotizacion: [], pedido: [], factura: [] };
    for (const d of documentos || []) {
      const t = String(d.tipo_documento || "").toLowerCase();
      if (t.includes("cotiz")) groups.cotizacion.push(d);
      else if (t.includes("pedido")) groups.pedido.push(d);
      else if (t.includes("factura")) groups.factura.push(d);
    }
    return groups;
  }, [documentos]);

  // ---- Productos comprados (agregado desde facturas de esta empresa+marca) ----
  const { data: productosComprados } = useQuery({
    queryKey: ["seguimiento_productos_comprados", row?.company_id, empresaVendedora],
    enabled: !!row?.company_id,
    queryFn: async () => {
      const { data: facturas } = await supabase
        .from("documentos")
        .select("id, fecha_documento")
        .eq("empresa_id", row!.company_id)
        .eq("empresa_vendedora", empresaVendedora)
        .eq("tipo_documento", "factura")
        .eq("is_active", true);
      const facMap = new Map<string, string>();
      for (const f of facturas || []) facMap.set(f.id, f.fecha_documento);
      const ids = Array.from(facMap.keys());
      if (ids.length === 0) return [];
      const { data: lineas } = await supabase
        .from("documento_productos")
        .select("documento_id, producto_id, cantidad, productos(id, nombre_producto, codigo)")
        .in("documento_id", ids);
      const agg = new Map<string, { producto_id: string; nombre: string; codigo: string | null; cantidad: number; ultima: string | null }>();
      for (const l of lineas || []) {
        if (!l.producto_id) continue;
        const fecha = facMap.get(l.documento_id) || null;
        const prev = agg.get(l.producto_id);
        const nombre = (l as any).productos?.nombre_producto || "—";
        const codigo = (l as any).productos?.codigo || null;
        if (prev) {
          prev.cantidad += Number(l.cantidad || 0);
          if (fecha && (!prev.ultima || fecha > prev.ultima)) prev.ultima = fecha;
        } else {
          agg.set(l.producto_id, { producto_id: l.producto_id, nombre, codigo, cantidad: Number(l.cantidad || 0), ultima: fecha });
        }
      }
      return Array.from(agg.values()).sort((a, b) => b.cantidad - a.cantidad);
    },
  });

  // ---- Motivos de pérdida ----
  const { data: motivosPerdida } = useQuery({
    queryKey: ["motivos_perdida_activos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("motivos_perdida")
        .select("id, nombre, tipo, color, activo, orden")
        .eq("activo", true)
        .order("orden");
      return (data || []) as any[];
    },
  });

  // ---- Bitácora de pérdidas de este registro ----
  const { data: perdidasLog } = useQuery({
    queryKey: ["seguimiento_perdidas_log", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("seguimiento_perdidas")
        .select("id, tipo, motivo_id, fecha, unidades_estimadas, nota, created_at, motivo:motivos_perdida(id, nombre, color)")
        .eq("seguimiento_venta_id", row!.id)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const ambito = tieneVenta ? "con_venta" : "sin_venta";
  const familiaManual = tieneVenta ? "riesgo" : "gestion";
  const statusOptions = useMemo(
    () => catalog.filter((c) => c.ambito === ambito && c.familia === familiaManual),
    [catalog, ambito, familiaManual],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<string, SeguimientoEstatus>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  if (!row) return null;

  const effectiveId = row.estatus_manual && row.estatus_manual_id
    ? row.estatus_manual_id
    : (tieneVenta ? row.estatus_riesgo_id : row.estatus_gestion_id);
  const effective = effectiveId ? catalogMap.get(effectiveId) : null;
  const ritmo = row.estatus_ritmo_id ? catalogMap.get(row.estatus_ritmo_id) : null;

  const marcaLabel = empresaVendedora === "galsa_phillips66" ? "Phillips 66" : "Chevron";
  const headerGradient = empresaVendedora === "galsa_phillips66"
    ? "bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-l-4 border-red-500"
    : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-blue-500";

  const handleManualChange = (val: string) => {
    if (val === "__auto__") {
      updateManual.mutate(
        { id: row.id, estatus_manual_id: null },
        { onSuccess: () => toast({ title: "Estatus automático activado" }) },
      );
    } else {
      updateManual.mutate(
        { id: row.id, estatus_manual_id: val },
        { onSuccess: () => toast({ title: "Estatus actualizado" }) },
      );
    }
  };

  const manualValue = row.estatus_manual && row.estatus_manual_id ? row.estatus_manual_id : "__auto__";

  const openCreate = (type?: TaskTypeKey) => {
    setCreateDefaultType(type);
    setCreateDialogOpen(true);
  };

  const handleWhatsApp = (raw?: string | null, name?: string) => {
    const phone = normalizePhoneForWhatsApp(raw);
    if (!phone) {
      toast({ title: "Sin número de WhatsApp", variant: "destructive" });
      return;
    }
    const msg = `Hola${name ? ` ${name}` : ""}, te contacto de ${marcaLabel}.`;
    openWhatsApp(phone, msg);
  };

  const visibleContacts = showAllContacts ? (contacts || []) : (contacts || []).slice(0, 3);

  const motivoPerdidaActual = (motivosPerdida || []).find((m) => m.id === row.motivo_perdida_id) || null;
  const isPerdido = !!row.perdido;

  // ---- Acciones de Pérdida ----
  const handleNuevaCotizacion = () => {
    const params = new URLSearchParams();
    params.set("tipo", "cotizacion");
    if (row.company_id) params.set("empresa_id", row.company_id);
    if (primaryContact?.id) params.set("contacto_id", primaryContact.id);
    if (empresaVendedora) params.set("empresa_vendedora", empresaVendedora);
    if (row.owner_id) params.set("ejecutivo_venta_id", row.owner_id);
    onOpenChange(false);
    navigate(`/documents/new?${params.toString()}`);
  };

  const invalidatePerdidas = () => {
    qc.invalidateQueries({ queryKey: ["seguimiento_perdidas_log", row.id] });
    qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
  };

  const handleReactivar = async () => {
    const { error } = await supabase
      .from("seguimiento_ventas")
      .update({ perdido: false, fecha_perdida: null })
      .eq("id", row.id);
    if (error) { toast({ title: "Error al reactivar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Registro reactivado" });
    invalidatePerdidas();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className={`rounded-lg p-4 shadow-sm ${headerGradient}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-lg flex-wrap">
                {effective && (
                  <div
                    className="h-3 w-3 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: effective.color }}
                  />
                )}
                <span>{row.companies?.name || "—"}</span>
                <Badge variant="outline" className="text-xs font-semibold bg-white/80 border-foreground/10 shadow-sm">
                  {marcaLabel}
                </Badge>
                <Badge variant="outline" className="text-xs bg-white/70">
                  {tieneVenta ? "Con Venta" : "Sin Venta"}
                </Badge>
              </DialogTitle>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {effective && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: effective.color }}
                >
                  {effective.es_urgente && <AlertTriangle className="h-3.5 w-3.5" />}
                  {effective.nombre}
                </span>
              )}
              {ritmo && tieneVenta && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: ritmo.color }}
                >
                  Ritmo: {ritmo.nombre}
                </span>
              )}
              {row.estatus_manual && (
                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-800">
                  Estatus manual
                </Badge>
              )}
               {isPerdido && (
                 <Badge className="text-xs bg-rose-600 hover:bg-rose-600/90 text-white border-transparent">
                   <XCircle className="h-3 w-3 mr-1" /> Perdido{motivoPerdidaActual ? ` · ${motivoPerdidaActual.nombre}` : ""}
                 </Badge>
               )}
            </div>
          </div>
        </DialogHeader>

        {/* Bloque de Contactos (entre encabezado y métricas) */}
        <div className="mt-4 rounded-lg shadow-sm bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Contactos
              {contacts && contacts.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px]">{contacts.length}</Badge>
              )}
            </h4>
            <div className="flex items-center gap-2">
              {contacts && contacts.length > 3 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAllContacts((v) => !v)}>
                  {showAllContacts ? "Ver menos" : `Seleccionar más (${contacts.length - 3})`}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setNewContactOpen(true)}>
                <UserPlus className="h-3 w-3 mr-1" /> Agregar contacto
              </Button>
            </div>
          </div>
          {(!contacts || contacts.length === 0) ? (
            <p className="text-xs text-muted-foreground">Sin contactos registrados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleContacts.map((c: any) => {
                const name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
                const wa = c.whatsapp_phone || c.mobile || c.phone;
                return (
                  <div key={c.id} className="rounded-md border bg-background p-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name || "—"}</p>
                      {c.job_title && <p className="text-[11px] text-muted-foreground truncate">{c.job_title}</p>}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        {(c.mobile || c.phone) && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.mobile || c.phone}</span>}
                      </div>
                    </div>
                    {wa && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Abrir WhatsApp"
                        onClick={() => handleWhatsApp(wa, c.first_name)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/main: métricas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg shadow-sm bg-muted/30 p-4 border-l-4" style={{ borderLeftColor: effective?.color || "hsl(var(--primary))" }}>
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Métricas
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                <Metric label="Potencial" value={fmtNum(row.potencial)} />
                <Metric label="Prom. mensual" value={fmtNum(row.promedio_historico_mensual)} />
                <Metric label="Ritmo" value={row.ritmo_pct != null ? `${Math.round(Number(row.ritmo_pct))}%` : "—"} />
                <Metric label="Acum. mes" value={fmtNum(row.acum_mes)} />
                <Metric label="Mes anterior" value={fmtNum(row.acum_mes_anterior)} />
                <Metric label="Acum. año" value={fmtNum(row.acum_anio)} />
                <Metric
                  label="Última compra"
                  value={
                    row.fecha_ultima_compra
                      ? `${formatDate(row.fecha_ultima_compra)}${row.dias_ultima_compra != null ? ` · ${row.dias_ultima_compra} d` : ""}`
                      : "—"
                  }
                />
                <Metric label="Ciclo (días)" value={row.ciclo_dias != null ? `${row.ciclo_dias}` : "—"} />
                <Metric label="Cotizaciones" value={`${row.cotizaciones_total}`} />
                <Metric
                  label="Últ. cotización"
                  value={
                    row.ultima_cotizacion_fecha
                      ? `${formatDate(row.ultima_cotizacion_fecha)}${row.dias_ultima_cotizacion != null ? ` · ${row.dias_ultima_cotizacion} d` : ""}`
                      : "—"
                  }
                />
                <Metric
                  label="Últ. actividad"
                  value={
                    row.ultima_actividad_fecha
                      ? `${formatDate(row.ultima_actividad_fecha)}${row.dias_ultima_actividad != null ? ` · ${row.dias_ultima_actividad} d` : ""}`
                      : "—"
                  }
                />
                <Metric label="Actividades activas" value={`${row.actividades_activas}`} />
              </div>
            </div>

            {/* Actividades y tareas vinculadas (unificado) */}
            <div className="rounded-lg shadow-sm bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> Actividades y tareas vinculadas
              </h4>
              {(!linkedActivities?.length && !linkedTasks?.length) ? (
                <p className="text-sm text-muted-foreground">Sin actividades ni tareas vinculadas a este seguimiento.</p>
              ) : (
                <div className="space-y-2">
                  {(linkedActivities || []).map((a: any) => (
                    <CrmActivityItem key={`a-${a.id}`} activity={a} />
                  ))}
                  {(linkedTasks || []).map((t: any) => (
                    <CrmTaskItem key={`t-${t.id}`} task={t} />
                  ))}
                </div>
              )}
            </div>

            {/* Documentos relacionados — Tabs (empresa + marca) */}
            <div className="rounded-lg shadow-sm bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Documentos relacionados
              </h4>
              <Tabs defaultValue="cotizaciones" className="w-full">
                <TabsList className="grid grid-cols-4 w-full h-9">
                  <TabsTrigger value="cotizaciones" className="text-xs gap-1">
                    <FileSignature className="h-3 w-3" /> Cotizaciones
                    <span className="text-[10px] opacity-70">({docsByTipo.cotizacion.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="pedidos" className="text-xs gap-1">
                    <PackageCheck className="h-3 w-3" /> Pedidos
                    <span className="text-[10px] opacity-70">({docsByTipo.pedido.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="facturas" className="text-xs gap-1">
                    <Receipt className="h-3 w-3" /> Facturas
                    <span className="text-[10px] opacity-70">({docsByTipo.factura.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="productos" className="text-xs gap-1">
                    <Package className="h-3 w-3" /> Productos
                    <span className="text-[10px] opacity-70">({(productosComprados || []).length})</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="cotizaciones" className="mt-3">
                  <DocGroup docs={docsByTipo.cotizacion} numKey="numero_cotizacion" />
                </TabsContent>
                <TabsContent value="pedidos" className="mt-3">
                  <DocGroup docs={docsByTipo.pedido} numKey="numero_pedido" showEntrega />
                </TabsContent>
                <TabsContent value="facturas" className="mt-3">
                  <DocGroup docs={docsByTipo.factura} numKey="numero_factura" showCobranza />
                </TabsContent>
                <TabsContent value="productos" className="mt-3">
                  <ProductosTable rows={productosComprados || []} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Pérdidas */}
            <div className="rounded-lg shadow-sm bg-muted/30 p-4 border-l-4 border-rose-300">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-rose-600" /> Pérdidas
                </h4>
                <div className="flex items-center gap-2">
                  {isPerdido ? (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReactivar}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Reactivar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                      onClick={() => setPerderDialogOpen(true)}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Marcar como perdido
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRegistrarPerdidaOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Registrar pérdida
                  </Button>
                </div>
              </div>
              {isPerdido && (
                <div className="mb-3 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
                  <p className="font-medium">
                    Marcado como perdido{row.fecha_perdida ? ` el ${formatDate(row.fecha_perdida)}` : ""}.
                  </p>
                  {motivoPerdidaActual && (
                    <p className="font-light">Motivo: {motivoPerdidaActual.nombre}</p>
                  )}
                  {row.nota_perdida && <p className="font-light mt-0.5">{row.nota_perdida}</p>}
                </div>
              )}
              {(!perdidasLog || perdidasLog.length === 0) ? (
                <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {perdidasLog.map((p: any) => (
                    <div key={p.id} className="rounded-md border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            p.tipo === "total"
                              ? "text-[10px] border-rose-300 text-rose-700 bg-rose-50"
                              : "text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                          }
                        >
                          {p.tipo === "total" ? "Total" : "Parcial"}
                        </Badge>
                        {p.motivo && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.motivo.color || "#999" }} />
                            <span className="font-medium">{p.motivo.nombre}</span>
                          </span>
                        )}
                        <span className="text-muted-foreground">{formatDate(p.fecha)}</span>
                        {p.unidades_estimadas != null && (
                          <span className="text-muted-foreground">· {fmtNum(p.unidades_estimadas)} u.</span>
                        )}
                      </div>
                      {p.nota && <p className="text-muted-foreground font-light mt-1">{p.nota}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Estatus + acciones */}
          <aside className="space-y-6 lg:border-l lg:pl-6">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Estatus</Label>
              <Select value={manualValue} onValueChange={handleManualChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                      Automático
                    </span>
                  </SelectItem>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                        {o.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {row.estatus_manual && (
                <p className="text-[11px] text-muted-foreground mt-1 font-light">
                  Estatus fijado manualmente. Selecciona "Automático" para volver al cálculo.
                </p>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Agregar
              </h4>
              <div className="flex flex-col gap-2">
                <Button variant="default" size="sm" className="justify-start" onClick={handleNuevaCotizacion}>
                  <FileSignature className="h-3.5 w-3.5 mr-2" /> Nueva cotización
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => openCreate("call")}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-2" /> Agregar actividad
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 font-light">
                Se pre-cargará con esta empresa, contacto y marca.
              </p>
            </div>
          </aside>
        </div>
      </DialogContent>

      <CreateCrmActivityTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultCompanyId={row.company_id}
        defaultContactId={primaryContact?.id}
        defaultTaskType={createDefaultType}
        defaultBrands={[empresaVendedora as "lumaggs_chevron" | "galsa_phillips66"]}
      />

      <ContactFormDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        defaultCompanyId={row.company_id}
      />

      <MarcarPerdidoDialog
        open={perderDialogOpen}
        onOpenChange={setPerderDialogOpen}
        row={row}
        motivos={(motivosPerdida || []).filter((m) => m.tipo === "total")}
        userId={user?.id || null}
        onSaved={invalidatePerdidas}
      />

      <RegistrarPerdidaDialog
        open={registrarPerdidaOpen}
        onOpenChange={setRegistrarPerdidaOpen}
        rowId={row.id}
        motivosAll={motivosPerdida || []}
        userId={user?.id || null}
        onSaved={invalidatePerdidas}
      />
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs font-light mt-0.5">{value}</p>
    </div>
  );
}

function DocGroup({
  title,
  icon,
  docs,
  numKey,
  showCobranza,
}: {
  title: string;
  icon: React.ReactNode;
  docs: any[];
  numKey: "numero_cotizacion" | "numero_pedido" | "numero_factura";
  showCobranza?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{docs.length}</Badge>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground font-light">—</p>
      ) : (
        <div className="space-y-1">
          {docs.slice(0, 10).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded-md bg-background border px-2.5 py-1.5">
              <div className="min-w-0 flex items-center gap-2">
                <span className="font-medium truncate">{d[numKey] || "(sin folio)"}</span>
                {d.fecha_documento && (
                  <span className="text-muted-foreground text-[11px]">{formatDate(d.fecha_documento)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] tabular-nums">{fmtMoney(d.total)}</span>
                {showCobranza && (
                  <EstadoCobranzaBadge value={d.estatus_factura || d.estado_cobranza} />
                )}
              </div>
            </div>
          ))}
          {docs.length > 10 && (
            <p className="text-[11px] text-muted-foreground font-light">+{docs.length - 10} más…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Dialog: Marcar como perdido (pérdida TOTAL) =====
function MarcarPerdidoDialog({
  open,
  onOpenChange,
  row,
  motivos,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: SeguimientoVentasRow;
  motivos: any[];
  userId: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [motivoId, setMotivoId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!motivoId) { toast({ title: "Selecciona un motivo", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from("seguimiento_ventas")
        .update({
          perdido: true,
          motivo_perdida_id: motivoId,
          fecha_perdida: fecha,
          nota_perdida: nota || null,
        })
        .eq("id", row.id);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase
        .from("seguimiento_perdidas")
        .insert({
          seguimiento_venta_id: row.id,
          tipo: "total",
          motivo_id: motivoId,
          fecha,
          nota: nota || null,
          created_by: userId,
        });
      if (insErr) throw insErr;
      toast({ title: "Registro marcado como perdido" });
      onSaved();
      onOpenChange(false);
      setMotivoId(""); setNota("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Marcar como perdido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Motivo</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color || "#999" }} />
                      {m.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Nota</Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-600/90">
            {saving ? "Guardando…" : "Marcar como perdido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Dialog: Registrar pérdida (evento total o parcial) =====
function RegistrarPerdidaDialog({
  open,
  onOpenChange,
  rowId,
  motivosAll,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rowId: string;
  motivosAll: any[];
  userId: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"total" | "parcial">("parcial");
  const [motivoId, setMotivoId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [unidades, setUnidades] = useState<string>("");
  const [nota, setNota] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const motivosFiltrados = useMemo(
    () => motivosAll.filter((m) => m.tipo === tipo),
    [motivosAll, tipo],
  );

  const handleSave = async () => {
    if (!motivoId) { toast({ title: "Selecciona un motivo", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("seguimiento_perdidas")
        .insert({
          seguimiento_venta_id: rowId,
          tipo,
          motivo_id: motivoId,
          fecha,
          unidades_estimadas: unidades ? Number(unidades) : null,
          nota: nota || null,
          created_by: userId,
        });
      if (error) throw error;
      toast({ title: "Pérdida registrada" });
      onSaved();
      onOpenChange(false);
      setMotivoId(""); setNota(""); setUnidades(""); setTipo("parcial");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar pérdida</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Tipo</Label>
            <Select value={tipo} onValueChange={(v: any) => { setTipo(v); setMotivoId(""); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="total">Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Motivo</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger>
              <SelectContent>
                {motivosFiltrados.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color || "#999" }} />
                      {m.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide font-light">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide font-light">Unidades estimadas</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide font-light">Nota</Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}