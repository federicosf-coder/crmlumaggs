import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { claveFrom } from "./useRvsCatalogos";

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function CatalogoSimple({
  titulo,
  table,
  queryKey,
  conRequiereAcceso,
}: {
  titulo: string;
  table: "rvs_empresas_grupo" | "rvs_puestos";
  queryKey: string;
  conRequiereAcceso?: boolean;
}) {
  const invalidate = useInvalidate();
  const [nuevo, setNuevo] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order("etiqueta");
      if (error) throw error;
      return data || [];
    },
  });

  const crear = async () => {
    if (!nuevo.trim()) return;
    const { error } = await supabase.from(table).insert({ clave: claveFrom(nuevo), etiqueta: nuevo.trim() } as any);
    if (error) return toast.error(error.message);
    setNuevo("");
    invalidate([queryKey]);
  };

  const patch = async (id: string, values: Record<string, any>) => {
    const { error } = await (supabase.from as any)(table).update(values).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate([queryKey]);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crear()}
            placeholder="Nombre nuevo…"
          />
          <Button size="sm" onClick={crear} disabled={!nuevo.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="divide-y rounded-lg border">
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm font-light">{i.etiqueta}</span>
              <div className="flex items-center gap-4">
                {conRequiereAcceso && (
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Requiere acceso
                    <Switch
                      checked={!!i.requiere_acceso}
                      onCheckedChange={(v) => patch(i.id, { requiere_acceso: v })}
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Activo
                  <Switch checked={!!i.is_active} onCheckedChange={(v) => patch(i.id, { is_active: v })} />
                </label>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Sin registros.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ZonasCard() {
  const invalidate = useInvalidate();
  const [nueva, setNueva] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});

  const { data: zonas = [] } = useQuery({
    queryKey: ["rvs_zonas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zonas").select("*").order("nombre");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: plazas = [] } = useQuery({
    queryKey: ["rvs_plazas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre, is_active").order("nombre");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: zp = [] } = useQuery({
    queryKey: ["rvs_zona_plazas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zona_plazas").select("id, zona_id, plaza_id");
      if (error) throw error;
      return data || [];
    },
  });

  const crearZona = async () => {
    if (!nueva.trim()) return;
    const { error } = await supabase.from("zonas").insert({ nombre: nueva.trim() });
    if (error) return toast.error(error.message);
    setNueva("");
    invalidate(["rvs_zonas"]);
  };

  const toggleZona = async (id: string, v: boolean) => {
    const { error } = await supabase.from("zonas").update({ is_active: v }).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate(["rvs_zonas"]);
  };

  const agregarPlaza = async (zonaId: string) => {
    const plazaId = seleccion[zonaId];
    if (!plazaId) return;
    const { error } = await supabase.from("zona_plazas").insert({ zona_id: zonaId, plaza_id: plazaId });
    if (error) return toast.error(error.message);
    setSeleccion((s) => ({ ...s, [zonaId]: "" }));
    invalidate(["rvs_zona_plazas"]);
  };

  const quitarPlaza = async (id: string) => {
    const { error } = await supabase.from("zona_plazas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate(["rvs_zona_plazas"]);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Zonas y plazas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearZona()}
            placeholder="Nueva zona…"
          />
          <Button size="sm" onClick={crearZona} disabled={!nueva.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {zonas.map((z: any) => {
            const asignadas = zp.filter((r: any) => r.zona_id === z.id);
            const disponibles = plazas.filter((p: any) => !asignadas.some((a: any) => a.plaza_id === p.id));
            return (
              <div key={z.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{z.nombre}</span>
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Activa
                    <Switch checked={!!z.is_active} onCheckedChange={(v) => toggleZona(z.id, v)} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {asignadas.map((a: any) => (
                    <Badge key={a.id} variant="secondary" className="gap-1">
                      {plazas.find((p: any) => p.id === a.plaza_id)?.nombre || "—"}
                      <button onClick={() => quitarPlaza(a.id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {asignadas.length === 0 && (
                    <span className="text-xs text-muted-foreground">Sin plazas asignadas.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SearchableSelect
                    value={seleccion[z.id] || ""}
                    onValueChange={(v) => setSeleccion((s) => ({ ...s, [z.id]: v }))}
                    options={disponibles.map((p: any) => ({ value: p.id, label: p.nombre }))}
                    placeholder="Agregar plaza…"
                  />
                  <Button size="sm" variant="outline" onClick={() => agregarPlaza(z.id)} disabled={!seleccion[z.id]}>
                    Agregar
                  </Button>
                </div>
              </div>
            );
          })}
          {zonas.length === 0 && <p className="text-sm text-muted-foreground">Sin zonas registradas.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfiguracionTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CatalogoSimple titulo="Empresas / Grupos" table="rvs_empresas_grupo" queryKey="rvs_empresas_grupo" />
      <CatalogoSimple titulo="Puestos" table="rvs_puestos" queryKey="rvs_puestos" conRequiereAcceso />
      <div className="lg:col-span-2">
        <ZonasCard />
      </div>
    </div>
  );
}
