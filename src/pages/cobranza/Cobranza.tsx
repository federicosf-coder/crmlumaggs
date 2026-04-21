import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, AlertTriangle, CheckCircle2, Clock, Eye, X, Paperclip, FileText, Image as ImageIcon, ExternalLink, Trash2, ArrowLeft, Mail, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranzaPagos, useDocumentosCobranza, useCobranzaAplicaciones, type CobranzaPago } from "@/hooks/useCobranza";
import { RegistrarPagoDialog } from "@/components/cobranza/RegistrarPagoDialog";
import { AplicarPagoDialog } from "@/components/cobranza/AplicarPagoDialog";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { ColumnFilterBuilder, evaluateConditions, type ColumnFilterCondition, type ColumnFilterDef } from "@/components/cobranza/ColumnFilterBuilder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ESTADO_PAGO_LABEL: Record<string, string> = {
  registrado: "Registrado",
  no_aplicado: "No aplicado",
  aplicado_parcial: "Parcial",
  aplicado_total: "Aplicado",
  cancelado: "Cancelado",
};

const ESTATUS_PAGO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  enviado_validar: "Enviado a Validar",
  validado: "Validado",
  aplicado: "Aplicado",
};

const ESTATUS_PAGO_OPTIONS = [
  { value: "recibido", label: "Recibido" },
  { value: "enviado_validar", label: "Enviado a Validar" },
  { value: "validado", label: "Validado" },
  { value: "aplicado", label: "Aplicado" },
];

