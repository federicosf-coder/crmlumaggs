import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/PageBanner";
import { cn } from "@/lib/utils";
import { Truck, FileText, ListChecks, TrendingUp, PieChart, Search, CreditCard, ShieldCheck } from "lucide-react";

const CATEGORIAS = ["Todos", "Ventas", "Crédito", "Operación"] as const;

const REPORTS = [
  {
    title: "Reporte Diario Entregas Básico",
    description: "Desempeño diario por repartidor: entregas, horas, km y score.",
    url: "/reports/daily-delivery",
    icon: Truck,
    category: "Operación",
  },
  {
    title: "Reporte Diario de Actividades",
    description: "Resumen de texto para correo: actividades, cotizaciones y prospectos del día.",
    url: "/reports/daily-activity",
    icon: FileText,
    category: "Operación",
  },
  {
    title: "Desglose de Facturas con Unidades",
    description: "Detalle de facturas del mes por producto, para verificar que todas estén cuantificadas correctamente.",
    url: "/reports/desglose-facturas",
    icon: ListChecks,
    category: "Ventas",
  },
  {
    title: "Ventas Delo XLE 15W40 — Comparativo Mensual",
    description: "Unidades equivalentes por mes de las 5 presentaciones de Delo XLE 15W40, últimos 12 meses.",
    url: "/reports/delo-xle-15w40",
    icon: TrendingUp,
    category: "Ventas",
  },
  {
    title: "Análisis 80/20 — Presentaciones Más Vendidas",
    description: "Concentración de ventas: qué presentaciones generan el 80% de las unidades equivalentes.",
    url: "/reports/pareto-8020",
    icon: PieChart,
    category: "Ventas",
  },
  {
    title: "Crédito Cescemex vs Directo",
    description: "Participación de cada tipo de crédito en la facturación 2026, evolución mensual y detalle por cliente.",
    url: "/reports/credito-cescemex",
    icon: CreditCard,
    category: "Ventas",
  },
  {
    title: "ROI Póliza Cescemex",
    description: "Costo real anual de la póliza de crédito y su peso sobre la cartera protegida.",
    url: "/reports/cescemex-roi",
    icon: ShieldCheck,
    category: "Crédito",
  },
];

export default function ReportsLanding() {
  const [busqueda, setBusqueda] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIAS)[number]>("Todos");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return REPORTS.filter(
      (r) => (cat === "Todos" || r.category === cat) && (!q || r.title.toLowerCase().includes(q))
    );
  }, [busqueda, cat]);

  return (
    <>
      <PageBanner title="Reportes" />
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar reporte…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={cat === c ? "default" : "outline"}
                className={cn("rounded-full text-xs")}
                onClick={() => setCat(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((r) => (
          <Link key={r.url} to={r.url}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                  <r.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{r.title}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
                      {r.category}
                    </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{r.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
          {visibles.length === 0 && (
            <p className="text-sm text-muted-foreground py-8">No se encontraron reportes.</p>
          )}
        </div>
      </div>
    </>
  );
}