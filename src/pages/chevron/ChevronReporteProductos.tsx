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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
            {!isLoading && visibles.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin registros…</TableCell></TableRow>}
            {visibles.map((p) => (
              <Fragment key={p.key}>
                <TableRow className="bg-violet-50/60 hover:bg-violet-50/60">
                  <TableCell colSpan={2} className="font-semibold uppercase tracking-widest text-[11px] text-violet-700">{p.label}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{qty(p.cantidad)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums font-medium">{money(p.importe)}</TableCell>
                </TableRow>
                {p.filas.map((f) => (
                  <TableRow key={p.key + f.codigo + f.descripcion}>
                    <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{qty(f.cantidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(f.cantidad ? f.importe / f.cantidad : 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(f.importe)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
