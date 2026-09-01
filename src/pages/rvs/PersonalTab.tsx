import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Quita el sufijo de clave del reporte, ej. "PEREZ JUAN - DDA" -> "PEREZ JUAN" */
export const limpiarNombre = (n: string) => (n || "").replace(/\s*-\s*[A-Za-z0-9]{1,6}\s*$/, "").trim();

function NombreMostrarInput({
  value,
  fallback,
  onSave,
}: {
  value: string;
  fallback: string;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <Input
      value={local}
      placeholder={fallback}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const v = local.trim();
        if (v !== (value || "")) onSave(v);
      }}
      className="h-8 text-sm font-medium"
    />
  );
}

interface Persona {
  id: string;
  nombre_reporte: string;
  nombre_mostrar: string | null;
  empresa_grupo_id: string | null;
  puesto_id: string | null;
  plaza_id: string | null;
  user_id: string | null;
  sin_clasificar: boolean;
  requiere_verificacion: boolean | null;
  is_active: boolean;
}


export function PersonalTab() {
  const qc = useQueryClient();
  const [soloSinClasificar, setSoloSinClasificar] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [personaUsuario, setPersonaUsuario] = useState<Persona | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [unirAbierto, setUnirAbierto] = useState(false);
  const { empresas, puestos, plazas, crearEmpresa, crearPuesto, crearPlaza } = useRvsCatalogos();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["rvs_personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_personas")
        .select("id, nombre_reporte, nombre_mostrar, empresa_grupo_id, puesto_id, plaza_id, user_id, sin_clasificar, requiere_verificacion, is_active")
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

  const requiereAcceso = (p: Persona) =>
    !!(puestos.data || []).find((x) => x.id === p.puesto_id)?.requiere_acceso;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return personas.filter(
      (p) =>
        (mostrarInactivas || p.is_active !== false) &&
        (!soloSinClasificar || p.sin_clasificar) &&
        (!q ||
          p.nombre_reporte.toLowerCase().includes(q) ||
          (p.nombre_mostrar || "").toLowerCase().includes(q))
    );
  }, [personas, soloSinClasificar, mostrarInactivas, busqueda]);

  const seleccionadas = useMemo(
    () => personas.filter((p) => seleccion.includes(p.id)),
    [personas, seleccion]
  );

  const toggleSel = (id: string) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const desactivarSeleccionadas = async (activo: boolean) => {
    const { error } = await supabase
      .from("rvs_personas")
      .update({ is_active: activo })
      .in("id", seleccion);
    if (error) return toast.error(error.message);
    toast.success(`${seleccion.length} persona(s) ${activo ? "activadas" : "desactivadas"}`);
    setSeleccion([]);
    qc.invalidateQueries({ queryKey: ["rvs_personas"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-indigo-200/70 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-100 to-sky-100 dark:from-indigo-950/40 dark:to-sky-950/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar persona…"
          className="sm:max-w-xs bg-background/80"
        />

        <div className="flex flex-wrap items-center gap-4">
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
          <div className="flex items-center gap-2">
            <Switch id="ver-inactivas" checked={mostrarInactivas} onCheckedChange={setMostrarInactivas} />
            <Label htmlFor="ver-inactivas" className="text-xs uppercase tracking-wide">
              Ver inactivas ({personas.filter((p) => p.is_active === false).length})
            </Label>
          </div>
        </div>
      </div>

      {seleccion.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {seleccion.length} seleccionada(s)
          </span>
          <Button size="sm" className="h-7 text-xs" disabled={seleccion.length < 2} onClick={() => setUnirAbierto(true)}>
            Unir duplicadas
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => desactivarSeleccionadas(false)}>
            Desactivar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => desactivarSeleccionadas(true)}>
            Activar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSeleccion([])}>
            Limpiar
          </Button>
        </div>
      )}


      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
              <TableHead className="w-8">
                <Checkbox
                  checked={visibles.length > 0 && visibles.every((v) => seleccion.includes(v.id))}
                  onCheckedChange={(c) =>
                    setSeleccion(c ? Array.from(new Set([...seleccion, ...visibles.map((v) => v.id)])) : [])
                  }
                />
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Nombre en reporte</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Nombre a mostrar</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Empresa / Grupo</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Puesto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Plaza</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Usuario</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide">Activa</TableHead>
            </TableRow>

          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground py-6">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && visibles.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground py-6">
                  Sin registros.
                </TableCell>
              </TableRow>
            )}
            {visibles.map((p, idx) => (
              <TableRow key={p.id} className={`${idx % 2 ? "bg-muted/30" : ""} ${p.is_active === false ? "opacity-60" : ""}`}>
                <TableCell>
                  <Checkbox checked={seleccion.includes(p.id)} onCheckedChange={() => toggleSel(p.id)} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.nombre_reporte}</TableCell>

                <TableCell className="min-w-[220px]">
                  <NombreMostrarInput
                    value={p.nombre_mostrar ?? ""}
                    fallback={limpiarNombre(p.nombre_reporte)}
                    onSave={(v) => update(p.id, { nombre_mostrar: v || limpiarNombre(p.nombre_reporte) })}
                  />
                </TableCell>
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
                  ) : requiereAcceso(p) ? (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPersonaUsuario(p)}>
                      Crear usuario
                    </Button>
                  ) : (
                    <Badge variant="secondary">Sin usuario</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {p.sin_clasificar ? (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Sin clasificar</Badge>
                  ) : p.requiere_verificacion ? (
                    <span className="inline-flex items-center gap-1">
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Verificar</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        title="Marcar como revisado"
                        onClick={() => update(p.id, { requiere_verificacion: false })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </span>
                  ) : (
                    <Badge variant="outline">Clasificado</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.is_active !== false}
                    onCheckedChange={(v) => update(p.id, { is_active: v })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UnirPersonasDialog
        open={unirAbierto}
        onOpenChange={setUnirAbierto}
        personas={seleccionadas}
        onDone={() => {
          setSeleccion([]);
          qc.invalidateQueries({ queryKey: ["rvs_personas"] });
          qc.invalidateQueries({ queryKey: ["rvs_ventas_mes"] });
        }}
      />

      <CrearUsuarioDialog
        persona={personaUsuario}
        onClose={() => setPersonaUsuario(null)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["rvs_personas"] })}
      />
    </div>

  );
}

