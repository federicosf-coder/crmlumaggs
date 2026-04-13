import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CrmPipelineFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function CrmPipelineFilters({ search, onSearchChange }: CrmPipelineFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar negocios..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-full sm:w-64"
        />
      </div>
    </div>
  );
}
