import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

export interface ProductOption {
  id: string;
  codigo: string;
  nombre_producto: string;
  presentacion?: string | null;
}

interface Props {
  productos: ProductOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function ProductMultiPicker({ productos, value, onChange, placeholder = "Agregar producto..." }: Props) {
  const [sel, setSel] = useState("");

  const options = useMemo(() => productos
    .filter((p) => !value.includes(p.id))
    .map((p) => ({
      value: p.id,
      label: `${p.codigo} — ${p.nombre_producto}`,
      searchText: `${p.codigo} ${p.nombre_producto}`,
    })), [productos, value]);

  const selected = value
    .map((id) => productos.find((p) => p.id === id))
    .filter(Boolean) as ProductOption[];

  return (
    <div className="space-y-2">
      <SearchableSelect
        value={sel}
        onValueChange={(v) => {
          if (!v) return;
          onChange([...value, v]);
          setSel("");
        }}
        options={options}
        placeholder={placeholder}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 font-normal pr-1">
              <span className="truncate max-w-[180px]">{p.codigo} — {p.nombre_producto}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== p.id))}
                className="hover:bg-destructive/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}