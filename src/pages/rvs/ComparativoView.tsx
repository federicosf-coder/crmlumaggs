import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  agregarPorPersona,
  agregarPorPlaza,
  combinar,
  currency,
  mesLabel,
  shiftMes,
  type FilaComparativa,
} from "./rvsAgregados";

const headClass =
  "bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30";

function Variacion({ v }: { v: number | null }) {
  if (v === null)
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" /> n/d
      </span>
    );
  const positivo = v >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${
        positivo ? "text-emerald-600" : "text-destructive"
      }`}
    >
      {positivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {v.toFixed(1)}%
    </span>
  );
}

function TablaComparativa({
  titulo,
  primeraColumna,
  filas,
  baseLabel,
  actualLabel,
  isLoading,
  extraFilas,
  extraTitulo,
}: {
  titulo: string;
  primeraColumna: string;
  filas: FilaComparativa[];
  baseLabel: string;
  actualLabel: string;
  isLoading: boolean;
  extraFilas?: FilaComparativa[];
  extraTitulo?: string;
}) {
  const renderFila = (r: FilaComparativa, i: number, destacado?: boolean) => (
    <TableRow
      key={r.key}
      className={destacado ? "bg-violet-50/60 dark:bg-violet-950/20" : i % 2 ? "bg-muted/30" : undefined}
    >
      <TableCell className={destacado ? "font-semibold uppercase text-xs tracking-wide" : "font-medium"}>
        {r.nombre}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">{currency(r.baseGalsa)}</TableCell>
      <TableCell className="text-right text-muted-foreground">{currency(r.baseLumaggs)}</TableCell>
      <TableCell className="text-right text-muted-foreground font-medium">{currency(r.baseTotal)}</TableCell>
      <TableCell className="text-right">{currency(r.actualGalsa)}</TableCell>
      <TableCell className="text-right">{currency(r.actualLumaggs)}</TableCell>
      <TableCell className="text-right font-semibold">{currency(r.actualTotal)}</TableCell>
      <TableCell className="text-right">
        <Variacion v={r.variacion} />
      </TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={headClass}>
                <TableHead rowSpan={2} className="text-[11px] uppercase tracking-wide align-bottom">
                  {primeraColumna}
                </TableHead>
                <TableHead colSpan={3} className="text-[11px] uppercase tracking-wide text-center border-l">
                  {baseLabel}
                </TableHead>
                <TableHead colSpan={3} className="text-[11px] uppercase tracking-wide text-center border-l">
                  {actualLabel}
                </TableHead>
                <TableHead rowSpan={2} className="text-[11px] uppercase tracking-wide text-right align-bottom border-l">
                  Var. %
                </TableHead>
              </TableRow>
              <TableRow className={headClass}>
                <TableHead className="text-[10px] uppercase tracking-wide text-right border-l">Galsa</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-right">Lumaggs</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-right">Total</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-right border-l">Galsa</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-right">Lumaggs</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (!extraFilas || extraFilas.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-sm text-muted-foreground">
                    {isLoading ? "Cargando…" : "Sin datos para los periodos comparados."}
                  </TableCell>
                </TableRow>
              )}
              {filas.map((r, i) => renderFila(r, i))}
              {extraFilas && extraFilas.length > 0 && (
                <>
                  <TableRow className="bg-blue-50/60 dark:bg-blue-950/20">
                    <TableCell colSpan={8} className="text-xs uppercase tracking-wide font-semibold">
                      {extraTitulo}
                    </TableCell>
                  </TableRow>
                  {extraFilas.map((r, i) => renderFila(r, i, true))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

async function cargarPeriodo(mes: string) {
  const [ventas, ventasPlaza] = await Promise.all([
    supabase.from("rvs_ventas_mes").select("persona_id, marca, venta, plaza_id").eq("anio_mes", mes),
    supabase
      .from("rvs_ventas_mes_plaza")
      .select("plaza_id, sucursal_reporte, marca, venta")
      .eq("anio_mes", mes),
  ]);
  if (ventas.error) throw ventas.error;
  if (ventasPlaza.error) throw ventasPlaza.error;
  return { ventas: ventas.data || [], ventasPlaza: ventasPlaza.data || [] };
}

export function ComparativoView({ mes, modo }: { mes: string; modo: "mes_anterior" | "anio_anterior" }) {
  const mesBase = useMemo(() => shiftMes(mes, modo === "mes_anterior" ? -1 : -12), [mes, modo]);

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_comparativo", mes, mesBase],
    queryFn: async () => {
      const [base, actual, personas, plazas, zonas, zonaPlazas] = await Promise.all([
        cargarPeriodo(mesBase),
        cargarPeriodo(mes),
        supabase.from("rvs_personas").select("id, nombre_reporte, nombre_mostrar, plaza_id"),
        supabase.from("plazas").select("id, nombre"),
        supabase.from("zonas").select("id, nombre, is_active").eq("is_active", true),
        supabase.from("zona_plazas").select("zona_id, plaza_id"),
      ]);
      const err = [personas, plazas, zonas, zonaPlazas].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        base,
        actual,
        personas: personas.data || [],
        plazas: plazas.data || [],
        zonas: zonas.data || [],
        zonaPlazas: zonaPlazas.data || [],
      };
    },
  });

  const plazaNombre = useMemo(() => {
    const m = new Map<string, string>();
    (data?.plazas || []).forEach((p: any) => m.set(p.id, p.nombre));
    return m;
  }, [data]);

  const personasComp = useMemo(() => {
    if (!data) return [];
    return combinar(
      agregarPorPersona(data.base.ventas, data.personas, plazaNombre),
      agregarPorPersona(data.actual.ventas, data.personas, plazaNombre)
    );
  }, [data, plazaNombre]);

  const plazasComp = useMemo(() => {
    if (!data) return { filas: [] as FilaComparativa[], zonas: [] as FilaComparativa[] };
    const b = agregarPorPlaza(data.base.ventasPlaza, plazaNombre, data.zonas, data.zonaPlazas);
    const a = agregarPorPlaza(data.actual.ventasPlaza, plazaNombre, data.zonas, data.zonaPlazas);
    return {
      filas: combinar(b.filas, a.filas),
      zonas: combinar(b.zonasFilas, a.zonasFilas),
    };
  }, [data, plazaNombre]);

  const baseLabel = mesLabel(mesBase);
  const actualLabel = mesLabel(mes);

  const exportar = () => {
    const encabezado = [
      "",
      `${baseLabel} Galsa`,
      `${baseLabel} Lumaggs`,
      `${baseLabel} Total`,
      `${actualLabel} Galsa`,
      `${actualLabel} Lumaggs`,
      `${actualLabel} Total`,
      "Var. %",
    ];
    const fila = (r: FilaComparativa) => [
      r.nombre,
      r.baseGalsa,
      r.baseLumaggs,
      r.baseTotal,
      r.actualGalsa,
      r.actualLumaggs,
      r.actualTotal,
      r.variacion === null ? "n/d" : Number(r.variacion.toFixed(1)),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Persona", ...encabezado.slice(1)], ...personasComp.map(fila)]),
      "Comp. por persona"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Plaza / Zona", ...encabezado.slice(1)],
        ...plazasComp.filas.map(fila),
        [],
        ["ZONAS"],
        ...plazasComp.zonas.map(fila),
      ]),
      "Comp. por plaza"
    );
    XLSX.writeFile(
      wb,
      `Comparativo_${modo === "mes_anterior" ? "MesAnterior" : "AnioAnterior"}_${mes}.xlsx`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground font-light">
          Comparando <strong>{actualLabel}</strong> contra <strong>{baseLabel}</strong>
        </p>
        <Button size="sm" onClick={exportar} disabled={isLoading}>
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
      </div>

      <TablaComparativa
        titulo="Comparativo de ventas por persona"
        primeraColumna="Persona"
        filas={personasComp}
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
      />

      <TablaComparativa
        titulo="Comparativo de ventas por plaza y zona"
        primeraColumna="Plaza / Zona"
        filas={plazasComp.filas}
        extraFilas={plazasComp.zonas}
        extraTitulo="Zonas"
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
      />
    </div>
  );
}
