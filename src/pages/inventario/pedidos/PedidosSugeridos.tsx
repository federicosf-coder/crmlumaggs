import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EyeOff, Undo2, Settings, Check } from "lucide-react";
import { toast } from "sonner";
import { AjusteManualDialog, type Row as MinMaxRow, type NivelRow } from "@/pages/inventario/MinMaxInventario";
import { ESTATUS_PEDIDO_LABEL, estatusPedidoColor } from "@/hooks/usePedidosInventario";

const ALMACENES = [
  { code: "1001", label: "Mexicali" },
  { code: "1002", label: "Tijuana" },
  { code: "1003", label: "Morelos" },
  { code: "1004", label: "Ensenada" },
];

export default function PedidosSugeridos() {
  const [empresa, setEmpresa] = useState("todas");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MinMaxRow | null>(null);
  const [detalleCodigo, setDetalleCodigo] = useState<{ codigo: string; nombre: string } | null>(null);
  const qc = useQueryClient();

  const { data: niveles = [] } = useQuery({
    queryKey: ["inv_niveles_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_niveles_inventario")
        .select("codigo_producto, nombre_producto, presentacion, empresa_vendedora, piezas_por_tarima")
        .order("codigo_producto");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: minmax = [] } = useQuery({
    queryKey: ["inv_minmax"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_minmax")
        .select("*")
        .order("codigo_producto");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: nivelesFull = [] } = useQuery<NivelRow[]>({
    queryKey: ["inv_niveles_inventario_min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, nombre_producto, clasificacion_abc, lead_time_dias, piezas_por_tarima, fuente_suministro, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004");
      if (error) throw error;
      return (data || []) as NivelRow[];
    },
  });

  const nivMap = useMemo(() => {
    const m = new Map<string, NivelRow>();
    for (const n of nivelesFull) m.set(n.codigo_producto, n);
    return m;
  }, [nivelesFull]);

  const { data: productosPres = [] } = useQuery({
    queryKey: ["productos_presentacion_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("productos")
        .select("codigo, presentaciones(nombre)")
        .limit(20000);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const presPorCodigo = useMemo(() => {
    const m: Record<string, string> = {};
    (productosPres as any[]).forEach((p) => {
      const nom = p?.presentaciones?.nombre;
      if (p?.codigo && nom && !m[p.codigo]) m[p.codigo] = nom;
    });
    return m;
  }, [productosPres]);

  const abrirAjuste = (codigo: string) => {
    const filas = (minmax as MinMaxRow[]).filter((r) => r.codigo_producto === codigo);
    const fila = filas.find((r) => r.almacen === "1001") || filas[0];
    if (!fila) { toast.error("Sin registro de mínimos/máximos para este código"); return; }
    setEditing(fila);
  };

  const { data: pedidoLineas = [] } = useQuery({
    queryKey: ["inv_pedido_lineas_abiertos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_solicitada, cantidad_confirmada, cantidad_recibida, estatus_linea, inv_pedidos!inner(estatus)")
        .not("inv_pedidos.estatus", "in", "(cerrado,cancelado,recibido)");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: detalleLineas = [] } = useQuery({
    queryKey: ["inv_pedido_lineas_abiertos_detalle", detalleCodigo?.codigo],
    enabled: !!detalleCodigo?.codigo,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_pedido_lineas")
        .select("*, inv_pedidos!inner(numero_po_interno, empresa_vendedora, almacen_destino, fecha_pedido, fecha_entrega_estimada, estatus)")
        .eq("codigo_producto", detalleCodigo!.codigo)
        .not("inv_pedidos.estatus", "in", "(cerrado,cancelado,recibido)");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: ignorados = [] } = useQuery({
    queryKey: ["inv_pedido_requerido_ignorados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_pedido_requerido_ignorados")
        .select("*")
        .order("ignorado_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: extraordinarias = [] } = useQuery({
    queryKey: ["inv_solicitudes_extraordinarias_aprobadas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_solicitudes_extraordinarias")
        .select("codigo_producto, cantidad")
        .eq("estatus", "aprobada")
        .eq("activo", true);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const extraPorCodigo = useMemo(() => {
    const m: Record<string, number> = {};
    (extraordinarias as any[]).forEach((s) => {
      if (!s.codigo_producto) return;
      m[s.codigo_producto] = (m[s.codigo_producto] || 0) + (Number(s.cantidad) || 0);
    });
    return m;
  }, [extraordinarias]);

  const { data: corporativas = [] } = useQuery({
    queryKey: ["entregas_corporativas_programadas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas_corporativas")
        .select("codigo_producto, cantidad")
        .eq("estatus", "programada");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const corpPorCodigo = useMemo(() => {
    const m: Record<string, number> = {};
    (corporativas as any[]).forEach((s) => {
      if (!s.codigo_producto) return;
      m[s.codigo_producto] = (m[s.codigo_producto] || 0) + (Number(s.cantidad) || 0);
    });
    return m;
  }, [corporativas]);

  const { data: perfiles = [] } = useQuery({
    queryKey: ["profiles_min_ignorados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, full_name");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const nombrePorUser = useMemo(() => {
    const m: Record<string, string> = {};
    (perfiles as any[]).forEach((p) => { m[p.id] = p.full_name || "—"; });
    return m;
  }, [perfiles]);

  const ignoradosSet = useMemo(
    () => new Set((ignorados as any[]).map((r) => r.codigo_producto)),
    [ignorados]
  );

  const ignorar = async (codigo: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("inv_pedido_requerido_ignorados")
      .insert({ codigo_producto: codigo, ignorado_por: userRes?.user?.id ?? null });
    if (error) { toast.error("No se pudo ignorar: " + error.message); return; }
    toast.success(`${codigo} movido a ignorados`);
    qc.invalidateQueries({ queryKey: ["inv_pedido_requerido_ignorados"] });
  };

  const quitarIgnorado = async (codigo: string) => {
    const { error } = await (supabase as any)
      .from("inv_pedido_requerido_ignorados")
      .delete()
      .eq("codigo_producto", codigo);
    if (error) { toast.error("No se pudo quitar: " + error.message); return; }
    toast.success(`${codigo} restaurado`);
    qc.invalidateQueries({ queryKey: ["inv_pedido_requerido_ignorados"] });
  };

  const infoPorCodigo = useMemo(() => {
    const m: Record<string, any> = {};
    (niveles as any[]).forEach((n) => {
      if (!n.codigo_producto) return;
      if (!m[n.codigo_producto]) m[n.codigo_producto] = n;
    });
    return m;
  }, [niveles]);

  const yaPedidoPorCodigo = useMemo(() => {
    const m: Record<string, number> = {};
    (pedidoLineas as any[]).forEach((l) => {
      if (!l.codigo_producto) return;
      const pedida = Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) || 0;
      const recibida = Number(l.cantidad_recibida ?? 0) || 0;
      const pendiente = Math.max(0, pedida - recibida);
      if (pendiente <= 0) return;
      m[l.codigo_producto] = (m[l.codigo_producto] || 0) + pendiente;
    });
    return m;
  }, [pedidoLineas]);

  const allRows = useMemo(() => {
    const porCodigo: Record<string, Record<string, number>> = {};
    (minmax as any[]).forEach((r) => {
      if (!r.codigo_producto) return;
      const val = Number(r.cantidad_reorden_manual ?? r.cantidad_reorden_calc ?? 0) || 0;
      if (!porCodigo[r.codigo_producto]) porCodigo[r.codigo_producto] = {};
      porCodigo[r.codigo_producto][r.almacen] = (porCodigo[r.codigo_producto][r.almacen] || 0) + val;
    });
    Object.keys(extraPorCodigo).forEach((c) => {
      if ((extraPorCodigo[c] || 0) > 0 && !porCodigo[c]) porCodigo[c] = {};
    });
    Object.keys(corpPorCodigo).forEach((c) => {
      if ((corpPorCodigo[c] || 0) > 0 && !porCodigo[c]) porCodigo[c] = {};
    });

    return Object.entries(porCodigo)
      .map(([codigo, porAlmacen]) => {
        const info = infoPorCodigo[codigo] || {};
        const necesidad_total = ALMACENES.reduce((s, a) => s + (porAlmacen[a.code] || 0), 0);
        const ya_pedido = yaPedidoPorCodigo[codigo] || 0;
        const extraordinario = extraPorCodigo[codigo] || 0;
        const corporativo = corpPorCodigo[codigo] || 0;
        const niv: any = nivMap.get(codigo) || {};
        const stockPorAlmacen: Record<string, number> = {
          "1001": Number(niv.stock_almacen_1001 ?? 0) || 0,
          "1002": Number(niv.stock_almacen_1002 ?? 0) || 0,
          "1003": Number(niv.stock_almacen_1003 ?? 0) || 0,
          "1004": Number(niv.stock_almacen_1004 ?? 0) || 0,
        };
        return {
          codigo,
          nombre: info.nombre_producto || "—",
          presentacion: presPorCodigo[codigo] || info.presentacion || "—",
          empresa_vendedora: info.empresa_vendedora || "",
          porAlmacen,
          stockPorAlmacen,
          stock_total: ALMACENES.reduce((s, a) => s + stockPorAlmacen[a.code], 0),
          necesidad_total,
          ya_pedido,
          extraordinario,
          corporativo,
          necesidad_neta_total: Math.max(0, necesidad_total - ya_pedido) + extraordinario + corporativo,
        };
      })
      .filter((r) => r.necesidad_neta_total > 0)
      .filter((r) => empresa === "todas" || r.empresa_vendedora === empresa)
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.codigo.toLowerCase().includes(q) || String(r.nombre).toLowerCase().includes(q);
      })
      .sort((a, b) => b.necesidad_neta_total - a.necesidad_neta_total);
  }, [minmax, infoPorCodigo, yaPedidoPorCodigo, empresa, search, presPorCodigo, nivMap, extraPorCodigo, corpPorCodigo]);

  const rows = useMemo(() => allRows.filter((r) => !ignoradosSet.has(r.codigo)), [allRows, ignoradosSet]);

  const rowsIgnorados = useMemo(() => {
    const byCode: Record<string, any> = {};
    allRows.forEach((r) => { byCode[r.codigo] = r; });
    return (ignorados as any[]).map((ig) => ({
      ...ig,
      nombre: byCode[ig.codigo_producto]?.nombre || infoPorCodigo[ig.codigo_producto]?.nombre_producto || "—",
      necesidad_total: byCode[ig.codigo_producto]?.necesidad_total ?? 0,
    }));
  }, [ignorados, allRows, infoPorCodigo]);

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar código o producto" className="max-w-[240px]" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="lumaggs">Lumaggs</SelectItem>
              <SelectItem value="galsa">Galsa</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-right">
            <p className="uppercase tracking-wide text-xs text-muted-foreground">SKUs a pedir</p>
            <p className="text-2xl font-light tabular-nums">{rows.length}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="por_pedir" className="space-y-4">
        <TabsList>
          <TabsTrigger value="por_pedir">Por Pedir <Badge variant="secondary" className="ml-2">{rows.length}</Badge></TabsTrigger>
          <TabsTrigger value="ignorados">Ignorados <Badge variant="secondary" className="ml-2">{rowsIgnorados.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="por_pedir">
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground">Código</TableHead>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground">Producto</TableHead>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground">Presentación</TableHead>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground text-right">Stock Total</TableHead>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground text-right">Ya Pedido</TableHead>
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground text-right">Total a Pedir</TableHead>
                {ALMACENES.map((a) => (
                  <TableHead key={a.code} className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground text-center">{a.label}</TableHead>
                ))}
                <TableHead className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.codigo} className="odd:bg-muted/20 hover:bg-blue-50/40">
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell className="text-[13px] font-light">{r.nombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.presentacion}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{r.stock_total}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm ${r.ya_pedido > 0 ? "text-blue-700 cursor-pointer underline decoration-dotted underline-offset-4 hover:text-blue-900" : "text-muted-foreground"}`}
                    onClick={() => r.ya_pedido > 0 && setDetalleCodigo({ codigo: r.codigo, nombre: r.nombre })}
                    title={r.ya_pedido > 0 ? "Ver pedidos abiertos" : undefined}
                  >
                    {r.ya_pedido}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-base font-semibold">
                    {r.necesidad_neta_total}
                    {r.extraordinario > 0 && (
                      <span className="ml-1 text-[10px] font-medium text-violet-600">+{r.extraordinario} extra</span>
                    )}
                    {r.corporativo > 0 && (
                      <span className="ml-1 text-[10px] font-medium text-amber-600">+{r.corporativo} corporativo</span>
                    )}
                  </TableCell>
                  {ALMACENES.map((a) => {
                    const hay = r.stockPorAlmacen[a.code] || 0;
                    const pide = r.porAlmacen[a.code] || 0;
                    return (
                      <TableCell key={a.code} className="p-1.5">
                        <div className="bg-muted/30 rounded-md p-1.5 text-right leading-tight min-w-[74px]">
                          <div className="text-[11px] tabular-nums text-blue-700">Hay: <span className="font-medium">{hay}</span></div>
                          {pide > 0 ? (
                            <div className="text-[11px] tabular-nums text-amber-600 font-semibold">Pide: {pide}</div>
                          ) : (
                            <div className="text-[11px] tabular-nums text-emerald-600 inline-flex items-center gap-0.5 justify-end w-full">
                              <Check className="h-3 w-3" />Pide: 0
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => ignorar(r.codigo)}>
                        <EyeOff className="h-3.5 w-3.5 mr-1" />Ignorar
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground" title="Ajuste manual" onClick={() => abrirAjuste(r.codigo)}>
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin productos por pedir</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ignorados">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    {["Código", "Nombre", "Total Necesario", "Ignorado el", "Ignorado por", ""].map((h, idx) => (
                      <TableHead key={h || idx} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsIgnorados.map((r, i) => (
                    <TableRow key={r.codigo_producto} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-mono text-xs">{r.codigo_producto}</TableCell>
                      <TableCell className="text-sm font-light">{r.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.necesidad_total}</TableCell>
                      <TableCell className="text-xs">{r.ignorado_at ? new Date(r.ignorado_at).toLocaleDateString("es-MX") : "—"}</TableCell>
                      <TableCell className="text-xs">{nombrePorUser[r.ignorado_por] || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => quitarIgnorado(r.codigo_producto)}>
                          <Undo2 className="h-3.5 w-3.5 mr-1" />Quitar de ignorados
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rowsIgnorados.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin productos ignorados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AjusteManualDialog editing={editing} onClose={() => setEditing(null)} nivMap={nivMap} />

      <Dialog open={!!detalleCodigo} onOpenChange={() => setDetalleCodigo(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">
              Detalle de pedidos abiertos — {detalleCodigo?.codigo} {detalleCodigo?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                    <TableRow>
                      {["N° PO", "Proveedor/Marca", "Almacén destino", "Cantidad", "Fecha de pedido", "Fecha entrega estimada", "Estatus"].map((h) => (
                        <TableHead key={h} className="uppercase tracking-widest text-[10px] font-semibold text-muted-foreground">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleLineas.map((l: any) => {
                      const pedido = l.inv_pedidos || {};
                      const almacen = ALMACENES.find((a) => a.code === pedido.almacen_destino)?.label || pedido.almacen_destino || "—";
                      const marcaLabel = pedido.empresa_vendedora === "lumaggs" ? "Lumaggs" : pedido.empresa_vendedora === "galsa" ? "Galsa" : pedido.empresa_vendedora || "—";
                      const cantidad = Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0);
                      const estatus = pedido.estatus || "borrador";
                      return (
                        <TableRow key={l.id} className="odd:bg-muted/20">
                          <TableCell className="font-mono text-xs">{pedido.numero_po_interno || "—"}</TableCell>
                          <TableCell className="text-sm font-light">{marcaLabel}</TableCell>
                          <TableCell className="text-xs">{almacen}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">{cantidad}</TableCell>
                          <TableCell className="text-xs">{pedido.fecha_pedido ? new Date(pedido.fecha_pedido).toLocaleDateString("es-MX") : "—"}</TableCell>
                          <TableCell className="text-xs">{pedido.fecha_entrega_estimada ? new Date(pedido.fecha_entrega_estimada).toLocaleDateString("es-MX") : "—"}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={`text-[10px] ${estatusPedidoColor(estatus)}`}>{ESTATUS_PEDIDO_LABEL[estatus] || estatus}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {detalleLineas.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin pedidos abiertos para este código</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="flex justify-end items-center gap-2">
              <span className="text-sm text-muted-foreground">Total ya pedido:</span>
              <span className="text-xl font-light tabular-nums">
                {detalleLineas.reduce((sum, l: any) => sum + Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0), 0)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
