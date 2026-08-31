import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, TrendingDown, TrendingUp, Minus, RotateCcw } from "lucide-react";
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
  ventasPlazaConRespaldo,
  mesLabel,
  shiftMes,
  type FilaComparativa,
} from "./rvsAgregados";
import { FiltroChipsMulti } from "./components/FiltroChipsMulti";

const headClass =
  "bg-gradient-to-r from-indigo-100 to-sky-100 dark:from-indigo-950/40 dark:to-sky-950/40";

const fmtUds = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
const fmtPct = (n: number | null) => (n === null ? "n/d" : `${n.toFixed(0)}%`);

type Metrica = "ventas" | "unidades" | "utilidad";
type Empresa = "todas" | "galsa" | "lumaggs";
type Agrupacion = "ninguno" | "plaza" | "empresa" | "plaza_empresa";
type Col = "galsa" | "lumaggs" | "total";

const PREFS_KEY = "rvs_comparativo_prefs";
const PREFS_DEFAULT = {
  metrica: "ventas" as Metrica,
  empresa: "todas" as Empresa,
  agrupacion: "ninguno" as Agrupacion,
  plazasSel: [] as string[],
  gruposSel: [] as string[],
};

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
      {v.toFixed(0)}%
    </span>
  );
}

function Delta({ d, fmt, sufijo }: { d: number; fmt: (n: number) => string; sufijo?: string }) {
  const positivo = d >= 0;
  return (
    <span className={`font-medium ${positivo ? "text-emerald-600" : "text-destructive"}`}>
      {positivo ? "+" : "-"}
      {fmt(Math.abs(d))}
      {sufijo || ""}
    </span>
  );
}

/** Valor de una fila según periodo, empresa y métrica */
function valorFila(r: FilaComparativa, periodo: "base" | "actual", col: Col, metrica: Metrica) {
  const m = col === "galsa" ? "Galsa" : col === "lumaggs" ? "Lumaggs" : "Total";
  const prefijo = metrica === "unidades" ? `${periodo}Uds` : metrica === "utilidad" ? `${periodo}Util` : periodo;
  return Number((r as any)[`${prefijo}${m}`] || 0);
}

/** Venta $ (denominador para margen) */
function ventaFila(r: FilaComparativa, periodo: "base" | "actual", col: Col) {
  const m = col === "galsa" ? "Galsa" : col === "lumaggs" ? "Lumaggs" : "Total";
  return Number((r as any)[`${periodo}${m}`] || 0);
}

const variacion = (b: number, a: number) => (b > 0 ? ((a - b) / b) * 100 : null);

interface Linea {
  key: string;
  label: string;
  nivel: number;
  grupo: boolean;
  base: number[];
  actual: number[];
  baseVenta: number[];
  actualVenta: number[];
}

function colsDe(empresa: Empresa): Col[] {
  return empresa === "todas" ? ["galsa", "lumaggs", "total"] : [empresa];
}

function sumar(lineas: Linea[], campo: keyof Pick<Linea, "base" | "actual" | "baseVenta" | "actualVenta">, n: number) {
  const out = Array(n).fill(0);
  lineas.forEach((l) => l[campo].forEach((v, i) => (out[i] += v)));
  return out;
}

/** Claves de agrupación: "empresa" = Empresa / Grupo del personal (pestaña Personal) */
function clavesDe(agrupacion: Agrupacion): ((r: FilaComparativa) => string)[] {
  const plaza = (r: FilaComparativa) => r.plaza || "Sin plaza";
  const grupo = (r: FilaComparativa) => r.empresaGrupo || "Sin empresa / grupo";
  if (agrupacion === "plaza") return [plaza];
  if (agrupacion === "empresa") return [grupo];
  if (agrupacion === "plaza_empresa") return [plaza, grupo];
  return [];
}

