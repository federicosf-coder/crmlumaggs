import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageBanner } from "@/components/PageBanner";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useVentasCharts } from "@/hooks/useVentasCharts";
import type { EmpresaVendedora } from "@/hooks/useSeguimientoVentas";

const PALETTES: Record<EmpresaVendedora, { bar: string; bars: string[]; ring: string; text: string }> = {
  lumaggs_chevron: {
    bar: "#2563eb",
    bars: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#0ea5e9", "#0284c7"],
    ring: "border-blue-200",
    text: "text-blue-900",
  },
  galsa_phillips66: {
    bar: "#dc2626",
    bars: ["#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#f43f5e", "#e11d48"],
    ring: "border-red-200",
    text: "text-red-900",
  },
};

function VentasChartsSection({ empresa, label }: { empresa: EmpresaVendedora; label: string }) {
  const { data, isLoading } = useVentasCharts(empresa);
  const palette = PALETTES[empresa];

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">Cargando gráficas de {label}…</div>
    );
  }
  if (!data || data.total === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">Sin ventas registradas para {label}.</div>
    );
  }

  const plazaData = [{ plaza: "Total", unidades: data.total }, ...data.porPlaza];

  // Build stacked dataset: rows = plazas, keys = ejecutivos
  const ejecutivosSet = new Set<string>();
  data.porPlazaEjecutivo.forEach(p => p.ejecutivos.forEach(e => ejecutivosSet.add(e.nombre)));
  const ejecutivos = Array.from(ejecutivosSet);
  const stackedData = data.porPlazaEjecutivo.map(p => {
    const row: Record<string, any> = { plaza: p.plaza };
    p.ejecutivos.forEach(e => { row[e.nombre] = e.unidades; });
    return row;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2 mt-4">
      <Card className={`border ${palette.ring}`}>
        <CardContent className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${palette.text}`}>Unidades vendidas — Total y por plaza</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plazaData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="plaza" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("es-MX")} />
                <Bar dataKey="unidades" fill={palette.bar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className={`border ${palette.ring}`}>
        <CardContent className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${palette.text}`}>Unidades por plaza y ejecutivo</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="plaza" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("es-MX")} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {ejecutivos.map((nombre, i) => (
                  <Bar key={nombre} dataKey={nombre} stackId="a" fill={palette.bars[i % palette.bars.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SeguimientoLanding() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageBanner
        title="Seguimiento a Ventas"
        description="Selecciona la marca para dar seguimiento a tus clientes"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        }
      />
      <section>
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-2 border-blue-200 hover:border-blue-400 bg-gradient-to-r from-blue-50/80 via-white to-sky-50/60"
          onClick={() => navigate("/seguimiento/chevron")}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-blue-600 font-bold">C</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-blue-900 leading-tight">Chevron</h2>
              <p className="text-xs text-blue-600/80 font-medium">Lumaggs</p>
            </div>
          </CardContent>
        </Card>
        <VentasChartsSection empresa="lumaggs_chevron" label="Chevron" />
      </section>
      <section>
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-2 border-red-200 hover:border-red-400 bg-gradient-to-r from-red-50/80 via-white to-rose-50/60"
          onClick={() => navigate("/seguimiento/phillips66")}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <span className="text-red-600 font-bold">P66</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-red-900 leading-tight">Phillips 66</h2>
              <p className="text-xs text-red-600/80 font-medium">Galsa</p>
            </div>
          </CardContent>
        </Card>
        <VentasChartsSection empresa="galsa_phillips66" label="Phillips 66" />
      </section>
    </div>
  );
}