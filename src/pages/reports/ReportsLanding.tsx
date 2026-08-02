import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBanner } from "@/components/PageBanner";
import { Truck, FileText, ListChecks, TrendingUp, PieChart } from "lucide-react";

const REPORTS = [
  {
    title: "Reporte Diario Entregas Básico",
    description: "Desempeño diario por repartidor: entregas, horas, km y score.",
    url: "/reports/daily-delivery",
    icon: Truck,
  },
  {
    title: "Reporte Diario de Actividades",
    description: "Resumen de texto para correo: actividades, cotizaciones y prospectos del día.",
    url: "/reports/daily-activity",
    icon: FileText,
  },
  {
    title: "Desglose de Facturas con Unidades",
    description: "Detalle de facturas del mes por producto, para verificar que todas estén cuantificadas correctamente.",
    url: "/reports/desglose-facturas",
    icon: ListChecks,
  },
  {
    title: "Ventas Delo XLE 15W40 — Comparativo Mensual",
    description: "Unidades equivalentes por mes de las 5 presentaciones de Delo XLE 15W40, últimos 12 meses.",
    url: "/reports/delo-xle-15w40",
    icon: TrendingUp,
  },
  {
    title: "Análisis 80/20 — Presentaciones Más Vendidas",
    description: "Concentración de ventas: qué presentaciones generan el 80% de las unidades equivalentes.",
    url: "/reports/pareto-8020",
    icon: PieChart,
  },
];

export default function ReportsLanding() {
  return (
    <>
      <PageBanner title="Reportes" />
      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.url} to={r.url}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <r.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{r.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}