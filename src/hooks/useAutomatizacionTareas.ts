import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type NivelAcceso = "basica" | "avanzada";
export type TriggerType = "manual" | "programado";

export interface AutomatizacionTarea {
  id: string;
  nombre: string;
  descripcion: string | null;
  nivel_acceso: string;
  trigger_type: string;
  trigger_config: any;
  activo: boolean;
  requiere_aprobacion: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PasoInput {
  tipo_paso: string;
  config: Record<string, any>;
}

export interface CrearAutomatizacionInput {
  nombre: string;
  descripcion?: string;
  nivel_acceso: NivelAcceso;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  requiere_aprobacion: boolean;
  usuarios: string[];
  pasos: PasoInput[];
}

export const TIPOS_PENDIENTES = [
  "generar_documento",
  "generar_hoja_calculo",
  "esperar_respuesta",
  "condicion",
];

export function useAutomatizacionesTareas() {
  return useQuery({
    queryKey: ["automatizaciones_tareas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automatizaciones")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AutomatizacionTarea[];
    },
  });
}

export function useIsAutomatizacionConstructor() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { data: isConstructor = false, isLoading } = useQuery({
    queryKey: ["automatizacion_constructor", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("automatizacion_constructores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user && !isAdmin,
  });
  return { isConstructor: isAdmin || isConstructor, isLoading: isAdmin ? false : isLoading };
}

export function useCreateAutomatizacionTarea() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CrearAutomatizacionInput) => {
      if (!user) throw new Error("No autenticado");
      const { data: auto, error } = await supabase
        .from("automatizaciones")
        .insert({
          nombre: input.nombre,
          descripcion: input.descripcion || null,
          nivel_acceso: input.nivel_acceso,
          trigger_type: input.trigger_type,
          trigger_config: input.trigger_config,
          requiere_aprobacion: input.requiere_aprobacion,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const pasosRows = input.pasos.map((p, i) => ({
        automatizacion_id: auto.id,
        orden: i + 1,
        tipo_paso: p.tipo_paso,
        config: p.config,
      }));

      let pasosCreados: any[] = [];
      if (pasosRows.length) {
        const { data: pd, error: pe } = await supabase
          .from("automatizacion_pasos")
          .insert(pasosRows)
          .select();
        if (pe) throw pe;
        pasosCreados = pd || [];
      }

      const usuariosRows = [
        { automatizacion_id: auto.id, user_id: user.id, rol: "dueño" },
        ...input.usuarios
          .filter((u) => u !== user.id)
          .map((u) => ({ automatizacion_id: auto.id, user_id: u, rol: "colaborador" })),
      ];
      const { error: ue } = await supabase.from("automatizacion_usuarios").insert(usuariosRows);
      if (ue) throw ue;

      const solicitudes = pasosCreados
        .filter((p) => TIPOS_PENDIENTES.includes(p.tipo_paso))
        .map((p) => ({
          automatizacion_id: auto.id,
          paso_id: p.id,
          solicitado_por: user.id,
          nombre_solicitada: p.tipo_paso,
          descripcion_necesidad: `El paso ${p.orden} de tipo "${p.tipo_paso}" de la automatización "${input.nombre}" aún no está implementado y quedó pendiente de desarrollo.`,
        }));
      if (solicitudes.length) {
        await supabase.from("automatizacion_solicitudes_funcion").insert(solicitudes);
      }

      return auto;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automatizaciones_tareas"] }),
  });
}

export function useToggleAutomatizacionTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("automatizaciones").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automatizaciones_tareas"] }),
  });
}

export function useDeleteAutomatizacionTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automatizaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automatizaciones_tareas"] }),
  });
}

export function useEjecutarAutomatizacionTarea() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (auto: AutomatizacionTarea) => {
      const { error } = await supabase.from("automatizacion_ejecuciones").insert({
        automatizacion_id: auto.id,
        disparado_por: user?.id ?? null,
        estatus: auto.requiere_aprobacion ? "pendiente_aprobacion" : "en_progreso",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automatizaciones_tareas"] }),
  });
}

export function useProfilesList() {
  return useQuery({
    queryKey: ["profiles_automatizacion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
}
