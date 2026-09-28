import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Users2, Plus, Trash2, Link2Off, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface EmpresaLite {
  id: string;
  name: string;
  razon_social: string | null;
  grupo_comercial_id: string | null;
  plazas?: { nombre: string } | null;
}

export function GruposComercialesTab({ onOpenCompany }: { onOpenCompany?: (companyId: string) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDesc, setNuevoDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [empresaSel, setEmpresaSel] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["grupos_comerciales", "admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("grupos_comerciales")
        .select("id, nombre, descripcion, activo")
        .order("nombre");
      if (error) throw error;
      return (data || []) as Grupo[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["companies_grupos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("id, name, razon_social, grupo_comercial_id, plazas(nombre)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as EmpresaLite[];
    },
  });

  const empresasPorGrupo = useMemo(() => {
    const m = new Map<string, EmpresaLite[]>();
    for (const e of empresas) {
      if (!e.grupo_comercial_id) continue;
      const arr = m.get(e.grupo_comercial_id) || [];
      arr.push(e);
      m.set(e.grupo_comercial_id, arr);
    }
    return m;
  }, [empresas]);

  const gruposFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => {
      if (g.nombre.toLowerCase().includes(q)) return true;
      return (empresasPorGrupo.get(g.id) || []).some(
        (e) => e.name.toLowerCase().includes(q) || (e.razon_social || "").toLowerCase().includes(q)
      );
    });
  }, [grupos, search, empresasPorGrupo]);

  const grupoDetalle = grupos.find((g) => g.id === detalleId) || null;
  const integrantes = detalleId ? empresasPorGrupo.get(detalleId) || [] : [];

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["grupos_comerciales"] });
    qc.invalidateQueries({ queryKey: ["companies_grupos"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
  };

  const crearGrupo = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      toast.error("Escribe el nombre del grupo");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("grupos_comerciales")
        .insert({ nombre, descripcion: nuevoDesc.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Grupo creado");
      setNuevoOpen(false);
      setNuevoNombre("");
      setNuevoDesc("");
      refrescar();
      setDetalleId(data.id);
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear el grupo");
    } finally {
      setSaving(false);
    }
  };

  const abrirDetalle = (g: Grupo) => {
    setDetalleId(g.id);
    setEditNombre(g.nombre);
    setEditDesc(g.descripcion || "");
    setEmpresaSel("");
  };

  const guardarCabecera = async () => {
    if (!grupoDetalle) return;
    const nombre = editNombre.trim();
    if (!nombre) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("grupos_comerciales")
        .update({ nombre, descripcion: editDesc.trim() || null })
        .eq("id", grupoDetalle.id);
      if (error) throw error;
      toast.success("Grupo actualizado");
      refrescar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  };

  const vincular = async () => {
    if (!grupoDetalle || !empresaSel) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({ grupo_comercial_id: grupoDetalle.id })
        .eq("id", empresaSel);
      if (error) throw error;
      toast.success("Empresa agregada al grupo");
      setEmpresaSel("");
      refrescar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo agregar la empresa");
    } finally {
      setSaving(false);
    }
  };

  const desvincular = async (companyId: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({ grupo_comercial_id: null })
        .eq("id", companyId);
      if (error) throw error;
      toast.success("Empresa desvinculada");
      refrescar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo desvincular");
    } finally {
      setSaving(false);
    }
  };

  const eliminarGrupo = async () => {
    if (!grupoDetalle) return;
    if (!confirm(`¿Eliminar el grupo "${grupoDetalle.nombre}"? Las empresas quedarán sin grupo.`)) return;
    setSaving(true);
    try {
      await (supabase as any)
        .from("companies")
        .update({ grupo_comercial_id: null })
        .eq("grupo_comercial_id", grupoDetalle.id);
      const { error } = await (supabase as any)
        .from("grupos_comerciales")
        .update({ activo: false })
        .eq("id", grupoDetalle.id);
      if (error) throw error;
      toast.success("Grupo eliminado");
      setDetalleId(null);
      refrescar();
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  };

  const opcionesEmpresas = useMemo(
    () =>
      empresas
        .filter((e) => e.grupo_comercial_id !== detalleId)
        .map((e) => ({
          value: e.id,
          label: e.name,
          description: e.razon_social || undefined,
          searchText: `${e.name} ${e.razon_social || ""}`,
          detail: e.grupo_comercial_id ? "Ya pertenece a otro grupo" : undefined,
        })),
    [empresas, detalleId]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupo o empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo grupo
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-[110px]">Empresas</TableHead>
                <TableHead>Integrantes</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
                </TableRow>
              ) : gruposFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin grupos registrados</TableCell>
                </TableRow>
              ) : (
                gruposFiltrados.map((g) => {
                  const items = empresasPorGrupo.get(g.id) || [];
                  return (
                    <TableRow key={g.id} className="cursor-pointer" onClick={() => abrirDetalle(g)}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {g.nombre}
                          {!g.activo && <Badge variant="secondary">Inactivo</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{items.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {items.slice(0, 4).map((e) => (
                            <Badge key={e.id} variant="secondary" className="font-normal">{e.name}</Badge>
                          ))}
                          {items.length > 4 && (
                            <Badge variant="outline">+{items.length - 4}</Badge>
                          )}
                          {items.length === 0 && <span className="text-xs text-muted-foreground">Sin empresas</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.descripcion || "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nuevo grupo */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo grupo comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</Label>
              <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej. Grupo Altisa" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas</Label>
              <Input value={nuevoDesc} onChange={(e) => setNuevoDesc(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
            <Button onClick={crearGrupo} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle de grupo */}
      <Dialog open={!!grupoDetalle} onOpenChange={(o) => { if (!o) setDetalleId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-tight">{grupoDetalle?.nombre}</DialogTitle>
          </DialogHeader>
          {grupoDetalle && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre del grupo</Label>
                  <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas</Label>
                  <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={guardarCabecera} disabled={saving}>Guardar cambios</Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Agregar empresa al grupo</Label>
                <div className="flex gap-2">
                  <SearchableSelect
                    value={empresaSel}
                    onValueChange={setEmpresaSel}
                    options={opcionesEmpresas}
                    placeholder="Buscar empresa por nombre o razón social…"
                    className="flex-1"
                  />
                  <Button onClick={vincular} disabled={!empresaSel || saving}>Agregar</Button>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-light">Empresas del grupo ({integrantes.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-0 sm:px-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre comercial</TableHead>
                        <TableHead>Razón social</TableHead>
                        <TableHead>Plaza</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrantes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aún no hay empresas en este grupo</TableCell>
                        </TableRow>
                      ) : (
                        integrantes.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">
                              {onOpenCompany ? (
                                <button className="hover:underline" onClick={() => { setDetalleId(null); onOpenCompany(e.id); }}>{e.name}</button>
                              ) : e.name}
                            </TableCell>
                            <TableCell>{e.razon_social || "—"}</TableCell>
                            <TableCell>{e.plazas?.nombre || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" title="Desvincular" onClick={() => desvincular(e.id)} disabled={saving}>
                                <Link2Off className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="ghost" className="text-destructive" onClick={eliminarGrupo} disabled={saving}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar grupo
                </Button>
                <Button variant="outline" onClick={() => setDetalleId(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
