import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { esGalsa, esLumaggs, mesLabel } from "./rvsAgregados";

const headClass =
  "bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30";

const money = (n: number) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const uds = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
const pct = (n: number) => `${n.toFixed(2)}%`;

type Empresa = "galsa" | "lumaggs";

interface FilaSucursal {
  key: string;
  sucursal: string;
  unidades: number;
  venta: number;
  costo: number;
  utilidad: number;
}

const margenDe = (utilidad: number, venta: number) => (venta > 0 ? (utilidad / venta) * 100 : 0);

export function ResumenSucursalView({ mes }: { mes: string }) {
  const [empresa, setEmpresa] = useState<Empresa>("galsa");

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_resumen_sucursal", mes],
    queryFn: async () => {
      const [ventasPlaza, plazas] = await Promise.all([
        supabase
          .from("rvs_ventas_mes_plaza")
          .select("plaza_id, sucursal_reporte, marca, unidades, venta, costo, utilidad")
          .eq("anio_mes", mes),
        supabase.from("plazas").select("id, nombre"),
      ]);
      const err = [ventasPlaza, plazas].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        ventasPlaza: (ventasPlaza.data || []) as any[],
        plazas: (plazas.data || []) as any[],
      };
    },
  });

  const filas = useMemo(() => {
    if (!data) return [] as FilaSucursal[];
    const plazaNombre = new Map<string, string>();
    data.plazas.forEach((p: any) => plazaNombre.set(p.id, p.nombre));
    const acc = new Map<string, FilaSucursal>();
    for (const v of data.ventasPlaza) {
      if (empresa === "galsa" && !esGalsa(v.marca || "")) continue;
      if (empresa === "lumaggs" && !esLumaggs(v.marca || "")) continue;
      const key = v.plaza_id || `sr:${v.sucursal_reporte || "Sin sucursal"}`;
      if (!acc.has(key))
        acc.set(key, {
          key,
          sucursal: (v.plaza_id && plazaNombre.get(v.plaza_id)) || v.sucursal_reporte || "Sin sucursal",
          unidades: 0,
          venta: 0,
          costo: 0,
          utilidad: 0,
        });
      const row = acc.get(key)!;
      row.unidades += Number(v.unidades || 0);
      row.venta += Number(v.venta || 0);
      row.costo += Number(v.costo || 0);
      row.utilidad += Number(v.utilidad || 0);
    }
    return Array.from(acc.values()).sort((a, b) => b.venta - a.venta);
  }, [data, empresa]);

  const total = useMemo(
    () =>
      filas.reduce(
        (t, r) => ({
          unidades: t.unidades + r.unidades,
          venta: t.venta + r.venta,
          costo: t.costo + r.costo,
          utilidad: t.utilidad + r.utilidad,
        }),
        { unidades: 0, venta: 0, costo: 0, utilidad: 0 }
      ),
    [filas]
  );

  const exportar = () => {
    const enc = ["Sucursal", "Unidades", "Venta", "Costo", "Utilidad", "Margen %"];
    const aoa: any[][] = [
      [`${mesLabel(mes)} — ${empresa === "galsa" ? "Galsa" : "Lumaggs"}`],
      enc,
      ...filas.map((r) => [
        r.sucursal,
        r.unidades,
        r.venta,
        r.costo,
        r.utilidad,
        Number(margenDe(r.utilidad, r.venta).toFixed(2)),
      ]),
      [
        "Total",
        total.unidades,
        total.venta,
        total.costo,
        total.utilidad,
        Number(margenDe(total.utilidad, total.venta).toFixed(2)),
      ],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Por sucursal");
    XLSX.writeFile(wb, `RVS_Sucursal_${empresa === "galsa" ? "Galsa" : "Lumaggs"}_${mes}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Ventas por sucursal — {mesLabel(mes)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={empresa} onValueChange={(v) => setEmpresa(v as Empresa)}>
              <TabsList>
                <TabsTrigger value="galsa">Galsa</TabsTrigger>
                <TabsTrigger value="lumaggs">Lumaggs</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={exportar} disabled={isLoading || filas.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={headClass}>
                <TableHead className="text-[11px] uppercase tracking-wide">Sucursal</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-right">Unidades</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-right">Venta</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-right">Costo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-right">Utilidad</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-sm text-muted-foreground">
                    {isLoading ? "Cargando…" : "Sin datos para este mes."}
                  </TableCell>
                </TableRow>
              )}
              {filas.map((r, i) => (
                <TableRow key={r.key} className={i % 2 ? "bg-muted/30" : undefined}>
                  <TableCell className="font-medium whitespace-nowrap">{r.sucursal}</TableCell>
                  <TableCell className="text-right">{uds(r.unidades)}</TableCell>
                  <TableCell className="text-right">{money(r.venta)}</TableCell>
                  <TableCell className="text-right">{money(r.costo)}</TableCell>
                  <TableCell className="text-right">{money(r.utilidad)}</TableCell>
                  <TableCell className="text-right">{pct(margenDe(r.utilidad, r.venta))}</TableCell>
                </TableRow>
              ))}
              {filas.length > 0 && (
                <TableRow className="bg-violet-50/60 dark:bg-violet-950/20">
                  <TableCell className="font-semibold uppercase text-xs tracking-wide">Total</TableCell>
                  <TableCell className="text-right font-semibold">{uds(total.unidades)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(total.venta)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(total.costo)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(total.utilidad)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {pct(margenDe(total.utilidad, total.venta))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
