import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_ES[(m || 1) - 1]} ${y}`;
};
const currency = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function ultimos12(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const esGalsa = (marca: string) => marca.toLowerCase().includes("galsa");
const esLumaggs = (marca: string) => marca.toLowerCase().includes("lumaggs");

export function ReportesMesTab() {
  const meses = useMemo(ultimos12, []);
  const [mes, setMes] = useState(meses[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["rvs_reportes_mes", mes],
    queryFn: async () => {
      const [ventas, ventasPlaza, personas, plazas, zonas, zonaPlazas] = await Promise.all([
        supabase.from("rvs_ventas_mes").select("persona_id, marca, venta, plaza_id").eq("anio_mes", mes),
        supabase.from("rvs_ventas_mes_plaza").select("plaza_id, sucursal_reporte, marca, venta").eq("anio_mes", mes),
        supabase.from("rvs_personas").select("id, nombre_reporte, plaza_id"),
        supabase.from("plazas").select("id, nombre"),
        supabase.from("zonas").select("id, nombre, is_active").eq("is_active", true),
        supabase.from("zona_plazas").select("zona_id, plaza_id"),
      ]);
      const err = [ventas, ventasPlaza, personas, plazas, zonas, zonaPlazas].find((r) => r.error);
      if (err?.error) throw err.error;
      return {
        ventas: (ventas.data || []) as any[],
        ventasPlaza: (ventasPlaza.data || []) as any[],
        personas: (personas.data || []) as any[],
        plazas: (plazas.data || []) as any[],
        zonas: (zonas.data || []) as any[],
        zonaPlazas: (zonaPlazas.data || []) as any[],
      };
    },
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ["rvs_reportes_intake"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_reportes_intake")
        .select("id, marca, asunto_email, estatus, error_message, fecha_recibido, anio_mes")
        .order("fecha_recibido", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });

  const plazaNombre = useMemo(() => {
    const m = new Map<string, string>();
    (data?.plazas || []).forEach((p: any) => m.set(p.id, p.nombre));
    return m;
  }, [data]);

  const porPersona = useMemo(() => {
    if (!data) return [] as { nombre: string; plaza: string; galsa: number; lumaggs: number; total: number }[];
    const personaMap = new Map<string, any>();
    data.personas.forEach((p: any) => personaMap.set(p.id, p));
    const acc = new Map<string, { nombre: string; plaza: string; galsa: number; lumaggs: number }>();
    for (const v of data.ventas) {
      const p = personaMap.get(v.persona_id);
      if (!p) continue;
      const key = v.persona_id;
      const plazaId = v.plaza_id || p.plaza_id;
      if (!acc.has(key))
        acc.set(key, {
          nombre: p.nombre_reporte,
          plaza: (plazaId && plazaNombre.get(plazaId)) || "Sin plaza",
          galsa: 0,
          lumaggs: 0,
        });
      const row = acc.get(key)!;
      const monto = Number(v.venta || 0);
      if (esGalsa(v.marca)) row.galsa += monto;
      else if (esLumaggs(v.marca)) row.lumaggs += monto;
    }
    return Array.from(acc.values())
      .map((r) => ({ ...r, total: r.galsa + r.lumaggs }))
      .sort((a, b) => b.total - a.total);
  }, [data, plazaNombre]);

  const [agruparPlaza, setAgruparPlaza] = useState(false);

  const porPlaza = useMemo(() => {
    if (!data) return { filas: [] as any[], zonasFilas: [] as any[] };
    const acc = new Map<string, { plazaId: string | null; plaza: string; galsa: number; lumaggs: number }>();
    for (const v of data.ventasPlaza) {
      const key = v.plaza_id || `sr:${v.sucursal_reporte || "Sin plaza"}`;
      if (!acc.has(key))
        acc.set(key, {
          plazaId: v.plaza_id || null,
          plaza: (v.plaza_id && plazaNombre.get(v.plaza_id)) || v.sucursal_reporte || "Sin plaza",
          galsa: 0,
          lumaggs: 0,
        });
      const row = acc.get(key)!;
      const monto = Number(v.venta || 0);
      if (esGalsa(v.marca)) row.galsa += monto;
      else if (esLumaggs(v.marca)) row.lumaggs += monto;
    }
    const filas = Array.from(acc.values())
      .map((r) => ({ ...r, total: r.galsa + r.lumaggs }))
      .sort((a, b) => b.total - a.total);

    const zonasFilas = data.zonas.map((z: any) => {
      const plazaIds = data.zonaPlazas.filter((zp: any) => zp.zona_id === z.id).map((zp: any) => zp.plaza_id);
      const incluidas = filas.filter((f) => f.plazaId && plazaIds.includes(f.plazaId));
      return {
        plaza: z.nombre,
        galsa: incluidas.reduce((s, f) => s + f.galsa, 0),
        lumaggs: incluidas.reduce((s, f) => s + f.lumaggs, 0),
        total: incluidas.reduce((s, f) => s + f.total, 0),
      };
    });
    return { filas, zonasFilas };
  }, [data, plazaNombre]);

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    const aoaPersona = [
      ["Persona", "Plaza", "Galsa", "Lumaggs", "Total"],
      ...porPersona.map((r) => [r.nombre, r.plaza, r.galsa, r.lumaggs, r.total]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaPersona), "Por persona");
    const aoaPlaza = [
      ["Plaza / Zona", "Galsa", "Lumaggs", "Total"],
      ...porPlaza.filas.map((r) => [r.plaza, r.galsa, r.lumaggs, r.total]),
      [],
      ["ZONAS"],
      ...porPlaza.zonasFilas.map((r) => [r.plaza, r.galsa, r.lumaggs, r.total]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaPlaza), "Por plaza");
    XLSX.writeFile(wb, `Reporte_Ventas_Sistema_${mes}.xlsx`);
  };

  const grupos = useMemo(() => {
    if (!agruparPlaza) return null;
    const m = new Map<string, typeof porPersona>();
    porPersona.forEach((r) => {
      if (!m.has(r.plaza)) m.set(r.plaza, []);
      m.get(r.plaza)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [agruparPlaza, porPersona]);

  const headClass = "bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30";

  const filaPersona = (r: (typeof porPersona)[number], i: number) => (
    <TableRow key={r.nombre + i} className={i % 2 ? "bg-muted/30" : undefined}>
      <TableCell className="font-medium">{r.nombre}</TableCell>
      <TableCell className="text-muted-foreground">{r.plaza}</TableCell>
      <TableCell className="text-right">{currency(r.galsa)}</TableCell>
      <TableCell className="text-right">{currency(r.lumaggs)}</TableCell>
      <TableCell className="text-right font-semibold">{currency(r.total)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="sm:max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
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
          <CardTitle className="text-base">Ventas por persona — {mesLabel(mes)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={headClass}>
                  <TableHead className="text-[11px] uppercase tracking-wide">Persona</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Plaza</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Galsa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Lumaggs</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porPersona.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                      {isLoading ? "Cargando…" : "Sin datos para este mes."}
                    </TableCell>
                  </TableRow>
                )}
                {!grupos && porPersona.map(filaPersona)}
                {grupos?.map(([plaza, filas]) => (
                  <>
                    <TableRow key={`g-${plaza}`} className="bg-blue-50/60 dark:bg-blue-950/20">
                      <TableCell colSpan={5} className="text-xs uppercase tracking-wide font-semibold">
                        {plaza} · {currency(filas.reduce((s, f) => s + f.total, 0))}
                      </TableCell>
                    </TableRow>
                    {filas.map(filaPersona)}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ventas por plaza y zona</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={headClass}>
                  <TableHead className="text-[11px] uppercase tracking-wide">Plaza / Zona</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Galsa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Lumaggs</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porPlaza.filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-muted-foreground">
                      {isLoading ? "Cargando…" : "Sin datos para este mes."}
                    </TableCell>
                  </TableRow>
                )}
                {porPlaza.filas.map((r, i) => (
                  <TableRow key={r.plaza + i} className={i % 2 ? "bg-muted/30" : undefined}>
                    <TableCell className="font-medium">{r.plaza}</TableCell>
                    <TableCell className="text-right">{currency(r.galsa)}</TableCell>
                    <TableCell className="text-right">{currency(r.lumaggs)}</TableCell>
                    <TableCell className="text-right font-semibold">{currency(r.total)}</TableCell>
                  </TableRow>
                ))}
                {porPlaza.zonasFilas.map((r) => (
                  <TableRow key={`z-${r.plaza}`} className="bg-violet-50/60 dark:bg-violet-950/20">
                    <TableCell className="font-semibold uppercase text-xs tracking-wide">{r.plaza}</TableCell>
                    <TableCell className="text-right">{currency(r.galsa)}</TableCell>
                    <TableCell className="text-right">{currency(r.lumaggs)}</TableCell>
                    <TableCell className="text-right font-semibold">{currency(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {vista !== "mensual" && (
        <ComparativoView mes={mes} modo={vista === "vs_mes" ? "mes_anterior" : "anio_anterior"} />
      )}



      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos reportes recibidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={headClass}>
                  <TableHead className="text-[11px] uppercase tracking-wide">Recibido</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Marca</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Asunto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Estatus</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intakes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-sm text-muted-foreground">
                      Aún no se reciben reportes.
                    </TableCell>
                  </TableRow>
                )}
                {intakes.map((r: any, i: number) => (
                  <TableRow key={r.id} className={i % 2 ? "bg-muted/30" : undefined}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.fecha_recibido).toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell>{r.marca || "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{r.asunto_email || "—"}</TableCell>
                    <TableCell>
                      {r.estatus === "procesado" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Procesado</Badge>
                      ) : r.estatus === "error" ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[280px] truncate">
                      {r.error_message || ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
