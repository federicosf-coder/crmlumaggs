import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Eye, EyeOff, Info, Link2, PackageX, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  useFantasmasCatalogo, useHuerfanosKardex, useMapeos,
  useCostosSinProducto, useCostosSinProductoCount, useCostosIgnorados,
} from "@/hooks/useMapeoProductos";
import { ALMACEN_LABELS, abcColor, statusColor } from "@/hooks/useInventario";

type ProductOptionType = "marca" | "aplicacion" | "uso" | "formula" | "viscosidad" | "categoria" | "linea";

function detectProveedor(empresaVendedora?: string | null): "chevron" | "phillips66" {
  return String(empresaVendedora || "").toLowerCase().includes("phillips") ||
    String(empresaVendedora || "").toLowerCase().includes("galsa")
    ? "phillips66" : "chevron";
}

const HEADER_CLS =
  "bg-gradient-to-r from-violet-50 to-blue-50 [&>tr>th]:uppercase [&>tr>th]:tracking-wide [&>tr>th]:text-xs [&>tr>th]:text-muted-foreground";

// ─── Buscar y vincular Dialog ───────────────────────────────
function BuscarVincularDialog({
  huerfano, open, onClose, onLinked,
}: { huerfano: any | null; open: boolean; onClose: () => void; onLinked?: (h: any) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [piezasTarima, setPiezasTarima] = useState<string>("");

  const { data: productos = [] } = useQuery({
    queryKey: ["productos-search", search],
    queryFn: async () => {
      let q = (supabase as any).from("productos")
        .select("id, codigo, nombre_producto, is_active, presentaciones(nombre)")
        .order("codigo").limit(50);
      if (search) q = q.or(`codigo.ilike.%${search}%,nombre_producto.ilike.%${search}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!huerfano || !selectedId) throw new Error("Falta seleccionar");
      const prov = detectProveedor(huerfano.empresa_vendedora);
      const sel = (productos as any[]).find((p) => p.id === selectedId);
      if (sel && sel.is_active === false) {
        const { error: upErr } = await (supabase as any).from("productos")
          .update({ is_active: true }).eq("id", selectedId);
        if (upErr) throw upErr;
      }
      const { error } = await (supabase as any).from("inv_producto_proveedor").insert({
        producto_id: selectedId,
        proveedor: prov,
        codigo_proveedor: huerfano.codigo_producto,
        codigo_contpaqi: huerfano.codigo_producto,
        piezas_por_tarima: piezasTarima ? Number(piezasTarima) : null,
        confirmado: true,
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv_producto_proveedor"] });
      qc.invalidateQueries({ queryKey: ["huerfanos_kardex"] });
      qc.invalidateQueries({ queryKey: ["huerfanos_count"] });
      qc.invalidateQueries({ queryKey: ["fantasmas_catalogo"] });
      qc.invalidateQueries({ queryKey: ["stock_por_producto"] });
      qc.invalidateQueries({ queryKey: ["inv_costos_producto"] });
      toast.success("Mapeo creado");
      onLinked?.(huerfano);
      setSelectedId(null);
      setSearch("");
      setPiezasTarima("");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Ligar a producto existente</DialogTitle>
        </DialogHeader>
        {huerfano && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Kardex: <span className="font-mono">{huerfano.codigo_producto}</span> — {huerfano.nombre_producto}
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por código o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="border rounded max-h-72 overflow-y-auto">
              <Table>
                <TableBody>
                  {productos.map((p: any) => (
                    <TableRow key={p.id} className={`cursor-pointer ${selectedId === p.id ? "bg-blue-50" : ""}`} onClick={() => setSelectedId(p.id)}>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-2">
                          {p.nombre_producto}
                          {p.is_active === false && (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600">Inactivo</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.presentaciones?.nombre}</TableCell>
                    </TableRow>
                  ))}
                  {productos.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">Sin resultados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Piezas por tarima</Label>
              <Input type="number" value={piezasTarima} onChange={(e) => setPiezasTarima(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter className="bg-muted/40 -m-6 mt-2 p-4 rounded-b-lg">
          <Button
            variant="outline"
            className="mr-auto"
            onClick={() => {
              if (!huerfano) return;
              onClose();
              navigate("/inventory", {
                state: {
                  prefillHuerfano: {
                    codigo: huerfano.codigo_producto,
                    nombre_producto: huerfano.nombre_producto,
                    unidad: huerfano.unidad,
                    proveedor: detectProveedor(huerfano.empresa_vendedora),
                  },
                },
              });
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> No lo encuentro — Crear producto nuevo
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!selectedId || save.isPending}>
            {save.isPending ? "Guardando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editar mapeo Dialog ───────────────────────────────
function EditarMapeoDialog({ mapeo, open, onClose }: { mapeo: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [piezas, setPiezas] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  useEffect(() => {
    if (mapeo) {
      setPiezas(mapeo.piezas_por_tarima ? String(mapeo.piezas_por_tarima) : "");
      setNotas(mapeo.notas || "");
    }
  }, [mapeo?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!mapeo) return;
      const { error } = await (supabase as any).from("inv_producto_proveedor")
        .update({ piezas_por_tarima: piezas ? Number(piezas) : null, notas: notas || null, confirmado: true })
        .eq("id", mapeo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv_producto_proveedor"] });
      toast.success("Mapeo actualizado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Editar mapeo</DialogTitle>
        </DialogHeader>
        {mapeo && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{mapeo.codigo_contpaqi}</span> — {mapeo.productos?.nombre_producto}
            </p>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Piezas por tarima</Label>
              <Input type="number" value={piezas} onChange={(e) => setPiezas(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter className="bg-muted/40 -m-6 mt-2 p-4 rounded-b-lg">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Huérfanos de Kardex ───────────────────────────────
function HuerfanosTab() {
  const { data: huerfanos = [], isLoading } = useHuerfanosKardex();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [ligarTarget, setLigarTarget] = useState<any>(null);
  const [agregandoCodigo, setAgregandoCodigo] = useState<string | null>(null);

  const handleAgregar = async (h: any) => {
    setAgregandoCodigo(h.codigo_producto);
    try {
      const { data: match, error } = await (supabase as any)
        .from("productos")
        .select("id, codigo, nombre_producto, is_active")
        .eq("codigo", h.codigo_producto)
        .maybeSingle();
      if (error) throw error;
      if (!match) {
        setLigarTarget(h);
        return;
      }
      const reactivado = match.is_active === false;
      if (reactivado) {
        const { error: upErr } = await (supabase as any)
          .from("productos").update({ is_active: true }).eq("id", match.id);
        if (upErr) throw upErr;
      }
      const { error: insErr } = await (supabase as any).from("inv_producto_proveedor").insert({
        producto_id: match.id,
        proveedor: detectProveedor(h.empresa_vendedora),
        codigo_proveedor: h.codigo_producto,
        codigo_contpaqi: h.codigo_producto,
        confirmado: true,
        creado_por: user?.id ?? null,
      });
      if (insErr) throw insErr;
      ["inv_producto_proveedor", "huerfanos_kardex", "huerfanos_count", "fantasmas_catalogo", "stock_por_producto"]
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Vinculado automáticamente a "${match.nombre_producto}"${reactivado ? " (reactivado)" : ""}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAgregandoCodigo(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-light">
          <AlertTriangle className="h-5 w-5 text-red-600" /> Huérfanos de Kardex
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estos productos tienen stock en el kardex pero NO están en el catálogo. Los vendedores no pueden cotizarlos.
        </p>
        {huerfanos.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            ⚠️ {huerfanos.length} producto(s) con inventario no están en el catálogo de productos
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader className={HEADER_CLS}>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">TJ</TableHead>
                  <TableHead className="text-right">MXL</TableHead>
                  <TableHead className="text-right">MOR</TableHead>
                  <TableHead className="text-right">ENS</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {huerfanos.map((h: any, i: number) => {
                  const prov = detectProveedor(h.empresa_vendedora);
                  return (
                    <TableRow key={h.codigo_producto} className={i % 2 ? "bg-muted/20" : ""}>
                      <TableCell className="font-mono text-xs">{h.codigo_producto}</TableCell>
                      <TableCell className="text-sm">{h.nombre_producto}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={prov === "chevron" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}>
                          {prov === "chevron" ? "Chevron" : "Phillips 66"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{h.unidad}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.stock_almacen_1002 ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.stock_almacen_1001 ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.stock_almacen_1003 ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.stock_almacen_1004 ?? 0}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{h.stock_total ?? 0}</TableCell>
                      <TableCell><Badge variant="outline" className={abcColor(h.clasificacion_abc)}>{h.clasificacion_abc || "—"}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(h.estatus_inventario)}>{h.estatus_inventario || "—"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={agregandoCodigo === h.codigo_producto}
                            onClick={() => handleAgregar(h)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {agregandoCodigo === h.codigo_producto ? "Agregando..." : "Agregar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {huerfanos.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No hay huérfanos 🎉</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <BuscarVincularDialog huerfano={ligarTarget} open={!!ligarTarget} onClose={() => setLigarTarget(null)} />
    </Card>
  );
}

// ─── Tab: Fantasmas de Catálogo ───────────────────────────────
function FantasmasTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: fantasmas = [], isLoading } = useFantasmasCatalogo();
  const [confirmDesactivar, setConfirmDesactivar] = useState<any>(null);

  const desactivar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("productos").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productos"] });
      qc.invalidateQueries({ queryKey: ["fantasmas_catalogo"] });
      toast.success("Producto desactivado");
      setConfirmDesactivar(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-light">
          <PackageX className="h-5 w-5 text-yellow-600" /> Fantasmas de Catálogo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estos productos están en el catálogo y activos, pero no tienen existencia en ningún almacén.
        </p>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5" />
          Pueden estar agotados temporalmente o ser productos que aún no se han recibido.
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader className={HEADER_CLS}>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fantasmas.map((p: any, i: number) => (
                  <TableRow key={p.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                    <TableCell className="text-sm">{p.nombre_producto}</TableCell>
                    <TableCell className="text-xs">{p.presentaciones?.nombre || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-gray-50 text-gray-600">Sin stock</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/inventory?search=${encodeURIComponent(p.codigo)}`)}>
                          <Eye className="h-3 w-3 mr-1" /> Ver
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDesactivar(p)}>
                          Desactivar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {fantasmas.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin fantasmas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmDesactivar} onOpenChange={(v) => { if (!v) setConfirmDesactivar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto <span className="font-mono">{confirmDesactivar?.codigo}</span> dejará de estar disponible para nuevas cotizaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDesactivar && desactivar.mutate(confirmDesactivar.id)}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Tab: Mapeados ───────────────────────────────
function MapeadosTab() {
  const qc = useQueryClient();
  const { data: mapeos = [], isLoading } = useMapeos();
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [filterProv, setFilterProv] = useState<string>("all");
  const [filterConf, setFilterConf] = useState<string>("all");

  const filtered = mapeos.filter((m: any) =>
    (filterProv === "all" || m.proveedor === filterProv) &&
    (filterConf === "all" || (filterConf === "conf" ? m.confirmado : !m.confirmado))
  );

  const desvincular = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("inv_producto_proveedor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv_producto_proveedor"] });
      qc.invalidateQueries({ queryKey: ["huerfanos_kardex"] });
      qc.invalidateQueries({ queryKey: ["huerfanos_count"] });
      qc.invalidateQueries({ queryKey: ["stock_por_producto"] });
      toast.success("Mapeo eliminado");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-light">
          <Link2 className="h-5 w-5 text-green-600" /> Mapeados
        </CardTitle>
        <p className="text-sm text-muted-foreground">Productos correctamente vinculados entre kardex y catálogo.</p>
        <div className="flex gap-2 pt-2">
          <Select value={filterProv} onValueChange={setFilterProv}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              <SelectItem value="chevron">Chevron</SelectItem>
              <SelectItem value="phillips66">Phillips 66</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterConf} onValueChange={setFilterConf}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="conf">Confirmados</SelectItem>
              <SelectItem value="pend">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader className={HEADER_CLS}>
                <TableRow>
                  <TableHead>Código CONTPAQi</TableHead>
                  <TableHead>Código proveedor</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Pzs/tarima</TableHead>
                  <TableHead>Confirmado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any, i: number) => (
                  <TableRow key={m.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="font-mono text-xs">{m.codigo_contpaqi}</TableCell>
                    <TableCell className="font-mono text-xs">{m.codigo_proveedor}</TableCell>
                    <TableCell className="text-sm">{m.productos?.nombre_producto || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.proveedor === "chevron" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}>
                        {m.proveedor === "chevron" ? "Chevron" : "Phillips 66"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.piezas_por_tarima ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.confirmado ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}>
                        {m.confirmado ? "Sí" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(m)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(m)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin mapeos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <EditarMapeoDialog mapeo={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular mapeo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el vínculo entre <span className="font-mono">{deleteTarget?.codigo_contpaqi}</span> y el producto del catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && desvincular.mutate(deleteTarget.id)}>
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Página principal ───────────────────────────────
function CostosSinProductoTab() {
  const canViewCostos = useCanViewCostos();
  const { data: rows = [], isLoading } = useCostosSinProducto();
  const { data: ignorados = [] } = useCostosIgnorados();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ligarTarget, setLigarTarget] = useState<any>(null);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);

  const ignoradosSet = new Set((ignorados as any[]).map((i) => i.codigo_producto));
  const visibles = (rows as any[]).filter(
    (r) => !ocultos.includes(r.codigo_producto) && !ignoradosSet.has(r.codigo_producto),
  );
  const rowsPorCodigo = new Map((rows as any[]).map((r) => [r.codigo_producto, r]));

  const ignorarMut = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await (supabase as any)
        .from("inv_costos_producto_ignorados")
        .insert({ codigo_producto: r.codigo_producto, empresa: r.empresa, ignorado_por: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Código ignorado");
      queryClient.invalidateQueries({ queryKey: ["inv_costos_producto_ignorados"] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo ignorar"),
  });

  const quitarMut = useMutation({
    mutationFn: async (codigo: string) => {
      const { error } = await (supabase as any)
        .from("inv_costos_producto_ignorados")
        .delete()
        .eq("codigo_producto", codigo);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quitado de ignorados");
      queryClient.invalidateQueries({ queryKey: ["inv_costos_producto_ignorados"] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo quitar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-light">
          <PackageX className="h-5 w-5 text-orange-600" /> Costos sin Producto
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Códigos con costo cargado desde listas de proveedor que aún no existen en el catálogo.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader className={HEADER_CLS}>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Marca</TableHead>
                  {canViewCostos && <TableHead className="text-right">Costo</TableHead>}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r: any, i: number) => (
                  <TableRow key={r.codigo_producto} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="font-mono text-xs">{r.codigo_producto}</TableCell>
                    <TableCell className="text-sm">{r.nombre_en_archivo || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.empresa === "lumaggs" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}>
                        {r.marca_label}
                      </Badge>
                    </TableCell>
                    {canViewCostos && (
                      <TableCell className="text-right tabular-nums">
                        {r.costo_efectivo != null ? Number(r.costo_efectivo).toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/inventory", {
                            state: {
                              prefillHuerfano: {
                                codigo: r.codigo_producto,
                                nombre_producto: r.nombre_en_archivo,
                                unidad: null,
                                proveedor: r.empresa === "lumaggs" ? "chevron" : "phillips66",
                              },
                            },
                          })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Crear producto nuevo
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLigarTarget({
                            codigo_producto: r.codigo_producto,
                            nombre_producto: r.nombre_en_archivo,
                            empresa_vendedora: r.empresa === "lumaggs" ? "lumaggs" : "galsa",
                            unidad: null,
                          })}
                        >
                          <Link2 className="h-3 w-3 mr-1" /> Vincular a producto existente
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ignorarMut.isPending}
                          onClick={() => ignorarMut.mutate(r)}
                        >
                          <EyeOff className="h-3 w-3 mr-1" /> Ignorar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visibles.length === 0 && (
                  <TableRow><TableCell colSpan={canViewCostos ? 5 : 4} className="text-center text-muted-foreground py-8">Sin costos huérfanos 🎉</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={() => setMostrarIgnorados((v) => !v)}>
            {mostrarIgnorados ? "Ocultar" : "Mostrar"} ignorados ({(ignorados as any[]).length})
          </Button>
          {mostrarIgnorados && (
            <div className="overflow-x-auto border rounded-md mt-3">
              <Table>
                <TableHeader className={HEADER_CLS}>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Marca</TableHead>
                    {canViewCostos && <TableHead className="text-right">Costo</TableHead>}
                    <TableHead>Ignorado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ignorados as any[]).map((ig, i) => {
                    const r = rowsPorCodigo.get(ig.codigo_producto);
                    return (
                      <TableRow key={ig.codigo_producto} className={i % 2 ? "bg-muted/20" : ""}>
                        <TableCell className="font-mono text-xs">{ig.codigo_producto}</TableCell>
                        <TableCell className="text-sm">{r?.nombre_en_archivo || "—"}</TableCell>
                        <TableCell className="text-sm">{r?.marca_label || "—"}</TableCell>
                        {canViewCostos && (
                          <TableCell className="text-right tabular-nums">
                            {r?.costo_efectivo != null
                              ? Number(r.costo_efectivo).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
                              : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-xs">{ig.ignorado_por || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {ig.ignorado_at ? new Date(ig.ignorado_at).toLocaleString("es-MX") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={quitarMut.isPending}
                            onClick={() => {
                              if (window.confirm("¿Quitar este código de ignorados?")) quitarMut.mutate(ig.codigo_producto);
                            }}
                          >
                            Quitar de ignorados
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(ignorados as any[]).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sin códigos ignorados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
      <BuscarVincularDialog
        huerfano={ligarTarget}
        open={!!ligarTarget}
        onLinked={(h) => h && setOcultos((prev) => [...prev, h.codigo_producto])}
        onClose={() => setLigarTarget(null)}
      />
    </Card>
  );
}

export function MapeoTabsContent() {
  const { data: huerfanos = [] } = useHuerfanosKardex();
  const { data: fantasmas = [] } = useFantasmasCatalogo();
  const { data: mapeos = [] } = useMapeos();
  const { data: sinProductoCount = 0 } = useCostosSinProductoCount();
  void sinProductoCount; void CostosSinProductoTab;
  // referencia para evitar warning unused
  void ALMACEN_LABELS;

  return (
    <Tabs defaultValue="huerfanos">
        <TabsList>
          <TabsTrigger value="huerfanos" className="gap-2">
            Huérfanos de Kardex
            {huerfanos.length > 0 && <Badge className="bg-red-500 text-white">{huerfanos.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="fantasmas" className="gap-2">
            Fantasmas de Catálogo
            {fantasmas.length > 0 && <Badge className="bg-yellow-500 text-white">{fantasmas.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mapeados" className="gap-2">
            Mapeados
            {mapeos.length > 0 && <Badge className="bg-green-600 text-white">{mapeos.length}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="huerfanos" className="mt-4"><HuerfanosTab /></TabsContent>
        <TabsContent value="fantasmas" className="mt-4"><FantasmasTab /></TabsContent>
        <TabsContent value="mapeados" className="mt-4"><MapeadosTab /></TabsContent>
    </Tabs>
  );
}

export default function MapeoProductos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapeo de Productos</h1>
        <p className="text-muted-foreground">Reconciliación entre kardex CONTPAQi y catálogo de productos</p>
      </div>
      <MapeoTabsContent />
    </div>
  );
}