import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useKardexCargas, ALMACEN_BY_NAME } from "@/hooks/useInventario";
import { useAuth } from "@/contexts/AuthContext";

type KardexTipo = "unidades" | "valorizado" | "cedis";

interface ParsedLinea {
  codigo: string;
  nombre: string;
  unidad: string;
  almacen: string; // 1001..1004
  fecha: string;
  serie: string;
  folio: string;
  concepto: string;
  entradas: number;
  salidas: number;
  existencia: number; // unidades o costo total acumulado según tipo
}

interface ParsedFile {
  tipo: KardexTipo;
  lineas: ParsedLinea[];
  fechaMin: string | null;
  fechaMax: string | null;
  skuCount: number;
}

function detectTipo(rows: any[][]): KardexTipo {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const text = (rows[i] || []).map((c) => String(c ?? "")).join(" ").toLowerCase();
    if (text.includes("en importes") || text.includes("valorizado")) return "valorizado";
    if (text.includes("en unidades")) return "unidades";
  }
  return "unidades";
}

function normFecha(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}

function parseFile(rows: any[][]): ParsedFile {
  const tipo = detectTipo(rows);
  const lineas: ParsedLinea[] = [];
  let curCodigo = "", curNombre = "", curUnidad = "";
  let fechaMin: string | null = null, fechaMax: string | null = null;
  const skus = new Set<string>();

  for (const row of rows) {
    if (!row) continue;
    const c0 = String(row[0] ?? "").trim();
    if (/^producto/i.test(c0)) { curCodigo = String(row[1] ?? "").trim(); continue; }
    if (/^nombre/i.test(c0)) { curNombre = String(row[1] ?? "").trim(); continue; }
    if (/^unidad/i.test(c0)) { curUnidad = String(row[1] ?? "").trim(); continue; }
    if (!curCodigo) continue;
    const fechaRaw = row[1];
    if (!fechaRaw) continue;
    const fecha = normFecha(fechaRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    const almName = String(row[5] ?? "").trim().toLowerCase();
    const almacen = ALMACEN_BY_NAME[almName];
    if (!almacen) continue;
    const entradas = Number(row[6]) || 0;
    const salidas = Number(row[7]) || 0;
    const existencia = Number(row[8]) || 0;
    lineas.push({
      codigo: curCodigo, nombre: curNombre, unidad: curUnidad,
      almacen, fecha, serie: String(row[2] ?? ""), folio: String(row[3] ?? ""),
      concepto: String(row[4] ?? ""), entradas, salidas, existencia,
    });
    skus.add(curCodigo);
    if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
    if (!fechaMax || fecha > fechaMax) fechaMax = fecha;
  }

  return { tipo, lineas, fechaMin, fechaMax, skuCount: skus.size };
}

export default function KardexCarga() {
  const { data: cargas = [] } = useKardexCargas();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [empresa, setEmpresa] = useState<string>("lumaggs");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumen, setResumen] = useState<{ updated: number; created: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResumen(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
      const p = parseFile(rows);
      setParsed(p);
    } catch (e: any) {
      toast.error("Error al leer el archivo: " + (e?.message || ""));
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const procesar = async () => {
    if (!parsed) return;
    setProcessing(true);
    setProgress(5);
    let updated = 0, created = 0, errors = 0;
    try {
      const { data: carga, error: cErr } = await (supabase as any)
        .from("inv_kardex_cargas")
        .insert({
          empresa_vendedora: empresa,
          tipo: parsed.tipo,
          nombre_archivo: fileName,
          fecha_archivo: parsed.fechaMax,
          estatus: "procesando",
          creado_por: user?.id ?? null,
          total_skus_procesados: parsed.skuCount,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // Agrupar última fila por (codigo, almacen)
      const lastByKey = new Map<string, ParsedLinea>();
      for (const l of parsed.lineas) {
        const k = `${l.codigo}|${l.almacen}`;
        const prev = lastByKey.get(k);
        if (!prev || l.fecha > prev.fecha) lastByKey.set(k, l);
      }

      // Agrupar por SKU
      const bySku = new Map<string, { nombre: string; unidad: string; stocks: Record<string, number>; valores: Record<string, number> }>();
      for (const [, l] of lastByKey) {
        const e = bySku.get(l.codigo) || { nombre: l.nombre, unidad: l.unidad, stocks: {}, valores: {} };
        if (parsed.tipo === "unidades") e.stocks[l.almacen] = l.existencia;
        else e.valores[l.almacen] = l.existencia;
        bySku.set(l.codigo, e);
      }

      const skuList = Array.from(bySku.keys());
      // Cargar niveles existentes
      const { data: existentes } = await (supabase as any)
        .from("inv_niveles_inventario")
        .select("codigo_producto, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total")
        .in("codigo_producto", skuList);
      const existMap = new Map<string, any>((existentes || []).map((r: any) => [r.codigo_producto, r]));

      const upserts: any[] = [];
      for (const [codigo, e] of bySku) {
        const ex = existMap.get(codigo);
        const row: any = {
          codigo_producto: codigo,
          nombre_producto: e.nombre || ex?.nombre_producto || null,
          unidad: e.unidad || ex?.unidad || null,
          empresa_vendedora: empresa,
          fecha_ultimo_kardex: parsed.fechaMax,
        };
        if (parsed.tipo === "unidades") {
          row.stock_almacen_1001 = e.stocks["1001"] ?? ex?.stock_almacen_1001 ?? 0;
          row.stock_almacen_1002 = e.stocks["1002"] ?? ex?.stock_almacen_1002 ?? 0;
          row.stock_almacen_1003 = e.stocks["1003"] ?? ex?.stock_almacen_1003 ?? 0;
          row.stock_almacen_1004 = e.stocks["1004"] ?? ex?.stock_almacen_1004 ?? 0;
          row.stock_total = row.stock_almacen_1001 + row.stock_almacen_1002 + row.stock_almacen_1003 + row.stock_almacen_1004;
        } else {
          const valor = Object.values(e.valores).reduce((a, b) => a + b, 0);
          const total = ex?.stock_total ?? 0;
          row.valor_total_inventario = valor;
          row.costo_promedio = total > 0 ? valor / total : 0;
        }
        if (!ex) created++; else updated++;
        upserts.push(row);
      }

      // Upsert por lotes
      const batchSize = 200;
      for (let i = 0; i < upserts.length; i += batchSize) {
        const chunk = upserts.slice(i, i + batchSize);
        const { error: upErr } = await (supabase as any)
          .from("inv_niveles_inventario")
          .upsert(chunk, { onConflict: "codigo_producto" });
        if (upErr) { errors += chunk.length; console.error(upErr); }
        setProgress(10 + Math.round(((i + chunk.length) / upserts.length) * 80));
      }

      // Guardar líneas resumen
      const lineasInsert = upserts.map((r) => ({
        carga_id: carga.id,
        codigo_producto: r.codigo_producto,
        nombre_producto: r.nombre_producto,
        stock_almacen_1001: r.stock_almacen_1001 ?? null,
        stock_almacen_1002: r.stock_almacen_1002 ?? null,
        stock_almacen_1003: r.stock_almacen_1003 ?? null,
        stock_almacen_1004: r.stock_almacen_1004 ?? null,
        stock_total: r.stock_total ?? null,
        valor_total: r.valor_total_inventario ?? null,
        costo_promedio: r.costo_promedio ?? null,
        estatus_linea: "ok",
      }));
      for (let i = 0; i < lineasInsert.length; i += batchSize) {
        await (supabase as any).from("inv_kardex_lineas").insert(lineasInsert.slice(i, i + batchSize));
      }

      await (supabase as any).from("inv_kardex_cargas").update({
        estatus: errors > 0 ? "con_errores" : "completado",
        total_skus_actualizados: updated + created,
        total_skus_error: errors,
      }).eq("id", carga.id);

      setProgress(100);
      setResumen({ updated, created, errors });
      toast.success(`Kárdex procesado: ${updated + created} SKUs (${errors} errores)`);
      qc.invalidateQueries({ queryKey: ["inv_niveles_inventario"] });
      qc.invalidateQueries({ queryKey: ["inv_kardex_cargas"] });
    } catch (e: any) {
      console.error(e);
      toast.error("Error al procesar: " + (e?.message || ""));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Carga de Kárdex</h1>
        <p className="text-sm text-muted-foreground">Sube archivos CONTPAQi de Kárdex en Unidades o Valorizado</p>
      </div>

      <Tabs defaultValue="subir">
        <TabsList>
          <TabsTrigger value="subir">Subir archivo</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="subir" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Arrastra un archivo XLS / XLSX o</p>
                <label className="inline-block">
                  <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <Button asChild variant="outline"><span>Seleccionar archivo</span></Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {parsed && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="outline" className="ml-2 uppercase">{parsed.tipo}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <Info label="SKUs detectados" value={parsed.skuCount} />
                  <Info label="Movimientos" value={parsed.lineas.length} />
                  <Info label="Desde" value={parsed.fechaMin || "—"} />
                  <Info label="Hasta" value={parsed.fechaMax || "—"} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</label>
                  <Select value={empresa} onValueChange={setEmpresa}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lumaggs">Lumaggs — Chevron</SelectItem>
                      <SelectItem value="galsa">Galsa — Phillips 66</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={procesar} disabled={processing}>{processing ? "Procesando..." : "Procesar"}</Button>
                </div>
                {processing && <Progress value={progress} />}
                {resumen && (
                  <div className="flex items-center gap-3 text-sm pt-2 border-t">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>SKUs actualizados: <b>{resumen.updated}</b></span>
                    <span>Nuevos: <b>{resumen.created}</b></span>
                    {resumen.errors > 0 && <span className="text-red-600 inline-flex items-center gap-1"><AlertCircle className="h-4 w-4" />Errores: <b>{resumen.errors}</b></span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Fecha carga</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Tipo</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Empresa</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Periodo</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Archivo</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Procesados</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Actualizados</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium text-right">Errores</TableHead>
                    <TableHead className="uppercase tracking-wide text-xs font-medium">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargas.map((c: any, i: number) => (
                    <TableRow key={c.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <TableCell className="text-xs">{c.created_at ? new Date(c.created_at).toLocaleString("es-MX") : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase">{c.tipo}</Badge></TableCell>
                      <TableCell>{c.empresa_vendedora === "lumaggs" ? "Lumaggs" : c.empresa_vendedora === "galsa" ? "Galsa" : c.empresa_vendedora}</TableCell>
                      <TableCell className="text-xs">{c.fecha_archivo || "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[260px]">{c.nombre_archivo}</TableCell>
                      <TableCell className="text-right">{c.total_skus_procesados ?? 0}</TableCell>
                      <TableCell className="text-right">{c.total_skus_actualizados ?? 0}</TableCell>
                      <TableCell className="text-right">{c.total_skus_error ?? 0}</TableCell>
                      <TableCell><Badge variant={c.estatus === "completado" ? "default" : c.estatus === "con_errores" ? "destructive" : "secondary"}>{c.estatus}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {cargas.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin cargas previas</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}