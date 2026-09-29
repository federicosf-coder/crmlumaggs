import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Network } from "lucide-react";

interface Props {
  nombre: string | null | undefined;
  empresas?: number;
  className?: string;
}

/** Chip discreto que identifica al Grupo Comercial de una empresa en reportes y listas. */
export function GrupoComercialBadge({ nombre, empresas, className }: Props) {
  if (!nombre) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-semibold uppercase tracking-widest",
        className
      )}
      title={`Grupo Comercial: ${nombre}`}
    >
      <Network className="h-3 w-3" />
      {nombre}
      {empresas && empresas > 1 ? ` · ${empresas}` : ""}
    </Badge>
  );
}
