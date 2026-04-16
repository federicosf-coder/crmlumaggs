import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Wallet, AlertTriangle, CheckCircle2, Clock, Eye, X, Paperclip, FileText, Image as ImageIcon, ExternalLink, Trash2, ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranzaPagos, useDocumentosCobranza, useCobranzaAplicaciones, type CobranzaPago } from "@/hooks/useCobranza";
import { RegistrarPagoDialog } from "@/components/cobranza/RegistrarPagoDialog";
import { AplicarPagoDialog } from "@/components/cobranza/AplicarPagoDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ESTADO_PAGO_LABEL: Record<string, string> = {
  registrado: "Registrado",
  no_aplicado: "No aplicado",
  aplicado_parcial: "Parcial",
  aplicado_total: "Aplicado",
  cancelado: "Cancelado",
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
  const { pagos, loading: loadingPagos, refetch: refetchPagos } = useCobranzaPagos();
  const { documentos, loading: loadingDocs, refetch: refetchDocs } = useDocumentosCobranza();

  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [openAplicar, setOpenAplicar] = useState(false);
  const [pagoSel, setPagoSel] = useState<CobranzaPago | null>(null);
  const [openDetalle, setOpenDetalle] = useState(false);

  const [searchPagos, setSearchPagos] = useState("");
  const [searchFacturas, setSearchFacturas] = useState("");
  const [bucketSel, setBucketSel] = useState<string | null>(null);

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
    const noAplicado = pagos.filter((p) => p.estado_pago !== "cancelado").reduce((s, p) => s + Number(p.monto_disponible), 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const cobradoMes = pagos.filter((p) => p.estado_pago !== "cancelado" && new Date(p.fecha_pago) >= inicioMes)
      .reduce((s, p) => s + Number(p.monto_total), 0);
    const facturasParciales = facturas.filter((f) => f.estado_cobranza === "parcial").length;
    const facturasPagadas = facturas.filter((f) => f.estado_cobranza === "pagada").length;
    return { abierta, vencida, porVencer, noAplicado, cobradoMes, facturasParciales, facturasPagadas };
  }, [facturas, pagos]);

  // Buckets de vencimiento
  const buckets = useMemo(() => {
    const orden = ["Vencidas", "Vencen hoy", "1-5 días", "6-10 días", "11-20 días", "21-30 días", "Más de 30 días"];
    const acc: Record<string, { count: number; monto: number }> = {};
    orden.forEach((b) => acc[b] = { count: 0, monto: 0 });
    facturas.forEach((f) => {
      if (Number(f.saldo_pendiente_cobranza) <= 0) return;
      const lbl = bucketLabel(diasParaVencer(f.fecha_vencimiento));
      if (acc[lbl]) { acc[lbl].count++; acc[lbl].monto += Number(f.saldo_pendiente_cobranza); }
    });
    return orden.map((b) => ({ label: b, ...acc[b] }));
  }, [facturas]);

  const proximasVencer = useMemo(() => {
    return [...facturas]
      .filter((f) => Number(f.saldo_pendiente_cobranza) > 0 && f.fecha_vencimiento)
      .sort((a, b) => new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime())
      .slice(0, 8);
  }, [facturas]);

  const pagosNoAplicados = useMemo(
    () => pagos.filter((p) => p.estado_pago !== "cancelado" && p.monto_disponible > 0).slice(0, 10),
    [pagos]
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

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="facturas">Seguimiento de facturas</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Buckets de vencimiento</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {buckets.map((b) => {
                  const max = Math.max(...buckets.map((x) => x.monto), 1);
                  const pct = (b.monto / max) * 100;
                  const isVencida = b.label === "Vencidas" || b.label === "Vencen hoy";
                  return (
                    <div key={b.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={isVencida ? "text-destructive font-medium" : ""}>{b.label} <span className="text-muted-foreground">({b.count})</span></span>
                        <span className="font-medium">{formatCurrency(b.monto)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded overflow-hidden">
                        <div className={`h-full ${isVencida ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

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
                        <TableCell className="text-right font-medium">{formatCurrency(p.monto_disponible)}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PAGOS */}
        <TabsContent value="pagos" className="space-y-4">
          <Input placeholder="Buscar por empresa o referencia..." value={searchPagos} onChange={(e) => setSearchPagos(e.target.value)} className="max-w-md" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Plaza</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Aplicado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead><TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingPagos && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loadingPagos && pagosFiltrados.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin pagos registrados</TableCell></TableRow>}
                  {pagosFiltrados.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{p.empresa?.name}</TableCell>
                      <TableCell>{p.plaza?.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.monto_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.monto_aplicado)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.monto_disponible)}</TableCell>
                      <TableCell className="text-xs">{p.referencia_pago || "—"}</TableCell>
                      <TableCell><Badge variant={p.estado_pago === "aplicado_total" ? "default" : p.estado_pago === "cancelado" ? "destructive" : "secondary"}>{ESTADO_PAGO_LABEL[p.estado_pago]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleVerDetalle(p)}><Eye className="h-4 w-4" /></Button>
                          {p.estado_pago !== "cancelado" && p.monto_disponible > 0 && (
                            <Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button>
                          )}
                          {p.estado_pago !== "cancelado" && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelarPago(p)}><X className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <RegistrarPagoDialog open={openRegistrar} onOpenChange={setOpenRegistrar} onSaved={() => { refetchPagos(); refetchDocs(); }} />
      <AplicarPagoDialog open={openAplicar} onOpenChange={setOpenAplicar} pago={pagoSel} onSaved={() => { refetchPagos(); refetchDocs(); }} />
      <DetallePagoSheet open={openDetalle} onOpenChange={setOpenDetalle} pago={pagoSel} onChanged={() => { refetchPagos(); refetchDocs(); }} onAplicar={(p) => { setOpenDetalle(false); handleAplicar(p); }} />
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
  const { aplicaciones, refetch } = useCobranzaAplicaciones(pago?.id || null);

  const handleCancelarAplicacion = async (id: string) => {
    if (!confirm("¿Cancelar esta aplicación?")) return;
    const { error } = await supabase.from("cobranza_aplicaciones").update({ estatus_aplicacion: "cancelada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aplicación cancelada");
    refetch(); onChanged();
  };

  if (!pago) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle del pago</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium">{pago.empresa?.name}</p></div>
              <div><p className="text-muted-foreground text-xs">Plaza</p><p>{pago.plaza?.nombre || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Fecha</p><p>{formatDate(pago.fecha_pago)}</p></div>
              <div><p className="text-muted-foreground text-xs">Tipo</p><p>{pago.tipo_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Banco</p><p>{pago.banco || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Referencia</p><p>{pago.referencia_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Monto total</p><p className="font-semibold">{formatCurrency(pago.monto_total)}</p></div>
              <div><p className="text-muted-foreground text-xs">Aplicado</p><p>{formatCurrency(pago.monto_aplicado)}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Disponible</p><p className="text-lg font-bold text-primary">{formatCurrency(pago.monto_disponible)}</p></div>
              {pago.observaciones && <div className="col-span-2"><p className="text-muted-foreground text-xs">Observaciones</p><p>{pago.observaciones}</p></div>}
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Aplicaciones</h3>
            {pago.estado_pago !== "cancelado" && pago.monto_disponible > 0 && (
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
