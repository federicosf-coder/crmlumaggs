import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const fmtUds = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

type Metrica = "ventas" | "unidades";

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
  metrica,
}: {
  titulo: string;
  primeraColumna: string;
  filas: FilaComparativa[];
  baseLabel: string;
  actualLabel: string;
  isLoading: boolean;
  extraFilas?: FilaComparativa[];
  extraTitulo?: string;
  metrica: Metrica;
}) {
  const esUds = metrica === "unidades";
  const fmt = esUds ? fmtUds : currency;

  const val = (r: FilaComparativa, periodo: "base" | "actual", marca: "galsa" | "lumaggs" | "total") => {
    const p = periodo === "base" ? "base" : "actual";
    const m = marca === "galsa" ? "Galsa" : marca === "lumaggs" ? "Lumaggs" : "Total";
    const key = esUds
      ? (`${p}Uds${m}` as keyof FilaComparativa)
      : (`${p}${m}` as keyof FilaComparativa);
    return r[key] as number;
  };

  const renderFila = (r: FilaComparativa, i: number, destacado?: boolean) => (
    <TableRow
      key={r.key}
      className={destacado ? "bg-violet-50/60 dark:bg-violet-950/20" : i % 2 ? "bg-muted/30" : undefined}
    >
      <TableCell className={destacado ? "font-semibold uppercase text-xs tracking-wide" : "font-medium"}>
        {r.nombre}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">{fmt(val(r, "base", "galsa"))}</TableCell>
      <TableCell className="text-right text-muted-foreground">{fmt(val(r, "base", "lumaggs"))}</TableCell>
      <TableCell className="text-right text-muted-foreground font-medium">{fmt(val(r, "base", "total"))}</TableCell>
      <TableCell className="text-right">{fmt(val(r, "actual", "galsa"))}</TableCell>
      <TableCell className="text-right">{fmt(val(r, "actual", "lumaggs"))}</TableCell>
      <TableCell className="text-right font-semibold">{fmt(val(r, "actual", "total"))}</TableCell>
      <TableCell className="text-right">
        <Variacion v={esUds ? r.variacionUds : r.variacion} />
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

/** Sub-filas por empresa (Galsa/Lumaggs) dentro de cada plaza */
interface FilaPlazaEmpresa {
  key: string;
  plaza: string;
  empresa: "GALSA" | "LUMAGGS";
  base: number;
  actual: number;
  baseUds: number;
  actualUds: number;
  variacion: number | null;
  variacionUds: number | null;
}

function construirPlazaEmpresa(filas: FilaComparativa[]): FilaPlazaEmpresa[] {
  const out: FilaPlazaEmpresa[] = [];
  for (const f of filas) {
    out.push({
      key: `${f.key}:galsa`,
      plaza: f.nombre,
      empresa: "GALSA",
      base: f.baseGalsa,
      actual: f.actualGalsa,
      baseUds: f.baseUdsGalsa,
      actualUds: f.actualUdsGalsa,
      variacion: f.baseGalsa > 0 ? ((f.actualGalsa - f.baseGalsa) / f.baseGalsa) * 100 : null,
      variacionUds: f.baseUdsGalsa > 0 ? ((f.actualUdsGalsa - f.baseUdsGalsa) / f.baseUdsGalsa) * 100 : null,
    });
    out.push({
      key: `${f.key}:lumaggs`,
      plaza: f.nombre,
      empresa: "LUMAGGS",
      base: f.baseLumaggs,
      actual: f.actualLumaggs,
      baseUds: f.baseUdsLumaggs,
      actualUds: f.actualUdsLumaggs,
      variacion: f.baseLumaggs > 0 ? ((f.actualLumaggs - f.baseLumaggs) / f.baseLumaggs) * 100 : null,
      variacionUds:
        f.baseUdsLumaggs > 0 ? ((f.actualUdsLumaggs - f.baseUdsLumaggs) / f.baseUdsLumaggs) * 100 : null,
    });
  }
  return out;
}

async function cargarPeriodo(mes: string) {
  const [ventas, ventasPlaza] = await Promise.all([
    supabase
      .from("rvs_ventas_mes")
      .select("persona_id, marca, venta, unidades, plaza_id")
      .eq("anio_mes", mes),
    supabase
      .from("rvs_ventas_mes_plaza")
      .select("plaza_id, sucursal_reporte, marca, venta, unidades")
      .eq("anio_mes", mes),
  ]);
  if (ventas.error) throw ventas.error;
  if (ventasPlaza.error) throw ventasPlaza.error;
  return { ventas: ventas.data || [], ventasPlaza: ventasPlaza.data || [] };
}

export function ComparativoView({ mes, modo }: { mes: string; modo: "mes_anterior" | "anio_anterior" }) {
  const mesBase = useMemo(() => shiftMes(mes, modo === "mes_anterior" ? -1 : -12), [mes, modo]);
  const [metrica, setMetrica] = useState<Metrica>("ventas");

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

  const plazaEmpresaFilas = useMemo(
    () => construirPlazaEmpresa(plazasComp.filas),
    [plazasComp]
  );

  const baseLabel = mesLabel(mesBase);
  const actualLabel = mesLabel(mes);
  const esUds = metrica === "unidades";

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
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Plaza", "Empresa", `${baseLabel} $`, `${actualLabel} $`, "Var. % $", `${baseLabel} Uds`, `${actualLabel} Uds`, "Var. % Uds"],
        ...plazaEmpresaFilas.map((r) => [
          r.plaza,
          r.empresa,
          r.base,
          r.actual,
          r.variacion === null ? "n/d" : Number(r.variacion.toFixed(1)),
          r.baseUds,
          r.actualUds,
          r.variacionUds === null ? "n/d" : Number(r.variacionUds.toFixed(1)),
        ]),
      ]),
      "Plaza x empresa"
    );
    XLSX.writeFile(
      wb,
      `Comparativo_${modo === "mes_anterior" ? "MesAnterior" : "AnioAnterior"}_${mes}.xlsx`
    );
  };

  /** Exporta un comparativo filtrado a una sola marca (Galsa o Lumaggs), con ventas y unidades */
  const exportarMarca = (marca: "galsa" | "lumaggs") => {
    const g = marca === "galsa";
    const etiqueta = g ? "GALSA" : "LUMAGGS";
    const fila = (r: FilaComparativa) => [
      r.nombre,
      g ? r.baseUdsGalsa : r.baseUdsLumaggs,
      g ? r.actualUdsGalsa : r.actualUdsLumaggs,
      g ? r.baseGalsa : r.baseLumaggs,
      g ? r.actualGalsa : r.actualLumaggs,
      (() => {
        const bv = g ? r.baseGalsa : r.baseLumaggs;
        const av = g ? r.actualGalsa : r.actualLumaggs;
        const v = bv > 0 ? ((av - bv) / bv) * 100 : null;
        return v === null ? "n/d" : Number(v.toFixed(1));
      })(),
    ];
    const enc = [
      "Nombre",
      `Uds ${baseLabel}`,
      `Uds ${actualLabel}`,
      `$ ${baseLabel}`,
      `$ ${actualLabel}`,
      "Var. % $",
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([enc, ...personasComp.map(fila)]),
      `${etiqueta} por persona`
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        enc,
        ...plazasComp.filas.map(fila),
        [],
        ["ZONAS"],
        ...plazasComp.zonas.map(fila),
      ]),
      `${etiqueta} por plaza`
    );
    XLSX.writeFile(
      wb,
      `Comparativo_${etiqueta}_${modo === "mes_anterior" ? "MesAnterior" : "AnioAnterior"}_${mes}.xlsx`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground font-light">
          Comparando <strong>{actualLabel}</strong> contra <strong>{baseLabel}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
            <TabsList>
              <TabsTrigger value="ventas">Ventas $</TabsTrigger>
              <TabsTrigger value="unidades">Unidades</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={() => exportarMarca("galsa")} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Excel Galsa
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportarMarca("lumaggs")} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Excel Lumaggs
          </Button>
          <Button size="sm" onClick={exportar} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <TablaComparativa
        titulo={`Comparativo de ventas por persona — ${esUds ? "unidades" : "venta $"}`}
        primeraColumna="Persona"
        filas={personasComp}
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
        metrica={metrica}
      />

      <TablaComparativa
        titulo={`Comparativo de ventas por plaza y zona — ${esUds ? "unidades" : "venta $"}`}
        primeraColumna="Plaza / Zona"
        filas={plazasComp.filas}
        extraFilas={plazasComp.zonas}
        extraTitulo="Zonas"
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
        metrica={metrica}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Comparativo por plaza agrupado por empresa — {esUds ? "unidades" : "venta $"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={headClass}>
                  <TableHead className="text-[11px] uppercase tracking-wide">Empresa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">{baseLabel}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">{actualLabel}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Var. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plazaEmpresaFilas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-muted-foreground">
                      {isLoading ? "Cargando…" : "Sin datos para los periodos comparados."}
                    </TableCell>
                  </TableRow>
                )}
                {(() => {
                  const grupos = new Map<string, FilaPlazaEmpresa[]>();
                  plazaEmpresaFilas.forEach((r) => {
                    if (!grupos.has(r.plaza)) grupos.set(r.plaza, []);
                    grupos.get(r.plaza)!.push(r);
                  });
                  return Array.from(grupos.entries()).map(([plaza, filas]) => {
                    const totBase = filas.reduce((s, f) => s + (esUds ? f.baseUds : f.base), 0);
                    const totActual = filas.reduce((s, f) => s + (esUds ? f.actualUds : f.actual), 0);
                    const fmt = esUds ? fmtUds : currency;
                    return (
                      <>
                        <TableRow key={`g-${plaza}`} className="bg-blue-50/60 dark:bg-blue-950/20">
                          <TableCell colSpan={4} className="text-xs uppercase tracking-wide font-semibold">
                            {plaza} · {fmt(totBase)} → {fmt(totActual)}
                          </TableCell>
                        </TableRow>
                        {filas.map((r) => (
                          <TableRow key={r.key}>
                            <TableCell className="pl-6 font-medium">{r.empresa}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {fmt(esUds ? r.baseUds : r.base)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {fmt(esUds ? r.actualUds : r.actual)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Variacion v={esUds ? r.variacionUds : r.variacion} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
