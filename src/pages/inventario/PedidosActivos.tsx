import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Plus, ExternalLink, Calendar, Package, DollarSign } from "lucide-react";
import { ALMACEN_LABELS } from "@/hooks/useInventario";
import { estatusPedidoColor, ESTATUS_PEDIDO_LABEL } from "@/hooks/usePedidosInventario";

const PROVEEDOR_LABEL: Record<string, string> = { chevron: "Chevron", phillips66: "Phillips 66" };
const PROVEEDOR_COLOR: Record<string, string> = {
  chevron: "bg-blue-100 text-blue-800 border-blue-200",
  phillips66: "bg-red-100 text-red-800 border-red-200",
};

export default function PedidosActivos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const puedeCrear = hasAnyRole(["admin", "manager", "warehouse"]);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["inv_pedidos_activos_config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_pedidos_activos_config")
        .select("*, pedido_actual:pedido_actual_id(id, estatus, fecha_pedido, fecha_entrega_estimada, total_tarimas, total_monto, moneda, numero_po_interno)")
        .order("id");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const { data: lineCounts = {} } = useQuery({
    queryKey: ["inv_pedidos_activos_lineas", configs.map((c: any) => c.pedido_actual_id).filter(Boolean)],
    enabled: configs.some((c: any) => c.pedido_actual_id),
    queryFn: async () => {
      const ids = configs.map((c: any) => c.pedido_actual_id).filter(Boolean);
      if (!ids.length) return {};
      const { data } = await (supabase as any).from("inv_pedido_lineas").select("pedido_id").in("pedido_id", ids);
      const counts: Record<string, number> = {};
      (data || []).forEach((l: any) => { counts[l.pedido_id] = (counts[l.pedido_id] || 0) + 1; });
      return counts;
    },
  });

  const totalTarimas = useMemo(
    () => configs.reduce((acc: number, c: any) => acc + (c.pedido_actual?.total_tarimas || 0), 0),
    [configs]
  );

  const handleNuevoPedido = async (config: any) => {
    try {
      const empresa = config.proveedor === "chevron" ? "lumaggs" : "galsa";
      const po = `${config.id}_${Date.now().toString().slice(-6)}`;
      const { data: nuevo, error } = await (supabase as any).from("inv_pedidos").insert({
        empresa_vendedora: empresa,
        proveedor: config.proveedor,
        fuente: config.fuente,
        almacen_destino: config.hub_almacen,
        moneda: config.moneda || "MXN",
        estatus: "borrador",
        fecha_pedido: new Date().toISOString().slice(0, 10),
        numero_po_interno: po,
        generado_desde_sugeridos: false,
        creado_por: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      const { error: ue } = await (supabase as any).from("inv_pedidos_activos_config")
        .update({ pedido_actual_id: nuevo.id }).eq("id", config.id);
      if (ue) throw ue;
      toast.success(`Pedido ${po} creado`);
      qc.invalidateQueries({ queryKey: ["inv_pedidos_activos_config"] });
      qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
      navigate("/inventario/pedidos/elaborados");
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2 tracking-tight">
            <ClipboardList className="h-6 w-6" /> Pedidos Activos
          </h1>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Pedidos permanentes del sistema de reabastecimiento
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          Total tarimas abiertas: <span className="font-semibold ml-1">{totalTarimas}</span>
        </Badge>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Cargando…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configs.map((c: any) => {
          const p = c.pedido_actual;
          const sinPedido = !p;
          const cerrado = p && (p.estatus === "cerrado" || p.estatus === "cancelado");
          const puedeNuevo = puedeCrear && (sinPedido || cerrado);
          const spokes = (c.spokes_almacenes || []).map((s: string) => ALMACEN_LABELS[s] || s).join(", ");
          const lineas = p ? (lineCounts[p.id] || 0) : 0;
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-muted-foreground">{c.id}</div>
                    <div className="text-base font-semibold tracking-tight">{c.nombre}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <Badge variant="outline" className={PROVEEDOR_COLOR[c.proveedor]}>{PROVEEDOR_LABEL[c.proveedor]}</Badge>
                    <Badge variant="outline" className="uppercase text-xs">{c.fuente}</Badge>
                  </div>
                </div>
              </div>
              <CardContent className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Ruta">
                    {ALMACEN_LABELS[c.hub_almacen] || c.hub_almacen}{spokes ? ` → ${spokes}` : ""}
                  </Info>
                  <Info label="Lead time">{Math.round((c.lead_time_dias || 0) / 7)} sem ({c.lead_time_dias} días)</Info>
                  <Info label="Mínimo tarimas">{c.minimo_tarimas}</Info>
                  <Info label="Moneda">{c.moneda}</Info>
                </div>

                <div className="border-t pt-3">
                  {sinPedido ? (
                    <div className="text-sm text-muted-foreground italic">Sin pedido activo</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-mono text-xs">{p.numero_po_interno}</div>
                        <Badge className={estatusPedidoColor(p.estatus)}>{ESTATUS_PEDIDO_LABEL[p.estatus] || p.estatus}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Stat icon={Calendar} label="Pedido" value={p.fecha_pedido || "—"} />
                        <Stat icon={Calendar} label="Entrega est." value={p.fecha_entrega_estimada || "—"} />
                        <Stat icon={Package} label="Tarimas" value={String(p.total_tarimas ?? 0)} />
                        <Stat icon={Package} label="SKUs" value={String(lineas)} />
                        <Stat icon={DollarSign} label="Monto" value={`${Number(p.total_monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda || ""}`} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="bg-muted/30 border-t px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {p && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/inventario/pedidos/elaborados")}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Ver pedido
                  </Button>
                )}
                {puedeNuevo && (
                  <Button size="sm" onClick={() => handleNuevoPedido(c)}>
                    <Plus className="h-4 w-4 mr-1" /> Nuevo pedido
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-light">{children}</div>
    </div>
  );
}
function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="uppercase tracking-wide text-[10px]">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}