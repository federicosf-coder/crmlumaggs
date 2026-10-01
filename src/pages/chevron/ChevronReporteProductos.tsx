import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLineasChevron } from "./chevronCfdiLineas";

const money = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const qty = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type Fila = { codigo: string; descripcion: string; cantidad: number; importe: number };

export function ChevronReporteProductos() {
  const [anio, setAnio] = useState("todos");

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ["chevron_reporte_productos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chevron_facturas_recibidas")
        .select("id, fecha, xml_raw")
        .eq("tipo_comprobante", "I")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: inv } = useQuery({
    queryKey: ["chevron_reporte_inventario"],
    queryFn: async () => {
      const all = async (table: string, cols: string, filt?: (q: any) => any) => {
        const out: any[] = [];
        for (let from = 0; ; from += 1000) {
          let q = (supabase as any).from(table).select(cols).range(from, from + 999);
          if (filt) q = filt(q);
          const { data, error } = await q;
          if (error) throw error;
          out.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        return out;
      };
      const [map, niv, dem] = await Promise.all([
        all("inv_producto_proveedor", "codigo_proveedor, codigo_contpaqi", (q) => q.eq("proveedor", "chevron")),
        all("inv_niveles_inventario", "codigo_producto, stock_total"),
        all("inv_demanda_plaza", "codigo_producto, almacen, periodo_fin, demanda_mensual_promedio"),
      ]);
      const alias = new Map<string, string>();
      map.forEach((m) => m.codigo_proveedor && m.codigo_contpaqi && alias.set(String(m.codigo_proveedor), String(m.codigo_contpaqi)));
      const stock = new Map<string, number>();
      niv.forEach((n) => { if (!stock.has(n.codigo_producto)) stock.set(n.codigo_producto, Number(n.stock_total || 0)); });
      // misma lógica que Rotación: por almacén la fila más reciente, sumada
      const latest = new Map<string, any>();
      dem.forEach((d) => {
        const k = `${d.codigo_producto}|${d.almacen}`;
        const prev = latest.get(k);
        if (!prev || String(d.periodo_fin || "") > String(prev.periodo_fin || "")) latest.set(k, d);
      });
      const demanda = new Map<string, number>();
      latest.forEach((d) => demanda.set(d.codigo_producto, (demanda.get(d.codigo_producto) || 0) + Number(d.demanda_mensual_promedio || 0)));
      return { alias, stock, demanda };
    },
  });

  const metricas = (codigo: string) => {
    if (!inv || !codigo || codigo === "—") return null;
    const c = inv.alias.get(codigo) || codigo;
    const mensual = inv.demanda.get(c) || 0;
    const stock = inv.stock.get(c);
    const dias = mensual > 0 && stock != null ? stock / (mensual / 30) : null;
    return { mensual, stock, dias };
  };

  const periodos = useMemo(() => {
    const m = new Map<string, Map<string, Fila>>();
    facturas.forEach((f) => {
      if (!f.fecha) return;
      const key = String(f.fecha).slice(0, 7);
      const prod = m.get(key) || new Map<string, Fila>();
      parseLineasChevron(f.xml_raw).forEach((l) => {
        const k = l.codigo || l.descripcion;
        const cur = prod.get(k) || { codigo: l.codigo || "—", descripcion: l.descripcion, cantidad: 0, importe: 0 };
        cur.cantidad += l.cantidad;
        cur.importe += l.importe;
        prod.set(k, cur);
      });
      m.set(key, prod);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, prod]) => {
        const filas = Array.from(prod.values()).sort((a, b) => b.importe - a.importe);
        return {
          key,
          anio: key.slice(0, 4),
          label: `${MESES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
          filas,
          cantidad: filas.reduce((s, f) => s + f.cantidad, 0),
          importe: filas.reduce((s, f) => s + f.importe, 0),
        };
      });
  }, [facturas]);

  const anios = Array.from(new Set(periodos.map((p) => p.anio)));
  const visibles = anio === "todos" ? periodos : periodos.filter((p) => p.anio === anio);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Año</span>
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {anios.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-light">Importes sin IVA, solo facturas de Chevron.</span>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio prom.</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">Venta prom. mes</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="text-right">Días de inv.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
            {!isLoading && visibles.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin registros…</TableCell></TableRow>}
            {visibles.map((p) => (
              <Fragment key={p.key}>
                <TableRow className="bg-violet-50/60 hover:bg-violet-50/60">
                  <TableCell colSpan={2} className="font-semibold uppercase tracking-widest text-[11px] text-violet-700">{p.label}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{qty(p.cantidad)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums font-medium">{money(p.importe)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
                {p.filas.map((f) => { const m = metricas(f.codigo); return (
                  <TableRow key={p.key + f.codigo + f.descripcion}>
                    <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{qty(f.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(f.cantidad ? f.importe / f.cantidad : 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(f.importe)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m ? qty(m.mensual) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m?.stock != null ? qty(m.stock) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{!m ? "—" : m.dias != null ? `${Math.round(m.dias)} días` : <span className="text-xs text-muted-foreground">Sin rotación</span>}</TableCell>
                  </TableRow>
                ); })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
