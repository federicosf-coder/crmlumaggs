import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Tags, BoxesIcon, Pencil, Kanban, Trash2, ChevronDown, ChevronRight, Image, Upload, Loader2, FileText, Building2, Truck, User, Mail, Factory, Search, Settings2, Copy } from "lucide-react";
import { EmailGroupsTab } from "@/components/admin/EmailGroupsTab";
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { SeguimientoEstatusTab } from "@/components/admin/SeguimientoEstatusTab";
import { DocumentosPlantillaCatalogoTab } from "@/components/admin/DocumentosPlantillaCatalogoTab";

type ProductOptionType = "marca" | "aplicacion" | "uso" | "formula" | "viscosidad" | "categoria" | "linea";

const OPTION_TYPE_LABELS: Record<ProductOptionType, string> = {
  marca: "Marca", aplicacion: "Aplicación", uso: "Uso", formula: "Fórmula",
  viscosidad: "Viscosidad", categoria: "Categoría", linea: "Línea",
};
const ALL_OPTION_TYPES: ProductOptionType[] = ["marca", "aplicacion", "uso", "formula", "viscosidad", "categoria", "linea"];

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

// ─── Plazas Tab ──────────────────────────────────────────────
function PlazasTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plazas_all"],
    queryFn: async () => { const { data, error } = await supabase.from("plazas").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [newLat, setNewLat] = useState<string>("");
  const [newLng, setNewLng] = useState<string>("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editLat, setEditLat] = useState<string>("");
  const [editLng, setEditLng] = useState<string>("");

  const add = useMutation({
    mutationFn: async () => {
      const payload: any = { nombre };
      if (newLat !== "") payload.lat = Number(newLat);
      if (newLng !== "") payload.lng = Number(newLng);
      const { error } = await supabase.from("plazas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plazas_all"] });
      qc.invalidateQueries({ queryKey: ["plazas"] });
      setOpen(false); setNombre(""); setNewLat(""); setNewLng("");
      toast.success("Plaza creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nombre: editNombre,
        is_active: editActive,
        lat: editLat === "" ? null : Number(editLat),
        lng: editLng === "" ? null : Number(editLng),
      };
      const { error } = await supabase.from("plazas").update(payload).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plazas_all"] }); qc.invalidateQueries({ queryKey: ["plazas"] }); setEditItem(null); toast.success("Plaza actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditNombre(item.nombre);
    setEditActive(item.is_active);
    setEditLat(item.lat != null ? String(item.lat) : "");
    setEditLng(item.lng != null ? String(item.lng) : "");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Plazas</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Plaza</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Monterrey" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Latitud (punto de partida)</Label><Input type="number" step="any" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="25.6866" /></div>
                <div><Label>Longitud (punto de partida)</Label><Input type="number" step="any" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="-100.3161" /></div>
              </div>
              <p className="text-xs text-muted-foreground">Estas coordenadas se usan como punto de partida para calcular kilómetros de ruta.</p>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Coordenadas</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.lat != null && p.lng != null ? `${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin plazas</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Plaza</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitud (punto de partida)</Label><Input type="number" step="any" value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="25.6866" /></div>
              <div><Label>Longitud (punto de partida)</Label><Input type="number" step="any" value={editLng} onChange={e => setEditLng(e.target.value)} placeholder="-100.3161" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Estas coordenadas se usan como punto de partida para calcular kilómetros de ruta.</p>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Presentaciones Tab ──────────────────────────────────────
function PresentacionesTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["presentaciones_all"],
    queryFn: async () => { const { data, error } = await supabase.from("presentaciones").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [unidades, setUnidades] = useState("1");
  const [palletChv, setPalletChv] = useState("");
  const [palletPhi, setPalletPhi] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editUnidades, setEditUnidades] = useState("1");
  const [editActive, setEditActive] = useState(true);
  const [editPalletChv, setEditPalletChv] = useState("");
  const [editPalletPhi, setEditPalletPhi] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("presentaciones").insert({
        nombre, unidades_equivalentes: Number(unidades),
        pallet_chevron: palletChv ? Number(palletChv) : null,
        pallet_phillips: palletPhi ? Number(palletPhi) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["presentaciones_all"] }); qc.invalidateQueries({ queryKey: ["presentaciones"] }); qc.invalidateQueries({ queryKey: ["presentaciones-all"] }); setOpen(false); setNombre(""); setUnidades("1"); setPalletChv(""); setPalletPhi(""); toast.success("Presentación creada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("presentaciones").update({
        nombre: editNombre,
        unidades_equivalentes: Number(editUnidades),
        is_active: editActive,
        pallet_chevron: editPalletChv ? Number(editPalletChv) : null,
        pallet_phillips: editPalletPhi ? Number(editPalletPhi) : null,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["presentaciones_all"] }); qc.invalidateQueries({ queryKey: ["presentaciones"] }); qc.invalidateQueries({ queryKey: ["presentaciones-all"] }); setEditItem(null); toast.success("Presentación actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => { setEditItem(item); setEditNombre(item.nombre); setEditUnidades(String(item.unidades_equivalentes)); setEditActive(item.is_active); setEditPalletChv(item.pallet_chevron != null ? String(item.pallet_chevron) : ""); setEditPalletPhi(item.pallet_phillips != null ? String(item.pallet_phillips) : ""); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BoxesIcon className="h-5 w-5" /> Presentaciones</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Presentación</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cubeta 19L" /></div>
              <div><Label>Unidades Equivalentes</Label><Input type="number" value={unidades} onChange={e => setUnidades(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pallet Chevron (pzs/tarima)</Label><Input type="number" value={palletChv} onChange={e => setPalletChv(e.target.value)} /></div>
                <div><Label>Pallet Phillips (pzs/tarima)</Label><Input type="number" value={palletPhi} onChange={e => setPalletPhi(e.target.value)} /></div>
              </div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Uds. Equiv.</TableHead><TableHead>Pallet Chevron</TableHead><TableHead>Pallet Phillips</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.unidades_equivalentes}</TableCell>
                  <TableCell className="tabular-nums">{(p as any).pallet_chevron ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{(p as any).pallet_phillips ?? "—"}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin presentaciones</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Presentación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Unidades Equivalentes</Label><Input type="number" value={editUnidades} onChange={e => setEditUnidades(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pallet Chevron (pzs/tarima)</Label><Input type="number" value={editPalletChv} onChange={e => setEditPalletChv(e.target.value)} /></div>
              <div><Label>Pallet Phillips (pzs/tarima)</Label><Input type="number" value={editPalletPhi} onChange={e => setEditPalletPhi(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Centros de Suministro Tab ───────────────────────────────
const FS_COBERTURA: Record<string, number> = { A: 60, B: 45, C: 30 };
const FS_SEGURIDAD: Record<string, number> = { A: 15, B: 10, C: 7 };

function FuentesSuministroTab() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editLead, setEditLead] = useState("");
  const [confirmAplicar, setConfirmAplicar] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inv_fuentes_suministro_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inv_fuentes_suministro").select("*").order("nombre");
      if (error) throw error; return data as any[];
    },
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditNombre(item.nombre || "");
    setEditLead(item.lead_time_dias != null ? String(item.lead_time_dias) : "");
  };

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inv_fuentes_suministro").update({
        nombre: editNombre,
        lead_time_dias: Number(editLead) || 0,
        updated_at: new Date().toISOString(),
      }).eq("code", editItem.code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv_fuentes_suministro_all"] });
      qc.invalidateQueries({ queryKey: ["inv_fuentes_suministro"] });
      toast.success("Centro de suministro actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const aplicar = useMutation({
    mutationFn: async () => {
      const code = editItem.code as string;
      const lead = Number(editLead) || 0;

      const { data: nivs, error: e1 } = await supabase
        .from("inv_niveles_inventario")
        .select("codigo_producto, clasificacion_abc, piezas_por_tarima, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004")
        .eq("fuente_suministro", code);
      if (e1) throw e1;
      const rows = (nivs || []) as any[];
      if (rows.length === 0) return 0;

      const { error: e2 } = await supabase
        .from("inv_niveles_inventario")
        .update({ lead_time_dias: lead })
        .eq("fuente_suministro", code);
      if (e2) throw e2;

      const codigos = Array.from(new Set(rows.map(r => r.codigo_producto)));
      const nivMap = new Map(rows.map(r => [r.codigo_producto, r]));
      const hoyIso = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < codigos.length; i += 200) {
        const chunk = codigos.slice(i, i + 200);

        const { data: dem } = await supabase
          .from("inv_demanda_plaza")
          .select("codigo_producto, almacen, demanda_diaria_promedio, periodo_inicio")
          .in("codigo_producto", chunk)
          .order("periodo_inicio", { ascending: false });
        const ultimaDem = new Map<string, number>();
        for (const d of (dem || []) as any[]) {
          const k = `${d.codigo_producto}|${d.almacen}`;
          if (!ultimaDem.has(k)) ultimaDem.set(k, Number(d.demanda_diaria_promedio || 0));
        }

        const { data: mmRows } = await supabase
          .from("inv_minmax").select("*").in("codigo_producto", chunk);

        for (const r of (mmRows || []) as any[]) {
          const n = nivMap.get(r.codigo_producto);
          const ppt = Math.max(1, Number(n?.piezas_por_tarima ?? 1) || 1);
          const ddia = ultimaDem.get(`${r.codigo_producto}|${r.almacen}`) ?? Number(r.demanda_diaria_hub ?? 0);
          const abc = n?.clasificacion_abc ?? r.clasificacion_abc ?? null;
          const cobertura = abc && FS_COBERTURA[abc] ? FS_COBERTURA[abc] : 45;
          const seguridad = abc && FS_SEGURIDAD[abc] ? FS_SEGURIDAD[abc] : 10;
          const minCalc = Math.ceil((ddia * (lead + seguridad)) / ppt) * ppt;
          const maxCalc = Math.ceil((ddia * (lead + cobertura)) / ppt) * ppt;
          const stock = Number(n?.[`stock_almacen_${r.almacen}`] ?? 0) || 0;
          const reordenCalc = Math.max(0, minCalc - stock);
          await supabase.from("inv_minmax").update({
            lead_time_dias: lead,
            dias_cobertura_objetivo: cobertura,
            dias_stock_seguridad: seguridad,
            minimo_calc: minCalc,
            maximo_calc: maxCalc,
            cantidad_reorden_calc: reordenCalc,
            ultima_actualizacion_calc: hoyIso,
          }).eq("id", r.id);
        }
      }
      return codigos.length;
    },
    onSuccess: (count: number) => {
      setConfirmAplicar(false);
      qc.invalidateQueries({ queryKey: ["inv_minmax"] });
      qc.invalidateQueries({ queryKey: ["inv_niveles_inventario_min"] });
      toast.success(`${count} producto(s) actualizados con el nuevo lead time`);
    },
    onError: (e: any) => { setConfirmAplicar(false); toast.error(e.message); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Centros de Suministro</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Código</TableHead>
              <TableHead className="text-right">Lead Time (días)</TableHead>
              <TableHead>Activo</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((f: any) => (
                <TableRow key={f.code}>
                  <TableCell className="font-medium">{f.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">{f.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.lead_time_dias}</TableCell>
                  <TableCell><Badge variant={f.activo ? "default" : "secondary"}>{f.activo ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Centro de Suministro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Código</Label><Input value={editItem?.code ?? ""} disabled className="font-mono" /></div>
              <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
              <div><Label>Lead Time (días)</Label><Input type="number" min="0" value={editLead} onChange={e => setEditLead(e.target.value)} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmAplicar(true)} disabled={aplicar.isPending || !editLead}>
                {aplicar.isPending ? "Aplicando..." : "Aplicar a productos con esta fuente"}
              </Button>
              <Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>
                {update.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmAplicar} onOpenChange={setConfirmAplicar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Aplicar lead time a los productos?</AlertDialogTitle>
              <AlertDialogDescription>
                Se actualizará el lead time a {editLead} días en todos los productos con fuente "{editItem?.code}" y se recalcularán mínimos, máximos y cantidad de reorden en las 4 plazas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); aplicar.mutate(); }}>Aplicar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ─── Productos Base Tab ──────────────────────────────────────
function ProductoBaseTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["productos_base_all"],
    queryFn: async () => { const { data, error } = await supabase.from("productos_base").select("*").order("nombre"); if (error) throw error; return data as any[]; },
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ["product_option_values", "marca"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_option_values").select("*").eq("option_type", "marca").eq("is_active", true).order("value");
      if (error) throw error; return data as any[];
    },
  });

  const marcaLabel = (id: string | null) => marcas.find((m: any) => m.id === id)?.value || "—";

  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editMarcaId, setEditMarcaId] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("productos_base").insert({
        nombre,
        marca_id: marcaId || null,
        descripcion: descripcion || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos_base_all"] }); qc.invalidateQueries({ queryKey: ["productos_base"] }); setOpen(false); setNombre(""); setMarcaId(""); setDescripcion(""); toast.success("Producto base creado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("productos_base").update({
        nombre: editNombre,
        marca_id: editMarcaId || null,
        descripcion: editDescripcion || null,
        is_active: editActive,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos_base_all"] }); qc.invalidateQueries({ queryKey: ["productos_base"] }); setEditItem(null); toast.success("Producto base actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditNombre(item.nombre || "");
    setEditMarcaId(item.marca_id || "");
    setEditDescripcion(item.descripcion || "");
    setEditActive(item.is_active !== false);
  };

  const filtered = items.filter((p: any) => (p.nombre || "").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BoxesIcon className="h-5 w-5" /> Productos Base</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Producto Base</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Delo 400 XLE" /></div>
              <div>
                <Label>Marca</Label>
                <Select value={marcaId} onValueChange={setMarcaId}>
                  <SelectTrigger><SelectValue placeholder="Sin marca" /></SelectTrigger>
                  <SelectContent>
                    {marcas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descripción</Label><Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-3 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Marca</TableHead><TableHead>Descripción</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{marcaLabel(p.marca_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.descripcion || "—"}</TableCell>
                  <TableCell><Badge variant={p.is_active !== false ? "default" : "secondary"}>{p.is_active !== false ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin productos base</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Producto Base</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div>
              <Label>Marca</Label>
              <Select value={editMarcaId} onValueChange={setEditMarcaId}>
                <SelectTrigger><SelectValue placeholder="Sin marca" /></SelectTrigger>
                <SelectContent>
                  {marcas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descripción</Label><Textarea value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} rows={3} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Options Tab ─────────────────────────────────────────────
function OptionsTab() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<ProductOptionType>("marca");
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>("");

  // Load marcas for the Línea filter
  const { data: marcas = [] } = useQuery({
    queryKey: ["product_option_values", "marca"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_option_values").select("*").eq("option_type", "marca").eq("is_active", true).order("value");
      if (error) throw error; return data;
    },
  });

  const isLinea = selectedType === "linea";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["product_option_values", selectedType, isLinea ? selectedMarcaId : ""],
    queryFn: async () => {
      let query = supabase.from("product_option_values").select("*, parent:parent_id(id, value)").eq("option_type", selectedType).order("value");
      if (isLinea && selectedMarcaId) {
        query = query.eq("parent_id", selectedMarcaId);
      }
      const { data, error } = await query;
      if (error) throw error; return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editParentId, setEditParentId] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const insertData: any = { option_type: selectedType, value };
      if (isLinea && newParentId) insertData.parent_id = newParentId;
      const { error } = await supabase.from("product_option_values").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setOpen(false); setValue(""); setNewParentId(""); toast.success("Opción agregada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const updateData: any = { value: editValue, is_active: editActive };
      if (isLinea) updateData.parent_id = editParentId || null;
      const { error } = await supabase.from("product_option_values").update(updateData).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_option_values"] }); setEditItem(null); toast.success("Opción actualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditValue(item.value);
    setEditActive(item.is_active);
    setEditParentId(item.parent_id || "");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Clasificaciones de Producto</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva Opción</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Opción — {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {isLinea && (
                <div>
                  <Label>Marca *</Label>
                  <Select value={newParentId} onValueChange={setNewParentId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
                    <SelectContent>
                      {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Valor</Label><Input value={value} onChange={e => setValue(e.target.value)} placeholder={isLinea ? "Ej: Delo, Havoline..." : "Ej: Chevron"} /></div>
              <Button onClick={() => add.mutate()} disabled={!value || (isLinea && !newParentId) || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ALL_OPTION_TYPES.map(t => (
            <Button key={t} size="sm" variant={selectedType === t ? "default" : "outline"} onClick={() => { setSelectedType(t); setSelectedMarcaId(""); }}>
              {OPTION_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>

        {isLinea && (
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Filtrar por Marca:</Label>
            <Select value={selectedMarcaId} onValueChange={setSelectedMarcaId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Todas las marcas" /></SelectTrigger>
              <SelectContent>
                {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedMarcaId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMarcaId("")}>Limpiar</Button>
            )}
          </div>
        )}

        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                {isLinea && <TableHead>Marca</TableHead>}
                <TableHead>Valor</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(o => (
                <TableRow key={o.id}>
                  {isLinea && <TableCell className="text-muted-foreground">{(o as any).parent?.value || "—"}</TableCell>}
                  <TableCell className="font-medium">{o.value}</TableCell>
                  <TableCell><Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={isLinea ? 4 : 3} className="text-center text-muted-foreground">Sin opciones para {OPTION_TYPE_LABELS[selectedType]}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar {OPTION_TYPE_LABELS[selectedType]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {isLinea && (
              <div>
                <Label>Marca</Label>
                <Select value={editParentId} onValueChange={setEditParentId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
                  <SelectContent>
                    {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Valor</Label><Input value={editValue} onChange={e => setEditValue(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editValue || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Embudos de Venta Tab ────────────────────────────────────
function EmbudosTab() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["all_pipelines_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_pipelines").select("*").order("marca").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedStages = [] } = useQuery({
    queryKey: ["crm_pipeline_stages", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase.from("crm_pipeline_stages").select("*").eq("pipeline_id", expandedId).order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!expandedId,
  });

  // Edit pipeline name
  const [editPipeline, setEditPipeline] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");

  const updatePipeline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_pipelines").update({ nombre: editNombre }).eq("id", editPipeline.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_pipelines_catalog"] });
      qc.invalidateQueries({ queryKey: ["crm_pipelines"] });
      setEditPipeline(null);
      toast.success("Pipeline actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit stage
  const [editStage, setEditStage] = useState<any>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("#3b82f6");

  const updateStage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_pipeline_stages").update({ name: editStageName, color: editStageColor }).eq("id", editStage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      setEditStage(null);
      toast.success("Etapa actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete pipeline (admin only)
  const [deletePipeline, setDeletePipeline] = useState<any>(null);
  const deletePipelineMutation = useMutation({
    mutationFn: async () => {
      // Check if pipeline has deals
      const { count, error: cErr } = await supabase
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", deletePipeline.id);
      if (cErr) throw cErr;
      if ((count || 0) > 0) {
        throw new Error(`No se puede eliminar: el embudo tiene ${count} negocio(s) asociado(s).`);
      }
      // Delete stages first
      const { error: sErr } = await supabase.from("crm_pipeline_stages").delete().eq("pipeline_id", deletePipeline.id);
      if (sErr) throw sErr;
      const { error } = await supabase.from("crm_pipelines").delete().eq("id", deletePipeline.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_pipelines_catalog"] });
      qc.invalidateQueries({ queryKey: ["crm_pipelines"] });
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      if (expandedId === deletePipeline?.id) setExpandedId(null);
      setDeletePipeline(null);
      toast.success("Embudo eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete stage (admin only)
  const [deleteStage, setDeleteStage] = useState<any>(null);
  const deleteStageMutation = useMutation({
    mutationFn: async () => {
      const { count, error: cErr } = await supabase
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", deleteStage.id);
      if (cErr) throw cErr;
      if ((count || 0) > 0) {
        throw new Error(`No se puede eliminar: la etapa tiene ${count} negocio(s) asociado(s).`);
      }
      const { error } = await supabase.from("crm_pipeline_stages").delete().eq("id", deleteStage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      setDeleteStage(null);
      toast.success("Etapa eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add stage to existing pipeline
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [addStagePipelineId, setAddStagePipelineId] = useState("");
  const [addStageName, setAddStageName] = useState("");
  const [addStageColor, setAddStageColor] = useState("#3b82f6");

  const addStage = useMutation({
    mutationFn: async () => {
      const maxPos = expandedStages.length > 0 ? Math.max(...expandedStages.map(s => s.position)) + 1 : 0;
      const { error } = await supabase.from("crm_pipeline_stages").insert({
        pipeline_id: addStagePipelineId,
        name: addStageName,
        color: addStageColor,
        position: maxPos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_pipeline_stages"] });
      setAddStageOpen(false);
      setAddStageName("");
      toast.success("Etapa agregada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAddStage = (pipelineId: string) => {
    setAddStagePipelineId(pipelineId);
    setAddStageColor(DEFAULT_COLORS[expandedStages.length % DEFAULT_COLORS.length]);
    setAddStageOpen(true);
  };

  // New pipeline
  const [newOpen, setNewOpen] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newMarca, setNewMarca] = useState("chevron");
  const [newStages, setNewStages] = useState([
    { name: "Prospecto", color: "#3b82f6" },
    { name: "Contactado", color: "#8b5cf6" },
    { name: "Propuesta", color: "#f59e0b" },
    { name: "Negociación", color: "#10b981" },
    { name: "Ganado", color: "#22c55e" },
    { name: "Perdido", color: "#ef4444" },
  ]);
  const [creatingPipeline, setCreatingPipeline] = useState(false);

  const handleCreatePipeline = async () => {
    if (!newNombre.trim()) return;
    const validStages = newStages.filter(s => s.name.trim());
    if (validStages.length === 0) { toast.error("Agrega al menos una etapa"); return; }
    setCreatingPipeline(true);
    const { data: newPipeline, error: pErr } = await supabase
      .from("crm_pipelines")
      .insert({ nombre: newNombre, marca: newMarca })
      .select("id")
      .single();
    if (pErr) { toast.error(pErr.message); setCreatingPipeline(false); return; }
    const stageInserts = validStages.map((s, i) => ({ pipeline_id: newPipeline.id, name: s.name, color: s.color, position: i }));
    const { error: sErr } = await supabase.from("crm_pipeline_stages").insert(stageInserts);
    setCreatingPipeline(false);
    if (sErr) { toast.error(sErr.message); return; }
    toast.success("Embudo creado");
    qc.invalidateQueries({ queryKey: ["all_pipelines_catalog"] });
    qc.invalidateQueries({ queryKey: ["crm_pipelines"] });
    setNewOpen(false);
    setNewNombre("");
    setNewStages([
      { name: "Prospecto", color: "#3b82f6" }, { name: "Contactado", color: "#8b5cf6" },
      { name: "Propuesta", color: "#f59e0b" }, { name: "Negociación", color: "#10b981" },
      { name: "Ganado", color: "#22c55e" }, { name: "Perdido", color: "#ef4444" },
    ]);
  };

  const marcaLabel = (m: string) => m === "chevron" ? "Chevron" : m === "phillips66" ? "Phillips 66" : m;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Kanban className="h-5 w-5" /> Embudos de Venta (Pipelines)</CardTitle>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo Embudo</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : pipelines.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No hay pipelines. Crea uno con el botón de arriba.</p>
        ) : (
          <div className="space-y-2">
            {pipelines.map((p) => (
              <div key={p.id} className="border rounded-lg">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedId === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{p.nombre}</span>
                    <Badge variant="outline">{marcaLabel(p.marca)}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditPipeline(p);
                      setEditNombre(p.nombre);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeletePipeline(p); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  </div>
                </div>
                {expandedId === p.id && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Etapas</span>
                      <Button variant="outline" size="sm" onClick={() => openAddStage(p.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Etapa
                      </Button>
                    </div>
                    {expandedStages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin etapas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expandedStages.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.position + 1}</TableCell>
                              <TableCell>
                                <div className="w-6 h-6 rounded" style={{ backgroundColor: s.color }} />
                              </TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditStage(s); setEditStageName(s.name); setEditStageColor(s.color); }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleteStage(s)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit pipeline name */}
      <Dialog open={!!editPipeline} onOpenChange={(v) => { if (!v) setEditPipeline(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Pipeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => updatePipeline.mutate()} disabled={!editNombre || updatePipeline.isPending}>
              {updatePipeline.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit stage */}
      <Dialog open={!!editStage} onOpenChange={(v) => { if (!v) setEditStage(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editStageName} onChange={(e) => setEditStageName(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Label>Color</Label>
              <input type="color" value={editStageColor} onChange={(e) => setEditStageColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateStage.mutate()} disabled={!editStageName || updateStage.isPending}>
              {updateStage.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add stage */}
      <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={addStageName} onChange={(e) => setAddStageName(e.target.value)} placeholder="Ej: Seguimiento" /></div>
            <div className="flex items-center gap-2">
              <Label>Color</Label>
              <input type="color" value={addStageColor} onChange={(e) => setAddStageColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addStage.mutate()} disabled={!addStageName || addStage.isPending}>
              {addStage.isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New pipeline */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Embudo de Venta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={newNombre} onChange={(e) => setNewNombre(e.target.value)} placeholder="Ej: Prospectos Nuevos" />
            </div>
            <div className="space-y-2">
              <Label>CRM (Marca)</Label>
              <Select value={newMarca} onValueChange={setNewMarca}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chevron">Chevron</SelectItem>
                  <SelectItem value="phillips66">Phillips 66</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setNewStages(prev => [...prev, { name: "", color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] }])}>
                  <Plus className="h-3 w-3 mr-1" /> Etapa
                </Button>
              </div>
              <div className="space-y-2">
                {newStages.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="color" value={stage.color} onChange={(e) => setNewStages(prev => prev.map((s, i) => i === idx ? { ...s, color: e.target.value } : s))} className="w-8 h-8 rounded border cursor-pointer flex-shrink-0" />
                    <Input value={stage.name} onChange={(e) => setNewStages(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} placeholder={`Etapa ${idx + 1}`} className="flex-1" />
                    {newStages.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setNewStages(prev => prev.filter((_, i) => i !== idx))} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePipeline} disabled={!newNombre.trim() || newStages.filter(s => s.name.trim()).length === 0 || creatingPipeline}>
              {creatingPipeline ? "Creando..." : "Crear Embudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete pipeline confirmation */}
      <AlertDialog open={!!deletePipeline} onOpenChange={(v) => { if (!v) setDeletePipeline(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar embudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el embudo "{deletePipeline?.nombre}" y todas sus etapas. Esta acción no se puede deshacer. Si el embudo tiene negocios asociados, no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deletePipelineMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePipelineMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete stage confirmation */}
      <AlertDialog open={!!deleteStage} onOpenChange={(v) => { if (!v) setDeleteStage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la etapa "{deleteStage?.name}". Si tiene negocios asociados, no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteStageMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStageMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Logos Tab ────────────────────────────────────────────────
function LogosTab() {
  const qc = useQueryClient();
  const { data: logos = [], isLoading } = useQuery({
    queryKey: ["brand_logos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_logos").select("*").order("label");
      if (error) throw error;
      return data;
    },
  });

  const [uploading, setUploading] = useState<string | null>(null);

  const getPublicUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (logoId: string, logoKey: string, file: File) => {
    setUploading(logoId);
    const ext = file.name.split(".").pop();
    const filePath = `${logoKey}.${ext}`;

    // Upload file (upsert)
    const { error: uploadErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(null);
      return;
    }

    // Update record
    const { error: updateErr } = await supabase.from("brand_logos").update({ storage_path: filePath, updated_at: new Date().toISOString() }).eq("id", logoId);
    if (updateErr) toast.error(updateErr.message);
    else toast.success("Logo actualizado");

    qc.invalidateQueries({ queryKey: ["brand_logos"] });
    setUploading(null);
  };

  // Add new logo entry
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const addLogo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brand_logos").insert({ key: newKey.toLowerCase().replace(/\s+/g, "_"), label: newLabel });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand_logos"] });
      setAddOpen(false);
      setNewKey("");
      setNewLabel("");
      toast.success("Entrada de logo creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Logos</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Logo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Identificador (clave)</Label><Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Ej: chevron" /></div>
              <div><Label>Nombre / Etiqueta</Label><Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ej: Chevron" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => addLogo.mutate()} disabled={!newKey || !newLabel || addLogo.isPending}>
                {addLogo.isPending ? "Guardando..." : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : logos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No hay logos configurados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {logos.map((logo) => {
              const url = getPublicUrl(logo.storage_path);
              return (
                <div key={logo.id} className="border rounded-lg p-4 flex flex-col items-center gap-3">
                  <p className="font-medium text-sm">{logo.label}</p>
                  <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-md overflow-hidden">
                    {url ? (
                      <img src={`${url}?t=${logo.updated_at}`} alt={logo.label} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Image className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(logo.id, logo.key, file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex items-center gap-1 text-sm text-primary hover:underline">
                      {uploading === logo.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Upload className="h-3 w-3" /> {url ? "Cambiar" : "Subir"} logo</>
                      )}
                    </div>
                  </label>
                  <Badge variant="outline" className="text-xs">{logo.key}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Condiciones Comerciales Tab ─────────────────────────────
const EMPRESA_LABELS: Record<string, string> = {
  lumaggs_chevron: "Lumaggs (Chevron)",
  galsa_phillips66: "Galsa (Phillips 66)",
};

function CondicionesTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["condiciones_comerciales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("condiciones_comerciales").select("*").order("empresa_vendedora");
      if (error) throw error;
      return data;
    },
  });

  const [editItem, setEditItem] = useState<any>(null);
  const [editContenido, setEditContenido] = useState("");

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("condiciones_comerciales").update({ contenido: editContenido }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["condiciones_comerciales"] });
      setEditItem(null);
      toast.success("Condiciones actualizadas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditContenido(item.contenido || "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Condiciones Comerciales</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{EMPRESA_LABELS[item.empresa_vendedora] || item.empresa_vendedora}</h3>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {item.contenido || <span className="italic">Sin condiciones configuradas</span>}
                </p>
              </div>
            ))}
            {items.length === 0 && <p className="text-center text-muted-foreground">Sin condiciones configuradas</p>}
          </div>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Condiciones — {editItem ? (EMPRESA_LABELS[editItem.empresa_vendedora] || editItem.empresa_vendedora) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Condiciones Comerciales</Label>
              <Textarea
                value={editContenido}
                onChange={e => setEditContenido(e.target.value)}
                placeholder="Ingresa las condiciones comerciales..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Marcas por Empresa Tab ──────────────────────────────────
function EmpresaMarcasTab() {
  const qc = useQueryClient();
  const EMPRESAS: { v: "lumaggs_chevron" | "galsa_phillips66"; l: string }[] = [
    { v: "lumaggs_chevron", l: "Lumaggs (Chevron)" },
    { v: "galsa_phillips66", l: "Galsa (Phillips 66)" },
  ];

  const { data: marcas = [] } = useQuery({
    queryKey: ["option_marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("product_option_values").select("id, value").eq("option_type", "marca").eq("is_active", true).order("value");
      return data || [];
    },
  });

  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ["empresa_marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_marcas").select("*, product_option_values(value)");
      return data || [];
    },
  });

  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("lumaggs_chevron");
  const [selectedMarca, setSelectedMarca] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("empresa_marcas").insert({ empresa_vendedora: selectedEmpresa as any, marca_id: selectedMarca });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_marcas"] }); setSelectedMarca(""); toast.success("Marca asignada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresa_marcas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_marcas"] }); toast.success("Marca removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const marcasAsignadas = asignaciones.filter((a: any) => a.empresa_vendedora === selectedEmpresa);
  const marcasDisponibles = marcas.filter((m: any) => !marcasAsignadas.some((a: any) => a.marca_id === m.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Marcas por Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {EMPRESAS.map(e => (
            <Button key={e.v} variant={selectedEmpresa === e.v ? "default" : "outline"} size="sm" onClick={() => setSelectedEmpresa(e.v)}>
              {e.l}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Agregar Marca</Label>
            <Select value={selectedMarca} onValueChange={setSelectedMarca}>
              <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
              <SelectContent>{marcasDisponibles.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => add.mutate()} disabled={!selectedMarca || add.isPending} size="sm"><Plus className="mr-1 h-4 w-4" /> Asignar</Button>
        </div>

        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Marca</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {marcasAsignadas.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sin marcas asignadas</TableCell></TableRow>
              ) : marcasAsignadas.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{(a.product_option_values as any)?.value || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Vehiculos Tab ───────────────────────────────────────────
function VehiculosTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["vehiculos_all"],
    queryFn: async () => { const { data, error } = await supabase.from("vehiculos").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [placas, setPlacas] = useState("");
  const [tipo, setTipo] = useState("");
  const [icon, setIcon] = useState<"pickup" | "truck">("truck");
  const [color, setColor] = useState("#3b82f6");
  const [editItem, setEditItem] = useState<any>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPlacas, setEditPlacas] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editIcon, setEditIcon] = useState<"pickup" | "truck">("truck");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editActive, setEditActive] = useState(true);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("vehiculos").insert({ nombre, placas: placas || null, tipo: tipo || null, icon, color }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehiculos_all"] }); qc.invalidateQueries({ queryKey: ["vehiculos"] }); setOpen(false); setNombre(""); setPlacas(""); setTipo(""); setIcon("truck"); setColor("#3b82f6"); toast.success("Vehículo creado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehiculos").update({ nombre: editNombre, placas: editPlacas || null, tipo: editTipo || null, icon: editIcon, color: editColor, is_active: editActive }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehiculos_all"] }); qc.invalidateQueries({ queryKey: ["vehiculos"] }); setEditItem(null); toast.success("Vehículo actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditNombre(item.nombre);
    setEditPlacas(item.placas || "");
    setEditTipo(item.tipo || "");
    setEditIcon((item.icon as "pickup" | "truck") || "truck");
    setEditColor(item.color || "#3b82f6");
    setEditActive(item.is_active);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Vehículos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Vehículo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Camioneta 1" /></div>
              <div><Label>Placas</Label><Input value={placas} onChange={e => setPlacas(e.target.value)} placeholder="Ej: ABC-123" /></div>
              <div><Label>Tipo</Label><Input value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Ej: Camioneta, Camión" /></div>
              <div>
                <Label>Icono del mapa</Label>
                <Select value={icon} onValueChange={(v) => setIcon(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">🚚 Camión</SelectItem>
                    <SelectItem value="pickup">🛻 Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color del pin</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-16 p-1" />
                  <Input value={color} onChange={e => setColor(e.target.value)} placeholder="#3b82f6" />
                </div>
              </div>
              <Button onClick={() => add.mutate()} disabled={!nombre || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Placas</TableHead><TableHead>Tipo</TableHead><TableHead>Icono</TableHead><TableHead>Color</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.nombre}</TableCell>
                  <TableCell>{v.placas || "—"}</TableCell>
                  <TableCell>{v.tipo || "—"}</TableCell>
                  <TableCell>{v.icon === "pickup" ? "🛻 Pickup" : "🚚 Camión"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded border" style={{ backgroundColor: v.color || "#3b82f6" }} />
                      <span className="text-xs text-muted-foreground font-mono">{v.color || "#3b82f6"}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin vehículos</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vehículo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Placas</Label><Input value={editPlacas} onChange={e => setEditPlacas(e.target.value)} /></div>
            <div><Label>Tipo</Label><Input value={editTipo} onChange={e => setEditTipo(e.target.value)} /></div>
            <div>
              <Label>Icono del mapa</Label>
              <Select value={editIcon} onValueChange={(v) => setEditIcon(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="truck">🚚 Camión</SelectItem>
                  <SelectItem value="pickup">🛻 Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color del pin</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="h-10 w-16 p-1" />
                <Input value={editColor} onChange={e => setEditColor(e.target.value)} placeholder="#3b82f6" />
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Repartidores Tab ────────────────────────────────────────
function RepartidoresTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["repartidores_all"],
    queryFn: async () => { const { data, error } = await supabase.from("repartidores").select("*").order("nombre"); if (error) throw error; return data; },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_repartidores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [licencia, setLicencia] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editUserId, setEditUserId] = useState<string>("");
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editLicencia, setEditLicencia] = useState("");
  const [editActive, setEditActive] = useState(true);

  const usedUserIds = new Set(items.map((r: any) => r.user_id).filter(Boolean));
  const availableProfilesNew = profiles.filter((p: any) => !usedUserIds.has(p.user_id));
  const availableProfilesEdit = profiles.filter((p: any) => !usedUserIds.has(p.user_id) || p.user_id === editItem?.user_id);

  const profileLabel = (p: any) => p.full_name?.trim() ? `${p.full_name} (${p.email || "sin correo"})` : (p.email || p.user_id);
  const profileById = (uid: string) => profiles.find((p: any) => p.user_id === uid);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repartidores").insert({
        nombre,
        telefono: telefono || null,
        licencia: licencia || null,
        user_id: userId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repartidores_all"] });
      setOpen(false); setUserId(""); setNombre(""); setTelefono(""); setLicencia("");
      toast.success("Repartidor creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repartidores").update({
        nombre: editNombre,
        telefono: editTelefono || null,
        licencia: editLicencia || null,
        is_active: editActive,
        user_id: editUserId || null,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["repartidores_all"] }); setEditItem(null); toast.success("Repartidor actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditUserId(item.user_id || "");
    setEditNombre(item.nombre);
    setEditTelefono(item.telefono || "");
    setEditLicencia(item.licencia || "");
    setEditActive(item.is_active);
  };

  const handlePickUserNew = (uid: string) => {
    setUserId(uid);
    const p = profileById(uid);
    if (p && !nombre) setNombre(p.full_name || p.email || "");
  };

  const handlePickUserEdit = (uid: string) => {
    setEditUserId(uid);
    const p = profileById(uid);
    if (p && (!editNombre || editNombre === editItem?.nombre)) setEditNombre(p.full_name || p.email || editNombre);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Repartidores</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Repartidor</DialogTitle>
              <DialogDescription>Vincula un usuario registrado. Se le asignará automáticamente el rol Delivery.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Usuario *</Label>
                <Select value={userId} onValueChange={handlePickUserNew}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                  <SelectContent>
                    {availableProfilesNew.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay usuarios disponibles</div>}
                    {availableProfilesNew.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{profileLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nombre a mostrar *</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan López" /></div>
              <div><Label>Teléfono</Label><Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 55 1234 5678" /></div>
              <div><Label>Licencia</Label><Input value={licencia} onChange={e => setLicencia(e.target.value)} placeholder="Ej: LIC-12345" /></div>
              <Button onClick={() => add.mutate()} disabled={!nombre || !userId || add.isPending}>{add.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Usuario</TableHead><TableHead>Teléfono</TableHead><TableHead>Licencia</TableHead><TableHead>Activo</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((r: any) => {
                const p = r.user_id ? profileById(r.user_id) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p ? (p.email || p.full_name) : <Badge variant="outline">Sin usuario</Badge>}</TableCell>
                    <TableCell>{r.telefono || "—"}</TableCell>
                    <TableCell>{r.licencia || "—"}</TableCell>
                    <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Sí" : "No"}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin repartidores</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Repartidor</DialogTitle>
            <DialogDescription>Vincula o cambia el usuario asociado a este repartidor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuario</Label>
              <Select value={editUserId || "__none__"} onValueChange={(v) => handlePickUserEdit(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin usuario vinculado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin usuario vinculado</SelectItem>
                  {availableProfilesEdit.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{profileLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nombre</Label><Input value={editNombre} onChange={e => setEditNombre(e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input value={editTelefono} onChange={e => setEditTelefono(e.target.value)} /></div>
            <div><Label>Licencia</Label><Input value={editLicencia} onChange={e => setEditLicencia(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editNombre || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tipos de Dirección ──────────────────────────────────────
function TiposDireccionTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clave, setClave] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editClave, setEditClave] = useState("");
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [editActive, setEditActive] = useState(true);

  const { data = [], isLoading } = useQuery({
    queryKey: ["tipos_direccion_all"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion").select("*").order("etiqueta");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("tipos_direccion").insert({
        clave: clave.trim().toLowerCase(),
        etiqueta: etiqueta.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      setOpen(false); setClave(""); setEtiqueta(""); toast.success("Tipo creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("tipos_direccion")
        .update({ clave: editClave.trim().toLowerCase(), etiqueta: editEtiqueta.trim(), is_active: editActive })
        .eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      setEditItem(null); toast.success("Tipo actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("tipos_direccion").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos_direccion_all"] });
      qc.invalidateQueries({ queryKey: ["tipos_direccion_catalog"] });
      toast.success("Tipo eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item); setEditClave(item.clave); setEditEtiqueta(item.etiqueta); setEditActive(item.is_active);
  };

  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center">
        <CardTitle>Tipos de Dirección</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Tipo de Dirección</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Clave (sin espacios)</Label><Input value={clave} onChange={e => setClave(e.target.value)} placeholder="Ej: bodega" /></div>
              <div><Label>Etiqueta</Label><Input value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Ej: Bodega" /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!clave || !etiqueta || create.isPending}>{create.isPending ? "Creando..." : "Crear"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Clave</TableHead><TableHead>Etiqueta</TableHead><TableHead>Activo</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.clave}</TableCell>
                  <TableCell>{t.etiqueta}</TableCell>
                  <TableCell>{t.is_active ? "Sí" : "No"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${t.etiqueta}"?`)) remove.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Tipo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Clave</Label><Input value={editClave} onChange={e => setEditClave(e.target.value)} /></div>
            <div><Label>Etiqueta</Label><Input value={editEtiqueta} onChange={e => setEditEtiqueta(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editClave || !editEtiqueta || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Industrias Tab ──────────────────────────────────────────
function IndustriasTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["industrias_catalog_admin"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("industrias_catalog")
        .select("*")
        .order("ordering", { ascending: true })
        .order("etiqueta", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [open, setOpen] = useState(false);
  const [clave, setClave] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editClave, setEditClave] = useState("");
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [filter, setFilter] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const claveFinal = clave.trim() || etiqueta.trim();
      const { error } = await (supabase.from as any)("industrias_catalog").insert({
        clave: claveFinal,
        etiqueta: etiqueta.trim(),
        ordering: (items.length + 1) * 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrias_catalog_admin"] });
      qc.invalidateQueries({ queryKey: ["industrias_catalog"] });
      setOpen(false); setClave(""); setEtiqueta(""); toast.success("Industria creada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("industrias_catalog").update({
        clave: editClave.trim(),
        etiqueta: editEtiqueta.trim(),
        is_active: editActive,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrias_catalog_admin"] });
      qc.invalidateQueries({ queryKey: ["industrias_catalog"] });
      setEditItem(null); toast.success("Industria actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("industrias_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrias_catalog_admin"] });
      qc.invalidateQueries({ queryKey: ["industrias_catalog"] });
      toast.success("Industria eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditClave(item.clave);
    setEditEtiqueta(item.etiqueta);
    setEditActive(item.is_active);
  };

  const filtered = items.filter((i: any) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return i.etiqueta.toLowerCase().includes(q) || i.clave.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" /> Industrias</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Industria</DialogTitle>
              <DialogDescription>
                La <b>etiqueta</b> es lo que se muestra en pantalla. La <b>clave</b> es el valor guardado en la base. Si las dejas iguales déjala en blanco.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Etiqueta (visible)</Label><Input value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Ej: Transporte de carga" /></div>
              <div>
                <Label>Clave guardada (opcional)</Label>
                <Input value={clave} onChange={e => setClave(e.target.value)} placeholder="Si se omite se usa la etiqueta" />
                <p className="text-[11px] text-muted-foreground mt-1">Solo cámbiala si la clave guardada debe ser distinta del nombre mostrado.</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!etiqueta || create.isPending}>{create.isPending ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar industria..." className="pl-8 h-9" />
        </div>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etiqueta (visible)</TableHead>
                <TableHead>Clave (guardada)</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.etiqueta}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.clave}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${r.etiqueta}"?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Industria</DialogTitle>
            <DialogDescription>
              Cambiar la <b>clave</b> puede romper registros existentes que la usen. La <b>etiqueta</b> solo afecta cómo se muestra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Etiqueta (visible)</Label><Input value={editEtiqueta} onChange={e => setEditEtiqueta(e.target.value)} /></div>
            <div><Label>Clave (guardada)</Label><Input value={editClave} onChange={e => setEditClave(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={editActive} onCheckedChange={setEditActive} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!editEtiqueta || !editClave || update.isPending}>{update.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
// ─── Márgenes por Línea de Producto ──────────────────────────
const LINEA_MARGIN_LEVELS = [
  { key: "margen_uf1", label: "UF1" },
  { key: "margen_uf2", label: "UF2" },
  { key: "margen_uf3", label: "UF3" },
  { key: "margen_uf4", label: "UF4" },
  { key: "margen_r1",  label: "R1" },
  { key: "margen_r2",  label: "R2" },
  { key: "margen_r3",  label: "R3" },
  { key: "margen_r4",  label: "R4" },
] as const;

function LineaMargenesTab() {
  const qc = useQueryClient();
  const canViewCostos = useCanViewCostos();

  const { data: lineas = [] } = useQuery({
    queryKey: ["product_option_values_linea_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_option_values")
        .select("id,value,is_active")
        .eq("option_type", "linea")
        .eq("is_active", true)
        .order("value");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["producto_linea_margenes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producto_linea_margenes")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data || [];
    },
  });

  const lineasUsadas = new Set(rows.map((r: any) => r.linea_id).filter(Boolean));
  const hasGeneral = rows.some((r: any) => r.linea_id === null);

  const emptyForm: any = {
    linea_id: "", nombre: "", activo: true,
    margen_uf1: 0, margen_uf2: 0, margen_uf3: 0, margen_uf4: 0,
    margen_r1: 0, margen_r2: 0, margen_r3: 0, margen_r4: 0,
  };
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openNew = () => { setIsDuplicating(false); setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: any) => {
    setIsDuplicating(false);
    setEditingId(r.id);
    setForm({
      linea_id: r.linea_id || "",
      nombre: r.nombre || "",
      activo: r.activo,
      ...Object.fromEntries(LINEA_MARGIN_LEVELS.map(l => [l.key, Number(r[l.key] ?? 0)])),
    });
    setOpen(true);
  };
  const openDuplicate = (r: any) => {
    setIsDuplicating(true);
    setEditingId(null);
    setForm({
      linea_id: "",
      nombre: r.nombre ? `Copia de ${r.nombre}` : "",
      activo: r.activo,
      ...Object.fromEntries(LINEA_MARGIN_LEVELS.map(l => [l.key, Number(r[l.key] ?? 0)])),
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const isGeneral = !form.linea_id;
      if (isGeneral && !editingId && hasGeneral) {
        throw new Error("Ya existe la fila General. Selecciona una Línea de Producto.");
      }
      const payload: any = {
        linea_id: form.linea_id || null,
        nombre: (form.nombre || "").trim() || (isGeneral ? "General" : (lineas.find((l: any) => l.id === form.linea_id)?.value ?? "")),
        activo: form.activo,
      };
      for (const l of LINEA_MARGIN_LEVELS) payload[l.key] = Number(form[l.key] ?? 0);
      if (!payload.nombre) throw new Error("El nombre es requerido");
      if (editingId) {
        const { error } = await supabase.from("producto_linea_margenes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("producto_linea_margenes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producto_linea_margenes"] });
      setOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Márgenes actualizados" : "Márgenes creados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("producto_linea_margenes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producto_linea_margenes"] });
      setConfirmDelete(null);
      toast.success("Eliminado");
    },
    onError: (e: any) => { toast.error(e.message); setConfirmDelete(null); },
  });

  const lineasDisponibles = lineas.filter((l: any) =>
    !lineasUsadas.has(l.id) || (editingId && form.linea_id === l.id)
  );

  if (!canViewCostos) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No tienes permiso para ver esta sección.</p>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" /> Márgenes por Línea de Producto
          </CardTitle>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Define los 8 porcentajes de utilidad (UF1-UF4, R1-R4) por Línea. La fila <strong>General</strong> se usa como fallback cuando un producto no tiene línea o su línea no está en este catálogo. Fórmula: <code>Precio = Costo / (1 - margen%/100)</code>.
          </p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground text-sm">Cargando...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Línea</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-xs">Márgenes UF</TableHead>
                <TableHead className="text-xs">Márgenes R</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const lineaName = r.linea_id ? (lineas.find((l: any) => l.id === r.linea_id)?.value ?? "—") : "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.linea_id === null ? <Badge variant="secondary">General</Badge> : lineaName}
                    </TableCell>
                    <TableCell className="text-sm">{r.nombre}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      UF1: {Number(r.margen_uf1).toFixed(1)}% · UF2: {Number(r.margen_uf2).toFixed(1)}%<br/>
                      UF3: {Number(r.margen_uf3).toFixed(1)}% · UF4: {Number(r.margen_uf4).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      R1: {Number(r.margen_r1).toFixed(1)}% · R2: {Number(r.margen_r2).toFixed(1)}%<br/>
                      R3: {Number(r.margen_r3).toFixed(1)}% · R4: {Number(r.margen_r4).toFixed(1)}%
                    </TableCell>
                    <TableCell><Badge variant={r.activo ? "default" : "secondary"}>{r.activo ? "Sí" : "No"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDuplicate(r)} title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setIsDuplicating(false); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {editingId ? "Editar márgenes" : isDuplicating ? "Duplicar márgenes" : "Nuevos márgenes por línea"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-light">
              {isDuplicating ? "Selecciona una nueva Línea de Producto para duplicar los márgenes." : "Selecciona la Línea de Producto o deja vacío para usar la fila General."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-5 overflow-y-auto flex-1 font-light">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Línea de Producto</Label>
                <Select
                  value={form.linea_id || "__general__"}
                  onValueChange={v => setForm({ ...form, linea_id: v === "__general__" ? "" : v })}
                  disabled={!!editingId && !isDuplicating}
                >
                  <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__general__" disabled={hasGeneral && !(editingId && !form.linea_id)}>
                      General (fallback){hasGeneral && !(editingId && !form.linea_id) ? " — ya existe" : ""}
                    </SelectItem>
                    {lineasDisponibles.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lineasDisponibles.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1 font-light">
                    {lineas.length === 0
                      ? "No hay Líneas de Producto activas. Crea una en el catálogo \"Líneas de Producto\"."
                      : "Todas las Líneas ya tienen márgenes asignados. Edita uno existente o crea una nueva Línea en su catálogo."}
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.activo} onCheckedChange={v => setForm({ ...form, activo: v })} />
                <Label>Activo</Label>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</Label>
                <Input
                  className="h-9 font-light"
                  value={form.nombre}
                  placeholder={form.linea_id ? (lineas.find((l: any) => l.id === form.linea_id)?.value ?? "") : "General"}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Márgenes de utilidad (%)</Label>
              <div className="grid grid-cols-4 gap-3">
                {LINEA_MARGIN_LEVELS.map(lvl => (
                  <div key={lvl.key}>
                    <Label className="text-xs">{lvl.label}</Label>
                    <Input
                      type="number" step="0.01" min={0} max={99.99}
                      className="h-9 font-light"
                      value={form[lvl.key] ?? 0}
                      onChange={e => setForm({ ...form, [lvl.key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Guardando..." : editingId ? "Actualizar" : isDuplicating ? "Duplicar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Los productos con esa línea usarán la fila General al recalcular precios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove.mutate(confirmDelete)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type CatalogKey =
  | "plazas" | "vehiculos" | "repartidores" | "tipos_direccion"
  | "presentaciones" | "clasificaciones" | "empresa_marcas"
  | "linea_margenes" | "producto_base" | "fuentes_suministro"
  | "industrias" | "embudos" | "condiciones"
  | "logos"
  | "seguimiento_estatus"
  | "documentos_plantilla"
  | "email_groups" | "system_settings";

type CatalogGroup = {
  id: string;
  label: string;
  items: { key: CatalogKey; label: string; description?: string }[];
};

const CATALOG_GROUPS: CatalogGroup[] = [
  {
    id: "logistica",
    label: "Logística y operación",
    items: [
      { key: "plazas", label: "Plazas", description: "Ciudades y punto de partida para rutas" },
      { key: "vehiculos", label: "Vehículos" },
      { key: "repartidores", label: "Repartidores" },
      { key: "tipos_direccion", label: "Tipos de Dirección" },
    ],
  },
  {
    id: "productos",
    label: "Productos",
    items: [
      { key: "presentaciones", label: "Presentaciones" },
      { key: "clasificaciones", label: "Clasificaciones de Producto" },
      { key: "linea_margenes", label: "Márgenes por Línea de Producto", description: "Define los 8 % de utilidad por línea" },
      { key: "empresa_marcas", label: "Marcas por Empresa" },
      { key: "producto_base", label: "Productos Base", description: "Familias de producto usadas para agrupar variantes" },
      { key: "fuentes_suministro", label: "Centros de Suministro", description: "Orígenes de abasto (USA, CEDIS, etc.) y su tiempo de entrega" },
    ],
  },
  {
    id: "ventas",
    label: "CRM y ventas",
    items: [
      { key: "industrias", label: "Industrias", description: "Editar nombre mostrado vs guardado" },
      { key: "condiciones", label: "Condiciones" },
      { key: "seguimiento_estatus", label: "Estatus de Seguimiento a Ventas", description: "Rangos por familia y ámbito" },
    ],
  },
  {
    id: "marca",
    label: "Marca",
    items: [
      { key: "logos", label: "Logos" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { key: "documentos_plantilla", label: "Documentos para Plantillas", description: "Biblioteca enviable por email y WhatsApp" },
      { key: "email_groups", label: "Grupos de Correo" },
      
      { key: "system_settings", label: "Parámetros" },
    ],
  },
];

function renderCatalog(key: CatalogKey) {
  switch (key) {
    case "plazas": return <PlazasTab />;
    case "vehiculos": return <VehiculosTab />;
    case "repartidores": return <RepartidoresTab />;
    case "tipos_direccion": return <TiposDireccionTab />;
    case "presentaciones": return <PresentacionesTab />;
    case "clasificaciones": return <OptionsTab />;
    case "linea_margenes": return <LineaMargenesTab />;
    case "empresa_marcas": return <EmpresaMarcasTab />;
    case "producto_base": return <ProductoBaseTab />;
    case "fuentes_suministro": return <FuentesSuministroTab />;
    case "industrias": return <IndustriasTab />;
    case "condiciones": return <CondicionesTab />;
    case "logos": return <LogosTab />;
    case "seguimiento_estatus": return <SeguimientoEstatusTab />;
    case "documentos_plantilla": return <DocumentosPlantillaCatalogoTab />;
    case "email_groups": return <EmailGroupsTab />;
    
    case "system_settings": return <SystemSettingsTab />;
  }
}

export default function CatalogsManagement() {
  const initial = (typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("cat")
    : null) as CatalogKey | null;
  const [active, setActive] = useState<CatalogKey>(initial ?? "plazas");
  const [search, setSearch] = useState("");

  const flat = CATALOG_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.label, groupId: g.id })));
  const activeMeta = flat.find(f => f.key === active);
  const q = search.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-muted-foreground">Administra todos los catálogos del sistema, organizados por área.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px,1fr]">
        {/* Sidebar de selección */}
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar catálogo..."
              className="pl-8 h-9"
            />
          </div>

          {/* Móvil: selector */}
          <div className="md:hidden">
            <Select value={active} onValueChange={v => setActive(v as CatalogKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATALOG_GROUPS.map(g => (
                  <div key={g.id}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{g.label}</div>
                    {g.items.filter(i => matches(i.label)).map(i => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: lista agrupada */}
          <div className="hidden md:block space-y-4">
            {CATALOG_GROUPS.map(g => {
              const visible = g.items.filter(i => matches(i.label));
              if (visible.length === 0) return null;
              return (
                <div key={g.id}>
                  <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map(i => {
                      const isActive = i.key === active;
                      return (
                        <button
                          key={i.key}
                          type="button"
                          onClick={() => setActive(i.key)}
                          className={
                            "w-full text-left rounded-md px-2.5 py-1.5 text-sm transition-colors " +
                            (isActive
                              ? "bg-violet-100 text-violet-900 font-medium"
                              : "hover:bg-muted text-foreground/80")
                          }
                        >
                          {i.label}
                          {i.description && !isActive && (
                            <div className="text-[10px] text-muted-foreground truncate">{i.description}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Contenido */}
        <section className="min-w-0">
          {activeMeta && (
            <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              {activeMeta.group} · {activeMeta.label}
            </div>
          )}
          {renderCatalog(active)}
        </section>
      </div>
    </div>
  );
}
