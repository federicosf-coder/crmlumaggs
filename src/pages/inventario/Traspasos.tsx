import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeftRight, Sparkles, Truck, PackageCheck, X } from "lucide-react";
import { ALMACEN_LABELS } from "@/hooks/useInventario";

const HUB_SPOKE: Record<string, string> = { "1003": "1001", "1004": "1002" };
const ESTATUS_COLOR: Record<string, string> = {
  sugerido: "bg-blue-100 text-blue-800",
  aprobado: "bg-cyan-100 text-cyan-800",
  enviado: "bg-amber-100 text-amber-800",
  recibido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

type Traspaso = any;
type Linea = any;

export default function Traspasos() {
  const qc = useQueryClient();
  const { hasAnyRole, user } = useAuth();
  const puedeEditar = hasAnyRole(["admin", "manager", "warehouse"]);
  const puedeGenerar = hasAnyRole(["admin", "manager"]);
  const [tab, setTab] = useState("sugeridos");
  const [generating, setGenerating] = useState(false);
  const [recepcionTarget, setRecepcionTarget] = useState<Traspaso | null>(null);

  const { data: traspasos = [] } = useQuery({
    queryKey: ["inv_traspasos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_traspasos")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const { data: lineas = [] } = useQuery({
    queryKey: ["inv_traspaso_lineas", traspasos.map((t: any) => t.id)],
    enabled: traspasos.length > 0,
    queryFn: async () => {
      const ids = traspasos.map((t: any) => t.id);
      const { data } = await (supabase as any).from("inv_traspaso_lineas").select("*").in("traspaso_id", ids);
      return data || [];
    },
  });

  const lineasByTraspaso = useMemo(() => {
    const m: Record<string, Linea[]> = {};
    (lineas as Linea[]).forEach((l) => { (m[l.traspaso_id] ||= []).push(l); });
    return m;
  }, [lineas]);

  const sugeridos = traspasos.filter((t: any) => t.estatus === "sugerido");
  const aprobados = traspasos.filter((t: any) => t.estatus === "aprobado");
  const enviados = traspasos.filter((t: any) => t.estatus === "enviado");
  const enTransito = [...aprobados, ...enviados];
  const historial = traspasos.filter((t: any) => t.estatus === "recibido" || t.estatus === "cancelado");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const recibidosMes = traspasos.filter((t: any) =>
    t.estatus === "recibido" && t.fecha_recepcion && new Date(t.fecha_recepcion) >= monthStart
  ).length;

  const handleGenerar = async () => {
    if (!puedeGenerar) return;
    setGenerating(true);
    try {
      const [{ data: niveles }, { data: minmaxs }, { data: existentes }] = await Promise.all([
        (supabase as any).from("inv_niveles_inventario").select("codigo_producto, nombre_producto, unidad, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004"),
        (supabase as any).from("inv_minmax").select("codigo_producto, almacen, minimo_efectivo, maximo_efectivo"),
        (supabase as any).from("inv_traspasos").select("id, almacen_destino, estatus").in("estatus", ["sugerido", "aprobado", "enviado"]),
      ]);
      const exLineas = existentes?.length
        ? (await (supabase as any).from("inv_traspaso_lineas").select("codigo_producto, traspaso_id").in("traspaso_id", existentes.map((e: any) => e.id))).data || []
        : [];
      const existingKeys = new Set<string>();
      exLineas.forEach((l: any) => {
        const t = existentes.find((e: any) => e.id === l.traspaso_id);
        if (t) existingKeys.add(`${l.codigo_producto}|${t.almacen_destino}`);
      });
      const mmMap = new Map<string, any>();
      (minmaxs || []).forEach((m: any) => mmMap.set(`${m.codigo_producto}|${m.almacen}`, m));

      const today = new Date().toISOString().slice(0, 10);
      const groups: Record<string, any[]> = {}; // key destino → lines

      for (const n of niveles || []) {
        for (const spoke of ["1003", "1004"]) {
          const stockSpoke = Number(n[`stock_almacen_${spoke}`] || 0);
          const mm = mmMap.get(`${n.codigo_producto}|${spoke}`);
          const minSpoke = Number(mm?.minimo_efectivo || 0);
          if (minSpoke <= 0) continue;
          if (stockSpoke >= minSpoke) continue;
          if (existingKeys.has(`${n.codigo_producto}|${spoke}`)) continue;
          const origen = HUB_SPOKE[spoke];
          const stockOrigen = Number(n[`stock_almacen_${origen}`] || 0);
          if (stockOrigen <= 0) continue;
          const maxSpoke = Number(mm?.maximo_efectivo || minSpoke * 2);
          const necesidad = Math.min(stockOrigen, Math.max(maxSpoke - stockSpoke, minSpoke - stockSpoke));
          if (necesidad <= 0) continue;
          (groups[spoke] ||= []).push({
            codigo_producto: n.codigo_producto, nombre_producto: n.nombre_producto, unidad: n.unidad,
            cantidad_sugerida: necesidad, stock_origen_actual: stockOrigen, stock_destino_actual: stockSpoke,
            minimo_destino: minSpoke, motivo: "Stock spoke bajo mínimo",
            _origen: origen,
          });
        }
      }

      let created = 0;
      for (const [destino, lns] of Object.entries(groups)) {
        if (!lns.length) continue;
        const origen = HUB_SPOKE[destino];
        const { data: tras, error } = await (supabase as any).from("inv_traspasos").insert({
          almacen_origen: origen, almacen_destino: destino, estatus: "sugerido",
          fecha_sugerida: today, es_consolidado: lns.length > 1, total_skus: lns.length,
          generado_automaticamente: true, creado_por: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        const insertLineas = lns.map(({ _origen, ...rest }) => ({ ...rest, traspaso_id: tras.id }));
        const { error: le } = await (supabase as any).from("inv_traspaso_lineas").insert(insertLineas);
        if (le) throw le;
        created++;
      }

      toast.success(created > 0 ? `Se generaron ${created} viaje(s) sugerido(s)` : "No hay nuevas sugerencias");
      qc.invalidateQueries({ queryKey: ["inv_traspasos"] });
      qc.invalidateQueries({ queryKey: ["inv_traspaso_lineas"] });
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    } finally { setGenerating(false); }
  };

  const updateEstatus = async (id: string, estatus: string, extra: any = {}) => {
    const { error } = await (supabase as any).from("inv_traspasos").update({ estatus, ...extra }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Actualizado"); qc.invalidateQueries({ queryKey: ["inv_traspasos"] }); }
  };

  const aprobarGrupo = async (ids: string[]) => {
    const { error } = await (supabase as any).from("inv_traspasos")
      .update({ estatus: "aprobado", aprobado_por: user?.id ?? null }).in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success("Viaje aprobado"); qc.invalidateQueries({ queryKey: ["inv_traspasos"] }); }
  };

  // Agrupar sugeridos por viaje_id (o por id si no tiene viaje_id)
  const sugeridosGroups = useMemo(() => {
    const m: Record<string, Traspaso[]> = {};
    sugeridos.forEach((t: any) => {
      const k = t.viaje_id || t.id;
      (m[k] ||= []).push(t);
    });
    return Object.values(m);
  }, [sugeridos]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2 tracking-tight">
            <ArrowLeftRight className="h-6 w-6" /> Traspasos entre almacenes
          </h1>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Hub → Spoke: Mexicali → Morelos · Tijuana → Ensenada
          </p>
        </div>
        {puedeGenerar && (
          <Button onClick={handleGenerar} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-1" /> {generating ? "Generando…" : "Generar sugerencias"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Sugeridos" value={sugeridos.length} className="text-blue-700" />
        <Kpi label="Aprobados" value={aprobados.length} className="text-cyan-700" />
        <Kpi label="En tránsito" value={enviados.length} className="text-amber-700" />
        <Kpi label="Recibidos este mes" value={recibidosMes} className="text-green-700" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sugeridos">Sugeridos ({sugeridos.length})</TabsTrigger>
          <TabsTrigger value="transito">En tránsito ({enTransito.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sugeridos" className="space-y-4 mt-4">
          {sugeridosGroups.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Sin traspasos sugeridos</CardContent></Card>
          )}
          {sugeridosGroups.map((grupo, idx) => {
            const ids = grupo.map((t) => t.id);
            const first = grupo[0];
            const allLineas = grupo.flatMap((t) => lineasByTraspaso[t.id] || []);
            return (
              <Card key={first.viaje_id || first.id}>
                <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold tracking-tight">
                      {ALMACEN_LABELS[first.almacen_origen]} → {ALMACEN_LABELS[first.almacen_destino]}
                    </div>
                    <Badge variant="outline" className="text-xs">Fecha: {first.fecha_sugerida || "—"}</Badge>
                    <Badge variant="outline" className="text-xs">{allLineas.length} SKU(s)</Badge>
                    {first.es_consolidado && <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-200 text-xs">Consolidado</Badge>}
                  </div>
                  {puedeEditar && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => aprobarGrupo(ids)}>Aprobar viaje</Button>
                      <Button size="sm" variant="outline" onClick={() => ids.forEach((id) => updateEstatus(id, "cancelado"))}>
                        <X className="h-3 w-3 mr-1" /> Descartar
                      </Button>
                    </div>
                  )}
                </div>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <Th>Código</Th><Th>Producto</Th>
                        <Th className="text-right">Sugerido</Th>
                        <Th className="text-right">Stock origen</Th>
                        <Th className="text-right">Stock destino</Th>
                        <Th className="text-right">Mín destino</Th>
                        <Th>Motivo</Th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allLineas.map((l: any, i: number) => (
                        <TableRow key={l.id} className={i % 2 ? "bg-muted/20" : ""}>
                          <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{l.nombre_producto || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{l.cantidad_sugerida}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.stock_origen_actual ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-red-700">{l.stock_destino_actual ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.minimo_destino ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="transito" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                  <TableRow>
                    <Th>Origen</Th><Th>Destino</Th><Th>Fecha sug.</Th><Th>Fecha envío</Th>
                    <Th className="text-right">SKUs</Th><Th>Estatus</Th><Th>Acciones</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enTransito.map((t: any, i: number) => (
                    <TableRow key={t.id} className={i % 2 ? "bg-muted/20" : ""}>
                      <TableCell>{ALMACEN_LABELS[t.almacen_origen]}</TableCell>
                      <TableCell>{ALMACEN_LABELS[t.almacen_destino]}</TableCell>
                      <TableCell className="text-xs">{t.fecha_sugerida || "—"}</TableCell>
                      <TableCell className="text-xs">{t.fecha_envio || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{(lineasByTraspaso[t.id] || []).length}</TableCell>
                      <TableCell><Badge className={ESTATUS_COLOR[t.estatus]}>{t.estatus}</Badge></TableCell>
                      <TableCell>
                        {puedeEditar && t.estatus === "aprobado" && (
                          <Button size="sm" variant="outline" onClick={() => updateEstatus(t.id, "enviado", { fecha_envio: new Date().toISOString().slice(0, 10) })}>
                            <Truck className="h-3 w-3 mr-1" /> Marcar enviado
                          </Button>
                        )}
                        {puedeEditar && t.estatus === "enviado" && (
                          <Button size="sm" onClick={() => setRecepcionTarget(t)}>
                            <PackageCheck className="h-3 w-3 mr-1" /> Registrar recepción
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {enTransito.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin traspasos en tránsito</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                  <TableRow>
                    <Th>Fecha</Th><Th>Origen → Destino</Th><Th className="text-right">SKUs</Th><Th>Estatus</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((t: any, i: number) => (
                    <TableRow key={t.id} className={i % 2 ? "bg-muted/20" : ""}>
                      <TableCell className="text-xs">{t.fecha_recepcion || t.updated_at?.slice(0, 10)}</TableCell>
                      <TableCell>{ALMACEN_LABELS[t.almacen_origen]} → {ALMACEN_LABELS[t.almacen_destino]}</TableCell>
                      <TableCell className="text-right tabular-nums">{(lineasByTraspaso[t.id] || []).length}</TableCell>
                      <TableCell><Badge className={ESTATUS_COLOR[t.estatus]}>{t.estatus}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {historial.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sin historial</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecepcionDialog
        target={recepcionTarget}
        lineas={recepcionTarget ? (lineasByTraspaso[recepcionTarget.id] || []) : []}
        onClose={() => setRecepcionTarget(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["inv_traspasos"] });
          qc.invalidateQueries({ queryKey: ["inv_traspaso_lineas"] });
          qc.invalidateQueries({ queryKey: ["inv_niveles_inventario"] });
        }}
      />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableHead className={`uppercase tracking-wide text-xs font-medium ${className || ""}`}>{children}</TableHead>;
}
function Kpi({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-3xl font-light mt-1 ${className || ""}`}>{value}</div>
    </CardContent></Card>
  );
}

function RecepcionDialog({ target, lineas, onClose, onSaved }: any) {
  const [recibidas, setRecibidas] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (target) {
      const init: Record<string, number> = {};
      (lineas as any[]).forEach((l) => { init[l.id] = Number(l.cantidad_enviada || l.cantidad_aprobada || l.cantidad_sugerida || 0); });
      setRecibidas(init);
    }
  }, [target, lineas]);

  if (!target) return null;

  const onSubmit = async () => {
    setSaving(true);
    try {
      // 1. Update líneas con cantidad_recibida
      for (const l of lineas) {
        const r = Number(recibidas[l.id] || 0);
        await (supabase as any).from("inv_traspaso_lineas").update({ cantidad_recibida: r }).eq("id", l.id);
      }
      // 2. Update traspaso
      await (supabase as any).from("inv_traspasos").update({
        estatus: "recibido", fecha_recepcion: new Date().toISOString().slice(0, 10),
      }).eq("id", target.id);
      // 3. Ajustar stock en niveles: destino += recibida, origen -= recibida
      const origenCol = `stock_almacen_${target.almacen_origen}`;
      const destinoCol = `stock_almacen_${target.almacen_destino}`;
      for (const l of lineas) {
        const r = Number(recibidas[l.id] || 0);
        if (r <= 0) continue;
        const { data: nivel } = await (supabase as any).from("inv_niveles_inventario")
          .select(`id, ${origenCol}, ${destinoCol}`).eq("codigo_producto", l.codigo_producto).maybeSingle();
        if (nivel) {
          await (supabase as any).from("inv_niveles_inventario").update({
            [origenCol]: Math.max(0, Number(nivel[origenCol] || 0) - r),
            [destinoCol]: Number(nivel[destinoCol] || 0) + r,
          }).eq("id", nivel.id);
        }
      }
      toast.success("Recepción registrada");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Registrar recepción · {ALMACEN_LABELS[target.almacen_origen]} → {ALMACEN_LABELS[target.almacen_destino]}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <Th>Código</Th><Th>Producto</Th>
                <Th className="text-right">Enviado</Th>
                <Th className="text-right">Recibido</Th>
                <Th className="text-right">Diferencia</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l: any) => {
                const enviado = Number(l.cantidad_enviada || l.cantidad_aprobada || l.cantidad_sugerida || 0);
                const r = Number(recibidas[l.id] || 0);
                const diff = r - enviado;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{l.nombre_producto || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{enviado}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="h-8 w-24 ml-auto text-right" value={r}
                        onChange={(e) => setRecibidas((p) => ({ ...p, [l.id]: Number(e.target.value) }))} />
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${diff < 0 ? "text-red-700" : diff > 0 ? "text-amber-700" : ""}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Guardando…" : "Confirmar recepción"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}