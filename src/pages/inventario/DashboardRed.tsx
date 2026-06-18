import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Network, AlertTriangle, Truck, Package, TrendingUp, ArrowRight } from "lucide-react";
import { ALMACEN_LABELS, abcColor, statusColor } from "@/hooks/useInventario";
import { estatusPedidoColor, ESTATUS_PEDIDO_LABEL } from "@/hooks/usePedidosInventario";

const HUBS = ["1001", "1002"];
const SPOKE_OF_HUB: Record<string, string> = { "1001": "1003", "1002": "1004" };

export default function DashboardRed() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const puedeEditar = hasAnyRole(["admin", "manager", "warehouse"]);

  const { data: niveles = [] } = useQuery({
    queryKey: ["dashred_niveles"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_niveles_inventario").select("*").order("clasificacion_abc").order("codigo_producto");
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: minmax = [] } = useQuery({
    queryKey: ["dashred_minmax"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_minmax").select("codigo_producto, almacen, minimo_efectivo");
      return data || [];
    },
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["dashred_configs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_pedidos_activos_config")
        .select("*, pedido_actual:pedido_actual_id(id, estatus, fecha_pedido, fecha_entrega_estimada, total_tarimas, updated_at)")
        .order("id");
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: traspasos = [] } = useQuery({
    queryKey: ["dashred_traspasos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_traspasos")
        .select("*").in("estatus", ["sugerido", "aprobado", "enviado"]).order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: ultimaCarga } = useQuery({
    queryKey: ["dashred_ultima_carga"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inv_kardex_cargas").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data?.created_at || null;
    },
  });

  // Minmax lookup
  const minmaxMap = useMemo(() => {
    const m: Record<string, number> = {};
    (minmax as any[]).forEach((mm) => { m[`${mm.codigo_producto}|${mm.almacen}`] = Number(mm.minimo_efectivo || 0); });
    return m;
  }, [minmax]);

  // ALERTAS
  const skusBajoMin = useMemo(() => {
    let count = 0;
    (niveles as any[]).forEach((n) => {
      for (const a of ["1001", "1002", "1003", "1004"]) {
        const min = minmaxMap[`${n.codigo_producto}|${a}`];
        if (min > 0 && Number(n[`stock_almacen_${a}`] || 0) < min) { count++; return; }
      }
    });
    return count;
  }, [niveles, minmaxMap]);

  const asimetriaHubSpoke = useMemo(() => {
    const items: any[] = [];
    (niveles as any[]).forEach((n) => {
      for (const hub of HUBS) {
        const spoke = SPOKE_OF_HUB[hub];
        const sH = Number(n[`stock_almacen_${hub}`] || 0);
        const sS = Number(n[`stock_almacen_${spoke}`] || 0);
        if (sH > 0 && sS === 0) {
          items.push({ ...n, hub, spoke, stockHub: sH, stockSpoke: sS });
        }
      }
    });
    return items;
  }, [niveles]);

  const pedidosSinMovimiento = useMemo(() => {
    const now = Date.now();
    return (configs as any[]).filter((c) => {
      const p = c.pedido_actual;
      if (!p) return false;
      if (p.estatus === "cerrado" || p.estatus === "cancelado") return false;
      const days = (now - new Date(p.updated_at).getTime()) / 86400000;
      return days > 7;
    });
  }, [configs]);

  const traspasosPendientes = traspasos as any[];

  // Matriz: solo clase A
  const matriz = useMemo(() =>
    (niveles as any[]).filter((n) => n.clasificacion_abc === "A").slice(0, 100)
  , [niveles]);

  // Sobrestock hub con spoke bajo
  const oportunidades = useMemo(() => {
    const items: any[] = [];
    (niveles as any[]).forEach((n) => {
      if (n.estatus_inventario !== "sobrestock") return;
      for (const hub of HUBS) {
        const spoke = SPOKE_OF_HUB[hub];
        const sH = Number(n[`stock_almacen_${hub}`] || 0);
        const sS = Number(n[`stock_almacen_${spoke}`] || 0);
        const minSpoke = minmaxMap[`${n.codigo_producto}|${spoke}`] || 0;
        if (sH > 0 && (minSpoke > 0 ? sS < minSpoke : sS < sH * 0.2)) {
          items.push({ ...n, hub, spoke, sH, sS, diff: sH - sS });
        }
      }
    });
    return items.slice(0, 50);
  }, [niveles, minmaxMap]);

  const sugerirTraspaso = async (item: any) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: tras, error } = await (supabase as any).from("inv_traspasos").insert({
        almacen_origen: item.hub, almacen_destino: item.spoke, estatus: "sugerido",
        fecha_sugerida: today, es_consolidado: false, total_skus: 1,
        generado_automaticamente: false, creado_por: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      const minSpoke = minmaxMap[`${item.codigo_producto}|${item.spoke}`] || 0;
      const cantidad = Math.max(1, Math.min(item.sH, minSpoke > 0 ? minSpoke - item.sS : Math.floor(item.diff / 2)));
      await (supabase as any).from("inv_traspaso_lineas").insert({
        traspaso_id: tras.id, codigo_producto: item.codigo_producto, nombre_producto: item.nombre_producto,
        unidad: item.unidad, cantidad_sugerida: cantidad,
        stock_origen_actual: item.sH, stock_destino_actual: item.sS, minimo_destino: minSpoke,
        motivo: "Sobrestock en hub, spoke con stock bajo",
      });
      toast.success("Traspaso sugerido creado");
      qc.invalidateQueries({ queryKey: ["dashred_traspasos"] });
    } catch (e: any) { toast.error("Error: " + (e?.message || "")); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2 tracking-tight">
            <Network className="h-6 w-6" /> Dashboard de la Red
          </h1>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Última actualización de kardex: {ultimaCarga ? new Date(ultimaCarga).toLocaleString("es-MX") : "—"}
          </p>
        </div>
      </div>

      {/* SECCIÓN 1 — ALERTAS */}
      {(skusBajoMin > 0 || asimetriaHubSpoke.length > 0 || pedidosSinMovimiento.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {skusBajoMin > 0 && (
            <AlertCard tone="red" icon={AlertTriangle} label="SKUs bajo mínimo" value={skusBajoMin}
              desc="En al menos un almacén" />
          )}
          {asimetriaHubSpoke.length > 0 && (
            <AlertCard tone="orange" icon={Truck} label="Spokes sin stock" value={asimetriaHubSpoke.length}
              desc="con stock disponible en hub" />
          )}
          {pedidosSinMovimiento.length > 0 && (
            <AlertCard tone="orange" icon={Package} label="Pedidos sin movimiento" value={pedidosSinMovimiento.length}
              desc="hace más de 7 días" />
          )}
        </div>
      )}

      {/* SECCIÓN 2 — PEDIDOS ACTIVOS */}
      <Card>
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-3 border-b">
          <div className="font-semibold tracking-tight">Pedidos activos</div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Pedido</Th><Th>Estatus</Th>
                <Th className="text-right">Tarimas</Th>
                <Th className="text-right">Días desde pedido</Th>
                <Th>Progreso → Entrega est.</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(configs as any[]).map((c: any) => {
                const p = c.pedido_actual;
                if (!p) return (
                  <TableRow key={c.id}>
                    <TableCell>{c.nombre}</TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground italic">Sin pedido activo</TableCell>
                  </TableRow>
                );
                const inicio = p.fecha_pedido ? new Date(p.fecha_pedido).getTime() : null;
                const fin = p.fecha_entrega_estimada ? new Date(p.fecha_entrega_estimada).getTime() : null;
                const now = Date.now();
                const diasDesde = inicio ? Math.floor((now - inicio) / 86400000) : null;
                let pct = 0;
                if (inicio && fin && fin > inicio) pct = Math.max(0, Math.min(100, ((now - inicio) / (fin - inicio)) * 100));
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.numero_po_interno || c.id}</div>
                    </TableCell>
                    <TableCell><Badge className={estatusPedidoColor(p.estatus)}>{ESTATUS_PEDIDO_LABEL[p.estatus] || p.estatus}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{p.total_tarimas ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{diasDesde ?? "—"}</TableCell>
                    <TableCell className="min-w-[200px]">
                      <Progress value={pct} className="h-2" />
                      <div className="text-[10px] text-muted-foreground mt-1">{p.fecha_pedido || "—"} → {p.fecha_entrega_estimada || "—"}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECCIÓN 3 — TRASPASOS PENDIENTES */}
      <Card>
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-3 border-b flex items-center justify-between">
          <div className="font-semibold tracking-tight">Traspasos pendientes</div>
          <Button size="sm" variant="ghost" onClick={() => navigate("/inventario/traspasos")}>Ver todos <ArrowRight className="h-3 w-3 ml-1" /></Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Origen → Destino</Th><Th className="text-right">SKUs</Th><Th>Fecha sugerida</Th><Th>Estatus</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traspasosPendientes.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>{ALMACEN_LABELS[t.almacen_origen]} → {ALMACEN_LABELS[t.almacen_destino]}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.total_skus ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.fecha_sugerida || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs uppercase">{t.estatus}</Badge></TableCell>
                </TableRow>
              ))}
              {traspasosPendientes.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sin traspasos pendientes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECCIÓN 4 — MATRIZ STOCK */}
      <Card>
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-3 border-b">
          <div className="font-semibold tracking-tight">Matriz de stock · SKUs Clase A</div>
          <div className="text-xs text-muted-foreground font-light">Stock por almacén y semáforo de estatus</div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>ABC</Th><Th>Código</Th><Th>Producto</Th>
                <Th className="text-right">MXL</Th>
                <Th className="text-right">TJ</Th>
                <Th className="text-right">MOR</Th>
                <Th className="text-right">ENS</Th>
                <Th>Status</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriz.map((n: any, i: number) => (
                <TableRow key={n.id} className={i % 2 ? "bg-muted/20" : ""}>
                  <TableCell><Badge variant="outline" className={abcColor(n.clasificacion_abc)}>{n.clasificacion_abc || "—"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{n.codigo_producto}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{n.nombre_producto || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.stock_almacen_1001 ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.stock_almacen_1002 ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.stock_almacen_1003 ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{n.stock_almacen_1004 ?? 0}</TableCell>
                  <TableCell><Badge className={statusColor(n.estatus_inventario)}>{n.estatus_inventario || "—"}</Badge></TableCell>
                </TableRow>
              ))}
              {matriz.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">Sin SKUs clase A</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECCIÓN 5 — OPORTUNIDADES */}
      <Card>
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-3 border-b">
          <div className="font-semibold tracking-tight flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Oportunidades de traspaso</div>
          <div className="text-xs text-muted-foreground font-light">Sobrestock en hub con stock bajo en spoke</div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Código</Th><Th>Producto</Th>
                <Th>Hub</Th>
                <Th className="text-right">Stock hub</Th>
                <Th>Spoke</Th>
                <Th className="text-right">Stock spoke</Th>
                <Th className="text-right">Diferencia</Th>
                <Th>{" "}</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {oportunidades.map((o: any, i: number) => (
                <TableRow key={`${o.id}-${o.hub}`} className={i % 2 ? "bg-muted/20" : ""}>
                  <TableCell className="font-mono text-xs">{o.codigo_producto}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{o.nombre_producto || "—"}</TableCell>
                  <TableCell>{ALMACEN_LABELS[o.hub]}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.sH}</TableCell>
                  <TableCell>{ALMACEN_LABELS[o.spoke]}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">{o.sS}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{o.diff}</TableCell>
                  <TableCell>
                    {puedeEditar && <Button size="sm" variant="outline" onClick={() => sugerirTraspaso(o)}>Sugerir traspaso</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {oportunidades.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">Sin oportunidades detectadas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableHead className={`uppercase tracking-wide text-xs font-medium ${className || ""}`}>{children}</TableHead>;
}
function AlertCard({ tone, icon: Icon, label, value, desc }: any) {
  const toneCls: Record<string, string> = {
    red: "border-red-300 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200",
    orange: "border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200",
  };
  return (
    <Card className={toneCls[tone]}>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
          <div className="text-2xl font-light">{value}</div>
          <div className="text-xs opacity-70">{desc}</div>
        </div>
      </CardContent>
    </Card>
  );
}