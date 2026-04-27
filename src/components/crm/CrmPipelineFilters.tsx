import { Input } from "@/components/ui/input";
import { Search, X, ArrowUpDown, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface ExecutivoOption { user_id: string; full_name: string }
export interface PlazaOption { id: string; nombre: string }

export type SortOption = "default" | "company_asc" | "company_desc" | "contact_asc" | "contact_desc" | "potencial_desc" | "potencial_asc" | "value_desc" | "value_asc";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Por defecto",
  company_asc: "Empresa (A → Z)",
  company_desc: "Empresa (Z → A)",
  contact_asc: "Contacto (A → Z)",
  contact_desc: "Contacto (Z → A)",
  potencial_desc: "Potencial (mayor)",
  potencial_asc: "Potencial (menor)",
  value_desc: "Valor (mayor)",
  value_asc: "Valor (menor)",
};

interface CrmPipelineFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  ejecutivos?: ExecutivoOption[];
  ejecutivoId?: string;
  onEjecutivoChange?: (v: string) => void;
  plazas?: PlazaOption[];
  plazaId?: string;
  onPlazaChange?: (v: string) => void;
  showRecompraFilters?: boolean;
  meses?: string[];
  mes?: string;
  onMesChange?: (v: string) => void;
  sort?: SortOption;
  onSortChange?: (v: SortOption) => void;
}

function fmtMes(m: string) {
  if (!/^\d{4}-\d{2}$/.test(m)) return m;
  const d = new Date(`${m}-01T00:00:00`);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function CrmPipelineFilters({
  search,
  onSearchChange,
  ejecutivos = [],
  ejecutivoId = "all",
  onEjecutivoChange,
  plazas = [],
  plazaId = "all",
  onPlazaChange,
  showRecompraFilters,
  meses = [],
  mes = "all",
  onMesChange,
  sort = "default",
  onSortChange,
}: CrmPipelineFiltersProps) {
  const hasFilters =
    !!search ||
    ejecutivoId !== "all" ||
    plazaId !== "all" ||
    (showRecompraFilters && mes !== "all") ||
    sort !== "default";

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

      <Select value={plazaId} onValueChange={(v) => onPlazaChange?.(v)}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Plaza" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las plazas</SelectItem>
          <SelectItem value="none">Sin plaza</SelectItem>
          {plazas.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showRecompraFilters && (
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
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Ordenar
            {sort !== "default" && (
              <span className="text-xs text-muted-foreground">· {SORT_LABELS[sort]}</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => onSortChange?.(opt)}
              className="flex items-center justify-between"
            >
              <span>{SORT_LABELS[opt]}</span>
              {sort === opt && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            onEjecutivoChange?.("all");
            onPlazaChange?.("all");
            onMesChange?.("all");
            onSortChange?.("default");
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}
