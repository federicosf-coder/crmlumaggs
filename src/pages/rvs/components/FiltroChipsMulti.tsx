import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filtro tipo checklista con chips: permite activar uno, varios o todos.
 * `seleccion` vacío ([]) significa "todos".
 */
export function FiltroChipsMulti({
  titulo,
  opciones,
  seleccion,
  onChange,
}: {
  titulo: string;
  opciones: string[];
  seleccion: string[];
  onChange: (sel: string[]) => void;
}) {
  if (opciones.length === 0) return null;
  const todos = seleccion.length === 0;
  const activo = (op: string) => todos || seleccion.includes(op);

  const toggle = (op: string) => {
    if (todos) {
      // Al tocar uno estando en "todos", quedan seleccionados todos menos ese
      onChange(opciones.filter((o) => o !== op));
      return;
    }
    const next = seleccion.includes(op)
      ? seleccion.filter((o) => o !== op)
      : [...seleccion, op];
    // Si no queda ninguno o quedaron todos, vuelve a "todos"
    onChange(next.length === 0 || next.length === opciones.length ? [] : next);
  };

  return (
    <div className="space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
            todos
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/40 hover:bg-muted"
          )}
        >
          {todos && <Check className="h-3 w-3" />}
          Todos
        </button>
        {opciones.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => toggle(op)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              activo(op) && !todos
                ? "bg-blue-600 text-white border-blue-600"
                : todos
                  ? "bg-muted/40 hover:bg-muted"
                  : "bg-muted/20 text-muted-foreground hover:bg-muted/50"
            )}
          >
            {activo(op) && !todos && <Check className="h-3 w-3" />}
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}
