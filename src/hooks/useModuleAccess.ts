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
  isError: boolean;
  retry: () => void;
}

export function useModuleAccess(module: AppModule): ModuleAccess {
  const { user } = useAuth();
  const userId = user?.id || null;

  const accessQuery = useQuery({
    queryKey: ["module_access", userId, module],
    queryFn: async () => {
      if (!userId) return "ninguno" as AccessLevel;
      const { data, error } = await supabase.rpc("get_user_module_access", {
        _user_id: userId,
        _module: module,
      });
      // Throw so react-query retries instead of silently denying access.
      if (error) throw error;
      return (data || "ninguno") as AccessLevel;
    },
    enabled: !!userId,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const accessLevel = (accessQuery.data ?? "ninguno") as AccessLevel;

  const teamQuery = useQuery({
    queryKey: ["team_member_ids", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc("get_user_team_member_ids", {
        _user_id: userId,
      });
      if (error) throw error;
      return (data || [userId]) as string[];
    },
    enabled: !!userId && accessLevel === "equipo",
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const teamMemberIds = (teamQuery.data ?? []) as string[];
  const isError = accessQuery.isError || (accessLevel === "equipo" && teamQuery.isError);

  return {
    accessLevel,
    teamMemberIds: accessLevel === "equipo" ? teamMemberIds : [],
    userId,
    isLoading:
      (accessQuery.isLoading && !accessQuery.isError) ||
      (accessLevel === "equipo" && teamQuery.isLoading && !teamQuery.isError),
    // Never deny access just because the permission check failed to load.
    canView: isError ? false : accessLevel !== "ninguno",
    isError,
    retry: () => {
      accessQuery.refetch();
      if (accessLevel === "equipo") teamQuery.refetch();
    },
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
