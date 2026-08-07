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
import { EyeOff, Undo2 } from "lucide-react";
import { toast } from "sonner";

const ALMACENES = [
  { code: "1001", label: "Mexicali" },
  { code: "1002", label: "Tijuana" },
  { code: "1003", label: "Morelos" },
  { code: "1004", label: "Ensenada" },
];

export default function PedidosSugeridos() {
  const [empresa, setEmpresa] = useState("todas");
  const [search, setSearch] = useState("");
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
    queryKey: ["inv_minmax_sugeridos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_minmax")
        .select("codigo_producto, almacen, minimo_calc, maximo_calc, minimo_manual, maximo_manual, cantidad_reorden_calc, cantidad_reorden_manual");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const { data: pedidoLineas = [] } = useQuery({
    queryKey: ["inv_pedido_lineas_abiertos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("inv_pedido_lineas")
        .select("codigo_producto, cantidad_solicitada, cantidad_confirmada, inv_pedidos!inner(estatus)")
        .not("inv_pedidos.estatus", "in", "(cerrado,cancelado)");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
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
      const cant = Number(l.cantidad_confirmada ?? l.cantidad_solicitada ?? 0) || 0;
      m[l.codigo_producto] = (m[l.codigo_producto] || 0) + cant;
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

    return Object.entries(porCodigo)
      .map(([codigo, porAlmacen]) => {
        const info = infoPorCodigo[codigo] || {};
        const necesidad_total = ALMACENES.reduce((s, a) => s + (porAlmacen[a.code] || 0), 0);
        const ya_pedido = yaPedidoPorCodigo[codigo] || 0;
        return {
          codigo,
          nombre: info.nombre_producto || "—",
          presentacion: info.presentacion || "—",
          empresa_vendedora: info.empresa_vendedora || "",
          porAlmacen,
          necesidad_total,
          ya_pedido,
          necesidad_neta_total: Math.max(0, necesidad_total - ya_pedido),
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
  }, [minmax, infoPorCodigo, yaPedidoPorCodigo, empresa, search]);

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
                {["Código", "Producto", "Presentación", ...ALMACENES.map((a) => a.label), "Total Necesario", "Ya Pedido", "Total a Pedir", ""].map((h, idx) => (
                  <TableHead key={h || idx} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.codigo} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell className="text-sm font-light">{r.nombre}</TableCell>
                  <TableCell className="text-xs">{r.presentacion}</TableCell>
                  {ALMACENES.map((a) => (
                    <TableCell key={a.code} className="text-right tabular-nums">{r.porAlmacen[a.code] || 0}</TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{r.necesidad_total}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.ya_pedido}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{r.necesidad_neta_total}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => ignorar(r.codigo)}>
                      <EyeOff className="h-3.5 w-3.5 mr-1" />Ignorar
                    </Button>
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
    </div>
  );
}