function EstatusPagoEditor({
  pagoId,
  value,
  canEdit,
  compact = false,
  onChanged,
}: {
  pagoId: string;
  value: string;
  canEdit: boolean;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  if (!canEdit) {
    return <Badge variant="outline">{ESTATUS_PAGO_LABEL[value] || value}</Badge>;
  }
  const handleChange = async (next: string) => {
    if (next === value) return;
    setSaving(true);
    const { error } = await supabase
      .from("cobranza_pagos")
      .update({ estatus_pago: next as any })
      .eq("id", pagoId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estatus actualizado");
    onChanged?.();
  };
  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className={compact ? "h-7 text-xs px-2 w-[150px]" : "h-8 w-[180px]"} onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ESTATUS_PAGO_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const FORMA_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_cescemex: "Crédito Cescemex",
};

const ESTADO_COBRANZA_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

function diasParaVencer(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(fechaVenc); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

function bucketLabel(dias: number | null): string {
  if (dias === null) return "Sin vencimiento";
  if (dias < 0) return "Vencidas";
  if (dias === 0) return "Vencen hoy";
  if (dias <= 5) return "1-5 días";
  if (dias <= 10) return "6-10 días";
  if (dias <= 20) return "11-20 días";
  if (dias <= 30) return "21-30 días";
  return "Más de 30 días";
}

export default function Cobranza() {
  const { hasAnyRole } = useAuth();
  const canDelete = hasAnyRole(["admin", "manager"]);
  const canEditEstatus = hasAnyRole(["admin", "manager", "accounting"]);
  const { pagos, breakdowns, loading: loadingPagos, refetch: refetchPagos } = useCobranzaPagos();
  const { documentos, loading: loadingDocs, refetch: refetchDocs } = useDocumentosCobranza();

  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [openAplicar, setOpenAplicar] = useState(false);
  const [pagoSel, setPagoSel] = useState<CobranzaPago | null>(null);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingDetalleId, setPendingDetalleId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link: open pago detail when ?pagoId=... is present
  useEffect(() => {
    const pid = searchParams.get("pagoId");
    if (!pid) return;
    setActiveTab("pagos");
    setPendingDetalleId(pid);
    // Clear param so the detail can be reopened by visiting again
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("pagoId");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const [searchPagos, setSearchPagos] = useState("");
  const [searchFacturas, setSearchFacturas] = useState("");
  const [bucketSel, setBucketSel] = useState<{ label: string; scope: "all" | "credito" | "credito_cescemex" } | null>(null);

  // Filtros por columna
  const [pagosConditions, setPagosConditions] = useState<ColumnFilterCondition[]>([]);
  const [pagosCombinator, setPagosCombinator] = useState<"AND" | "OR">("AND");
  const [facturasConditions, setFacturasConditions] = useState<ColumnFilterCondition[]>([]);
  const [facturasCombinator, setFacturasCombinator] = useState<"AND" | "OR">("AND");

  const pagosColumns: ColumnFilterDef[] = useMemo(() => [
    { key: "fecha_pago", label: "Fecha", type: "date" },
    { key: "empresa", label: "Cliente", type: "text" },
    { key: "plaza", label: "Plaza", type: "text" },
    { key: "referencia_pago", label: "Referencia", type: "text" },
    { key: "banco", label: "Banco", type: "text" },
    { key: "monto_total", label: "Total", type: "number" },
    { key: "aplicado_facturas", label: "Aplicado a Facturas", type: "number" },
    { key: "aplicado_otros", label: "Aplicado a Cot/Pedidos", type: "number" },
    { key: "disponible_facturas", label: "Disponible (facturas)", type: "number" },
    { key: "tipo_pago", label: "Forma", type: "select", options: [
      { value: "contado", label: "Contado" },
      { value: "credito", label: "Crédito Directo" },
      { value: "credito_cescemex", label: "Crédito Cescemex" },
    ]},
    { key: "estatus_pago", label: "Estatus Pago", type: "select", options: ESTATUS_PAGO_OPTIONS },
    { key: "estado_pago", label: "Estado", type: "select", options: [
      { value: "registrado", label: "Registrado" },
      { value: "no_aplicado", label: "No aplicado" },
      { value: "aplicado_parcial", label: "Parcial" },
      { value: "aplicado_total", label: "Aplicado" },
      { value: "cancelado", label: "Cancelado" },
    ]},
  ], []);

  const facturasColumns: ColumnFilterDef[] = useMemo(() => [
    { key: "numero_factura", label: "Folio", type: "text" },
    { key: "empresa", label: "Cliente", type: "text" },
    { key: "plaza", label: "Plaza", type: "text" },
    { key: "fecha_documento", label: "Emisión", type: "date" },
    { key: "fecha_vencimiento", label: "Vence", type: "date" },
    { key: "dias", label: "Días para vencer", type: "number" },
    { key: "total", label: "Total", type: "number" },
    { key: "saldo_pendiente_cobranza", label: "Saldo", type: "number" },
    { key: "tipo_pago", label: "Forma", type: "select", options: [
      { value: "contado", label: "Contado" },
      { value: "credito", label: "Crédito Directo" },
      { value: "credito_cescemex", label: "Crédito Cescemex" },
    ]},
    { key: "estado_cobranza", label: "Estado", type: "select", options: [
      { value: "pendiente", label: "Pendiente" },
      { value: "parcial", label: "Parcial" },
      { value: "pagada", label: "Pagada" },
      { value: "vencida", label: "Vencida" },
      { value: "cancelada", label: "Cancelada" },
    ]},
  ], []);

  // Solo facturas activas para cartera/dashboard
  const facturas = useMemo(() => documentos.filter((d) => d.tipo_documento === "factura" && d.estado_cobranza !== "cancelada"), [documentos]);

  // KPIs
  const cartera = useMemo(() => {
    const abierta = facturas.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);
    const vencida = facturas.filter((f) => {
      const d = diasParaVencer(f.fecha_vencimiento);
      return d !== null && d < 0 && Number(f.saldo_pendiente_cobranza) > 0;
    }).reduce((s, f) => s + Number(f.saldo_pendiente_cobranza), 0);
    const porVencer = abierta - vencida;
    const noAplicado = pagos.filter((p) => p.estado_pago !== "cancelado").reduce((s, p) => s + (breakdowns[p.id]?.disponibleFacturas ?? Number(p.monto_disponible)), 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const cobradoMes = pagos.filter((p) => p.estado_pago !== "cancelado" && new Date(p.fecha_pago) >= inicioMes)
      .reduce((s, p) => s + Number(p.monto_total), 0);
    const facturasParciales = facturas.filter((f) => f.estado_cobranza === "parcial").length;
    const facturasPagadas = facturas.filter((f) => f.estado_cobranza === "pagada").length;
    return { abierta, vencida, porVencer, noAplicado, cobradoMes, facturasParciales, facturasPagadas };
  }, [facturas, pagos, breakdowns]);

  // Buckets de vencimiento (helper reusable)
  const buildBuckets = (lista: typeof facturas) => {
    const orden = ["Vencidas", "Vencen hoy", "1-5 días", "6-10 días", "11-20 días", "21-30 días", "Más de 30 días"];
    const acc: Record<string, { count: number; monto: number }> = {};
    orden.forEach((b) => acc[b] = { count: 0, monto: 0 });
    lista.forEach((f) => {
      if (Number(f.saldo_pendiente_cobranza) <= 0) return;
      const lbl = bucketLabel(diasParaVencer(f.fecha_vencimiento));
      if (acc[lbl]) { acc[lbl].count++; acc[lbl].monto += Number(f.saldo_pendiente_cobranza); }
    });
    return orden.map((b) => ({ label: b, ...acc[b] }));
  };

  const facturasCreditoDirecto = useMemo(() => facturas.filter((f) => f.tipo_pago === "credito"), [facturas]);
  const facturasCreditoCescemex = useMemo(() => facturas.filter((f) => f.tipo_pago === "credito_cescemex"), [facturas]);

  const buckets = useMemo(() => buildBuckets(facturas), [facturas]);
  const bucketsCreditoDirecto = useMemo(() => buildBuckets(facturasCreditoDirecto), [facturasCreditoDirecto]);
  const bucketsCreditoCescemex = useMemo(() => buildBuckets(facturasCreditoCescemex), [facturasCreditoCescemex]);

  const proximasVencer = useMemo(() => {
    return [...facturas]
      .filter((f) => Number(f.saldo_pendiente_cobranza) > 0 && f.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime())
      .slice(0, 8);
  }, [facturas]);

  const pagosNoAplicados = useMemo(
    () => pagos.filter((p) => p.estado_pago !== "cancelado" && (breakdowns[p.id]?.disponibleFacturas ?? p.monto_disponible) > 0).slice(0, 10),
    [pagos, breakdowns]
  );

  const carteraPorPlaza = useMemo(() => {
    const map = new Map<string, number>();
    facturas.forEach((f) => {
      const k = f.plaza?.nombre || "Sin plaza";
      map.set(k, (map.get(k) || 0) + Number(f.saldo_pendiente_cobranza));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [facturas]);

  // Filtros listados
  const pagosFiltrados = useMemo(() => {
    const q = searchPagos.toLowerCase();
    return pagos.filter((p) =>
      !q || p.empresa?.name?.toLowerCase().includes(q) || p.referencia_pago?.toLowerCase().includes(q)
    );
  }, [pagos, searchPagos]);

  const facturasFiltradas = useMemo(() => {
    const q = searchFacturas.toLowerCase();
    return facturas.filter((f) =>
      !q || f.empresa?.name?.toLowerCase().includes(q) || f.numero_factura?.toLowerCase().includes(q)
    );
  }, [facturas, searchFacturas]);

  const handleAplicar = (p: CobranzaPago) => { setPagoSel(p); setOpenAplicar(true); };
  const handleVerDetalle = (p: CobranzaPago) => { setPagoSel(p); setOpenDetalle(true); };

  useEffect(() => {
    if (!pendingDetalleId) return;
    const found = pagos.find((p) => p.id === pendingDetalleId);
    if (found) {
      setPagoSel(found);
      setOpenDetalle(true);
      setPendingDetalleId(null);
    }
  }, [pendingDetalleId, pagos]);

  const handleCancelarPago = async (p: CobranzaPago) => {
    if (!confirm("¿Cancelar este pago? Se revertirán todas sus aplicaciones.")) return;
    // Cancelar aplicaciones activas
    await supabase.from("cobranza_aplicaciones")
      .update({ estatus_aplicacion: "cancelada" })
      .eq("pago_id", p.id)
      .eq("estatus_aplicacion", "activa");
    const { error } = await supabase.from("cobranza_pagos").update({ estado_pago: "cancelado" }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pago cancelado");
    refetchPagos(); refetchDocs();
  };

  const handleEliminarPago = async (p: CobranzaPago) => {
    if (!confirm("¿Eliminar permanentemente este pago? Se eliminarán también sus aplicaciones y archivos. Esta acción no se puede deshacer.")) return;
    const docIds = Array.from(new Set(((await supabase.from("cobranza_aplicaciones").select("documento_id").eq("pago_id", p.id)).data || []).map((a: any) => a.documento_id)));
    await supabase.from("cobranza_aplicaciones").delete().eq("pago_id", p.id);
    await supabase.from("cobranza_pago_archivos").delete().eq("pago_id", p.id);
    const { error } = await supabase.from("cobranza_pagos").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    for (const docId of docIds) {
      await supabase.rpc("recompute_documento_cobranza", { _documento_id: docId });
    }
    toast.success("Pago eliminado");
    refetchPagos(); refetchDocs();
  };

  return (
    <div className="space-y-6">
      <PageBanner
        title="Cobranza"
        description="Gestión de pagos, aplicaciones y cartera por cobrar"
        avatar={<div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Wallet className="h-5 w-5" /></div>}
      />

      <div className="flex justify-end">
        <Button onClick={() => setOpenRegistrar(true)}>
          <Plus className="h-4 w-4 mr-2" /> Registrar pago
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="facturas">Seguimiento de facturas</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          {bucketSel ? (
            <BucketDetalle
              label={bucketSel.label}
              scopeLabel={bucketSel.scope === "credito" ? "Crédito Directo" : bucketSel.scope === "credito_cescemex" ? "Crédito Cescemex" : "Todas las facturas"}
              facturas={(bucketSel.scope === "credito" ? facturasCreditoDirecto : bucketSel.scope === "credito_cescemex" ? facturasCreditoCescemex : facturas).filter((f) => Number(f.saldo_pendiente_cobranza) > 0 && bucketLabel(diasParaVencer(f.fecha_vencimiento)) === bucketSel.label)}
              onBack={() => setBucketSel(null)}
            />
          ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Cartera abierta" value={formatCurrency(cartera.abierta)} icon={Wallet} />
            <KpiCard title="Cartera vencida" value={formatCurrency(cartera.vencida)} icon={AlertTriangle} variant="destructive" />
            <KpiCard title="Por vencer" value={formatCurrency(cartera.porVencer)} icon={Clock} />
            <KpiCard title="Cobrado del mes" value={formatCurrency(cartera.cobradoMes)} icon={CheckCircle2} variant="success" />
            <KpiCard title="Pagos no aplicados" value={formatCurrency(cartera.noAplicado)} icon={Wallet} />
            <KpiCard title="Facturas parciales" value={String(cartera.facturasParciales)} icon={Clock} />
            <KpiCard title="Facturas pagadas" value={String(cartera.facturasPagadas)} icon={CheckCircle2} variant="success" />
            <KpiCard title="Total pagos" value={String(pagos.length)} icon={Wallet} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BucketReportCard title="Vencimientos" buckets={buckets} onSelect={(label) => setBucketSel({ label, scope: "all" })} />
            <BucketReportCard title="Crédito Directo" buckets={bucketsCreditoDirecto} onSelect={(label) => setBucketSel({ label, scope: "credito" })} />
            <BucketReportCard title="Crédito Cescemex" buckets={bucketsCreditoCescemex} onSelect={(label) => setBucketSel({ label, scope: "credito_cescemex" })} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Cartera por plaza</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Plaza</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {carteraPorPlaza.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>}
                    {carteraPorPlaza.map(([plaza, monto]) => (
                      <TableRow key={plaza}><TableCell>{plaza}</TableCell><TableCell className="text-right font-medium">{formatCurrency(monto)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Próximas facturas a vencer</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Vence</TableHead><TableHead className="text-right">Saldo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {proximasVencer.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin facturas pendientes</TableCell></TableRow>}
                    {proximasVencer.map((f) => {
                      const d = diasParaVencer(f.fecha_vencimiento);
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono text-xs">{f.numero_factura || "—"}</TableCell>
                          <TableCell className="truncate max-w-[160px]">{f.empresa?.name}</TableCell>
                          <TableCell>
                            <span className={d !== null && d < 0 ? "text-destructive font-medium" : ""}>
                              {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}
                              {d !== null && <span className="text-xs text-muted-foreground ml-1">({d}d)</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(f.saldo_pendiente_cobranza))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pagos no aplicados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Disponible</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pagosNoAplicados.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Todos los pagos están aplicados</TableCell></TableRow>}
                    {pagosNoAplicados.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                        <TableCell className="truncate max-w-[160px]">{p.empresa?.name}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(breakdowns[p.id]?.disponibleFacturas ?? p.monto_disponible)}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </TabsContent>

        {/* PAGOS */}
        <TabsContent value="pagos" className="space-y-4">
          <Input placeholder="Buscar por empresa o referencia..." value={searchPagos} onChange={(e) => setSearchPagos(e.target.value)} className="max-w-md" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Plaza</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aplicado a Facturas</TableHead>
                  <TableHead className="text-right">Aplicado a Cot/Pedidos</TableHead>
                  <TableHead className="text-right">Disponible (facturas)</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Estatus Pago</TableHead>
                  <TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingPagos && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loadingPagos && pagosFiltrados.length === 0 && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin pagos registrados</TableCell></TableRow>}
                  {pagosFiltrados.map((p) => {
                    const b = breakdowns[p.id];
                    const aplicadoFact = b?.aplicadoFacturas ?? 0;
                    const aplicadoOtros = b?.aplicadoOtros ?? 0;
                    const dispFact = b?.disponibleFacturas ?? Number(p.monto_disponible);
                    return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{p.empresa?.name}</TableCell>
                      <TableCell>{p.plaza?.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.monto_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(aplicadoFact)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{aplicadoOtros > 0 ? formatCurrency(aplicadoOtros) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(dispFact)}</TableCell>
                      <TableCell className="text-xs">{FORMA_PAGO_LABEL[p.tipo_pago || ""] || p.tipo_pago || "—"}</TableCell>
                      <TableCell><EstatusPagoEditor pagoId={p.id} value={p.estatus_pago} canEdit={canEditEstatus} compact onChanged={refetchPagos} /></TableCell>
                      <TableCell><Badge variant={p.estado_pago === "aplicado_total" ? "default" : p.estado_pago === "cancelado" ? "destructive" : "secondary"}>{ESTADO_PAGO_LABEL[p.estado_pago]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleVerDetalle(p)}><Eye className="h-4 w-4" /></Button>
                          {p.estado_pago !== "cancelado" && dispFact > 0 && (
                            <Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button>
                          )}
                          {p.estado_pago !== "cancelado" && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelarPago(p)} title="Cancelar"><X className="h-4 w-4" /></Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" onClick={() => handleEliminarPago(p)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACTURAS */}
        <TabsContent value="facturas" className="space-y-4">
          <Input placeholder="Buscar por cliente o folio..." value={searchFacturas} onChange={(e) => setSearchFacturas(e.target.value)} className="max-w-md" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Plaza</TableHead>
                  <TableHead>Emisión</TableHead><TableHead>Vence</TableHead><TableHead>Días</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingDocs && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loadingDocs && facturasFiltradas.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin facturas</TableCell></TableRow>}
                  {facturasFiltradas.map((f) => {
                    const d = diasParaVencer(f.fecha_vencimiento);
                    const aplicado = Number(f.total) - Number(f.saldo_pendiente_cobranza);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-xs">{f.numero_factura || "—"}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{f.empresa?.name}</TableCell>
                        <TableCell>{f.plaza?.nombre || "—"}</TableCell>
                        <TableCell>{formatDate(f.fecha_documento)}</TableCell>
                        <TableCell>{f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}</TableCell>
                        <TableCell><span className={d !== null && d < 0 ? "text-destructive font-medium" : ""}>{d ?? "—"}</span></TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(f.total))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(f.saldo_pendiente_cobranza))}</TableCell>
                        <TableCell>
                          <Badge variant={
                            f.estado_cobranza === "pagada" ? "default" :
                            f.estado_cobranza === "vencida" ? "destructive" :
                            f.estado_cobranza === "parcial" ? "secondary" : "outline"
                          }>
                            {f.estado_cobranza ? ESTADO_COBRANZA_LABEL[f.estado_cobranza] : "Pendiente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RegistrarPagoDialog open={openRegistrar} onOpenChange={setOpenRegistrar} onSaved={(newId) => { refetchPagos(); refetchDocs(); if (newId) { setActiveTab("pagos"); setPendingDetalleId(newId); } }} />
      <AplicarPagoDialog open={openAplicar} onOpenChange={setOpenAplicar} pago={pagoSel} onSaved={() => { refetchPagos(); refetchDocs(); }} />
      <DetallePagoSheet
        open={openDetalle}
        onOpenChange={setOpenDetalle}
        pago={pagoSel ? (pagos.find((p) => p.id === pagoSel.id) || pagoSel) : null}
        onChanged={() => { refetchPagos(); refetchDocs(); }}
        onAplicar={(p) => { setOpenDetalle(false); handleAplicar(p); }}
      />
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, variant }: { title: string; value: string; icon: any; variant?: "destructive" | "success" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-xl font-bold mt-1 ${variant === "destructive" ? "text-destructive" : variant === "success" ? "text-primary" : ""}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${variant === "destructive" ? "text-destructive/30" : "text-muted-foreground/30"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function DetallePagoSheet({ open, onOpenChange, pago, onChanged, onAplicar }: { open: boolean; onOpenChange: (o: boolean) => void; pago: CobranzaPago | null; onChanged: () => void; onAplicar: (p: CobranzaPago) => void }) {
  const { user, profile, hasAnyRole } = useAuth();
  const canEditEstatus = hasAnyRole(["admin", "manager", "accounting"]);
  const { aplicaciones, refetch } = useCobranzaAplicaciones(pago?.id || null);
  const [openEnviar, setOpenEnviar] = useState(false);
  const [defaultEmails, setDefaultEmails] = useState<string[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [comprobantes, setComprobantes] = useState<{ nombre: string; url: string }[]>([]);
  const [previouslySentEmails, setPreviouslySentEmails] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState<null | "contado" | "credito" | "credito_cescemex" | "general">(null);
  const [editandoFormaPago, setEditandoFormaPago] = useState(false);
  const [nuevaFormaPago, setNuevaFormaPago] = useState<string>(pago?.tipo_pago || "");
  const [activeFlow, setActiveFlow] = useState<{
    templateName: string;
    title: string;
    description: string;
    formaPago?: string;
  }>({ templateName: "pago-confirmation", title: "Enviar confirmación", description: "" });

  useEffect(() => {
    setNuevaFormaPago(pago?.tipo_pago || "");
    setEditandoFormaPago(false);
  }, [pago?.id, pago?.tipo_pago]);

  const handleCancelarAplicacion = async (id: string) => {
    if (!confirm("¿Cancelar esta aplicación?")) return;
    const { error } = await supabase.from("cobranza_aplicaciones").update({ estatus_aplicacion: "cancelada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aplicación cancelada");
    refetch(); onChanged();
  };

  const loadEmailsAndOpen = async (
    flow: "contado" | "credito" | "credito_cescemex" | "general"
  ) => {
    if (!pago) return;
    setLoadingEmails(flow);
    const emails: string[] = [];
    const isValidacion = flow !== "general";

    // Empresa email
    const { data: emp } = await supabase.from("companies").select("email").eq("id", pago.empresa_id).maybeSingle();

    // Correos PROHIBIDOS para validación: empresa + contactos relacionados
    const blocked: string[] = [];
    if (isValidacion) {
      if (emp?.email) blocked.push(emp.email.toLowerCase());
      const { data: contactos } = await supabase
        .from("contacts").select("email").eq("company_id", pago.empresa_id);
      (contactos || []).forEach((c: any) => {
        if (c.email) {
          const e = c.email.toLowerCase();
          if (!blocked.includes(e)) blocked.push(e);
        }
      });
    } else {
      // Confirmación general (no validación) mantiene comportamiento previo
      if (emp?.email) emails.push(emp.email);
    }

    // Determinar grupo según flujo
    const groupName =
      flow === "contado" ? "Cobranza Contado" :
      flow === "credito" ? "Cobranza Crédito Directo" :
      flow === "credito_cescemex" ? "Cobranza Cescemex" :
      "Contabilidad";

    // 1) Parámetros del sistema (system_settings) — fuente principal
    const settingKey =
      flow === "contado" ? "destinatarios_default_contado" :
      flow === "credito" ? "destinatarios_default_credito_directo" :
      flow === "credito_cescemex" ? "destinatarios_default_credito_cescemex" :
      null;
    if (settingKey) {
      const { data: setting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();
      const list = Array.isArray(setting?.value) ? (setting!.value as any[]) : [];
      list.forEach((e: any) => {
        if (typeof e === "string" && e && !emails.includes(e)) emails.push(e);
      });
    }

    // 2) Grupos de correo (compatibilidad / complementario)
    const { data: grp } = await supabase
      .from("email_groups").select("id").eq("nombre", groupName).eq("is_active", true).maybeSingle();
    if (grp?.id) {
      const { data: members } = await supabase
        .from("email_group_members").select("email").eq("group_id", grp.id);
      (members || []).forEach((m: any) => {
        if (m.email && !emails.includes(m.email)) emails.push(m.email);
      });
    }

    // Filtrar correos prohibidos para validación
    const filteredEmails = isValidacion
      ? emails.filter((e) => !blocked.includes(e.toLowerCase()))
      : emails;
    setBlockedEmails(blocked);


    // Comprobantes
    const { data: archivos } = await supabase
      .from("cobranza_pago_archivos")
      .select("nombre_archivo,url_archivo")
      .eq("pago_id", pago.id);
    setComprobantes(
      (archivos || []).map((a: any) => ({ nombre: a.nombre_archivo, url: a.url_archivo }))
    );

    // Configurar el flujo
    if (flow === "general") {
      setActiveFlow({
        templateName: "pago-confirmation",
        title: "Enviar confirmación de pago",
        description: "Envía el detalle del pago a los destinatarios.",
      });
    } else {
      const formaLabel =
        flow === "contado" ? "Contado" :
        flow === "credito" ? "Crédito Directo" : "Crédito Cescemex";
      setActiveFlow({
        templateName: "pago-validacion",
        title: `Solicitud de validación — ${formaLabel}`,
        description: `Se enviará a los destinatarios del grupo "${groupName}". Al enviar, el estatus del pago cambiará a "Enviado a Validar".`,
        formaPago: flow,
      });
    }

    // Envíos previos del template seleccionado
    const tpl = flow === "general" ? "pago-confirmation" : "pago-validacion";
    const { data: sentLogs } = await supabase
      .from("email_send_log")
      .select("recipient_email,status")
      .eq("template_name", tpl)
      .eq("status", "sent");
    const sentSet = new Set(
      (sentLogs || []).map((l: any) => (l.recipient_email || "").toLowerCase())
    );
    setPreviouslySentEmails(filteredEmails.filter((e) => sentSet.has(e.toLowerCase())).map((e) => e.toLowerCase()));
    setDefaultEmails(filteredEmails);
    setLoadingEmails(null);
    setOpenEnviar(true);
  };

  const handleSentValidacion = async () => {
    if (!pago) return;
    // Solo avanzar si está en "recibido"
    if (pago.estatus_pago === "recibido") {
      const { error } = await supabase
        .from("cobranza_pagos")
        .update({ estatus_pago: "enviado_validar" })
        .eq("id", pago.id);
      if (!error) {
        toast.success("Estatus actualizado a 'Enviado a Validar'");
        onChanged();
      }
    }
  };

  if (!pago) return null;

  const TIPO_LABEL: Record<string, string> = { factura: "Factura", pedido: "Pedido", cotizacion: "Cotización" };
  const aplicacionesActivas = aplicaciones.filter((a) => a.estatus_aplicacion === "activa");
  const aplicadoFacturas = aplicacionesActivas.filter((a) => a.tipo_documento === "factura").reduce((s, a) => s + Number(a.monto_aplicado || 0), 0);
  const aplicadoOtros = aplicacionesActivas.filter((a) => a.tipo_documento !== "factura").reduce((s, a) => s + Number(a.monto_aplicado || 0), 0);
  const disponibleFacturas = Math.max(0, Number(pago.monto_total) - aplicadoFacturas);
  const documentosLigados = aplicacionesActivas.map((a) => ({
      tipo: TIPO_LABEL[a.tipo_documento] || a.tipo_documento,
      numero: a.documento?.numero_factura || a.documento?.numero_pedido || a.documento?.numero_cotizacion || a.documento_id.slice(0, 8),
      monto: formatCurrency(Number(a.monto_aplicado)),
    }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Detalle del pago</SheetTitle>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Regresar a Pagos
            </Button>
          </div>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="flex flex-wrap justify-end gap-2">
            {(!pago.tipo_pago || pago.tipo_pago === "contado") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("contado")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "contado" ? "Cargando..." : "Enviar correo Contado"}
              </Button>
            )}
            {(!pago.tipo_pago || pago.tipo_pago === "credito") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("credito")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "credito" ? "Cargando..." : "Enviar correo Crédito Directo"}
              </Button>
            )}
            {(!pago.tipo_pago || pago.tipo_pago === "credito_cescemex") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("credito_cescemex")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "credito_cescemex" ? "Cargando..." : "Enviar correo Crédito Cescemex"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditandoFormaPago(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          </div>
          {editandoFormaPago && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Editar Forma de Pago</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={nuevaFormaPago}
                  onChange={(e) => setNuevaFormaPago(e.target.value)}
                >
                  <option value="">— Sin definir —</option>
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito Directo</option>
                  <option value="credito_cescemex">Crédito Cescemex</option>
                </select>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditandoFormaPago(false)}>Cancelar</Button>
                  <Button size="sm" onClick={async () => {
                    const { error } = await supabase
                      .from("cobranza_pagos")
                      .update({ tipo_pago: (nuevaFormaPago || null) as any })
                      .eq("id", pago.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Forma de pago actualizada");
                    setEditandoFormaPago(false);
                    onChanged();
                  }}>Guardar</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium">{pago.empresa?.name}</p></div>
              <div><p className="text-muted-foreground text-xs">Plaza</p><p>{pago.plaza?.nombre || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Fecha</p><p>{formatDate(pago.fecha_pago)}</p></div>
              <div><p className="text-muted-foreground text-xs">Forma de pago</p><p>{FORMA_PAGO_LABEL[pago.tipo_pago || ""] || pago.tipo_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Estatus Pago</p><div className="mt-1"><EstatusPagoEditor pagoId={pago.id} value={pago.estatus_pago} canEdit={canEditEstatus} onChanged={onChanged} /></div></div>
              <div><p className="text-muted-foreground text-xs">Banco</p><p>{pago.banco || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Referencia</p><p>{pago.referencia_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Monto total</p><p className="font-semibold">{formatCurrency(pago.monto_total)}</p></div>
              <div><p className="text-muted-foreground text-xs">Aplicado a Facturas</p><p>{formatCurrency(aplicadoFacturas)}</p></div>
              <div><p className="text-muted-foreground text-xs">Aplicado a Cot/Pedidos</p><p className="text-muted-foreground">{aplicadoOtros > 0 ? formatCurrency(aplicadoOtros) : "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Disponible (a facturas)</p><p className="text-lg font-bold text-primary">{formatCurrency(disponibleFacturas)}</p></div>
              {pago.observaciones && <div className="col-span-2"><p className="text-muted-foreground text-xs">Observaciones</p><p>{pago.observaciones}</p></div>}
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Aplicaciones</h3>
            {pago.estado_pago !== "cancelado" && disponibleFacturas > 0 && (
              <Button size="sm" onClick={() => onAplicar(pago)}><Plus className="h-4 w-4 mr-1" /> Aplicar</Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Documento</TableHead>
                  <TableHead className="text-right">Monto</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {aplicaciones.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin aplicaciones</TableCell></TableRow>}
                  {aplicaciones.map((a) => {
                    const folio = a.documento?.numero_factura || a.documento?.numero_pedido || a.documento?.numero_cotizacion || a.documento_id.slice(0, 8);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.fecha_aplicacion)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.tipo_documento}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{folio}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(a.monto_aplicado))}</TableCell>
                        <TableCell><Badge variant={a.estatus_aplicacion === "activa" ? "default" : "secondary"}>{a.estatus_aplicacion}</Badge></TableCell>
                        <TableCell>
                          {a.estatus_aplicacion === "activa" && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelarAplicacion(a.id)}><X className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PagoArchivosSection pagoId={pago.id} />
        </div>
      </SheetContent>
      <EnviarConfirmacionPagoDialog
        open={openEnviar}
        onOpenChange={setOpenEnviar}
        pagoId={pago.id}
        empresa={pago.empresa?.name || "—"}
        fechaPago={pago.fecha_pago}
        montoTotal={formatCurrency(pago.monto_total)}
        moneda={pago.moneda || "MXN"}
        observaciones={pago.observaciones || undefined}
        documentos={documentosLigados}
        comprobantes={comprobantes}
        registradoPor={profile?.full_name || user?.email || undefined}
        defaultEmails={defaultEmails}
        blockedEmails={blockedEmails}
        previouslySentEmails={previouslySentEmails}
        templateName={activeFlow.templateName}
        title={activeFlow.title}
        description={activeFlow.description}
        extraTemplateData={{
          cliente: pago.empresa?.name,
          referencia: pago.referencia_pago,
          formaPago: activeFlow.formaPago || pago.tipo_pago,
        }}
        onSent={activeFlow.templateName === "pago-validacion" ? handleSentValidacion : undefined}
      />
    </Sheet>
  );
}

interface PagoArchivo {
  id: string;
  url_archivo: string;
  nombre_archivo: string;
  tipo_archivo: string;
  fecha_carga: string;
}

function PagoArchivosSection({ pagoId }: { pagoId: string }) {
  const { user } = useAuth();
  const [archivos, setArchivos] = useState<PagoArchivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchArchivos = async () => {
    const { data } = await supabase
      .from("cobranza_pago_archivos")
      .select("id,url_archivo,nombre_archivo,tipo_archivo,fecha_carga")
      .eq("pago_id", pagoId)
      .order("fecha_carga", { ascending: false });
    setArchivos(data || []);
  };

  useEffect(() => { fetchArchivos(); /* eslint-disable-next-line */ }, [pagoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const valid = list.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (valid.length === 0) { toast.error("Solo PDF o imágenes"); return; }
    setUploading(true);
    try {
      for (const file of valid) {
        const ext = file.name.split(".").pop();
        const path = `pagos/${pagoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("document-files").getPublicUrl(path);
        const { error: insErr } = await supabase.from("cobranza_pago_archivos").insert({
          pago_id: pagoId,
          url_archivo: pub.publicUrl,
          nombre_archivo: file.name,
          tipo_archivo: file.type,
          usuario_carga: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success("Archivos subidos");
      fetchArchivos();
    } catch (e: any) {
      toast.error(e.message || "Error al subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from("cobranza_pago_archivos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Archivo eliminado");
    fetchArchivos();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">Comprobantes</h3>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleUpload} />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Paperclip className="h-4 w-4 mr-1" /> {uploading ? "Subiendo..." : "Adjuntar"}
        </Button>
      </div>
      <Card>
        <CardContent className="p-3">
          {archivos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Sin comprobantes</p>
          ) : (
            <div className="space-y-2">
              {archivos.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {a.tipo_archivo === "application/pdf" ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="text-sm truncate">{a.nombre_archivo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.fecha_carga)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                      <a href={a.url_archivo} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BucketReportCard({ title, buckets, onSelect }: { title: string; buckets: { label: string; count: number; monto: number }[]; onSelect: (label: string) => void }) {
  const max = Math.max(...buckets.map((x) => x.monto), 1);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {buckets.map((b) => {
          const pct = (b.monto / max) * 100;
          const isVencida = b.label === "Vencidas" || b.label === "Vencen hoy";
          const disabled = b.count === 0;
          return (
            <button
              key={b.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(b.label)}
              className="w-full text-left rounded-md p-2 -mx-2 hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <div className="flex justify-between text-sm mb-1">
                <span className={isVencida ? "text-destructive font-medium" : ""}>{b.label} <span className="text-muted-foreground">({b.count})</span></span>
                <span className="font-medium">{formatCurrency(b.monto)}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div className={`h-full ${isVencida ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BucketDetalle({ label, scopeLabel, facturas, onBack }: { label: string; scopeLabel: string; facturas: any[]; onBack: () => void }) {
  const total = facturas.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Regresar al dashboard
        </Button>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{facturas.length}</span> facturas · <span className="font-medium text-foreground">{formatCurrency(total)}</span>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{scopeLabel} · {label}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plaza</TableHead>
                <TableHead>Fecha doc.</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin facturas en este grupo</TableCell></TableRow>
              )}
              {facturas.map((f) => {
                const d = diasParaVencer(f.fecha_vencimiento);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.numero_factura || "—"}</TableCell>
                    <TableCell>{f.empresa?.name || "—"}</TableCell>
                    <TableCell>{f.plaza?.nombre || "—"}</TableCell>
                    <TableCell>{formatDate(f.fecha_documento)}</TableCell>
                    <TableCell>{f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}</TableCell>
                    <TableCell className="text-right"><span className={d !== null && d < 0 ? "text-destructive font-medium" : ""}>{d ?? "—"}</span></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(f.total))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(f.saldo_pendiente_cobranza))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