/** Convierte las filas comparativas en líneas planas según la agrupación elegida */
function construirLineas(
  filas: FilaComparativa[],
  metrica: Metrica,
  empresa: Empresa,
  agrupacion: Agrupacion
): Linea[] {
  const cols = colsDe(empresa);
  const claves = clavesDe(agrupacion);

  const lineaDato = (r: FilaComparativa, nivel: number): Linea => ({
    key: r.key,
    label: r.nombre,
    nivel,
    grupo: false,
    base: cols.map((c) => valorFila(r, "base", c, metrica)),
    actual: cols.map((c) => valorFila(r, "actual", c, metrica)),
    baseVenta: cols.map((c) => ventaFila(r, "base", c)),
    actualVenta: cols.map((c) => ventaFila(r, "actual", c)),
  });

  const construir = (rows: FilaComparativa[], nivel: number, idx: number, prefijo: string): Linea[] => {
    if (idx >= claves.length) return rows.map((r) => lineaDato(r, nivel));
    const mapa = new Map<string, FilaComparativa[]>();
    rows.forEach((r) => {
      const k = claves[idx](r);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(r);
    });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .flatMap(([label, subRows]) => {
        const hijos = construir(subRows, nivel + 1, idx + 1, `${prefijo}${label}/`);
        const directos = hijos.filter((l) => l.nivel === nivel + 1);
        const encabezado: Linea = {
          key: `g:${prefijo}${label}`,
          label,
          nivel,
          grupo: true,
          base: sumar(directos, "base", cols.length),
          actual: sumar(directos, "actual", cols.length),
          baseVenta: sumar(directos, "baseVenta", cols.length),
          actualVenta: sumar(directos, "actualVenta", cols.length),
        };
        return [encabezado, ...hijos];
      });
  };

  return construir(filas, 0, 0, "");
}


