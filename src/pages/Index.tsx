import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingCart, FileText, Package, Truck, BookOpen,
  ArrowLeftRight, FolderKanban, Search, GraduationCap, Receipt, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const modules = [
  { title: "Directorio", description: "Empresas y contactos", icon: BookOpen, url: "/directory", color: "bg-primary" },
  { title: "CRM", description: "Ventas Chevron y Phillips 66", icon: ShoppingCart, url: "/crm", color: "bg-primary" },
  { title: "Documentos", description: "Cotizaciones, pedidos y facturas", icon: FileText, url: "/documents", color: "bg-primary" },
  { title: "Inventario", description: "Catálogo de productos y existencias", icon: Package, url: "/inventory", color: "bg-primary" },
  { title: "Entregas", description: "Seguimiento de entregas", icon: Truck, url: "/delivery", color: "bg-primary" },
  { title: "Transferencias", description: "Transferencias de inventario", icon: ArrowLeftRight, url: "/transfers", color: "bg-primary" },
  { title: "Proyectos", description: "Proyectos y tareas", icon: FolderKanban, url: "/projects", color: "bg-primary" },
  { title: "Capacitación", description: "Capacitación del equipo", icon: GraduationCap, url: "/training", color: "bg-primary" },
  { title: "Reportes", description: "Análisis y reportes", icon: BarChart3, url: "/reports", color: "bg-primary" },
];

export default function Index() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bienvenido, {profile?.full_name || "Usuario"}</h1>
        <p className="text-muted-foreground mt-1">Plataforma de Distribución de Lubricantes Chevron y Phillips 66</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <Card
            key={mod.url}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(mod.url)}
          >
            <CardHeader className="pb-2 flex flex-row items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${mod.color} flex items-center justify-center`}>
                <mod.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{mod.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
