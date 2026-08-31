import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AccessLevel = "todos" | "equipo" | "propio" | "ninguno";
export type AppModule =
  | "directorio"
  | "cotizaciones" | "inventario" | "entregas"
  | "transferencias" | "facturacion" | "productos"
  | "proyectos" | "capacitacion" | "reportes"
  | "modificar_pdf_cotizacion" | "eliminar_pdf_cotizacion"
  | "tareas" | "actividades" | "whatsapp" | "biblioteca" | "credito"
  | "seguimiento_ventas" | "cobranza" | "pedidos" | "reporte_ventas_sistema";

interface ModuleAccess {
  accessLevel: AccessLevel;
  teamMemberIds: string[];
  userId: string | null;
  isLoading: boolean;
  canView: boolean;
}

export function useModuleAccess(module: AppModule): ModuleAccess {
  const { user } = useAuth();
  const userId = user?.id || null;

  const { data: accessLevel = "ninguno" as AccessLevel, isLoading: loadingAccess } = useQuery({
    queryKey: ["module_access", userId, module],
    queryFn: async () => {
      if (!userId) return "ninguno" as AccessLevel;
      const { data, error } = await supabase.rpc("get_user_module_access", {
        _user_id: userId,
        _module: module,
      });
      if (error) {
        console.error("Error fetching module access:", error);
        return "ninguno" as AccessLevel;
      }
      return (data || "ninguno") as AccessLevel;
    },
    enabled: !!userId,
  });

  const { data: teamMemberIds = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["team_member_ids", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc("get_user_team_member_ids", {
        _user_id: userId,
      });
      if (error) {
        console.error("Error fetching team members:", error);
        return [userId];
      }
      return (data || [userId]) as string[];
    },
    enabled: !!userId && accessLevel === "equipo",
  });

  return {
    accessLevel,
    teamMemberIds: accessLevel === "equipo" ? teamMemberIds : [],
    userId,
    isLoading: loadingAccess || (accessLevel === "equipo" && loadingTeam),
    canView: accessLevel !== "ninguno",
  };
}

/**
 * Apply access level filtering to a Supabase query builder.
 * ownerFields: column names that indicate ownership (e.g., ["created_by", "owner_id"])
 */
export function applyAccessFilter<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
  query: T,
  access: ModuleAccess,
  ownerFields: string[] = ["created_by"]
): T | null {
  if (access.accessLevel === "ninguno") return null;
  if (access.accessLevel === "todos") return query;

  const ids = access.accessLevel === "equipo" ? access.teamMemberIds : [access.userId!];

  if (ownerFields.length === 1) {
    return query.in(ownerFields[0], ids);
  }

  // For multiple owner fields, use or filter
  const orClause = ownerFields.map(f => `${f}.in.(${ids.join(",")})`).join(",");
  return (query as any).or(orClause);
}
