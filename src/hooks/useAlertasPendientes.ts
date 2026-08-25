import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AlertaComprobante {
  id: string;
  created_at: string;
  nombre_detectado: string | null;
  monto_extraido: number | null;
  empresa_id: string | null;
  canal: string | null;
}

export interface AlertaEntrega {
  id: string;
  created_at: string;
  cliente_detectado: string | null;
  lugar_entrega_detectado: string | null;
}

export interface AlertaAutorizacion {
  id: string;
  created_at: string;
  documento_id: string | null;
  documentos: {
    numero_pedido: string | null;
    plaza_id: string | null;
    companies: { name: string | null } | null;
  } | null;
}

export function useAlertasPendientes() {
  const { profile, hasAnyRole } = useAuth();
  const verTodo = hasAnyRole(["admin", "manager"]);
  const plazaId = profile?.plaza_id ?? null;
  const enabled = !!profile?.user_id;

  const comprobantesQuery = useQuery({
    queryKey: ["alertas-comprobantes", verTodo, plazaId],
    enabled,
    queryFn: async (): Promise<AlertaComprobante[]> => {
      const { data, error } = await (supabase as any)
        .from("comprobantes_intake")
        .select("id, created_at, nombre_detectado, monto_extraido, empresa_id, canal")
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as AlertaComprobante[];
      if (verTodo) return rows;

      const empresaIds = Array.from(
        new Set(rows.map((r) => r.empresa_id).filter((v): v is string => !!v))
      );
      if (empresaIds.length === 0) return [];
      const { data: cp, error: cpError } = await (supabase as any)
        .from("company_plazas")
        .select("company_id, plaza_id")
        .in("company_id", empresaIds);
      if (cpError) throw cpError;
      const mapa = new Map<string, string>();
      for (const row of (cp || []) as { company_id: string; plaza_id: string }[]) {
        if (!mapa.has(row.company_id)) mapa.set(row.company_id, row.plaza_id);
      }
      return rows.filter((r) => r.empresa_id && mapa.get(r.empresa_id) === plazaId);
    },
  });

  const entregasQuery = useQuery({
    queryKey: ["alertas-entregas-intake"],
    enabled,
    queryFn: async (): Promise<AlertaEntrega[]> => {
      const { data, error } = await (supabase as any)
        .from("entregas_corporativas_intake")
        .select("id, created_at, cliente_detectado, lugar_entrega_detectado")
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AlertaEntrega[];
    },
  });

  const autorizacionesQuery = useQuery({
    queryKey: ["alertas-autorizaciones", verTodo, plazaId],
    enabled,
    queryFn: async (): Promise<AlertaAutorizacion[]> => {
      const { data, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select("id, created_at, documento_id, documentos(numero_pedido, plaza_id, companies(name))")
        .eq("estatus", "pendiente_revision")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as AlertaAutorizacion[];
      if (verTodo) return rows;
      return rows.filter((r) => r.documentos?.plaza_id === plazaId);
    },
  });

  const comprobantes = comprobantesQuery.data || [];
  const entregas = entregasQuery.data || [];
  const autorizaciones = autorizacionesQuery.data || [];

  const refetchAll = async () => {
    await Promise.all([
      comprobantesQuery.refetch(),
      entregasQuery.refetch(),
      autorizacionesQuery.refetch(),
    ]);
  };

  return {
    comprobantes,
    entregas,
    autorizaciones,
    totalCount: comprobantes.length + entregas.length + autorizaciones.length,
    isLoading:
      comprobantesQuery.isLoading || entregasQuery.isLoading || autorizacionesQuery.isLoading,
    verTodo,
    refetchAll,
  };
}
