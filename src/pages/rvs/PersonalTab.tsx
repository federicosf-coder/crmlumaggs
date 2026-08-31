import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreatableCatalogSelect } from "./components/CreatableCatalogSelect";
import { useRvsCatalogos, labelOf } from "./useRvsCatalogos";

interface Persona {
  id: string;
  nombre_reporte: string;
  empresa_grupo_id: string | null;
  puesto_id: string | null;
  plaza_id: string | null;
  user_id: string | null;
  sin_clasificar: boolean;
}

export function PersonalTab() {
  const qc = useQueryClient();
  const [soloSinClasificar, setSoloSinClasificar] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const { empresas, puestos, plazas, crearEmpresa, crearPuesto, crearPlaza } = useRvsCatalogos();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["rvs_personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_personas")
        .select("id, nombre_reporte, empresa_grupo_id, puesto_id, plaza_id, user_id, sin_clasificar")
        .order("nombre_reporte");
      if (error) throw error;
      return (data || []) as Persona[];
    },
  });

  const update = async (id: string, patch: Partial<Persona>) => {
    const { error } = await supabase.from("rvs_personas").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["rvs_personas"] });
  };

  const opt = (items: any[]) =>
    items.map((i) => ({ value: i.id, label: labelOf(i) }));

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return personas.filter(
      (p) =>
        (!soloSinClasificar || p.sin_clasificar) &&
        (!q || p.nombre_reporte.toLowerCase().includes(q))
    );
  }, [personas, soloSinClasificar, busqueda]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar persona…"
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="sin-clasificar"
            checked={soloSinClasificar}
            onCheckedChange={setSoloSinClasificar}
          />
          <Label htmlFor="sin-clasificar" className="text-xs uppercase tracking-wide">
            Solo sin clasificar ({personas.filter((p) => p.sin_clasificar).length})
          </Label>
        </div>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
              <TableHead className="text-[11px] uppercase tracking-wide">Nombre en reporte</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Empresa / Grupo</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Puesto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Plaza</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Usuario</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground py-6">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && visibles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground py-6">
                  Sin registros.
                </TableCell>
              </TableRow>
            )}
            {visibles.map((p, idx) => (
              <TableRow key={p.id} className={idx % 2 ? "bg-muted/30" : undefined}>
                <TableCell className="font-medium whitespace-nowrap">{p.nombre_reporte}</TableCell>
                <TableCell className="min-w-[220px]">
                  <CreatableCatalogSelect
                    value={p.empresa_grupo_id || ""}
                    onValueChange={(v) => update(p.id, { empresa_grupo_id: v || null, sin_clasificar: false })}
                    options={opt(empresas.data || [])}
                    placeholder="Sin empresa"
                    createTitle="Nueva empresa / grupo"
                    onCreate={crearEmpresa}
                  />
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <CreatableCatalogSelect
                    value={p.puesto_id || ""}
                    onValueChange={(v) => update(p.id, { puesto_id: v || null, sin_clasificar: false })}
                    options={opt(puestos.data || [])}
                    placeholder="Sin puesto"
                    createTitle="Nuevo puesto"
                    onCreate={crearPuesto}
                  />
                </TableCell>
                <TableCell className="min-w-[220px]">
                  <CreatableCatalogSelect
                    value={p.plaza_id || ""}
                    onValueChange={(v) => update(p.id, { plaza_id: v || null, sin_clasificar: false })}
                    options={opt(plazas.data || [])}
                    placeholder="Sin plaza"
                    createTitle="Nueva plaza"
                    onCreate={crearPlaza}
                  />
                </TableCell>
                <TableCell>
                  {p.user_id ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Vinculado</Badge>
                  ) : (
                    <Badge variant="secondary">Sin usuario</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {p.sin_clasificar ? (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Sin clasificar</Badge>
                  ) : (
                    <Badge variant="outline">Clasificado</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
