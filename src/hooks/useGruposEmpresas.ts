import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GrupoEmpresaInfo {
  grupoId: string;
  nombre: string;
}

interface CompanyGrupoRow {
  id: string;
  grupo_comercial_id: string | null;
  grupos_comerciales: { id: string; nombre: string } | null;
}

/**
 * Mapa companyId -> Grupo Comercial, para consolidar y etiquetar en reportes.
 * Las empresas sin grupo simplemente no aparecen en el mapa.
 */
export function useGruposEmpresas() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["grupos-empresas-map"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, grupo_comercial_id, grupos_comerciales:grupo_comercial_id(id, nombre)")
        .not("grupo_comercial_id", "is", null);
      if (error) throw error;
      return (data || []) as unknown as CompanyGrupoRow[];
    },
  });

  const grupoPorEmpresa = useMemo(() => {
    const m = new Map<string, GrupoEmpresaInfo>();
    for (const r of rows) {
      const gid = r.grupos_comerciales?.id || r.grupo_comercial_id;
      if (!gid) continue;
      m.set(r.id, { grupoId: gid, nombre: r.grupos_comerciales?.nombre || "Grupo" });
    }
    return m;
  }, [rows]);

  const grupoNombre = (companyId: string | null | undefined) =>
    (companyId && grupoPorEmpresa.get(companyId)?.nombre) || null;

  const grupoId = (companyId: string | null | undefined) =>
    (companyId && grupoPorEmpresa.get(companyId)?.grupoId) || null;

  /** Clave de agrupación: el grupo si existe, si no la propia empresa. */
  const claveGrupo = (companyId: string | null | undefined, fallback: string) =>
    grupoId(companyId) || companyId || fallback;

  return { grupoPorEmpresa, grupoNombre, grupoId, claveGrupo, isLoading };
}
