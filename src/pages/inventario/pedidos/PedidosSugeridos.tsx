import { useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, FileText, ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { MIN_TARIMAS_PEDIDO } from "@/hooks/usePedidosInventario";
import { abcColor } from "@/hooks/useInventario";

const ALMACENES: { code: string; label: string }[] = [
  { code: "1001", label: "Mexicali (1001)" },
  { code: "1002", label: "Tijuana (1002)" },
  { code: "1003", label: "Morelos (1003)" },
  { code: "1004", label: "Ensenada (1004)" },
];

export default function PedidosSugeridos() {
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const puedeGenerar = hasAnyRole(["admin", "manager"]);
  const [empresa, setEmpresa] = useState("todas");
  const [hub, setHub] = useState("ambos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ocultarRestringidos, setOcultarRestringidos] = useState(false);
  const [modo, setModo] = useState<"consolidado" | "estricto">("consolidado");
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: niveles = [] } = useQuery({
    queryKey: ["inv_niveles_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_niveles_inventario")
        .select("*").order("clasificacion_abc").order("codigo_producto");
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: minmax = [] } = useQuery({
    queryKey: ["inv_minmax_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_minmax")
        .select("codigo_producto, almacen, minimo_calc, maximo_calc, minimo_manual, maximo_manual, cantidad_reorden_calc, cantidad_reorden_manual, demanda_diaria_hub, lead_time_dias, clasificacion_abc");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: pedidoLineas = [] } = useQuery({
    queryKey: ["inv_pedido_lineas_abiertos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_solicitada, cantidad_confirmada, inv_pedidos!inner(estatus, almacen_destino, empresa_vendedora)")
        .not("inv_pedidos.estatus", "in", "(cerrado,cancelado)");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: restricciones = [] } = useQuery({
    queryKey: ["inv_restricciones_activas_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_restricciones")
        .select("codigo_producto, marca, descripcion, tipo")
        .eq("activa", true).eq("excluir_de_pedido", true);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const restriccionFor = useMemo(() => {
    const bySku: Record<string, any> = {};
    const byMarca: Record<string, any> = {};
    (restricciones as any[]).forEach((r) => {
      if (r.codigo_producto) bySku[r.codigo_producto] = r;
      else if (r.marca) byMarca[r.marca] = r;
    });
    return (codigo: string, empresa_vendedora: string) => {
      if (bySku[codigo]) return bySku[codigo];
      const marca = empresa_vendedora === "galsa" ? "phillips66" : "chevron";
      return byMarca[marca] || null;
    };
  }, [restricciones]);

  // reorden efectiva por código y almacén
  const reordenPorCodigo = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    (minmax as any[]).forEach((r) => {
      const val = Number(r.cantidad_reorden_manual ?? r.cantidad_reorden_calc ?? 0) || 0;
      if (!m[r.codigo_producto]) m[r.codigo_producto] = {};
      m[r.codigo_producto][r.almacen] = (m[r.codigo_producto][r.almacen] || 0) + val;
    });
    return m;
  }, [minmax]);

  const pedidoPorCodigo = useMemo(() => {
    const total: Record<string, number> = {};
    const porAlmacen: Record<string, Record<string, number>> = {};
    (pedidoLineas as any[]).forEach((l) => {
      const cant = Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) || 0;
      const cod = l.codigo_producto;
      if (!cod) return;
      total[cod] = (total[cod] || 0) + cant;
      const alm = l.inv_pedidos?.almacen_destino || "";
      if (!porAlmacen[cod]) porAlmacen[cod] = {};
      porAlmacen[cod][alm] = (porAlmacen[cod][alm] || 0) + cant;
    });
    return { total, porAlmacen };
  }, [pedidoLineas]);

  const enriched = useMemo(() => {
    const hubs = modo === "estricto"
      ? (hub === "ambos" ? ["1001", "1002"] : [hub])
      : ALMACENES.map((a) => a.code);

    return (niveles as any[])
      .filter((n) => empresa === "todas" || n.empresa_vendedora === empresa)
      .map((n) => {
        const desglose = reordenPorCodigo[n.codigo_producto] || {};
        const necesidad_empresa = hubs.reduce((a, c) => a + (desglose[c] || 0), 0);
        const ya_pedido = modo === "estricto"
          ? hubs.reduce((a, c) => a + ((pedidoPorCodigo.porAlmacen[n.codigo_producto] || {})[c] || 0), 0)
          : (pedidoPorCodigo.total[n.codigo_producto] || 0);
        const necesidad_neta = Math.max(0, Math.round(necesidad_empresa - ya_pedido));
        const pzs = Number(n.piezas_por_tarima || 0);
        const tarimas = pzs > 0 ? Math.ceil(necesidad_neta / pzs) : 0;
        return {
          ...n,
          _desglose: desglose,
          _necesidadTotal: Math.round(necesidad_empresa),
          _yaPedido: Math.round(ya_pedido),
          _necesidadNeta: necesidad_neta,
          _tarimas: tarimas,
          _restr: restriccionFor(n.codigo_producto, n.empresa_vendedora),
        };
      })
      .filter((n) => n._necesidadNeta > 0);
  }, [niveles, empresa, modo, hub, reordenPorCodigo, pedidoPorCodigo, restriccionFor]);

  const visibles = useMemo(
    () => ocultarRestringidos ? enriched.filter((n) => !n._restr) : enriched,
    [enriched, ocultarRestringidos]
  );
  const restringidosCount = enriched.filter((n) => n._restr).length;

  const tarimasPorPresentacion = useMemo(() => {
    const m: Record<string, number> = {};
    enriched.filter((n) => !n._restr).forEach((n) => { const k = n.presentacion || "otro"; m[k] = (m[k] || 0) + n._tarimas; });
    return m;
  }, [enriched]);
  const totalTarimas = Object.values(tarimasPorPresentacion).reduce((a, b) => a + b, 0);

  return (
   <TooltipProvider>
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="SKUs a pedir" value={enriched.length} />
        <Kpi label="Tarimas estimadas" value={totalTarimas} />
        <Card className={totalTarimas >= MIN_TARIMAS_PEDIDO ? "bg-green-50" : "bg-red-50"}>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Mínimo de tarimas</div>
            <div className={`text-2xl font-light mt-1 ${totalTarimas >= MIN_TARIMAS_PEDIDO ? "text-green-700" : "text-red-700"}`}>
              {totalTarimas >= MIN_TARIMAS_PEDIDO ? "✓ Alcanzado" : `Faltan ${MIN_TARIMAS_PEDIDO - totalTarimas}`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las empresas</SelectItem>
                <SelectItem value="lumaggs">Lumaggs — Chevron</SelectItem>
                <SelectItem value="galsa">Galsa — Phillips 66</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hub} onValueChange={setHub}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos hubs</SelectItem>
                <SelectItem value="1001">Mexicali (1001)</SelectItem>
                <SelectItem value="1002">Tijuana (1002)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modo} onValueChange={(v) => setModo(v as any)}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidado">Consolidado (recomendado)</SelectItem>
                <SelectItem value="estricto">Estricto por plaza</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 pl-2 border-l">
              <Switch id="hide-restr" checked={ocultarRestringidos} onCheckedChange={setOcultarRestringidos} />
              <Label htmlFor="hide-restr" className="text-xs cursor-pointer">Ocultar restringidos</Label>
              {restringidosCount > 0 && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{restringidosCount}</Badge>}
            </div>
          </div>
          {puedeGenerar && enriched.length > 0 && (
            <Button onClick={() => setDialogOpen(true)}><FileText className="h-4 w-4 mr-2" />Generar pedido elaborado</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>
                <Th className="w-8"> </Th>
                <Th>ABC</Th><Th>Código</Th><Th>Producto</Th><Th>Presentación</Th>
                <Th className="text-right">Stock</Th><Th className="text-right">Consumo/mes</Th>
                <Th className="text-right">Días Cob.</Th><Th className="text-right">Lead (sem)</Th>
                <Th className="text-right">Necesidad Total</Th><Th className="text-right">Ya Pedido</Th>
                <Th className="text-right">Necesidad Neta</Th><Th className="text-right">Pzs/Tarima</Th>
                <Th className="text-right">Tarimas</Th><Th>Fuente</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((n, i) => (
               <Fragment key={n.id}>
                <TableRow key={n.id} className={n._restr ? "bg-amber-50/70" : (i % 2 === 0 ? "" : "bg-muted/20")}>
                  <TableCell className="w-8 p-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setExpandido(expandido === n.id ? null : n.id)}
                      title="Desglose por plaza">
                      {expandido === n.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={abcColor(n.clasificacion_abc)}>{n.clasificacion_abc || "—"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {n.codigo_producto}
                      {n._restr && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1">
                              <ShieldAlert className="h-3 w-3" />RESTRINGIDO
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs"><b>{n._restr.tipo}</b>: {n._restr.descripcion}</div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">{n.nombre_producto || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase text-xs">{n.presentacion || "—"}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{n.stock_total ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(n.consumo_hub_mensual || 0)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700 font-semibold">{Math.round(n.dias_cobertura || 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.lead_time_dias ? Math.round(n.lead_time_dias / 7) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{n._necesidadTotal}</TableCell>
                  <TableCell className={`text-right tabular-nums ${n._yaPedido === 0 ? "text-muted-foreground" : ""}`}>{n._yaPedido}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{n._necesidadNeta}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.piezas_por_tarima ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{n._tarimas}</TableCell>
                  <TableCell className="text-xs uppercase">{n.fuente_suministro || "—"}</TableCell>
                </TableRow>
                {expandido === n.id && (
                  <TableRow className="bg-blue-50/40">
                    <TableCell colSpan={15} className="text-xs py-3">
                      <div className="flex flex-wrap gap-4 pl-8">
                        <span className="uppercase tracking-wide text-muted-foreground">Desglose por plaza</span>
                        {ALMACENES.map((a) => (
                          <span key={a.code}>
                            {a.label}: <b className="tabular-nums">{Math.round(n._desglose[a.code] || 0)}</b>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
               </Fragment>
              ))}
              {visibles.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">No hay SKUs por pedir</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {enriched.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Resumen por presentación</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tarimasPorPresentacion).map(([k, v]) => (
                <Badge key={k} variant="outline" className="capitalize">{k.replace("_", " ")}: {v}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-lg">Total: <b>{totalTarimas} tarimas</b></div>
              {totalTarimas >= MIN_TARIMAS_PEDIDO
                ? <span className="text-green-700 inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Mínimo alcanzado (24 tarimas)</span>
                : <span className="text-red-700 inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Faltan {MIN_TARIMAS_PEDIDO - totalTarimas} tarimas para el mínimo</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <GenerarPedidoDialog
        open={dialogOpen} onOpenChange={setDialogOpen} skus={enriched.filter((n) => !n._restr)}
        excluidos={restringidosCount}
        onCreated={() => { qc.invalidateQueries(); navigate("/inventario/pedidos/elaborados"); }}
      />
    </div>
   </TooltipProvider>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableHead className={`uppercase tracking-wide text-xs font-medium ${className || ""}`}>{children}</TableHead>;
}
function Kpi({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-3xl font-light mt-1">{value}</div></CardContent></Card>;
}

function GenerarPedidoDialog({ open, onOpenChange, skus, excluidos = 0, onCreated }: any) {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState("lumaggs");
  const [almacen, setAlmacen] = useState("1002");
  const [fuente, setFuente] = useState("USA");
  const [proveedor, setProveedor] = useState("chevron");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    setSaving(true);
    try {
      const filtered = skus.filter((s: any) => s.empresa_vendedora === empresa && s._sug.necesidad > 0);
      if (filtered.length === 0) { toast.error("Sin SKUs para esta empresa"); setSaving(false); return; }
      const totalTarimas = filtered.reduce((a: number, s: any) => a + s._sug.tarimas, 0);
      const po = `PO_${empresa.toUpperCase()}_${almacen}_${Date.now().toString().slice(-6)}`;
      const { data: pedido, error } = await (supabase as any).from("inv_pedidos").insert({
        empresa_vendedora: empresa, almacen_destino: almacen, fuente, proveedor,
        fecha_pedido: fecha, estatus: "borrador", moneda: proveedor === "phillips66" ? "USD" : "MXN",
        numero_po_interno: po, total_tarimas: totalTarimas, notas: notas || null,
        generado_desde_sugeridos: true, creado_por: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      const lineas = filtered.map((s: any) => ({
        pedido_id: pedido.id, codigo_producto: s.codigo_producto, nombre_producto: s.nombre_producto,
        presentacion: s.presentacion, unidad_pedido: s.unidad,
        cantidad_solicitada: s._sug.necesidad, tarimas: s._sug.tarimas,
        piezas_por_tarima: s.piezas_por_tarima, moneda: proveedor === "phillips66" ? "USD" : "MXN",
      }));
      const { error: le } = await (supabase as any).from("inv_pedido_lineas").insert(lineas);
      if (le) throw le;
      toast.success(`Pedido ${po} creado con ${filtered.length} SKUs (${totalTarimas} tarimas)`);
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Generar pedido elaborado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {excluidos > 0 && (
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-md px-3 py-2 text-xs flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Se excluirán automáticamente <b>{excluidos}</b> SKU(s) con restricciones activas.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs uppercase tracking-wide">Empresa</Label>
              <Select value={empresa} onValueChange={(v) => { setEmpresa(v); setProveedor(v === "galsa" ? "phillips66" : "chevron"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lumaggs">Lumaggs — Chevron</SelectItem>
                  <SelectItem value="galsa">Galsa — Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-wide">Almacén destino</Label>
              <Select value={almacen} onValueChange={setAlmacen}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1001">Mexicali (1001)</SelectItem>
                  <SelectItem value="1002">Tijuana (1002)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-wide">Fuente</Label>
              <Select value={fuente} onValueChange={setFuente}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="CEDIS">CEDIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-wide">Proveedor</Label>
              <Select value={proveedor} onValueChange={setProveedor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chevron">Chevron</SelectItem>
                  <SelectItem value="phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase tracking-wide">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <div><Label className="text-xs uppercase tracking-wide">Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Creando..." : "Crear pedido"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}