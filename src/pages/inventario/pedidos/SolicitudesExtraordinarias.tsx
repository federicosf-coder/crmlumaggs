import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, Check, ChevronsUpDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Solicitud = {
  id: string;
  codigo_producto: string | null;
  producto_descripcion?: string | null;
  cantidad: number;
  tipo: string;
  motivo: string;
  estatus: string;
  activo: boolean;
  solicitado_por: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  notas_revision: string | null;
  created_at: string;
};

type OpcionProducto = { codigo: string; nombre: string; en_catalogo: boolean; activo: boolean };

const ESTATUS_CLS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  aprobada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  en_espera: "bg-blue-100 text-blue-800 border-blue-200",
  rechazada: "bg-red-100 text-red-800 border-red-200",
};
const ESTATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente", aprobada: "Aprobada", en_espera: "En espera", rechazada: "Rechazada",
};

export default function SolicitudesExtraordinarias() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const puedeRevisar = hasRole("admin") || hasRole("manager") || hasRole("warehouse");

  const [fEstatus, setFEstatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [revision, setRevision] = useState<{ row: Solicitud; accion: "aprobada" | "en_espera" | "rechazada" } | null>(null);
  const [notas, setNotas] = useState("");
  const [editar, setEditar] = useState<Solicitud | null>(null);
  const [toggleActivo, setToggleActivo] = useState<{ row: Solicitud; valor: boolean; titulo: string } | null>(null);

  const { data: solicitudes = [] } = useQuery({
    queryKey: ["solicitudes_extraordinarias"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_solicitudes_extraordinarias")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Solicitud[];
    },
  });

  const { data: productos = [] } = useQuery({
    queryKey: ["productos_solext"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("productos")
        .select("codigo, nombre, is_active")
        .limit(20000);
      if (error) throw error;
      return (data || []) as { codigo: string; nombre: string; is_active: boolean }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: costosProd = [] } = useQuery({
    queryKey: ["costos_producto_solext"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inv_costos_producto")
        .select("codigo_producto, nombre_en_archivo, created_at")
        .order("created_at", { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data || []) as { codigo_producto: string; nombre_en_archivo: string | null }[];
    },
    staleTime: 5 * 60_000,
  });

  const opcionesProducto = useMemo(() => {
    const map = new Map<string, OpcionProducto>();
    productos.forEach((p) => {
      if (p.codigo && !map.has(p.codigo)) {
        map.set(p.codigo, { codigo: p.codigo, nombre: p.nombre, en_catalogo: true, activo: !!p.is_active });
      }
    });
    costosProd.forEach((c) => {
      if (c.codigo_producto && !map.has(c.codigo_producto)) {
        map.set(c.codigo_producto, { codigo: c.codigo_producto, nombre: c.nombre_en_archivo || "", en_catalogo: false, activo: false });
      }
    });
    return Array.from(map.values());
  }, [productos, costosProd]);

  const { data: perfiles = [] } = useQuery({
    queryKey: ["profiles_solext"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, full_name, email");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
    staleTime: 5 * 60_000,
  });

  const nombrePorCodigo = useMemo(() => {
    const m: Record<string, string> = {};
    productos.forEach((p) => { if (p.codigo && !m[p.codigo]) m[p.codigo] = p.nombre; });
    return m;
  }, [productos]);

  const nombreUsuario = (id: string | null) => {
    if (!id) return "—";
    const p = perfiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const solicitanteNombre = useMemo(() => {
    if (!user) return "Yo";
    const p = perfiles.find((x) => x.id === user.id);
    return p?.full_name || p?.email || user.email || "Yo";
  }, [user, perfiles]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (fEstatus !== "todos" && s.estatus !== fEstatus) return false;
      if (fTipo !== "todos" && s.tipo !== fTipo) return false;
      if (q) {
        const hay = `${s.codigo_producto || ""} ${(s.codigo_producto && nombrePorCodigo[s.codigo_producto]) || ""} ${s.producto_descripcion || ""} ${s.motivo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [solicitudes, fEstatus, fTipo, busqueda, nombrePorCodigo]);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["solicitudes_extraordinarias"] });

  const crear = useMutation({
    mutationFn: async (payload: { codigo_producto: string | null; producto_descripcion: string | null; cantidad: number; tipo: string; motivo: string }) => {
      const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").insert({
        ...payload, estatus: "pendiente", solicitado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitud creada"); setNuevaOpen(false); refrescar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const revisar = useMutation({
    mutationFn: async ({ id, estatus, notas_revision }: { id: string; estatus: string; notas_revision: string | null }) => {
      const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").update({
        estatus, notas_revision, revisado_por: user?.id ?? null, revisado_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitud actualizada"); setRevision(null); setNotas(""); refrescar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const setActivo = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").update({ activo: valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Actualizado"); setToggleActivo(null); refrescar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const editarMut = useMutation({
    mutationFn: async ({ id, cantidad, motivo }: { id: string; cantidad: number; motivo: string }) => {
      const { error } = await (supabase as any).from("inv_solicitudes_extraordinarias").update({ cantidad, motivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitud editada"); setEditar(null); refrescar(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={fEstatus} onValueChange={setFEstatus}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="en_espera">En espera</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="unica">Única</SelectItem>
                <SelectItem value="recurrente">Recurrente</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-[280px]" placeholder="Buscar código, producto o motivo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <Button onClick={() => setNuevaOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nueva Solicitud</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 hover:bg-transparent">
                {["Producto", "Cantidad", "Tipo", "Motivo", "Solicitado por", "Fecha", "Estatus", "Acciones"].map((h) => (
                  <TableHead key={h} className="text-[11px] uppercase tracking-wide font-medium text-slate-600">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Sin solicitudes</TableCell></TableRow>
              )}
              {filtradas.map((s, i) => {
                const esDueno = !!user && s.solicitado_por === user.id;
                return (
                  <TableRow key={s.id} className={cn(i % 2 === 1 && "bg-muted/20", "hover:bg-blue-50/40")}>
                    <TableCell>
                      {s.codigo_producto ? (
                        <>
                          <div className="font-medium text-sm">{s.codigo_producto}</div>
                          <div className="text-xs text-muted-foreground">{nombrePorCodigo[s.codigo_producto] || "—"}</div>
                        </>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <span className="font-medium text-sm">{s.producto_descripcion || "—"}</span>
                          <Badge variant="outline" className="text-[10px] font-normal bg-slate-100 text-slate-600 border-slate-200">Sin código</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(s.cantidad).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{s.tipo === "recurrente" ? "Recurrente" : "Única"}</Badge>
                      {!s.activo && <span className="ml-1 text-[11px] text-muted-foreground">(inactiva)</span>}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                      <div className="line-clamp-2">{s.motivo}</div>
                      {s.notas_revision && <div className="mt-1 italic">Rev: {s.notas_revision}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{nombreUsuario(s.solicitado_por)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("es-MX")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTATUS_CLS[s.estatus] || ""}>{ESTATUS_LABEL[s.estatus] || s.estatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {esDueno && s.estatus === "pendiente" && (
                          <Button size="sm" variant="ghost" onClick={() => setEditar(s)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                        )}
                        {puedeRevisar && s.estatus !== "aprobada" && (
                          <Button size="sm" variant="outline" onClick={() => { setRevision({ row: s, accion: "aprobada" }); setNotas(""); }}>Aprobar</Button>
                        )}
                        {puedeRevisar && s.estatus !== "en_espera" && s.estatus !== "rechazada" && (
                          <Button size="sm" variant="outline" onClick={() => { setRevision({ row: s, accion: "en_espera" }); setNotas(""); }}>Dejar en espera</Button>
                        )}
                        {puedeRevisar && s.estatus !== "rechazada" && (
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setRevision({ row: s, accion: "rechazada" }); setNotas(""); }}>Rechazar</Button>
                        )}
                        {puedeRevisar && s.estatus === "aprobada" && s.tipo === "recurrente" && (
                          s.activo
                            ? <Button size="sm" variant="ghost" onClick={() => setToggleActivo({ row: s, valor: false, titulo: "Desactivar solicitud recurrente" })}>Desactivar</Button>
                            : <Button size="sm" variant="ghost" onClick={() => setToggleActivo({ row: s, valor: true, titulo: "Reactivar solicitud recurrente" })}>Reactivar</Button>
                        )}
                        {puedeRevisar && s.estatus === "aprobada" && s.tipo === "unica" && s.activo && (
                          <Button size="sm" variant="ghost" onClick={() => setToggleActivo({ row: s, valor: false, titulo: "Marcar como incluida en pedido" })}>Marcar como incluida en pedido</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NuevaSolicitudDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        productos={opcionesProducto}
        onSubmit={(p) => crear.mutate(p)}
        saving={crear.isPending}
        solicitanteNombre={solicitanteNombre}
      />

      {/* Revisión */}
      <Dialog open={!!revision} onOpenChange={(o) => { if (!o) { setRevision(null); setNotas(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {revision?.accion === "aprobada" ? "Aprobar solicitud" : revision?.accion === "en_espera" ? "Dejar en espera" : "Rechazar solicitud"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {revision?.row.codigo_producto || revision?.row.producto_descripcion} — {Number(revision?.row.cantidad ?? 0).toLocaleString()} pzas
            </p>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide">Notas de revisión (opcional)</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevision(null); setNotas(""); }}>Cancelar</Button>
            <Button
              disabled={revisar.isPending}
              onClick={() => revision && revisar.mutate({ id: revision.row.id, estatus: revision.accion, notas_revision: notas.trim() || null })}
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activar / desactivar */}
      <Dialog open={!!toggleActivo} onOpenChange={(o) => { if (!o) setToggleActivo(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{toggleActivo?.titulo}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {toggleActivo?.valor
              ? "La solicitud volverá a contar para el cálculo de necesidad."
              : "La solicitud dejará de contar para el cálculo de necesidad."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleActivo(null)}>Cancelar</Button>
            <Button disabled={setActivo.isPending} onClick={() => toggleActivo && setActivo.mutate({ id: toggleActivo.row.id, valor: toggleActivo.valor })}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar propia */}
      <Dialog open={!!editar} onOpenChange={(o) => { if (!o) setEditar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar solicitud</DialogTitle></DialogHeader>
          {editar && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Cantidad</Label>
                <Input type="number" value={String(editar.cantidad)} onChange={(e) => setEditar({ ...editar, cantidad: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">Motivo</Label>
                <Textarea rows={3} value={editar.motivo} onChange={(e) => setEditar({ ...editar, motivo: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditar(null)}>Cancelar</Button>
            <Button
              disabled={editarMut.isPending || !editar?.motivo.trim() || !(Number(editar?.cantidad) > 0)}
              onClick={() => editar && editarMut.mutate({ id: editar.id, cantidad: Number(editar.cantidad), motivo: editar.motivo.trim() })}
            >Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NuevaSolicitudDialog({ open, onOpenChange, productos, onSubmit, saving }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productos: OpcionProducto[];
  onSubmit: (p: { codigo_producto: string | null; producto_descripcion: string | null; cantidad: number; tipo: string; motivo: string }) => void;
  saving: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [tipo, setTipo] = useState("unica");
  const [motivo, setMotivo] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [q, setQ] = useState("");
  const [modoDescripcion, setModoDescripcion] = useState(false);
  const [descProducto, setDescProducto] = useState("");
  const [descPresentacion, setDescPresentacion] = useState("");

  const opciones = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? productos.filter((p) => `${p.codigo} ${p.nombre}`.toLowerCase().includes(term))
      : productos;
    return base.slice(0, 50);
  }, [productos, q]);

  const sel = productos.find((p) => p.codigo === codigo);
  const validoProducto = modoDescripcion ? descProducto.trim().length > 0 : !!codigo;
  const valido = validoProducto && Number(cantidad) > 0 && motivo.trim().length > 0;

  const reset = () => {
    setCodigo(""); setCantidad(""); setTipo("unica"); setMotivo(""); setQ("");
    setModoDescripcion(false); setDescProducto(""); setDescPresentacion("");
  };

  const badgeDe = (o: OpcionProducto) =>
    o.en_catalogo && o.activo
      ? <Badge variant="outline" className="text-[10px] font-normal bg-emerald-50 text-emerald-700 border-emerald-200">En catálogo</Badge>
      : o.en_catalogo
        ? <Badge variant="outline" className="text-[10px] font-normal bg-red-50 text-red-700 border-red-200">Inactivo</Badge>
        : <Badge variant="outline" className="text-[10px] font-normal bg-amber-50 text-amber-700 border-amber-200">No en catálogo</Badge>;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva Solicitud Extraordinaria</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Producto</Label>
            {modoDescripcion ? (
              <div className="space-y-3">
                <Input value={descProducto} onChange={(e) => setDescProducto(e.target.value)} placeholder="Ej. Aceite Havoline 20W50" />
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide">Presentación</Label>
                  <Input value={descPresentacion} onChange={(e) => setDescPresentacion(e.target.value)} placeholder="Ej. Cubeta 19L" />
                </div>
                <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={() => setModoDescripcion(false)}>
                  Buscar por código en su lugar
                </Button>
              </div>
            ) : (
            <>
            {sel && (
              <div className="flex items-center gap-2 pb-1">
                <span className="text-xs text-muted-foreground truncate">{sel.codigo} — {sel.nombre}</span>
                {badgeDe(sel)}
              </div>
            )}
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {sel ? `${sel.codigo} — ${sel.nombre}` : "Buscar producto por código o nombre…"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Código o nombre…" value={q} onValueChange={setQ} />
                  <CommandList>
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {opciones.map((p) => (
                        <CommandItem key={p.codigo} value={p.codigo} onSelect={() => { setCodigo(p.codigo); setComboOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", codigo === p.codigo ? "opacity-100" : "opacity-0")} />
                          <span className="text-xs font-medium mr-2">{p.codigo}</span>
                          <span className="text-xs text-muted-foreground truncate">{p.nombre}</span>
                          <span className="ml-auto pl-2">{badgeDe(p)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup>
                      <CommandItem
                        value="__describir__"
                        onSelect={() => { setModoDescripcion(true); setCodigo(""); setComboOpen(false); }}
                        className="text-xs font-medium text-violet-700"
                      >
                        No encuentro el producto, quiero describirlo
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            </>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Cantidad</Label>
            <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Única — para un pedido puntual</SelectItem>
                <SelectItem value="recurrente">Recurrente — se mantiene mientras esté activa (pico de demanda, cliente nuevo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Motivo / Justificación</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explica por qué se requiere esta cantidad adicional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valido || saving}
            onClick={() => onSubmit(
              modoDescripcion
                ? {
                    codigo_producto: null,
                    producto_descripcion: [descProducto.trim(), descPresentacion.trim()].filter(Boolean).join(" — "),
                    cantidad: Number(cantidad), tipo, motivo: motivo.trim(),
                  }
                : { codigo_producto: codigo, producto_descripcion: null, cantidad: Number(cantidad), tipo, motivo: motivo.trim() }
            )}
          >
            Crear solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
