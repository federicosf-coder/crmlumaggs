import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/roles";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting" | "cobranza";
type AppModule = "directorio" | "seguimiento_ventas" | "cotizaciones" | "pedidos" | "inventario" | "entregas" | "transferencias" | "facturacion" | "cobranza" | "productos" | "proyectos" | "capacitacion" | "reportes" | "modificar_pdf_cotizacion" | "eliminar_pdf_cotizacion" | "tareas" | "actividades" | "whatsapp" | "credito" | "reporte_ventas_sistema";
type AccessLevel = "todos" | "equipo" | "propio" | "ninguno";

const ALL_ROLES: AppRole[] = ["admin", "manager", "sales", "delivery", "warehouse", "customer_service", "accounting", "cobranza"];
const ALL_MODULES: AppModule[] = ["directorio", "seguimiento_ventas", "cotizaciones", "pedidos", "credito", "inventario", "entregas", "transferencias", "facturacion", "cobranza", "productos", "proyectos", "capacitacion", "reportes", "reporte_ventas_sistema", "tareas", "actividades", "whatsapp", "modificar_pdf_cotizacion", "eliminar_pdf_cotizacion"];
const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "equipo", label: "Equipo" },
  { value: "propio", label: "Propio" },
  { value: "ninguno", label: "Ninguno" },
];

const MODULE_LABELS: Record<AppModule, string> = {
  directorio: "Directorio",
  seguimiento_ventas: "Seguimiento a Ventas",
  cotizaciones: "Cotizaciones",
  pedidos: "Pedidos",
  inventario: "Inventario",
  entregas: "Entregas",
  transferencias: "Transferencias",
  facturacion: "Facturación",
  cobranza: "Cobranza",
  productos: "Productos",
  proyectos: "Proyectos",
  capacitacion: "Capacitación",
  reportes: "Reportes",
  reporte_ventas_sistema: "Reporte de Ventas Sistema",
  tareas: "Tareas",
  actividades: "Actividades",
  whatsapp: "WhatsApp",
  modificar_pdf_cotizacion: "Modificar PDF Documento",
  eliminar_pdf_cotizacion: "Eliminar PDF Documento",
  credito: "Solicitud de Crédito",
};

interface Permission {
  id: string;
  role: AppRole;
  module: AppModule;
  access_level: AccessLevel;
}

export default function PermissionsManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [costosVisibility, setCostosVisibility] = useState<{ role: string; puede_ver_costos: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchPermissions = async () => {
    setLoading(true);
    const { data } = await supabase.from("role_module_permissions").select("*");
    setPermissions((data || []) as Permission[]);
    setLoading(false);
  };

  const fetchCostosVisibility = async () => {
    const { data } = await (supabase as any).from("role_costos_visibility").select("*");
    setCostosVisibility((data || []) as { role: string; puede_ver_costos: boolean }[]);
  };

  useEffect(() => { fetchPermissions(); fetchCostosVisibility(); }, []);

  const updateCostosVisibility = async (role: string, puede_ver_costos: boolean) => {
    const { error } = await (supabase as any)
      .from("role_costos_visibility")
      .update({ puede_ver_costos })
      .eq("role", role);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCostosVisibility((prev) =>
        prev.map((r) => (r.role === role ? { ...r, puede_ver_costos } : r))
      );
      toast({ title: "Visibilidad de costos actualizada" });
    }
  };

  const getPuedeVerCostos = (role: string): boolean => {
    if (role === "admin") return true;
    return costosVisibility.find((r) => r.role === role)?.puede_ver_costos ?? false;
  };

  const updatePermission = async (role: AppRole, module: AppModule, access_level: AccessLevel) => {
    const existing = permissions.find((p) => p.role === role && p.module === module);
    if (!existing) return;

    const { error } = await supabase
      .from("role_module_permissions")
      .update({ access_level } as any)
      .eq("id", existing.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPermissions((prev) =>
        prev.map((p) => (p.id === existing.id ? { ...p, access_level } : p))
      );
      toast({ title: "Permiso actualizado" });
    }
  };

  const getAccessLevel = (role: AppRole, module: AppModule): AccessLevel => {
    return permissions.find((p) => p.role === role && p.module === module)?.access_level || "ninguno";
  };

  if (!hasRole("admin")) {
    return <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Permisos por Módulo</h1>
      <p className="text-muted-foreground">
        Configura el nivel de acceso a registros que cada rol tiene en cada módulo: <strong>Todos</strong> (ve todo), <strong>Equipo</strong> (solo registros de su equipo), <strong>Propio</strong> (solo sus registros) o <strong>Ninguno</strong>. Los permisos <strong>Modificar PDF Documento</strong> y <strong>Eliminar PDF Documento</strong> aplican a los 3 tipos: cotizaciones, pedidos y facturas.
      </p>
      <Card>
        <CardHeader><CardTitle>Matriz de Permisos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-background min-w-[140px]">Módulo</th>
                    {ALL_ROLES.map((role) => (
                      <th key={role} className="text-center p-2 font-medium text-muted-foreground min-w-[130px]">
                        {roleLabel(role)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_MODULES.map((module) => (
                    <tr key={module} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium sticky left-0 bg-background">{MODULE_LABELS[module]}</td>
                      {ALL_ROLES.map((role) => (
                        <td key={role} className="p-2 text-center">
                          <Select
                            value={getAccessLevel(role, module)}
                            onValueChange={(v) => updatePermission(role, module, v as AccessLevel)}
                            disabled={role === "admin"}
                          >
                            <SelectTrigger className="w-28 mx-auto text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_LEVELS.map((al) => (
                                <SelectItem key={al.value} value={al.value}>{al.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Visibilidad de Costos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Controla qué roles pueden ver campos de costo, márgenes y utilidad en todo el sistema (catálogo de productos, gestión de costos, autorización de precios, reportes, etc). No afecta los precios de venta, que siguen visibles para todos los roles con acceso al módulo correspondiente.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground min-w-[180px]">Permiso</th>
                  {ALL_ROLES.filter((r) => r === "admin" || costosVisibility.some((c) => c.role === r)).map((role) => (
                    <th key={role} className="text-center p-2 font-medium text-muted-foreground min-w-[110px]">
                      {roleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">Ver información de costos</td>
                  {ALL_ROLES.filter((r) => r === "admin" || costosVisibility.some((c) => c.role === r)).map((role) => (
                    <td key={role} className="p-2 text-center">
                      <Switch
                        checked={getPuedeVerCostos(role)}
                        onCheckedChange={(v) => updateCostosVisibility(role, v)}
                        disabled={role === "admin"}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
