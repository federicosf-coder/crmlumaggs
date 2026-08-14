import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/inventario/pedidos/sugeridos", label: "Pedidos Requeridos" },
  { to: "/inventario/pedidos/subir", label: "Subir Pedidos" },
  { to: "/inventario/pedidos/activos", label: "Activos" },
  { to: "/inventario/pedidos/recibidos", label: "Recibidos" },
  { to: "/inventario/pedidos/reclamos", label: "Reclamos" },
  { to: "/inventario/pedidos/extraordinarias", label: "Extraordinarias" },
];

export default function Pedidos() {
  const loc = useLocation();
  return (
    <div>
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-6 pt-5">
          <h1 className="text-2xl font-light tracking-tight">Pedidos de Inventario</h1>
          <p className="text-sm text-muted-foreground">Sugerencias, pedidos elaborados, recepciones y reclamos</p>
        </div>
        <nav className="px-6 mt-4 flex gap-1">
          {TABS.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 py-2 text-sm border-b-2 transition",
                  active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}