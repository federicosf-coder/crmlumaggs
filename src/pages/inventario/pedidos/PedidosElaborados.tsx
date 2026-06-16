import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Upload, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { usePedidos, usePedido, useUpdatePedidoEstatus, ESTATUS_PEDIDO_LABEL, estatusPedidoColor, nextEstatus, nextEstatusLabel } from "@/hooks/usePedidosInventario";

export default function PedidosElaborados() {
  const { data: pedidos = [] } = usePedidos();
  const [empresa, setEmpresa] = useState("todas");
  const [almacen, setAlmacen] = useState("todos");
  const [estatus, setEstatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => pedidos.filter((p) => {
    if (empresa !== "todas" && p.empresa_vendedora !== empresa) return false;
    if (almacen !== "todos" && p.almacen_destino !== almacen) return false;
    if (estatus !== "todos" && p.estatus !== estatus) return false;
    if (search && !String(p.numero_po_interno || "").toLowerCase().includes(search.toLowerCase())
      && !String(p.numero_orden_proveedor || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [pedidos, empresa, almacen, estatus, search]);

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <Input placeholder="Buscar PO" className="max-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="lumaggs">Lumaggs</SelectItem>
              <SelectItem value="galsa">Galsa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={almacen} onValueChange={setAlmacen}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los hubs</SelectItem>
              <SelectItem value="1001">Mexicali</SelectItem>
              <SelectItem value="1002">Tijuana</SelectItem>
            </SelectContent>
          </Select>
          <Select value={estatus} onValueChange={setEstatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estatus</SelectItem>
              {Object.entries(ESTATUS_PEDIDO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
              <TableRow>
                {["PO interno","N° Orden","Empresa","Almacén","Fuente","Fecha pedido","Despacho","Entrega est.","Tarimas","Monto","Estatus"].map((h) =>
                  <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow key={p.id} className={`cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/20"}`} onClick={() => setOpenId(p.id)}>
                  <TableCell className="font-mono text-xs">{p.numero_po_interno || "—"}</TableCell>
                  <TableCell className="text-xs">{p.numero_orden_proveedor || "—"}</TableCell>
                  <TableCell><Badge className={p.empresa_vendedora === "lumaggs" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>{p.empresa_vendedora === "lumaggs" ? "Chevron" : "Phillips 66"}</Badge></TableCell>
                  <TableCell>{p.almacen_destino}</TableCell>
                  <TableCell className="text-xs">{p.fuente || "—"}</TableCell>
                  <TableCell className="text-xs">{p.fecha_pedido || "—"}</TableCell>
                  <TableCell className="text-xs">{p.fecha_despacho || "—"}</TableCell>
                  <TableCell className="text-xs">{p.fecha_entrega_estimada || "—"}</TableCell>
                  <TableCell className="text-right">{p.total_tarimas ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.total_monto ? `${Number(p.total_monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda || ""}` : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={estatusPedidoColor(p.estatus)}>{ESTATUS_PEDIDO_LABEL[p.estatus] || p.estatus}</Badge></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin pedidos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PedidoDetailSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PedidoDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, refetch } = usePedido(id);
  const upd = useUpdatePedidoEstatus();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<{ archivoId: string; data: any } | null>(null);

  if (!id) return null;
  const p = data?.pedido;
  const lineas = data?.lineas || [];
  const archivos = data?.archivos || [];

  const onAdvance = async () => {
    if (!p) return;
    const next = nextEstatus(p.estatus);
    if (!next) return;
    if (p.estatus === "en_transito") { navigate(`/inventario/pedidos/recibidos?pedido=${p.id}`); return; }
    await upd.mutateAsync({ id: p.id, estatus: next });
    toast.success(`Estatus actualizado a ${ESTATUS_PEDIDO_LABEL[next]}`);
  };

  const onUpload = async (file: File) => {
    if (!p) return;
    setUploading(true);
    try {
      const path = `${p.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("inventario-pedidos").upload(path, file);
      if (upErr) throw upErr;
      await (supabase as any).from("inv_pedido_archivos").insert({
        pedido_id: p.id, nombre_archivo: file.name, url_archivo: path,
        tipo_archivo: file.type, usuario_carga: user?.id ?? null,
      });
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
      refetch();
    } catch (e: any) { toast.error(e?.message || "Error al subir"); }
    finally { setUploading(false); }
  };

  const onExtract = async (archivo: any) => {
    if (!p) return;
    setExtracting(archivo.id);
    try {
      const { data: res, error } = await supabase.functions.invoke("inv-pedido-extract", {
        body: { proveedor: p.proveedor, file_path: archivo.url_archivo },
      });
      if (error) throw error;
      if ((res as any).error) throw new Error((res as any).error);
      const extractedData = (res as any).extracted;
      await (supabase as any).from("inv_pedido_archivos").update({
        extraido_por_ia: true, datos_extraidos: extractedData,
      }).eq("id", archivo.id);
      setExtracted({ archivoId: archivo.id, data: extractedData });
      toast.success("Extracción completada");
    } catch (e: any) { toast.error(e?.message || "Error extrayendo"); }
    finally { setExtracting(null); }
  };

  const aplicarExtraccion = async () => {
    if (!p || !extracted) return;
    const d = extracted.data;
    const update: any = {};
    if (d.numero_po) update.numero_po_interno = d.numero_po;
    if (d.numero_orden) update.numero_orden_proveedor = d.numero_orden;
    if (d.fecha_pedido) update.fecha_pedido = d.fecha_pedido;
    if (d.fecha_despacho) update.fecha_despacho = d.fecha_despacho;
    if (d.total_monto) update.total_monto = d.total_monto;
    if (d.moneda) update.moneda = d.moneda;
    await (supabase as any).from("inv_pedidos").update(update).eq("id", p.id);
    toast.success("Datos aplicados");
    setExtracted(null);
    qc.invalidateQueries({ queryKey: ["inv_pedido", p.id] });
    qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
    refetch();
  };

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 p-6">
          <SheetTitle className="font-light">Pedido {p?.numero_po_interno || "—"}</SheetTitle>
        </SheetHeader>
        {p && (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Empresa" value={p.empresa_vendedora === "lumaggs" ? "Lumaggs (Chevron)" : "Galsa (Phillips 66)"} />
              <Field label="Almacén destino" value={p.almacen_destino} />
              <Field label="Fuente" value={p.fuente || "—"} />
              <Field label="Proveedor" value={p.proveedor} />
              <Field label="N° Orden proveedor" value={p.numero_orden_proveedor || "—"} />
              <Field label="Total tarimas" value={p.total_tarimas ?? 0} />
              <Field label="Monto" value={p.total_monto ? `${Number(p.total_monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda || ""}` : "—"} />
              <Field label="Estatus" value={<Badge className={estatusPedidoColor(p.estatus)}>{ESTATUS_PEDIDO_LABEL[p.estatus]}</Badge>} />
            </div>
            {nextEstatus(p.estatus) && (
              <Button onClick={onAdvance} className="w-full">{nextEstatusLabel(p.estatus)}</Button>
            )}

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Archivos adjuntos</div>
              <div className="flex items-center gap-2 mb-3">
                <label className="inline-block">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
                  <Button asChild variant="outline" size="sm" disabled={uploading}><span><Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Subiendo..." : "Subir PDF del proveedor"}</span></Button>
                </label>
              </div>
              <div className="space-y-2">
                {archivos.map((a: any) => (
                  <div key={a.id} className="border rounded p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="truncate max-w-[260px]">{a.nombre_archivo}</span>{a.extraido_por_ia && <Badge variant="outline" className="bg-violet-50 text-violet-700">IA</Badge>}</div>
                    <Button size="sm" variant="outline" onClick={() => onExtract(a)} disabled={extracting === a.id}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />{extracting === a.id ? "Extrayendo..." : "Extraer con IA"}
                    </Button>
                  </div>
                ))}
                {archivos.length === 0 && <div className="text-xs text-muted-foreground">Sin archivos</div>}
              </div>
              {extracted && (
                <div className="mt-3 border rounded p-3 bg-violet-50/50">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vista previa de extracción</div>
                  <pre className="text-[10px] max-h-48 overflow-auto bg-background border rounded p-2">{JSON.stringify(extracted.data, null, 2)}</pre>
                  <Button size="sm" className="mt-2" onClick={aplicarExtraccion}>Aplicar datos extraídos</Button>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Líneas del pedido</div>
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      {["Código","Producto","Pres.","Cant.","Unidad","Tarimas","P. unit.","Total","Status"].map((h) => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.codigo_producto}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{l.nombre_producto || "—"}</TableCell>
                        <TableCell className="text-xs">{l.presentacion || "—"}</TableCell>
                        <TableCell className="text-right">{l.cantidad_solicitada}</TableCell>
                        <TableCell className="text-xs">{l.unidad_pedido || "—"}</TableCell>
                        <TableCell className="text-right">{l.tarimas ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.precio_unitario ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{l.precio_neto ?? "—"}</TableCell>
                        <TableCell className="text-xs">{l.estatus_linea || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}