function CrearUsuarioDialog({
  persona,
  onClose,
  onCreated,
}: {
  persona: Persona | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (persona) {
      setFullName((persona.nombre_reporte || "").replace(/\s*-\s*[A-Z0-9]{2,6}$/, "").trim());
      setEmail("");
    }
  }, [persona]);

  const crear = async () => {
    if (!persona) return;
    const correo = email.trim().toLowerCase();
    if (!correo || !fullName.trim()) {
      toast.error("Nombre y correo son requeridos");
      return;
    }
    setSaving(true);
    const tempPassword = crypto.randomUUID().slice(0, 10);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: correo,
        password: tempPassword,
        full_name: fullName.trim(),
        phone: null,
        plaza_id: persona.plaza_id,
        team_ids: [],
        roles: ["sales"],
      },
    });
    if (error || (data as any)?.error) {
      setSaving(false);
      toast.error((data as any)?.error || error?.message || "No se pudo crear el usuario");
      return;
    }
    const newUserId = (data as any)?.user_id as string | undefined;
    if (newUserId) {
      const { error: upErr } = await supabase
        .from("rvs_personas")
        .update({ user_id: newUserId, requiere_verificacion: true })
        .eq("id", persona.id);
      if (upErr) toast.error(upErr.message);
    }
    setSaving(false);
    toast.success(`Usuario creado. Contraseña temporal: ${tempPassword}`, { duration: 15000 });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={!!persona} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-lg font-semibold tracking-tight">Crear usuario</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-light">
            Se generará una contraseña temporal que deberás compartir manualmente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 font-light" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Correo</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="h-9 font-light"
            />
          </div>
        </div>
        <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={saving}>
            {saving ? "Creando…" : "Crear y vincular"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
