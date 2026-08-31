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
import { esGalsa, esLumaggs, mesLabel, shiftMes } from "./rvsAgregados";

const headClass =
  "bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30";

const fmtUds = (n: number) => (n ? n.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : "—");

type Empresa = "todas" | "galsa" | "lumaggs";

function ultimos12Meses(): string[] {
  const now = new Date();
  const actual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) out.push(shiftMes(actual, -i));
  return out;
}

export function Historico12MesesTab() {
  const meses = useMemo(ultimos12Meses, []);
  const [empresa, setEmpresa] = useState<Empresa>("todas");
  const [agruparPlaza, setAgruparPlaza] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_historico_12m", meses[0], meses[11]],
    queryFn: async () => {
      const [ventas, personas, plazas] = await Promise.all([
        supabase
          .from("rvs_ventas_mes")
          .select("persona_id, marca, unidades, plaza_id, anio_mes")
          .gte("anio_mes", meses[0])
          .lte("anio_mes", meses[11]),
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

  const filas = useMemo(() => {
    if (!data) return [] as { key: string; nombre: string; plaza: string; porMes: number[]; total: number }[];
    const plazaNombre = new Map<string, string>();
    data.plazas.forEach((p: any) => plazaNombre.set(p.id, p.nombre));
    const personaMap = new Map<string, any>();
    data.personas.forEach((p: any) => personaMap.set(p.id, p));
    const idxMes = new Map(meses.map((m, i) => [m, i]));

    const acc = new Map<string, { key: string; nombre: string; plaza: string; porMes: number[]; total: number }>();
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
          porMes: Array(12).fill(0),
          total: 0,
        });
      }
      const row = acc.get(v.persona_id)!;
      const uds = Number(v.unidades || 0);
      row.porMes[i] += uds;
      row.total += uds;
    }
    return Array.from(acc.values()).sort((a, b) => b.total - a.total);
  }, [data, empresa, meses]);

  const grupos = useMemo(() => {
    if (!agruparPlaza) return null;
    const m = new Map<string, typeof filas>();
    filas.forEach((r) => {
      if (!m.has(r.plaza)) m.set(r.plaza, []);
      m.get(r.plaza)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [agruparPlaza, filas]);

  const totalesMes = useMemo(
    () => meses.map((_, i) => filas.reduce((s, r) => s + r.porMes[i], 0)),
    [filas, meses]
  );

  const exportar = () => {
    const enc = ["Persona", "Plaza", ...meses.map(mesLabel), "Total 12 meses"];
    const aoa: any[][] = [enc];
    const fila = (r: (typeof filas)[number]) => [r.nombre, r.plaza, ...r.porMes, r.total];
    if (grupos) {
      grupos.forEach(([plaza, rows]) => {
        aoa.push([plaza.toUpperCase()]);
        rows.forEach((r) => aoa.push(fila(r)));
      });
    } else {
      filas.forEach((r) => aoa.push(fila(r)));
    }
    aoa.push(["TOTAL", "", ...totalesMes, totalesMes.reduce((s, n) => s + n, 0)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Unidades 12 meses");
    XLSX.writeFile(
      wb,
      `RVS_Unidades_12meses_${empresa === "todas" ? "Ambas" : empresa}_${meses[11]}.xlsx`
    );
  };

  const renderFila = (r: (typeof filas)[number], i: number) => (
    <TableRow key={r.key} className={i % 2 ? "bg-muted/30" : undefined}>
      <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-inherit">{r.nombre}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{r.plaza}</TableCell>
      {r.porMes.map((n, k) => (
        <TableCell key={k} className="text-right">
          {fmtUds(n)}
        </TableCell>
      ))}
      <TableCell className="text-right font-semibold">{fmtUds(r.total)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground font-light">
          Unidades por persona · {mesLabel(meses[0])} — {mesLabel(meses[11])}
        </p>
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
          <Button size="sm" onClick={exportar} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Unidades por persona — últimos 12 meses
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
                    <TableCell colSpan={15} className="py-6 text-sm text-muted-foreground">
                      {isLoading ? "Cargando…" : "Sin datos en los últimos 12 meses."}
                    </TableCell>
                  </TableRow>
                )}
                {!grupos && filas.map(renderFila)}
                {grupos?.map(([plaza, rows]) => (
                  <>
                    <TableRow key={`g-${plaza}`} className="bg-blue-50/60 dark:bg-blue-950/20">
                      <TableCell colSpan={15} className="text-xs uppercase tracking-wide font-semibold">
                        {plaza} · {fmtUds(rows.reduce((s, r) => s + r.total, 0))} uds
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
                    {totalesMes.map((n, i) => (
                      <TableCell key={i} className="text-right font-semibold">
                        {fmtUds(n)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">
                      {fmtUds(totalesMes.reduce((s, n) => s + n, 0))}
                    </TableCell>
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
