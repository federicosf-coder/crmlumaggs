import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CatalogoItem {
  id: string;
  clave?: string;
  etiqueta?: string;
  nombre?: string;
  is_active: boolean;
  requiere_acceso?: boolean;
}

export const claveFrom = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export function useRvsCatalogos() {
  const qc = useQueryClient();

  const empresas = useQuery({
    queryKey: ["rvs_empresas_grupo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_empresas_grupo")
        .select("id, clave, etiqueta, is_active")
        .order("etiqueta");
      if (error) throw error;
      return (data || []) as CatalogoItem[];
    },
  });

  const puestos = useQuery({
    queryKey: ["rvs_puestos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_puestos")
        .select("id, clave, etiqueta, requiere_acceso, is_active")
        .order("etiqueta");
      if (error) throw error;
      return (data || []) as CatalogoItem[];
    },
  });

  const plazas = useQuery({
    queryKey: ["rvs_plazas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plazas")
        .select("id, nombre, is_active")
        .order("nombre");
      if (error) throw error;
      return (data || []) as CatalogoItem[];
    },
  });

  const crearEmpresa = async (nombre: string) => {
    const { data, error } = await supabase
      .from("rvs_empresas_grupo")
      .insert({ clave: claveFrom(nombre), etiqueta: nombre })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    qc.invalidateQueries({ queryKey: ["rvs_empresas_grupo"] });
    return data.id as string;
  };

  const crearPuesto = async (nombre: string) => {
    const { data, error } = await supabase
      .from("rvs_puestos")
      .insert({ clave: claveFrom(nombre), etiqueta: nombre })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    qc.invalidateQueries({ queryKey: ["rvs_puestos"] });
    return data.id as string;
  };

  const crearPlaza = async (nombre: string) => {
    const { data, error } = await supabase
      .from("plazas")
      .insert({ nombre })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    qc.invalidateQueries({ queryKey: ["rvs_plazas"] });
    return data.id as string;
  };

  return { empresas, puestos, plazas, crearEmpresa, crearPuesto, crearPlaza };
}

export const labelOf = (i: CatalogoItem) => i.etiqueta || i.nombre || "";
