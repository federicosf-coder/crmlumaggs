import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import ListaCostos from "./ListaCostos";

export const CONTABILIDAD_ROLES = ["master", "accounting"] as const;

const SUBMODULOS = {
  "listas-precio": { title: "Listas de Precio", description: "Consulta y control de listas de precio. En construcción." },
  costos: { title: "Lista de Costos", description: "Consulta y control de costos por producto. En construcción." },
  cfdis: { title: "Comprobación de estatus de CFDIs", description: "Verificación del estatus de CFDIs ante el SAT. En construcción." },
} as const;

export type SubmoduloContabilidad = keyof typeof SUBMODULOS;

export default function ContabilidadModulo({ submodulo }: { submodulo: SubmoduloContabilidad }) {
  const { hasAnyRole, loading } = useAuth();
  if (loading) return null;
  if (!hasAnyRole([...CONTABILIDAD_ROLES])) return <Navigate to="/" replace />;
  if (submodulo === "costos") return <ListaCostos />;
  const info = SUBMODULOS[submodulo];
  return <ModulePlaceholder title={info.title} description={info.description} />;
}
