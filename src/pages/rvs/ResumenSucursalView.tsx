import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { esGalsa, esLumaggs, mesLabel, derivarVentasPlaza } from "./rvsAgregados";
import { CapturaSucursalDialog } from "./components/CapturaSucursalDialog";
import { FiltroChipsMulti } from "./components/FiltroChipsMulti";


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
  const [marcasSel, setMarcasSel] = useState<string[]>([]); // [] = ambas
  const [sucursalesSel, setSucursalesSel] = useState<string[]>([]); // [] = todas
  const [capturaAbierta, setCapturaAbierta] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_resumen_sucursal", mes],
    queryFn: async () => {
      const [ventasPlaza, ventas, personas, plazas] = await Promise.all([
        supabase
          .from("rvs_ventas_mes_plaza")
          .select("plaza_id, sucursal_reporte, marca, unidades, venta, costo, utilidad")
          .eq("anio_mes", mes),
        supabase
          .from("rvs_ventas_mes")
          .select("persona_id, marca, unidades, venta, costo, utilidad, plaza_id")
          .eq("anio_mes", mes),
        supabase.from("rvs_personas").select("id, plaza_id"),
        supabase.from("plazas").select("id, nombre"),
      ]);
      const err = [ventasPlaza, ventas, personas, plazas].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        reales: (ventasPlaza.data || []) as any[],
        derivadas: derivarVentasPlaza(
          (ventas.data || []) as any[],
          (personas.data || []) as any[]
        ),
        plazas: (plazas.data || []) as any[],
      };
    },
  });

  const filtrarMarca = (rows: any[]) =>
    rows.filter((v) => {
      const m = v.marca || "";
      if (esGalsa(m)) return marcasSel.length === 0 || marcasSel.includes("galsa");
      if (esLumaggs(m)) return marcasSel.length === 0 || marcasSel.includes("lumaggs");
      return true;
    });

  const reales = useMemo(() => filtrarMarca(data?.reales || []), [data, marcasSel]);
  const esDerivado = reales.length === 0;
  const fuente = useMemo(
    () => (esDerivado ? filtrarMarca(data?.derivadas || []) : reales),
    [data, marcasSel, esDerivado, reales]
  );

  const filas = useMemo(() => {
    if (!data) return [] as FilaSucursal[];
    const plazaNombre = new Map<string, string>();
    data.plazas.forEach((p: any) => plazaNombre.set(p.id, p.nombre));
    const acc = new Map<string, FilaSucursal>();
    for (const v of fuente) {
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
  }, [data, fuente]);

  const opcionesSucursal = useMemo(() => filas.map((f) => f.sucursal), [filas]);

  const filasVisibles = useMemo(
    () =>
      sucursalesSel.length === 0
        ? filas
        : filas.filter((f) => sucursalesSel.includes(f.sucursal)),
    [filas, sucursalesSel]
  );



  const total = useMemo(
    () =>
      filasVisibles.reduce(
        (t, r) => ({
          unidades: t.unidades + r.unidades,
          venta: t.venta + r.venta,
          costo: t.costo + r.costo,
          utilidad: t.utilidad + r.utilidad,
        }),
        { unidades: 0, venta: 0, costo: 0, utilidad: 0 }
      ),
    [filasVisibles]
  );

  const marcaLabel =
    marcasSel.length === 1 ? (marcasSel[0] === "galsa" ? "Galsa" : "Lumaggs") : "Galsa + Lumaggs";

  const exportar = () => {
    const enc = ["Sucursal", "Unidades", "Venta", "Costo", "Utilidad", "Margen %"];
    const aoa: any[][] = [
      [`${mesLabel(mes)} — ${marcaLabel}`],
      enc,
      ...filasVisibles.map((r) => [
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
    XLSX.writeFile(wb, `RVS_Sucursal_${marcaLabel.replace(/\s+\+\s+/, "_")}_${mes}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Ventas por sucursal — {mesLabel(mes)}</CardTitle>
            {!isLoading && (
              <Badge
                variant="outline"
                className={
                  esDerivado
                    ? "text-amber-600 border-amber-300"
                    : "text-emerald-700 border-emerald-300"
                }
              >
                {esDerivado
                  ? "Derivado de la plaza del vendedor (aproximado)"
                  : "Datos oficiales capturados por sucursal"}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCapturaAbierta(true)}>
              <Upload className="h-4 w-4 mr-1" /> Capturar por sucursal
            </Button>
            <Button size="sm" onClick={exportar} disabled={isLoading || filasVisibles.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </div>
        <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-2">
          <FiltroChipsMulti
            titulo="Empresa (una, varias o todas)"
            opciones={["galsa", "lumaggs"]}
            seleccion={marcasSel}
            onChange={setMarcasSel}
          />
          <FiltroChipsMulti
            titulo="Sucursal (una, varias o todas)"
            opciones={opcionesSucursal}
            seleccion={sucursalesSel}
            onChange={setSucursalesSel}
          />
        </div>
        {esDerivado && !isLoading && (
          <p className="pt-1 text-xs text-muted-foreground">
            Estas cifras se calculan con la plaza asignada al vendedor, por lo que una venta hecha
            en otra sucursal se acredita a la plaza del vendedor. Captura la tabla oficial por
            sucursal del correo para corregirlo.
          </p>
        )}
      </CardHeader>
      <CapturaSucursalDialog
        open={capturaAbierta}
        onOpenChange={setCapturaAbierta}
        mes={mes}
        marca={marcasSel.length === 1 ? (marcasSel[0] as Empresa) : "galsa"}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["rvs_resumen_sucursal"] });
          qc.invalidateQueries({ queryKey: ["rvs_reportes_mes"] });
        }}
      />

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