function TablaComparativa({
  titulo,
  primeraColumna,
  lineas,
  cols,
  baseLabel,
  actualLabel,
  isLoading,
  metrica,
}: {
  titulo: string;
  primeraColumna: string;
  lineas: Linea[];
  cols: Col[];
  baseLabel: string;
  actualLabel: string;
  isLoading: boolean;
  metrica: Metrica;
}) {
  const esUds = metrica === "unidades";
  const fmt = esUds ? fmtUds : currency;
  const colSpanTotal = 1 + cols.length * 2 + 2;
  const iPrincipal = cols.length - 1;

  const celda = (l: Linea, periodo: "base" | "actual", i: number) => {
    const val = periodo === "base" ? l.base[i] : l.actual[i];
    const venta = periodo === "base" ? l.baseVenta[i] : l.actualVenta[i];
    return (
      <div className="leading-tight">
        <div>{fmt(val)}</div>
        {metrica === "utilidad" && (
          <div className="text-[10px] text-muted-foreground">
            {venta > 0 ? `${((val / venta) * 100).toFixed(0)}%` : "—"}
          </div>
        )}
      </div>
    );
  };

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
                <TableHead
                  colSpan={cols.length}
                  className="text-[11px] uppercase tracking-wide text-center border-l"
                >
                  {baseLabel}
                </TableHead>
                <TableHead
                  colSpan={cols.length}
                  className="text-[11px] uppercase tracking-wide text-center border-l"
                >
                  {actualLabel}
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="text-[11px] uppercase tracking-wide text-right align-bottom border-l"
                >
                  {esUds ? "Var. uds" : metrica === "utilidad" ? "Var. utilidad $" : "Var. $"}
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="text-[11px] uppercase tracking-wide text-right align-bottom"
                >
                  Var. %
                </TableHead>
              </TableRow>
              <TableRow className={headClass}>
                {cols.map((c, i) => (
                  <TableHead
                    key={`hb-${c}`}
                    className={`text-[10px] uppercase tracking-wide text-right ${i === 0 ? "border-l" : ""}`}
                  >
                    {c === "total" && cols.length === 1 ? "Valor" : c}
                  </TableHead>
                ))}
                {cols.map((c, i) => (
                  <TableHead
                    key={`ha-${c}`}
                    className={`text-[10px] uppercase tracking-wide text-right ${i === 0 ? "border-l" : ""}`}
                  >
                    {c === "total" && cols.length === 1 ? "Valor" : c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpanTotal} className="py-6 text-sm text-muted-foreground">
                    {isLoading ? "Cargando…" : "Sin datos para los periodos comparados."}
                  </TableCell>
                </TableRow>
              )}
              {lineas.map((l, i) => (
                <TableRow
                  key={l.key}
                  className={
                    l.grupo && l.nivel === 0
                      ? "bg-blue-50/60 dark:bg-blue-950/20"
                      : l.grupo
                        ? "bg-violet-50/50 dark:bg-violet-950/20"
                        : i % 2
                          ? "bg-muted/30"
                          : undefined
                  }
                >
                  <TableCell
                    className={l.grupo ? "font-semibold uppercase text-xs tracking-wide" : "font-medium"}
                    style={{ paddingLeft: 12 + l.nivel * 18 }}
                  >
                    {l.label}
                  </TableCell>
                  {cols.map((c, k) => (
                    <TableCell key={`b-${c}`} className="text-right text-muted-foreground">
                      {celda(l, "base", k)}
                    </TableCell>
                  ))}
                  {cols.map((c, k) => (
                    <TableCell key={`a-${c}`} className={`text-right ${c === "total" ? "font-semibold" : ""}`}>
                      {celda(l, "actual", k)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right border-l">
                    <div className="leading-tight">
                      <Delta d={l.actual[iPrincipal] - l.base[iPrincipal]} fmt={fmt} />
                      {metrica === "utilidad" && (
                        <div className="text-[10px] text-muted-foreground">
                          {l.baseVenta[iPrincipal] > 0 && l.actualVenta[iPrincipal] > 0
                            ? `${(
                                (l.actual[iPrincipal] / l.actualVenta[iPrincipal] -
                                  l.base[iPrincipal] / l.baseVenta[iPrincipal]) *
                                100
                              ).toFixed(0)} pp`
                            : "—"}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Variacion v={variacion(l.base[iPrincipal], l.actual[iPrincipal])} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

async function cargarPeriodo(mes: string) {
  const [ventas, ventasPlaza] = await Promise.all([
    supabase
      .from("rvs_ventas_mes")
      .select("persona_id, marca, venta, unidades, costo, utilidad, plaza_id")
      .eq("anio_mes", mes),
    supabase
      .from("rvs_ventas_mes_plaza")
      .select("plaza_id, sucursal_reporte, marca, venta, unidades, utilidad")
      .eq("anio_mes", mes),
  ]);
  if (ventas.error) throw ventas.error;
  if (ventasPlaza.error) throw ventasPlaza.error;
  return { ventas: ventas.data || [], ventasPlaza: ventasPlaza.data || [] };
}

export function ComparativoView({ mes, modo }: { mes: string; modo: "mes_anterior" | "anio_anterior" }) {
  const mesBase = useMemo(() => shiftMes(mes, modo === "mes_anterior" ? -1 : -12), [mes, modo]);

  const prefsIniciales = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...PREFS_DEFAULT, ...JSON.parse(raw) } : PREFS_DEFAULT;
    } catch {
      return PREFS_DEFAULT;
    }
  }, []);

  const [metrica, setMetrica] = useState<Metrica>(prefsIniciales.metrica);
  const [empresa, setEmpresa] = useState<Empresa>(prefsIniciales.empresa);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(prefsIniciales.agrupacion);
  const [plazasSel, setPlazasSel] = useState<string[]>(prefsIniciales.plazasSel);
  const [gruposSel, setGruposSel] = useState<string[]>(prefsIniciales.gruposSel);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ metrica, empresa, agrupacion, plazasSel, gruposSel })
      );
    } catch {
      /* almacenamiento no disponible */
    }
  }, [metrica, empresa, agrupacion, plazasSel, gruposSel]);

  const restablecer = () => {
    setMetrica(PREFS_DEFAULT.metrica);
    setEmpresa(PREFS_DEFAULT.empresa);
    setAgrupacion(PREFS_DEFAULT.agrupacion);
    setPlazasSel(PREFS_DEFAULT.plazasSel);
    setGruposSel(PREFS_DEFAULT.gruposSel);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_comparativo", mes, mesBase],
    queryFn: async () => {
      const [base, actual, personas, plazas, zonas, zonaPlazas, grupos] = await Promise.all([
        cargarPeriodo(mesBase),
        cargarPeriodo(mes),
        supabase
          .from("rvs_personas")
          .select("id, nombre_reporte, nombre_mostrar, plaza_id, empresa_grupo_id"),
        supabase.from("plazas").select("id, nombre"),
        supabase.from("zonas").select("id, nombre, is_active").eq("is_active", true),
        supabase.from("zona_plazas").select("zona_id, plaza_id"),
        supabase.from("rvs_empresas_grupo").select("id, etiqueta"),
      ]);
      const err = [personas, plazas, zonas, zonaPlazas, grupos].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        base,
        actual,
        personas: personas.data || [],
        plazas: plazas.data || [],
        zonas: zonas.data || [],
        zonaPlazas: zonaPlazas.data || [],
        grupos: grupos.data || [],
      };
    },
  });

  const plazaNombre = useMemo(() => {
    const m = new Map<string, string>();
    (data?.plazas || []).forEach((p: any) => m.set(p.id, p.nombre));
    return m;
  }, [data]);

  const grupoNombre = useMemo(() => {
    const m = new Map<string, string>();
    (data?.grupos || []).forEach((g: any) => m.set(g.id, g.etiqueta));
    return m;
  }, [data]);

  const personasComp = useMemo(() => {
    if (!data) return [];
    return combinar(
      agregarPorPersona(data.base.ventas, data.personas, plazaNombre, grupoNombre),
      agregarPorPersona(data.actual.ventas, data.personas, plazaNombre, grupoNombre)
    );
  }, [data, plazaNombre, grupoNombre]);

  const plazasComp = useMemo(() => {
    if (!data) return { filas: [] as FilaComparativa[], zonas: [] as FilaComparativa[] };
    const basePlaza = ventasPlazaConRespaldo(data.base.ventasPlaza, data.base.ventas, data.personas);
    const actualPlaza = ventasPlazaConRespaldo(data.actual.ventasPlaza, data.actual.ventas, data.personas);
    const b = agregarPorPlaza(basePlaza, plazaNombre, data.zonas, data.zonaPlazas);
    const a = agregarPorPlaza(actualPlaza, plazaNombre, data.zonas, data.zonaPlazas);
    return {
      filas: combinar(b.filas, a.filas),
      zonas: combinar(b.zonasFilas, a.zonasFilas),
    };
  }, [data, plazaNombre]);

  // Opciones disponibles para las checklistas (se construyen de los datos reales)
  const opcionesPlaza = useMemo(() => {
    const set = new Set<string>();
    personasComp.forEach((r) => set.add(r.plaza || "Sin plaza"));
    plazasComp.filas.forEach((r) => set.add(r.nombre || "Sin plaza"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [personasComp, plazasComp]);

  const opcionesGrupo = useMemo(() => {
    const set = new Set<string>();
    personasComp.forEach((r) => set.add(r.empresaGrupo || "Sin empresa / grupo"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [personasComp]);

  // Aplicación de las checklistas
  const personasFiltradas = useMemo(
    () =>
      personasComp.filter(
        (r) =>
          (plazasSel.length === 0 || plazasSel.includes(r.plaza || "Sin plaza")) &&
          (gruposSel.length === 0 || gruposSel.includes(r.empresaGrupo || "Sin empresa / grupo"))
      ),
    [personasComp, plazasSel, gruposSel]
  );

  const plazasFiltradas = useMemo(
    () =>
      plazasComp.filas.filter(
        (r) => plazasSel.length === 0 || plazasSel.includes(r.nombre || "Sin plaza")
      ),
    [plazasComp, plazasSel]
  );

  const cols = colsDe(empresa);
  // plazas y zonas no tienen Empresa / Grupo: se muestran sin agrupar
  const agrupacionPlazas: Agrupacion = "ninguno";


  const lineasPersonas = useMemo(
    () => construirLineas(personasFiltradas, metrica, empresa, agrupacion),
    [personasFiltradas, metrica, empresa, agrupacion]
  );
  const lineasPlazas = useMemo(
    () => construirLineas(plazasFiltradas, metrica, empresa, agrupacionPlazas),
    [plazasFiltradas, metrica, empresa, agrupacionPlazas]
  );
  const lineasZonas = useMemo(
    () => construirLineas(plazasComp.zonas, metrica, empresa, agrupacionPlazas),
    [plazasComp, metrica, empresa, agrupacionPlazas]
  );

  const baseLabel = mesLabel(mesBase);
  const actualLabel = mesLabel(mes);
  const metricaLabel =
    metrica === "unidades" ? "unidades" : metrica === "utilidad" ? "utilidad $" : "venta $";
  const empresaLabel = empresa === "todas" ? "" : ` · ${empresa === "galsa" ? "Galsa" : "Lumaggs"}`;

  /** Convierte líneas en filas de Excel respetando la agrupación (con niveles de esquema) */
  const hojaDe = (primeraColumna: string, bloques: { titulo?: string; lineas: Linea[] }[]) => {
    const colLabel = (c: Col) => (c === "total" && cols.length === 1 ? "Valor" : c.toUpperCase());
    const enc: any[] = [primeraColumna];
    cols.forEach((c) => enc.push(`${baseLabel} ${colLabel(c)}`));
    cols.forEach((c) => enc.push(`${actualLabel} ${colLabel(c)}`));
    enc.push(metrica === "unidades" ? "Var. uds" : metrica === "utilidad" ? "Var. utilidad $" : "Var. $");
    enc.push("Var. %");
    if (metrica === "utilidad") {
      enc.push("Var. margen (pp)");
      cols.forEach((c) => enc.push(`Margen % ${baseLabel} ${colLabel(c)}`));
      cols.forEach((c) => enc.push(`Margen % ${actualLabel} ${colLabel(c)}`));
    }
    const aoa: any[][] = [enc];
    const niveles: { level?: number }[] = [{}];
    const iPrincipal = cols.length - 1;

    bloques.forEach((b) => {
      if (b.titulo) {
        aoa.push([b.titulo.toUpperCase()]);
        niveles.push({});
      }
      b.lineas.forEach((l) => {
        const fila: any[] = [`${"    ".repeat(l.nivel)}${l.label}`];
        l.base.forEach((v) => fila.push(v));
        l.actual.forEach((v) => fila.push(v));
        fila.push(Number((l.actual[iPrincipal] - l.base[iPrincipal]).toFixed(0)));
        const v = variacion(l.base[iPrincipal], l.actual[iPrincipal]);
        fila.push(v === null ? "n/d" : Number(v.toFixed(0)));
        if (metrica === "utilidad") {
          const mb = l.baseVenta[iPrincipal] > 0 ? (l.base[iPrincipal] / l.baseVenta[iPrincipal]) * 100 : null;
          const ma = l.actualVenta[iPrincipal] > 0 ? (l.actual[iPrincipal] / l.actualVenta[iPrincipal]) * 100 : null;
          fila.push(mb === null || ma === null ? "n/d" : Number((ma - mb).toFixed(0)));
          l.base.forEach((val, i) =>
            fila.push(l.baseVenta[i] > 0 ? Number(((val / l.baseVenta[i]) * 100).toFixed(0)) : "n/d")
          );
          l.actual.forEach((val, i) =>
            fila.push(l.actualVenta[i] > 0 ? Number(((val / l.actualVenta[i]) * 100).toFixed(0)) : "n/d")
          );
        }
        aoa.push(fila);
        niveles.push(l.nivel ? { level: l.nivel } : {});
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    (ws as any)["!rows"] = niveles;
    return ws;
  };

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hojaDe("Persona", [{ lineas: lineasPersonas }]), "Por persona");
    XLSX.utils.book_append_sheet(
      wb,
      hojaDe("Plaza / Zona", [
        { lineas: lineasPlazas },
        { titulo: "Zonas", lineas: lineasZonas },
      ]),
      "Por plaza"
    );
    XLSX.writeFile(
      wb,
      `Comparativo_${metrica}_${empresa}_${agrupacion}_${
        modo === "mes_anterior" ? "MesAnterior" : "AnioAnterior"
      }_${mes}.xlsx`
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
              <TabsTrigger value="utilidad">Utilidad</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={empresa} onValueChange={(v) => setEmpresa(v as Empresa)}>
            <TabsList>
              <TabsTrigger value="todas">Ambas</TabsTrigger>
              <TabsTrigger value="galsa">Galsa</TabsTrigger>
              <TabsTrigger value="lumaggs">Lumaggs</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={agrupacion} onValueChange={(v) => setAgrupacion(v as Agrupacion)}>
            <SelectTrigger className="h-9 w-[200px] text-xs">
              <SelectValue placeholder="Agrupación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Sin agrupar</SelectItem>
              <SelectItem value="plaza">Plaza</SelectItem>
              <SelectItem value="empresa">Empresa / Grupo</SelectItem>
              <SelectItem value="plaza_empresa">Plaza → Empresa / Grupo</SelectItem>

            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={restablecer} title="Restablecer vista">
            <RotateCcw className="h-4 w-4 mr-1" /> Restablecer
          </Button>
          <Button size="sm" onClick={exportar} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <FiltroChipsMulti
          titulo="Plaza (uno, varios o todos)"
          opciones={opcionesPlaza}
          seleccion={plazasSel}
          onChange={setPlazasSel}
        />
        <FiltroChipsMulti
          titulo="Empresa / Grupo (uno, varios o todos)"
          opciones={opcionesGrupo}
          seleccion={gruposSel}
          onChange={setGruposSel}
        />
      </div>

      <TablaComparativa
        titulo={`Comparativo por persona — ${metricaLabel}${empresaLabel}`}
        primeraColumna="Persona"
        lineas={lineasPersonas}
        cols={cols}
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
        metrica={metrica}
      />

      <TablaComparativa
        titulo={`Comparativo por plaza — ${metricaLabel}${empresaLabel}`}
        primeraColumna="Plaza"
        lineas={lineasPlazas}
        cols={cols}
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
        metrica={metrica}
      />

      <TablaComparativa
        titulo={`Comparativo por zona — ${metricaLabel}${empresaLabel}`}
        primeraColumna="Zona"
        lineas={lineasZonas}
        cols={cols}
        baseLabel={baseLabel}
        actualLabel={actualLabel}
        isLoading={isLoading}
        metrica={metrica}
      />
    </div>
  );
}
