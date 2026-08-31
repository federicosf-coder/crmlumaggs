import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMAS = [
  { activo: "bg-blue-600 border-blue-600 text-white", inactivo: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900" },
  { activo: "bg-emerald-600 border-emerald-600 text-white", inactivo: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900" },
  { activo: "bg-amber-600 border-amber-600 text-white", inactivo: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900" },
  { activo: "bg-violet-600 border-violet-600 text-white", inactivo: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900" },
  { activo: "bg-pink-600 border-pink-600 text-white", inactivo: "bg-pink-50 border-pink-200 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-900" },
  { activo: "bg-cyan-600 border-cyan-600 text-white", inactivo: "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-900" },
  { activo: "bg-orange-600 border-orange-600 text-white", inactivo: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900" },
  { activo: "bg-indigo-600 border-indigo-600 text-white", inactivo: "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900" },
];

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
      // Al tocar uno estando en "todos", ahora selecciona solo ese
      onChange([op]);
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
        {opciones.map((op, i) => {
          const tema = TEMAS[i % TEMAS.length];
          const isActivo = activo(op) && !todos;
          return (
            <button
              key={op}
              type="button"
              onClick={() => toggle(op)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                isActivo ? tema.activo : tema.inactivo
              )}
            >
              {isActivo && <Check className="h-3 w-3" />}
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}
