import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { esGalsa, esLumaggs, mesLabel, shiftMes } from "./rvsAgregados";

const headClass =
  "bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30";

const fmtUds = (n: number) => (n ? n.toLocaleString("es-MX", { maximumFractionDigits: 0 }) : "—");

const PREFS_KEY = "rvs_historico_prefs";

/** Variación % contra el mes previo del arreglo */
const varMes = (arr: number[], i: number) => {
  if (i === 0) return null;
  const b = arr[i - 1];
  return b > 0 ? ((arr[i] - b) / b) * 100 : null;
};

/** Variación absoluta (unidades) contra el mes previo */
const deltaMes = (arr: number[], i: number) => (i === 0 ? null : arr[i] - arr[i - 1]);

function VarPct({ v, d }: { v: number | null; d?: number | null }) {
  if (v === null && (d === null || d === undefined))
    return <div className="text-[10px] text-muted-foreground">—</div>;
  const ref = v ?? d ?? 0;
  const signo = ref >= 0 ? "+" : "";
  return (
    <div className={`text-[10px] ${ref >= 0 ? "text-emerald-600" : "text-destructive"}`}>
      {d !== null && d !== undefined
        ? `${signo}${d.toLocaleString("es-MX", { maximumFractionDigits: 0 })} uds`
        : ""}
      {d !== null && d !== undefined && v !== null ? " · " : ""}
      {v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : ""}
    </div>
  );
}

type Empresa = "todas" | "galsa" | "lumaggs";

const mesActual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/** Catálogo de meses seleccionables: 48 meses hacia atrás desde el mes actual */
function opcionesMeses(): string[] {
  const actual = mesActual();
  const out: string[] = [];
  for (let i = 0; i < 48; i++) out.push(shiftMes(actual, -i));
  return out;
}

function rangoMeses(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let cur = desde;
  let guard = 0;
  while (cur <= hasta && guard < 200) {
    out.push(cur);
    cur = shiftMes(cur, 1);
    guard++;
  }
  return out;
}

