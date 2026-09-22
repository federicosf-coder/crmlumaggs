import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

interface SistemaCandado {
  id: string;
  titulo: string;
  descripcion: string;
  rol_requerido: string | null;
  modulo: string | null;
  tabla_afectada: string | null;
  tipo: string;
  activo: boolean;
  created_at: string;
}

function fechaCorta(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function CandadoCard({ candado }: { candado: SistemaCandado }) {
  return (
    <Card className="relative">
      <CardContent className="pt-5">
        <span className="absolute right-4 top-4 text-[10px] text-muted-foreground">
          {fechaCorta(candado.created_at)}
        </span>
        <h3 className="font-bold pr-24">{candado.titulo}</h3>
        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
          {candado.descripcion}
        </p>
        {(candado.rol_requerido || candado.modulo || candado.tabla_afectada) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {candado.rol_requerido && (
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                {candado.rol_requerido}
              </Badge>
            )}
            {candado.modulo && <Badge variant="outline">{candado.modulo}</Badge>}
            {candado.tabla_afectada && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {candado.tabla_afectada}
              </code>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Seccion({
  titulo,
  descripcion,
  items,
}: {
  titulo: string;
  descripcion: string;
  items: SistemaCandado[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((c) => (
          <CandadoCard key={c.id} candado={c} />
        ))}
      </div>
    </section>
  );
}

export default function CandadosSistema() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sistema_candados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sistema_candados")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SistemaCandado[];
    },
  });

  const permisos = (data ?? []).filter((c) => c.tipo === "permiso");
  const reglas = (data ?? []).filter((c) => c.tipo === "regla_negocio");

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Candados del Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Registro de restricciones de permisos y reglas de negocio ya implementadas en el CRM — para saber de un vistazo qué está bloqueado.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando candados…</p>}
      {error && (
        <p className="text-sm text-destructive">
          No se pudieron cargar los candados. Intenta de nuevo más tarde.
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay candados activos registrados.
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-8">
          <Seccion
            titulo="🔒 Candados de permisos por rol"
            descripcion="Restringen quién puede hacer algo, según su rol."
            items={permisos}
          />
          <Seccion
            titulo="⚙️ Reglas de negocio automáticas"
            descripcion="Se aplican siempre, sin importar el rol, según la lógica del proceso."
            items={reglas}
          />
        </div>
      )}
    </div>
  );
}
