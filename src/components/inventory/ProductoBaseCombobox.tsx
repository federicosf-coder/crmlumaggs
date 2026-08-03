import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Base = { id: string; nombre: string; marca_id: string | null };

interface Props {
  value: string;
  onChange: (id: string) => void;
  marcaId: string;
  disabled?: boolean;
}

export function ProductoBaseCombobox({ value, onChange, marcaId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Base[]>([]);
  const [selected, setSelected] = useState<Base | null>(null);
  const [creating, setCreating] = useState(false);

  // Load options (filtered by marca when available)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = (supabase as any)
        .from("productos_base")
        .select("id, nombre, marca_id")
        .eq("is_active", true)
        .order("nombre")
        .limit(1000);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data } = await q;
      if (!cancelled) setItems((data ?? []) as Base[]);
    })();
    return () => { cancelled = true; };
  }, [marcaId]);

  // Preload selected label in edit mode
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    const local = items.find((i) => i.id === value);
    if (local) { setSelected(local); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("productos_base")
        .select("id, nombre, marca_id")
        .eq("id", value)
        .maybeSingle();
      if (!cancelled && data) setSelected(data as Base);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 100);
    return items.filter((i) => i.nombre.toLowerCase().includes(q)).slice(0, 100);
  }, [items, query]);

  const exactMatch = items.some((i) => i.nombre.trim().toLowerCase() === query.trim().toLowerCase());

  const handleCreate = async () => {
    const nombre = query.trim();
    if (!nombre) return;
    setCreating(true);
    const { data, error } = await (supabase as any)
      .from("productos_base")
      .insert({ nombre, marca_id: marcaId || null })
      .select("id, nombre, marca_id")
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [...prev, data as Base]);
    setSelected(data as Base);
    onChange((data as Base).id);
    setQuery("");
    setOpen(false);
    toast.success("Producto base creado");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-light"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.nombre || "Buscar o crear producto base..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Escribe para buscar..." value={query} onValueChange={setQuery} />
          <CommandList>
            {filtered.length === 0 && !query.trim() && <CommandEmpty>Sin productos base.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  onSelect={() => { setSelected(i); onChange(i.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === i.id ? "opacity-100" : "opacity-0")} />
                  {i.nombre}
                </CommandItem>
              ))}
              {query.trim() && !exactMatch && (
                <CommandItem value={`__create__${query}`} onSelect={handleCreate}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Crear "{query.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}