export function Historico12MesesTab() {
  const opciones = useMemo(opcionesMeses, []);
  const defDesde = useMemo(() => shiftMes(mesActual(), -5), []);
  const defHasta = useMemo(mesActual, []);

  const prefs = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);
  const [empresa, setEmpresa] = useState<Empresa>(prefs.empresa || "todas");
  const [agruparPlaza, setAgruparPlaza] = useState<boolean>(!!prefs.agruparPlaza);
  const [desde, setDesde] = useState<string>(prefs.desde || defDesde);
  const [hasta, setHasta] = useState<string>(prefs.hasta || defHasta);

  const meses = useMemo(() => {
    const d = desde <= hasta ? desde : hasta;
    const h = desde <= hasta ? hasta : desde;
    return rangoMeses(d, h);
  }, [desde, hasta]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ empresa, agruparPlaza, desde, hasta }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [empresa, agruparPlaza, desde, hasta]);

  const restablecer = () => {
    setEmpresa("todas");
    setAgruparPlaza(false);
    setDesde(defDesde);
    setHasta(defHasta);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_historico", meses[0], meses[meses.length - 1]],
    queryFn: async () => {
      const [ventas, personas, plazas] = await Promise.all([
        supabase
          .from("rvs_ventas_mes")
          .select("persona_id, marca, unidades, plaza_id, anio_mes")
          .gte("anio_mes", meses[0])
          .lte("anio_mes", meses[meses.length - 1]),
        supabase.from("rvs_personas").select("id, nombre_reporte, nombre_mostrar, plaza_id"),
        supabase.from("plazas").select("id, nombre"),
      ]);
      const err = [ventas, personas, plazas].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        ventas: (ventas.data || []) as any[],
        personas: (personas.data || []) as any[],
        plazas: (plazas.data || []) as any[],
      };
    },
  });

  type Fila = { key: string; nombre: string; plaza: string; porMes: number[]; total: number; promedio: number };

  const filas = useMemo<Fila[]>(() => {
    if (!data) return [];
    const plazaNombre = new Map<string, string>();
    data.plazas.forEach((p: any) => plazaNombre.set(p.id, p.nombre));
    const personaMap = new Map<string, any>();
    data.personas.forEach((p: any) => personaMap.set(p.id, p));
    const idxMes = new Map(meses.map((m, i) => [m, i]));

    const acc = new Map<string, Fila>();
    for (const v of data.ventas) {
      const p = personaMap.get(v.persona_id);
      if (!p) continue;
      if (empresa === "galsa" && !esGalsa(v.marca)) continue;
      if (empresa === "lumaggs" && !esLumaggs(v.marca)) continue;
      const i = idxMes.get(v.anio_mes);
      if (i === undefined) continue;
      if (!acc.has(v.persona_id)) {
        const plazaId = v.plaza_id || p.plaza_id;
        acc.set(v.persona_id, {
          key: v.persona_id,
          nombre: p.nombre_mostrar || p.nombre_reporte,
          plaza: (plazaId && plazaNombre.get(plazaId)) || "Sin plaza",
          porMes: Array(meses.length).fill(0),
          total: 0,
          promedio: 0,
        });
      }
      const row = acc.get(v.persona_id)!;
      const uds = Number(v.unidades || 0);
      row.porMes[i] += uds;
      row.total += uds;
    }
    return Array.from(acc.values())
      .map((r) => ({ ...r, promedio: meses.length ? r.total / meses.length : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [data, empresa, meses]);

  const grupos = useMemo(() => {
    if (!agruparPlaza) return null;
    const m = new Map<string, Fila[]>();
    filas.forEach((r) => {
      if (!m.has(r.plaza)) m.set(r.plaza, []);
      m.get(r.plaza)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [agruparPlaza, filas]);

  const totalesMes = useMemo(
    () => meses.map((_, i) => filas.reduce((s, r) => s + (r.porMes[i] || 0), 0)),
    [filas, meses]
  );
  const totalGeneral = totalesMes.reduce((s, n) => s + n, 0);
  const promedioGeneral = meses.length ? totalGeneral / meses.length : 0;
  const colSpanTotal = meses.length + 4;

  const periodoLabel = meses.length
    ? `${mesLabel(meses[0])} — ${mesLabel(meses[meses.length - 1])}`
    : "";

  const exportar = () => {
    const enc: any[] = ["Persona", "Plaza", "Promedio del periodo"];
    meses.forEach((m) => enc.push(mesLabel(m), `Var. uds ${mesLabel(m)}`, `Var. % ${mesLabel(m)}`));
    enc.push(`Total ${meses.length} meses`);
    const aoa: any[][] = [enc];
    const niveles: { level?: number }[] = [{}];
    const celdas = (arr: number[]) =>
      arr.flatMap((n, i) => {
        const v = varMes(arr, i);
        const d = deltaMes(arr, i);
        return [n, d === null ? "n/d" : Number(d.toFixed(0)), v === null ? "n/d" : Number(v.toFixed(0))];
      });
    const fila = (r: Fila) => [
      r.nombre,
      r.plaza,
      Number(r.promedio.toFixed(0)),
      ...celdas(r.porMes),
      r.total,
    ];
    if (grupos) {
      grupos.forEach(([plaza, rows]) => {
        aoa.push([plaza.toUpperCase()]);
        niveles.push({});
        rows.forEach((r) => {
          aoa.push(fila(r));
          niveles.push({ level: 1 });
        });
      });
    } else {
      filas.forEach((r) => {
        aoa.push(fila(r));
        niveles.push({});
      });
    }
    aoa.push([
      "TOTAL",
      "",
      Number(promedioGeneral.toFixed(0)),
      ...celdas(totalesMes),
      totalGeneral,
    ]);
    niveles.push({});
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    (ws as any)["!rows"] = niveles;
    XLSX.utils.book_append_sheet(wb, ws, "Historico unidades");
    XLSX.writeFile(
      wb,
      `RVS_Historico_${empresa === "todas" ? "Ambas" : empresa}_${meses[0]}_a_${meses[meses.length - 1]}.xlsx`
    );
  };

  const renderFila = (r: Fila, i: number) => (
    <TableRow key={r.key} className={i % 2 ? "bg-muted/30" : undefined}>
      <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-inherit">{r.nombre}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{r.plaza}</TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap border-r">
        {fmtUds(Number(r.promedio.toFixed(0)))}
      </TableCell>
      {r.porMes.map((n, k) => (
        <TableCell key={k} className="text-right leading-tight">
          <div>{fmtUds(n)}</div>
          <VarPct v={varMes(r.porMes, k)} d={deltaMes(r.porMes, k)} />
        </TableCell>
      ))}
      <TableCell className="text-right font-semibold">{fmtUds(r.total)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Periodo</span>
          <Select value={desde} onValueChange={setDesde}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {opciones.map((m) => (
                <SelectItem key={m} value={m}>
                  {mesLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">a</span>
          <Select value={hasta} onValueChange={setHasta}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {opciones.map((m) => (
                <SelectItem key={m} value={m}>
                  {mesLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground font-light">
            · {meses.length} {meses.length === 1 ? "mes" : "meses"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={empresa} onValueChange={(v) => setEmpresa(v as Empresa)}>
            <TabsList>
              <TabsTrigger value="todas">Ambas</TabsTrigger>
              <TabsTrigger value="galsa">Galsa</TabsTrigger>
              <TabsTrigger value="lumaggs">Lumaggs</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant={agruparPlaza ? "default" : "outline"}
            onClick={() => setAgruparPlaza((v) => !v)}
          >
            Agrupar por plaza
          </Button>
          <Button size="sm" variant="outline" onClick={restablecer} title="Restablecer vista">
            <RotateCcw className="h-4 w-4 mr-1" /> Restablecer
          </Button>
          <Button size="sm" onClick={exportar} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Unidades por persona — {periodoLabel}
            {empresa !== "todas" ? ` · ${empresa === "galsa" ? "Galsa" : "Lumaggs"}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={headClass}>
                  <TableHead className="text-[11px] uppercase tracking-wide sticky left-0 bg-inherit">
                    Persona
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Plaza</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right border-r whitespace-nowrap">
                    Promedio
                  </TableHead>
                  {meses.map((m) => (
                    <TableHead key={m} className="text-[10px] uppercase tracking-wide text-right whitespace-nowrap">
                      {mesLabel(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-[11px] uppercase tracking-wide text-right border-l">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colSpanTotal} className="py-6 text-sm text-muted-foreground">
                      {isLoading ? "Cargando…" : "Sin datos en el periodo seleccionado."}
                    </TableCell>
                  </TableRow>
                )}
                {!grupos && filas.map(renderFila)}
                {grupos?.map(([plaza, rows]) => (
                  <>
                    <TableRow key={`g-${plaza}`} className="bg-blue-50/60 dark:bg-blue-950/20">
                      <TableCell colSpan={colSpanTotal} className="text-xs uppercase tracking-wide font-semibold">
                        {plaza} · {fmtUds(rows.reduce((s, r) => s + r.total, 0))} uds · prom.{" "}
                        {fmtUds(
                          Number(
                            (
                              rows.reduce((s, r) => s + r.total, 0) / (meses.length || 1)
                            ).toFixed(0)
                          )
                        )}
                      </TableCell>
                    </TableRow>
                    {rows.map(renderFila)}
                  </>
                ))}
                {filas.length > 0 && (
                  <TableRow className="bg-violet-50/60 dark:bg-violet-950/20">
                    <TableCell className="font-semibold uppercase text-xs tracking-wide sticky left-0 bg-inherit">
                      Total
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold border-r">
                      {fmtUds(Number(promedioGeneral.toFixed(0)))}
                    </TableCell>
                    {totalesMes.map((n, i) => (
                      <TableCell key={i} className="text-right font-semibold leading-tight">
                        <div>{fmtUds(n)}</div>
                        <VarPct v={varMes(totalesMes, i)} d={deltaMes(totalesMes, i)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{fmtUds(totalGeneral)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
