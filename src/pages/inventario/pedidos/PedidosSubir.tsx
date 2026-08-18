import { useRef, useState } from "react";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

type Estado = "pendiente" | "procesando" | "creado" | "actualizado" | "error";

type Resultado = {
  id: string;
  nombre: string;
  proveedor?: string;
  estado: Estado;
  mensaje?: string;
  numero_po?: string;
  lineas?: number;
};

async function firstPageText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return (content.items as any[]).map((i) => i.str || "").join(" ");
  } catch {
    return "";
  }
}

async function detectarProveedor(file: File): Promise<"Chevron" | "Phillips 66"> {
  const text = (await firstPageText(file)).toLowerCase();
  if (text.includes("business point") || text.includes("chevron")) return "Chevron";
  if (text.includes("phillips") || text.includes("history orders")) return "Phillips 66";
  return "Chevron";
}

function estadoBadge(r: Resultado) {
  if (r.estado === "procesando") return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Procesando…</Badge>;
  if (r.estado === "creado") return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Creado</Badge>;
  if (r.estado === "actualizado") return <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Actualizado</Badge>;
  if (r.estado === "error") return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Error: {r.mensaje}</Badge>;
  return <Badge variant="outline">En cola</Badge>;
}

export default function PedidosSubir() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fecha, setFecha] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { toast.error("Selecciona archivos PDF"); return; }
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const upd = (id: string, patch: Partial<Resultado>) =>
    setResultados((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const procesarArchivo = async (file: File, id: string) => {
    const proveedor = await detectarProveedor(file);
    upd(id, { proveedor });

    const path = `nuevo/${Date.now()}_${file.name}`;
    const up = await supabase.storage.from("inventario-pedidos").upload(path, file, { contentType: "application/pdf" });
    if (up.error) throw new Error(up.error.message);

    const { data: res, error: fnErr } = await supabase.functions.invoke("inv-pedido-extract", {
      body: { proveedor: proveedor === "Chevron" ? "chevron" : "phillips66", file_path: path },
    });
    if (fnErr) throw new Error(fnErr.message);
    if ((res as any)?.error) throw new Error((res as any).error);

    const extracted = (res as any)?.extracted;
    if (!extracted) throw new Error("No se pudo extraer información del PDF");

    const empresa_vendedora = proveedor === "Chevron" ? "lumaggs" : "galsa";
    const proveedorKey = proveedor === "Chevron" ? "chevron" : "phillips66";

    const { data: existente } = await supabase
      .from("inv_pedidos")
      .select("id, estatus, almacen_destino, fecha_entrega_estimada")
      .eq("numero_po_interno", extracted.numero_po)
      .eq("empresa_vendedora", empresa_vendedora as any)
      .maybeSingle();

    let pedidoId: string;
    let creado = false;

    if (existente) {
      const nuevoEstatus = !existente.estatus || existente.estatus === "elaborado" ? "elaborado" : existente.estatus;
      const { error } = await supabase.from("inv_pedidos").update({
        numero_orden_proveedor: extracted.numero_orden,
        almacen_destino: extracted.almacen_destino ?? existente.almacen_destino,
        total_monto: extracted.total_monto,
        moneda: extracted.moneda ?? "MXN",
        fecha_pedido: fecha,
        estatus: nuevoEstatus,
        fecha_entrega_estimada: extracted.fecha_entrega_estimada ?? existente.fecha_entrega_estimada,
      }).eq("id", existente.id);
      if (error) throw new Error(error.message);
      pedidoId = existente.id;
    } else {
      const { data: nuevo, error } = await supabase.from("inv_pedidos").insert({
        numero_po_interno: extracted.numero_po,
        numero_orden_proveedor: extracted.numero_orden,
        empresa_vendedora: empresa_vendedora as any,
        proveedor: proveedorKey,
        almacen_destino: extracted.almacen_destino,
        fuente: "usa",
        moneda: extracted.moneda ?? "MXN",
        total_monto: extracted.total_monto,
        estatus: "elaborado",
        fecha_pedido: fecha,
        fecha_entrega_estimada: extracted.fecha_entrega_estimada ?? null,
        generado_desde_sugeridos: false,
        creado_por: user?.id ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      pedidoId = nuevo.id;
      creado = true;
    }

    const lineas = Array.isArray(extracted.lineas) ? extracted.lineas : [];
    if (lineas.length) {
      const rows = lineas.map((l: any) => ({
        pedido_id: pedidoId,
        codigo_producto: l.codigo,
        nombre_producto: l.descripcion,
        cantidad_solicitada: l.cantidad,
        unidad_pedido: l.unidad,
        precio_unitario: l.precio_unitario,
        precio_neto: l.precio_neto,
        estatus_linea: String(l.estado || "").toLowerCase().includes("cancel") ? "cancelada" : "pendiente",
      }));
      const { error } = await supabase.from("inv_pedido_lineas").upsert(rows, { onConflict: "pedido_id,codigo_producto" });
      if (error) throw new Error(error.message);
    }

    const { error: archErr } = await supabase.from("inv_pedido_archivos").insert({
      pedido_id: pedidoId,
      nombre_archivo: file.name,
      url_archivo: path,
      tipo_archivo: "confirmacion_proveedor",
      extraido_por_ia: true,
      datos_extraidos: extracted,
      usuario_carga: user?.id ?? null,
    });
    if (archErr) throw new Error(archErr.message);

    upd(id, {
      estado: creado ? "creado" : "actualizado",
      numero_po: extracted.numero_po,
      lineas: lineas.length,
    });
    qc.invalidateQueries({ queryKey: ["inv_pedidos"] });
  };

  const procesar = async () => {
    if (!files.length) { toast.error("Selecciona al menos un archivo PDF"); return; }
    if (!fecha) { toast.error("Indica la fecha de pedido"); return; }
    setLoading(true);
    const nuevos: Resultado[] = files.map((f, i) => ({ id: `${Date.now()}_${i}_${f.name}`, nombre: f.name, estado: "pendiente" }));
    setResultados((prev) => [...nuevos, ...prev]);
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const id = nuevos[i].id;
      upd(id, { estado: "procesando" });
      try {
        await procesarArchivo(files[i], id);
        ok++;
      } catch (e: any) {
        upd(id, { estado: "error", mensaje: e?.message || "Error desconocido" });
        fail++;
      }
    }
    setLoading(false);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    toast[fail && !ok ? "error" : "success"](`${ok} procesado(s)${fail ? `, ${fail} con error` : ""}`);
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label className="uppercase tracking-wide text-xs font-medium">Fecha de pedido (aplica a todo el lote)</Label>
            <Input type="date" value={fecha} disabled={loading} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!loading) addFiles(e.dataTransfer.files); }}
            onClick={() => !loading && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/30"}`}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-light">Arrastra aquí los PDF de confirmación o haz clic para seleccionarlos</p>
            <p className="text-xs text-muted-foreground mt-1">Puedes subir varios archivos a la vez</p>
            <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={`${f.name}_${i}`} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-light">{f.name}</span>
                  {!loading && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={procesar} disabled={loading || !files.length || !fecha}>
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando…</>) : `Procesar ${files.length || ""} archivo(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                <TableRow>
                  {["Archivo", "Proveedor", "Estado", "PO", "Líneas"].map((h) => (
                    <TableHead key={h} className="uppercase tracking-wide text-xs font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((r, i) => (
                  <TableRow key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <TableCell className="text-xs font-light">{r.nombre}</TableCell>
                    <TableCell className="text-xs">{r.proveedor || "—"}</TableCell>
                    <TableCell>{estadoBadge(r)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.numero_po || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.lineas ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
