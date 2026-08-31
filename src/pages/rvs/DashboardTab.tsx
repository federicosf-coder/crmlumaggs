import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Download,
  DollarSign,
  TrendingUp,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Loader2,
  Package,
} from "lucide-react";
import {
  agregarPorPlaza,
  ventasPlazaConRespaldo,
  currency,
  mesLabel,
  shiftMes,
} from "./rvsAgregados";

const PALETA = [
  "#2563eb", // azul
  "#10b981", // esmeralda
  "#f59e0b", // ámbar
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#06b6d4", // cian
  "#f97316", // naranja
  "#6366f1", // índigo
  "#84cc16", // lima
  "#ef4444", // rojo
];

const uds = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 });

function ultimos12(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function cargarMes(mes: string) {
  const [ventasPlaza, ventas, personas, plazas, zonas, zonaPlazas] = await Promise.all([
    supabase
      .from("rvs_ventas_mes_plaza")
      .select("plaza_id, sucursal_reporte, marca, unidades, venta, costo, utilidad")
      .eq("anio_mes", mes),
    supabase
      .from("rvs_ventas_mes")
      .select("persona_id, marca, venta, unidades, costo, utilidad, plaza_id")
      .eq("anio_mes", mes),
    supabase.from("rvs_personas").select("id, plaza_id"),
    supabase.from("plazas").select("id, nombre"),
    supabase.from("zonas").select("id, nombre, is_active").eq("is_active", true),
    supabase.from("zona_plazas").select("zona_id, plaza_id"),
  ]);
  const err = [ventasPlaza, ventas, personas, plazas, zonas, zonaPlazas].find((r) => r.error);
  if (err?.error) throw err.error;

  const plazaNombre = new Map<string, string>(
    ((plazas.data || []) as any[]).map((p) => [p.id, p.nombre])
  );
  const filasPlaza = ventasPlazaConRespaldo(
    (ventasPlaza.data || []) as any[],
    (ventas.data || []) as any[],
    (personas.data || []) as any[]
  );
  const { filas } = agregarPorPlaza(
    filasPlaza,
    plazaNombre,
    (zonas.data || []) as any[],
    (zonaPlazas.data || []) as any[]
  );
  return filas;
}

interface KpiCardProps {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: React.ReactNode;
  clase: string;
  onClick?: () => void;
}

function KpiCard({ titulo, valor, detalle, icono, clase, onClick }: KpiCardProps) {
  return (
    <Card
      className={`border-border/60 shadow-sm ${clase} ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{titulo}</p>
          {icono}
        </div>
        <p className="mt-2 text-2xl font-light tracking-tight">{valor}</p>
        {detalle && <p className="text-xs font-light opacity-80">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

interface DatosMarca {
  ventaTotal: number;
  unidadesTotal: number;
  utilidadTotal: number;
  margen: number;
  ventaPrevia: number;
  variacion: number | null;
  chartData: { nombre: string; venta: number; color: string }[];
}

interface BloqueMarcaProps {
  titulo: string;
  datos: DatosMarca;
  headerClase: string;
  kpiClases: { venta: string; unidades: string; utilidad: string; margen: string };
  iconoClase: string;
  mesLabelTexto: string;
  isLoading: boolean;
}

function BloqueMarca({
  titulo,
  datos,
  headerClase,
  kpiClases,
  iconoClase,
  mesLabelTexto,
  isLoading,
}: BloqueMarcaProps) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className={`${headerClase} border-b border-border/40 py-3`}>
        <CardTitle className="text-sm font-light tracking-tight">
          {titulo} — {mesLabelTexto}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            titulo="Venta total"
            valor={currency(datos.ventaTotal)}
            icono={<DollarSign className={`h-4 w-4 ${iconoClase}`} />}
            clase={kpiClases.venta}
          />
          <KpiCard
            titulo="Unidades totales"
            valor={uds(datos.unidadesTotal)}
            icono={<Package className={`h-4 w-4 ${iconoClase}`} />}
            clase={kpiClases.unidades}
          />
          <KpiCard
            titulo="Utilidad total"
            valor={currency(datos.utilidadTotal)}
            icono={<TrendingUp className={`h-4 w-4 ${iconoClase}`} />}
            clase={kpiClases.utilidad}
          />
          <KpiCard
            titulo="Margen promedio"
            valor={`${datos.margen.toFixed(0)}%`}
            icono={<Percent className={`h-4 w-4 ${iconoClase}`} />}
            clase={kpiClases.margen}
          />
          <KpiCard
            titulo="Variación vs. mes anterior"
            valor={
              datos.variacion === null
                ? "—"
                : `${datos.variacion >= 0 ? "+" : ""}${datos.variacion.toFixed(0)}%`
            }
            detalle={datos.ventaPrevia > 0 ? `Anterior: ${currency(datos.ventaPrevia)}` : "Sin mes anterior"}
            icono={
              datos.variacion !== null && datos.variacion < 0 ? (
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              )
            }
            clase="bg-slate-50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : datos.chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin datos para este mes.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datos.chartData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="nombre"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => currency(Number(v))}
                width={90}
              />
              <Tooltip
                formatter={(v: any) => [currency(Number(v)), "Venta"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="venta" radius={[6, 6, 0, 0]}>
                {datos.chartData.map((d) => (
                  <Cell key={d.nombre} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ onIrAPersonal }: { onIrAPersonal?: () => void } = {}) {
  const meses = useMemo(ultimos12, []);
  const [mes, setMes] = useState(meses[0]);
  const [descargando, setDescargando] = useState(false);


  const actualQuery = useQuery({
    queryKey: ["rvs_dashboard_mes", mes],
    queryFn: () => cargarMes(mes),
  });
  const previoQuery = useQuery({
    queryKey: ["rvs_dashboard_mes", shiftMes(mes, -1)],
    queryFn: () => cargarMes(shiftMes(mes, -1)),
  });

  const pendientesQuery = useQuery({
    queryKey: ["rvs_dashboard_pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_personas")
        .select("id")
        .or("sin_clasificar.eq.true,requiere_verificacion.eq.true");
      if (error) throw error;
      return (data || []).length;
    },
  });

  const filas = actualQuery.data || [];
  const filasPrevias = previoQuery.data || [];

  const datosMarca = (marca: "galsa" | "lumaggs") => {
    const ventaTotal = filas.reduce((s, f) => s + f[marca], 0);
    const unidadesTotal = filas.reduce(
      (s, f) => s + (marca === "galsa" ? f.udsGalsa : f.udsLumaggs),
      0
    );
    const utilidadTotal = filas.reduce(
      (s, f) => s + (marca === "galsa" ? f.utilGalsa : f.utilLumaggs),
      0
    );
    const margen = ventaTotal > 0 ? (utilidadTotal / ventaTotal) * 100 : 0;
    const ventaPrevia = filasPrevias.reduce((s, f) => s + f[marca], 0);
    const variacion = ventaPrevia > 0 ? ((ventaTotal - ventaPrevia) / ventaPrevia) * 100 : null;
    const chartData = filas
      .filter((f) => f[marca] !== 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((f, i) => ({
        nombre: f.nombre,
        venta: Math.round(f[marca]),
        color: PALETA[i % PALETA.length],
      }));
    return { ventaTotal, unidadesTotal, utilidadTotal, margen, ventaPrevia, variacion, chartData };
  };

  const galsaData = useMemo(
    () => datosMarca("galsa"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, filasPrevias]
  );
  const lumaggsData = useMemo(
    () => datosMarca("lumaggs"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, filasPrevias]
  );

  const descargarHistorico = async () => {
    setDescargando(true);
    try {
      const [ventas, ventasPlaza, personas, plazas, grupos, puestos] = await Promise.all([
        supabase
          .from("rvs_ventas_mes")
          .select("persona_id, anio_mes, marca, unidades, venta, costo, utilidad, margen, plaza_id")
          .order("anio_mes", { ascending: false }),
        supabase
          .from("rvs_ventas_mes_plaza")
          .select(
            "plaza_id, sucursal_reporte, anio_mes, marca, unidades, venta, costo, utilidad, margen"
          )
          .order("anio_mes", { ascending: false }),
        supabase
          .from("rvs_personas")
          .select("id, nombre_reporte, nombre_mostrar, empresa_grupo_id, puesto_id, plaza_id"),
        supabase.from("plazas").select("id, nombre"),
        supabase.from("rvs_empresas_grupo").select("id, etiqueta"),
        supabase.from("rvs_puestos").select("id, etiqueta"),
      ]);
      const err = [ventas, ventasPlaza, personas, plazas, grupos, puestos].find((r) => r.error);
      if (err?.error) throw err.error;

      const plazaNombre = new Map<string, string>(
        ((plazas.data || []) as any[]).map((p) => [p.id, p.nombre])
      );
      const grupoNombre = new Map<string, string>(
        ((grupos.data || []) as any[]).map((g) => [g.id, g.etiqueta])
      );
      const puestoNombre = new Map<string, string>(
        ((puestos.data || []) as any[]).map((p) => [p.id, p.etiqueta])
      );
      const personaMap = new Map<string, any>(
        ((personas.data || []) as any[]).map((p) => [p.id, p])
      );

      const margenDe = (r: any) => {
        const v = Number(r.venta || 0);
        if (r.margen !== null && r.margen !== undefined) return Math.round(Number(r.margen));
        return v > 0 ? Math.round((Number(r.utilidad || 0) / v) * 100) : 0;
      };

      const hoja1 = ((ventas.data || []) as any[]).map((r) => {
        const p = personaMap.get(r.persona_id);
        const plazaId = r.plaza_id || p?.plaza_id;
        return {
          Persona: p?.nombre_mostrar || p?.nombre_reporte || "Sin persona",
          "Empresa/Grupo": (p?.empresa_grupo_id && grupoNombre.get(p.empresa_grupo_id)) || "",
          Puesto: (p?.puesto_id && puestoNombre.get(p.puesto_id)) || "",
          Plaza: (plazaId && plazaNombre.get(plazaId)) || "Sin plaza",
          "Año-Mes": r.anio_mes,
          Marca: r.marca,
          Unidades: Math.round(Number(r.unidades || 0)),
          Venta: Math.round(Number(r.venta || 0)),
          Costo: Math.round(Number(r.costo || 0)),
          Utilidad: Math.round(Number(r.utilidad || 0)),
          Margen: margenDe(r),
        };
      });

      const hoja2 = ((ventasPlaza.data || []) as any[]).map((r) => ({
        "Sucursal/Plaza":
          (r.plaza_id && plazaNombre.get(r.plaza_id)) || r.sucursal_reporte || "Sin plaza",
        "Año-Mes": r.anio_mes,
        Marca: r.marca,
        Unidades: Math.round(Number(r.unidades || 0)),
        Venta: Math.round(Number(r.venta || 0)),
        Costo: Math.round(Number(r.costo || 0)),
        Utilidad: Math.round(Number(r.utilidad || 0)),
        Margen: margenDe(r),
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja1), "Ventas por persona");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja2), "Ventas por sucursal");
      XLSX.writeFile(wb, `RVS_Historico_Completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Histórico descargado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo descargar el histórico");
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-full sm:w-56 border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/40">
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
        <Button
          size="sm"
          variant="outline"
          disabled={descargando}
          onClick={descargarHistorico}
          className="border-indigo-200 bg-gradient-to-r from-indigo-100 to-sky-100 text-indigo-700 hover:from-indigo-200 hover:to-sky-200 hover:text-indigo-800 text-[10px] font-semibold uppercase tracking-widest"
        >
          {descargando ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          Descargar histórico completo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          titulo="Venta total del mes"
          valor={currency(ventaTotal)}
          detalle={`${uds(unidadesTotal)} unidades`}
          icono={<DollarSign className="h-4 w-4 text-blue-600" />}
          clase="bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
        />
        <KpiCard
          titulo="Utilidad total"
          valor={currency(utilidadTotal)}
          icono={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          clase="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
        />
        <KpiCard
          titulo="Margen promedio"
          valor={`${margen.toFixed(0)}%`}
          icono={<Percent className="h-4 w-4 text-violet-600" />}
          clase="bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100"
        />
        <KpiCard
          titulo="Variación vs. mes anterior"
          valor={variacion === null ? "—" : `${variacion >= 0 ? "+" : ""}${variacion.toFixed(0)}%`}
          detalle={ventaPrevia > 0 ? `Anterior: ${currency(ventaPrevia)}` : "Sin mes anterior"}
          icono={
            variacion !== null && variacion < 0 ? (
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            )
          }
          clase="bg-pink-50 dark:bg-pink-950/30 text-pink-900 dark:text-pink-100"
        />
        <KpiCard
          titulo="Personas por clasificar"
          valor={uds(pendientesQuery.data || 0)}
          detalle="Ir a la pestaña Personal"
          icono={<Users className="h-4 w-4 text-amber-600" />}
          clase="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
          onClick={onIrAPersonal}
        />
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-100 to-sky-100 dark:from-indigo-950/40 dark:to-sky-950/40 border-b border-border/40 py-3">
          <CardTitle className="text-sm font-light tracking-tight">
            Venta por plaza — {mesLabel(mes)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {actualQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Sin datos para este mes.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="nombre"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={60}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => currency(Number(v))}
                  width={90}
                />
                <Tooltip
                  formatter={(v: any) => [currency(Number(v)), "Venta"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="venta" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.nombre} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
