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

export interface AlertaRvsPersona {
  id: string;
  nombre_reporte: string;
  sin_clasificar: boolean | null;
  requiere_verificacion: boolean | null;
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
        .select(
          "id, created_at, nombre_detectado, monto_extraido, empresa_id, canal, ejecutivo_id, remitente_email"
        )
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as (AlertaComprobante & {
        ejecutivo_id: string | null;
        remitente_email: string | null;
      })[];
      if (verTodo || !plazaId) return rows;

      // Misma cadena de resolución que la bandeja de comprobantes:
      // ejecutivo que subió → remitente por correo → plaza de la empresa.
      const empresaIds = Array.from(
        new Set(rows.map((r) => r.empresa_id).filter((v): v is string => !!v))
      );
      const mapaEmpresa = new Map<string, string>();
      if (empresaIds.length > 0) {
        const { data: cp, error: cpError } = await (supabase as any)
          .from("company_plazas")
          .select("company_id, plaza_id")
          .in("company_id", empresaIds);
        if (cpError) throw cpError;
        for (const row of (cp || []) as { company_id: string; plaza_id: string }[]) {
          if (!mapaEmpresa.has(row.company_id)) mapaEmpresa.set(row.company_id, row.plaza_id);
        }
      }

      const visibles: AlertaComprobante[] = [];
      for (const r of rows) {
        let plazaRow: string | null = null;
        if (r.ejecutivo_id || r.remitente_email) {
          const email = r.remitente_email
            ? (r.remitente_email.match(/[^\s<>,;]+@[^\s<>,;]+/)?.[0] || r.remitente_email).trim()
            : null;
          const { data: rpcData } = await (supabase as any).rpc("get_plaza_remitente", {
            _user_id: r.ejecutivo_id ?? null,
            _email: email,
          });
          plazaRow = (rpcData as string | null) ?? null;
        }
        if (!plazaRow && r.empresa_id) plazaRow = mapaEmpresa.get(r.empresa_id) ?? null;
        // Sin plaza resoluble, se muestra (mismo criterio que la bandeja).
        if (!plazaRow || plazaRow === plazaId) visibles.push(r);
      }
      return visibles;
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

  const rvsPersonasQuery = useQuery({
    queryKey: ["alertas-rvs-personas"],
    enabled,
    queryFn: async (): Promise<AlertaRvsPersona[]> => {
      const { data, error } = await (supabase as any)
        .from("rvs_personas")
        .select("id, nombre_reporte, sin_clasificar, requiere_verificacion")
        .or("sin_clasificar.eq.true,requiere_verificacion.eq.true")
        .order("nombre_reporte", { ascending: true });
      if (error) throw error;
      return (data || []) as AlertaRvsPersona[];
    },
  });

  const comprobantes = comprobantesQuery.data || [];
  const entregas = entregasQuery.data || [];
  const autorizaciones = autorizacionesQuery.data || [];
  const rvsPersonas = rvsPersonasQuery.data || [];

  const refetchAll = async () => {
    await Promise.all([
      comprobantesQuery.refetch(),
      entregasQuery.refetch(),
      autorizacionesQuery.refetch(),
      rvsPersonasQuery.refetch(),
    ]);
  };

  return {
    comprobantes,
    entregas,
    autorizaciones,
    rvsPersonas,
    totalCount:
      comprobantes.length + entregas.length + autorizaciones.length + rvsPersonas.length,
    isLoading:
      comprobantesQuery.isLoading ||
      entregasQuery.isLoading ||
      autorizacionesQuery.isLoading ||
      rvsPersonasQuery.isLoading,
    verTodo,
    refetchAll,
  };
}
