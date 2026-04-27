import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface ExecutivoOption { user_id: string; full_name: string }

interface CrmPipelineFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  showRecompraFilters?: boolean;
  ejecutivos?: ExecutivoOption[];
  ejecutivoId?: string;
  onEjecutivoChange?: (v: string) => void;
  meses?: string[];
  mes?: string;
  onMesChange?: (v: string) => void;
}

function fmtMes(m: string) {
  // YYYY-MM -> "Mes YYYY"
  if (!/^\d{4}-\d{2}$/.test(m)) return m;
  const d = new Date(`${m}-01T00:00:00`);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function CrmPipelineFilters({
  search,
  onSearchChange,
  showRecompraFilters,
  ejecutivos = [],
  ejecutivoId = "all",
  onEjecutivoChange,
  meses = [],
  mes = "all",
  onMesChange,
}: CrmPipelineFiltersProps) {
  const hasFilters = showRecompraFilters && (ejecutivoId !== "all" || mes !== "all" || search);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar negocios..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-full sm:w-64"
        />
      </div>
      {showRecompraFilters && (
        <>
          <Select value={ejecutivoId} onValueChange={(v) => onEjecutivoChange?.(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Ejecutivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ejecutivos</SelectItem>
              <SelectItem value="none">Sin asignar</SelectItem>
              {ejecutivos.map((e) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mes} onValueChange={(v) => onMesChange?.(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{fmtMes(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onSearchChange(""); onEjecutivoChange?.("all"); onMesChange?.("all"); }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </>
      )}
    </div>
  );
}
