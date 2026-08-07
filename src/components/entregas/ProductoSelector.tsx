import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductoCatalogo = { codigo: string; nombre: string; descripcion?: string };

let cache: ProductoCatalogo[] | null = null;

export async function fetchProductosCatalogo(): Promise<ProductoCatalogo[]> {
  if (cache) return cache;
  const { data } = await (supabase as any)
    .from("productos")
    .select("codigo, nombre_producto, descripcion, presentaciones(nombre)")
    .order("codigo")
    .limit(5000);
  cache = ((data ?? []) as any[])
    .filter((p) => p.codigo)
    .map((p) => {
      const presentacion = Array.isArray(p.presentaciones) && p.presentaciones.length > 0
        ? p.presentaciones[0].nombre
        : undefined;
      const partes = [presentacion, p.descripcion].filter(Boolean);
      return {
        codigo: String(p.codigo),
        nombre: p.nombre_producto || "",
        descripcion: partes.length > 0 ? partes.join(" — ") : undefined,
      };
    });
  return cache;
}

interface Props {
  codigo: string;
  onSelect: (p: ProductoCatalogo) => void;
  placeholder?: string;
  className?: string;
}

export function ProductoSelector({ codigo, onSelect, placeholder = "Buscar producto…", className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductoCatalogo[]>([]);

  useEffect(() => { fetchProductosCatalogo().then(setItems); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? items.filter((p) => `${p.codigo} ${p.nombre}`.toLowerCase().includes(term))
      : items;
    return base.slice(0, 100);
  }, [items, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox"
          className={cn("h-8 w-full justify-between text-sm font-normal", className)}>
          <span className={cn("truncate font-mono", !codigo && "text-muted-foreground font-sans")}>
            {codigo || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Código o nombre…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem key={p.codigo} value={p.codigo}
                  onSelect={() => { onSelect(p); setOpen(false); setQ(""); }}>
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", codigo === p.codigo ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center min-w-0">
                      <span className="font-mono text-xs mr-2 shrink-0">{p.codigo}</span>
                      <span className="truncate text-sm">{p.nombre}</span>
                    </div>
                    {p.descripcion && (
                      <span className="text-xs text-muted-foreground truncate">{p.descripcion}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
