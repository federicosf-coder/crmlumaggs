import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Lock, Unlock, Upload, Download, RefreshCw, Save, X, ChevronDown, History, EyeOff, Eye, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { descargarPlantillaCostos, leerArchivoCostos, puedeEditarCostos, validarCosto, type CambioCosto, type ProductoCosto } from "@/lib/contabilidadCostos";
import type { Json } from "@/integrations/supabase/types";

type Producto = ProductoCosto & { empresas: string[]; activo?: boolean; ignorado?: boolean };
type Historial = { id: string; codigo: string; nombre_producto: string; marca_id: string | null; costo_anterior: number | null; costo_nuevo: number | null; precios_anteriores: Json; precios_nuevos: Json; fuente: string; realizado_at: string; realizado_por: string | null };
type SortKey = "codigo" | "nombre" | "clasificacion" | "costo" | "fecha";
const money = (n: number | null) => n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fecha = (s: string) => new Date(s).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function CeldaCosto({ producto, enabled, saving, onSave }: { producto: Producto; enabled: boolean; saving: boolean; onSave: (p: Producto, costo: number) => Promise<void> }) {
  const [value, setValue] = useState<string | null>(null);
  if (!enabled) return <span className="font-mono text-xs">{money(producto.costo_actual)}</span>;
  const changed = value !== null && value !== String(producto.costo_actual);
  const save = async () => {
    try { await onSave(producto, validarCosto(value ?? producto.costo_actual)); setValue(null); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar"); }
  };
  return <div className="flex items-center gap-1 min-w-52">
    <Input aria-label={`Costo ${producto.codigo}`} type="number" min="0" step="0.01" className="w-32 h-8 font-mono" value={value ?? producto.costo_actual} disabled={saving} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && changed) void save(); if (e.key === "Escape") setValue(null); }} />
    <Button size="icon" variant="ghost" className="h-8 w-8" title="Guardar costo" aria-label={`Guardar costo ${producto.codigo}`} disabled={!changed || saving} onClick={() => void save()}><Save className="h-4 w-4" /></Button>
    <Button size="icon" variant="ghost" className="h-8 w-8" title="Descartar cambio" aria-label={`Descartar costo ${producto.codigo}`} disabled={!changed || saving} onClick={() => setValue(null)}><X className="h-4 w-4" /></Button>
  </div>;
}

export default function ListaCostos() {
  const { roles } = useAuth();
  const canView = useCanViewCostos();
  const qc = useQueryClient();
  const [empresa, setEmpresa] = useState("lumaggs_chevron");
  const [marcas, setMarcas] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("costos");
  const [pending, setPending] = useState<{ cambios: CambioCosto[]; recalcular: boolean; archivo?: string } | null>(null);
  const [detalle, setDetalle] = useState<Historial | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "codigo", dir: "asc" });
  const [widths, setWidths] = useState<Record<SortKey, number>>({ codigo: 130, nombre: 320, clasificacion: 170, costo: 200, fecha: 210 });
  const [desde, setDesde] = useState("");
  const [estado, setEstado] = useState<"activos" | "inactivos" | "todos">("activos");
  const [verIgnorados, setVerIgnorados] = useState(false);
  const toggleIgnorar = async (p: Producto) => {
    const { error } = p.ignorado
      ? await supabase.from("contabilidad_costos_ignorados").delete().eq("producto_id", p.id)
      : await supabase.from("contabilidad_costos_ignorados").insert({ producto_id: p.id });
    if (error) { toast.error(error.message); return; }
    toast.success(p.ignorado ? `${p.codigo} vuelve a la lista` : `${p.codigo} ignorado`);
    await qc.invalidateQueries({ queryKey: ["contabilidad-costos"] });
  };
  const [hasta, setHasta] = useState("");
  const autores = useQuery({ queryKey: ["contabilidad-ultimo-autor"], enabled: canView, queryFn: async () => {
    const [{ data: hist, error }, { data: profs, error: e2 }] = await Promise.all([
      supabase.from("contabilidad_costos_historial").select("producto_id,realizado_por,realizado_at").order("realizado_at", { ascending: false }).range(0, 9999),
      supabase.from("profiles").select("user_id,full_name"),
    ]);
    if (error) throw error; if (e2) throw e2;
    const names = new Map((profs ?? []).map(p => [p.user_id, p.full_name]));
    const map = new Map<string, string>();
    for (const h of hist ?? []) if (h.producto_id && !map.has(h.producto_id)) map.set(h.producto_id, names.get(h.realizado_por ?? "") ?? "Sistema");
    return map;
  } });
  const startResize = (key: SortKey, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = widths[key];
    const move = (ev: PointerEvent) => setWidths(w => ({ ...w, [key]: Math.max(80, w0 + ev.clientX - x0) }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const productosQuery = useQuery({ queryKey: ["contabilidad-costos"], enabled: canView, queryFn: async () => {
    const { data, error } = await supabase.rpc("contabilidad_costos_listar");
    if (error) throw error;
    return data as unknown as Producto[];
  } });
  const productos = productosQuery.data ?? [];
  const empresaProductos = productos.filter(p => p.empresas.includes(empresa));
  const options = [...new Map(empresaProductos.map(p => [p.marca_id ?? "sin-marca", p.marca])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const selected = empresaProductos.filter(p => (estado === "todos" || (estado === "activos") === (p.activo !== false)) && !!p.ignorado === verIgnorados && (!marcas.length || marcas.includes(p.marca_id ?? "sin-marca")) && normalize(`${p.codigo} ${p.nombre_producto} ${p.clasificacion}`).includes(normalize(search)));
  const filtered = selected.filter(p => { const d = (p.fecha_registro ?? "").slice(0, 10); return (!desde || d >= desde) && (!hasta || d <= hasta); });
  const val = (p: Producto, k: SortKey): string | number => k === "codigo" ? p.codigo : k === "nombre" ? p.nombre_producto : k === "clasificacion" ? (p.clasificacion ?? "") : k === "costo" ? (p.costo_actual ?? -1) : (p.fecha_registro ?? "");
  const rows = [...filtered].sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true }); return sort.dir === "asc" ? c : -c; });
  const head = (key: SortKey, label: string, extra = "") => <TableHead key={key} style={{ width: widths[key], minWidth: widths[key], maxWidth: widths[key] }} className={`relative select-none ${extra}`} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" className="flex items-center gap-1 w-full text-left" onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}>{label}{sort.key === key ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</button>
    <span role="separator" aria-label={`Ajustar ancho ${label}`} onPointerDown={e => startResize(key, e)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" />
  </TableHead>;
  const historyQuery = useQuery({ queryKey: ["contabilidad-costos-historial", empresa, marcas, search, historyPage, selected.map(p => p.id)], enabled: canView && productosQuery.isSuccess && tab === "historial", queryFn: async () => {
    const ids = selected.map(p => p.id);
    if (!ids.length) return { rows: [] as Historial[], total: 0 };
    const { data, error, count } = await supabase.from("contabilidad_costos_historial").select("*", { count: "exact" }).in("producto_id", ids).order("realizado_at", { ascending: false }).range(historyPage * 100, historyPage * 100 + 99);
    if (error) throw error;
    return { rows: data as Historial[], total: count ?? 0 };
  } });
  const users = useQuery({ queryKey: ["contabilidad-autores"], enabled: canView && tab === "historial", queryFn: async () => { const { data, error } = await supabase.from("profiles").select("user_id,full_name"); if (error) throw error; return new Map(data.map(p => [p.user_id, p.full_name])); } });
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["contabilidad-costos"] }), qc.invalidateQueries({ queryKey: ["contabilidad-costos-historial"] }), qc.invalidateQueries({ queryKey: ["productos"] }), qc.invalidateQueries({ queryKey: ["contabilidad-ultimo-autor"] })]); };
  const apply = async (cambios: CambioCosto[], recalcular = false, fuente = "edicion") => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("contabilidad_costos_aplicar", { p_cambios: cambios.map(({ id, costo, costo_anterior }) => ({ id, costo, costo_anterior })), p_fuente: fuente, p_recalcular: recalcular });
      if (error) throw error;
      await refresh();
      const result = data as { actualizados: number };
      toast.success(`${result.actualizados} registros actualizados; cambios guardados en el historial`);
    } finally { setSaving(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try { const cambios = await leerArchivoCostos(file, empresaProductos); setPending({ cambios: cambios.filter(c => c.costo !== c.costo_anterior), recalcular: false, archivo: file.name }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo"); }
    if (inputRef.current) inputRef.current.value = "";
  };
  const confirm = async () => {
    if (!pending) return;
    try { await apply(pending.cambios, pending.recalcular, "carga"); setPending(null); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudieron guardar los cambios"); }
  };
  if (!canView) return <div className="text-muted-foreground py-10">Consultando permisos de costos…</div>;
  return <div className="space-y-4 min-w-0">
    <div className="flex flex-wrap justify-between items-start gap-3"><h1 className="text-2xl font-semibold">Lista de Costos</h1><Button variant="outline" size="sm" disabled={saving || productosQuery.isFetching} onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div>
    <div className="flex gap-2">{[["lumaggs_chevron", "Lumaggs"], ["galsa_phillips66", "Galsa"]].map(([key, label]) => <Button key={key} variant={empresa === key ? "default" : "outline"} className="rounded-full px-6" aria-pressed={empresa === key} disabled={saving} onClick={() => { setEmpresa(key); setMarcas([]); setEditing(false); setHistoryPage(0); }}>{label}</Button>)}</div>
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar productos" placeholder="Buscar código, nombre o clasificación" value={search} onChange={e => { setSearch(e.target.value); setHistoryPage(0); }} className="pl-9" /></div>
    </div>
    {empresa === "galsa_phillips66" && <div className="flex flex-wrap gap-2" role="group" aria-label="Marcas">
      <Button size="sm" variant={!marcas.length ? "default" : "outline"} className="rounded-full" aria-pressed={!marcas.length} onClick={() => { setMarcas([]); setHistoryPage(0); }}>Todas las marcas</Button>
      {options.map(([id, label]) => { const on = marcas.includes(id); return <Button key={id} size="sm" variant={on ? "default" : "outline"} className="rounded-full" aria-pressed={on} onClick={() => { setMarcas(current => on ? current.filter(m => m !== id) : [...current, id]); setHistoryPage(0); }}>{label}</Button>; })}
    </div>}
    <Tabs value={tab} onValueChange={setTab}>
      <div className="flex flex-wrap justify-between gap-3 items-center"><TabsList><TabsTrigger value="costos">Costos ({selected.length})</TabsTrigger><TabsTrigger value="historial"><History className="mr-2 h-4 w-4" />Historial</TabsTrigger></TabsList></div>
      <TabsContent value="costos" className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">{([["activos", "Activos"], ["inactivos", "Desactivados"], ["todos", "Todos"]] as const).map(([k, l]) => <Button key={k} size="sm" variant={estado === k ? "default" : "outline"} className="rounded-full" aria-pressed={estado === k} onClick={() => setEstado(k)}>{l}</Button>)}<Button size="sm" variant={verIgnorados ? "default" : "outline"} className="rounded-full" aria-pressed={verIgnorados} onClick={() => setVerIgnorados(v => !v)}><EyeOff className="mr-1 h-4 w-4" />{verIgnorados ? "Viendo ignorados" : "Ver ignorados"} ({empresaProductos.filter(p => p.ignorado).length})</Button></div>
        <div className="flex flex-wrap gap-2 items-center text-sm"><span className="text-muted-foreground">Fecha de registro/modificación:</span><Input type="date" aria-label="Desde" className="w-40 h-9" value={desde} onChange={e => setDesde(e.target.value)} /><span>a</span><Input type="date" aria-label="Hasta" className="w-40 h-9" value={hasta} onChange={e => setHasta(e.target.value)} />{(desde || hasta) && <Button size="sm" variant="ghost" onClick={() => { setDesde(""); setHasta(""); }}>Limpiar fechas</Button>}<span className="text-muted-foreground">{rows.length} de {selected.length}</span></div>
        <div className="flex flex-wrap gap-2">
          <Button variant={editing ? "secondary" : "outline"} disabled={saving} onClick={() => setEditing(v => !v)}>{editing ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}{editing ? "Bloquear edición en línea" : "Permitir edición en línea"}</Button>
          <Button variant="outline" disabled={saving || productosQuery.isLoading} onClick={() => inputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Subir costos</Button>
          <Button variant="outline" onClick={descargarPlantillaCostos}><Download className="mr-2 h-4 w-4" />Plantilla Excel</Button>
          <Button disabled={saving || !selected.length} onClick={() => setPending({ cambios: selected.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre_producto, costo: p.costo_actual, costo_anterior: p.costo_actual })), recalcular: true })}><RefreshCw className="mr-2 h-4 w-4" />Actualizar precios</Button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
        </div>
        {productosQuery.isError ? <p className="text-destructive">{productosQuery.error.message}</p> : <div className="[&>div]:max-h-[calc(100vh-21rem)] [&>div]:min-h-56"><Table className="table-fixed" style={{ width: Object.values(widths).reduce((a, b) => a + b, 0) }}><TableHeader className="sticky top-0 z-20 bg-background"><TableRow>{head("codigo", "Código", "sticky left-0 z-30 bg-background")}{head("nombre", "Nombre")}{head("clasificacion", "Clasificación precio")}{head("costo", "Costo del producto")}{head("fecha", "Fecha del registro")}<TableHead className="w-28">Ignorar</TableHead></TableRow></TableHeader><TableBody>{rows.map(p => <TableRow key={p.id}><TableCell className="sticky left-0 bg-background font-mono text-xs">{p.codigo}</TableCell><TableCell className="truncate"><div className="truncate">{p.nombre_producto}</div><div className="text-xs text-muted-foreground">{p.marca}</div></TableCell><TableCell>{p.clasificacion}</TableCell><TableCell><CeldaCosto producto={p} enabled={puedeEditarCostos(roles, editing)} saving={saving} onSave={(producto, costo) => apply([{ id: producto.id, codigo: producto.codigo, nombre: producto.nombre_producto, costo, costo_anterior: producto.costo_actual }])} /></TableCell><TableCell className="whitespace-nowrap text-xs"><div>{p.fecha_registro ? fecha(p.fecha_registro) : "—"}</div><div className="text-muted-foreground truncate">{autores.data?.get(p.id) ?? (autores.isLoading ? "…" : "Sin cambios registrados")}</div></TableCell><TableCell><Button size="sm" variant="ghost" disabled={saving} onClick={() => void toggleIgnorar(p)}>{p.ignorado ? <><Eye className="mr-1 h-4 w-4" />Restaurar</> : <><EyeOff className="mr-1 h-4 w-4" />Ignorar</>}</Button>{p.activo === false && <div className="text-xs text-muted-foreground">Desactivado</div>}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={6} className="text-center py-12">{productosQuery.isLoading ? "Cargando costos…" : "Sin registros"}</TableCell></TableRow>}</TableBody></Table></div>}
      </TabsContent>
      <TabsContent value="historial" className="space-y-3">
        {historyQuery.isError && <p className="text-destructive">{historyQuery.error.message}</p>}
        <div className="[&>div]:max-h-[calc(100vh-21rem)] [&>div]:min-h-56"><Table className="min-w-[950px]"><TableHeader className="sticky top-0 z-20 bg-background"><TableRow>{["Fecha", "Código / producto", "Costo anterior", "Costo nuevo", "Precios", "Origen", "Responsable"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{historyQuery.data?.rows.map(h => <TableRow key={h.id}><TableCell className="whitespace-nowrap text-xs">{fecha(h.realizado_at)}</TableCell><TableCell><div className="font-mono text-xs">{h.codigo}</div>{h.nombre_producto}</TableCell><TableCell className="font-mono text-xs">{money(h.costo_anterior)}</TableCell><TableCell className="font-mono text-xs">{money(h.costo_nuevo)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setDetalle(h)}>Ver cambios</Button></TableCell><TableCell>{h.fuente === "edicion" ? "Edición en línea" : h.fuente === "carga" ? "Carga de costos" : h.fuente === "recalculo" ? "Actualización de precios" : "Catálogo"}</TableCell><TableCell>{users.data?.get(h.realizado_por ?? "") ?? "Sistema"}</TableCell></TableRow>)}{!historyQuery.data?.rows.length && <TableRow><TableCell colSpan={7} className="text-center py-12">{historyQuery.isLoading ? "Cargando historial…" : "Sin cambios registrados"}</TableCell></TableRow>}</TableBody></Table></div>
        <div className="flex justify-between items-center text-sm text-muted-foreground"><span>{historyQuery.data?.total ?? 0} cambios</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!historyPage} onClick={() => setHistoryPage(p => p - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(historyPage + 1) * 100 >= (historyQuery.data?.total ?? 0)} onClick={() => setHistoryPage(p => p + 1)}>Siguiente</Button></div></div>
      </TabsContent>
    </Tabs>
    <Dialog open={!!pending} onOpenChange={open => { if (!open && !saving) setPending(null); }}><DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"><DialogHeader className="bg-muted/50 px-5 py-4 border-b"><DialogTitle>{pending?.recalcular ? "Actualizar precios" : "Confirmar carga de costos"}</DialogTitle><DialogDescription>{pending?.archivo ?? `${selected.length} productos seleccionados`}</DialogDescription></DialogHeader><div className="px-5 py-4 overflow-auto space-y-3"><p className="text-sm">{pending?.cambios.length ?? 0} registros. Se aplicarán las reglas vigentes del catálogo y se guardará el historial.</p><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Costo anterior</TableHead><TableHead>Costo nuevo</TableHead></TableRow></TableHeader><TableBody>{pending?.cambios.map(c => <TableRow key={c.id}><TableCell>{c.codigo}</TableCell><TableCell>{money(c.costo_anterior)}</TableCell><TableCell>{money(c.costo)}</TableCell></TableRow>)}</TableBody></Table></div><DialogFooter className="border-t bg-muted/30 px-5 py-3"><Button variant="outline" disabled={saving} onClick={() => setPending(null)}>Cancelar</Button><Button disabled={saving || !pending?.cambios.length} onClick={() => void confirm()}>{saving ? "Guardando…" : pending?.recalcular ? "Actualizar precios" : "Aplicar costos y actualizar precios"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!detalle} onOpenChange={open => { if (!open) setDetalle(null); }}><DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden"><DialogHeader className="bg-muted/50 px-5 py-4 border-b"><DialogTitle>Cambios de precios — {detalle?.codigo}</DialogTitle><DialogDescription>{detalle?.nombre_producto}</DialogDescription></DialogHeader><div className="px-5 py-4 overflow-auto"><Table><TableHeader><TableRow><TableHead>Lista</TableHead><TableHead>Anterior</TableHead><TableHead>Nuevo</TableHead></TableRow></TableHeader><TableBody>{detalle && Object.keys(detalle.precios_nuevos as object).map(key => { const old = (detalle.precios_anteriores as Record<string, number>)[key]; const next = (detalle.precios_nuevos as Record<string, number>)[key]; return <TableRow key={key} className={old !== next ? "font-medium" : ""}><TableCell>{key}</TableCell><TableCell>{money(old)}</TableCell><TableCell>{money(next)}</TableCell></TableRow>; })}</TableBody></Table></div><DialogFooter className="border-t bg-muted/30 px-5 py-3"><Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}