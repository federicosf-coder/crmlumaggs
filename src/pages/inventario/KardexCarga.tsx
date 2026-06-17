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
import { useKardexCargas } from "@/hooks/useInventario";
import { useAuth } from "@/contexts/AuthContext";

type KardexTipo = "unidades" | "valorizado";

// Almacenes válidos (se ignoran 1 "Almacen Uno" y 999 "Consignación")
const ALMACENES_VALIDOS = new Set(["1001", "1002", "1003", "1004"]);

interface ParsedLinea {
  codigo: string;
  nombre: string;
  almacen: string;
  existencia: number; // unidades o costo total
  entradas: number;
  salidas: number;
  inicial: number;
}

interface ParsedFile {
  tipo: KardexTipo;
  lineas: ParsedLinea[];
  fechaInicio: string | null;
  fechaFin: string | null;
  skuCount: number;
  warehousesEncontrados: string[];
}

const MESES_ES: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
  JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

function normContpaqiDate(s: string): string {
  const m = s.trim().toUpperCase().match(/^(\d{1,2})\/([A-Z]{3})\/(\d{4})$/);
  if (!m) return "";
  const mes = MESES_ES[m[2]];
  if (!mes) return "";
  return `${m[3]}-${mes}-${m[1].padStart(2, "0")}`;
}

function normalizeCodigo(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // Códigos numéricos: quitar decimales
    return String(Math.round(v));
  }
  return String(v).trim();
}

function parseFile(rows: any[][]): ParsedFile {
  // Tipo en A3
  const a3 = String(rows[2]?.[0] ?? "").toUpperCase();
  const tipo: KardexTipo = a3.includes("IMPORTE") ? "valorizado" : "unidades";

  // Rango de fechas en A4: "Del: 01/ENE/2024 Al: 15/JUN/2026"
  const a4 = String(rows[3]?.[0] ?? "");
  const mRange = a4.match(/Del:\s*([\d\/A-Za-z]+)\s+Al:\s*([\d\/A-Za-z]+)/i);
  const fechaInicio = mRange ? normContpaqiDate(mRange[1]) : null;
  const fechaFin = mRange ? normContpaqiDate(mRange[2]) : null;

  const lineas: ParsedLinea[] = [];
  const skus = new Set<string>();
  const warehouses = new Set<string>();
  let curAlmacen: string | null = null;
  let almacenValido = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = String(row[0] ?? "").trim();

    if (/^Almac[eé]n:/i.test(c0)) {
      const codeRaw = row[1];
      const code = typeof codeRaw === "number" ? String(Math.round(codeRaw)) : String(codeRaw ?? "").trim();
      curAlmacen = code;
      almacenValido = ALMACENES_VALIDOS.has(code);
      if (almacenValido) warehouses.add(code);
      continue;
    }
    if (/^Nombre:/i.test(c0)) continue;
    if (!curAlmacen || !almacenValido) continue;

    const codigo = normalizeCodigo(row[0]);
    const nombre = String(row[1] ?? "").trim();
    if (!codigo || !nombre) continue;
    // saltar headers/encabezados/totales sin valores numéricos
    if (/^c[oó]digo/i.test(codigo) || /^total/i.test(codigo)) continue;

    const inicial = Number(row[3]) || 0;
    const entradas = Number(row[4]) || 0;
    const salidas = Number(row[5]) || 0;
    const existencia = Number(row[6]) || 0;

    lineas.push({ codigo, nombre, almacen: curAlmacen, existencia, entradas, salidas, inicial });
    skus.add(codigo);
  }

  return {
    tipo,
    lineas,
    fechaInicio,
    fechaFin,
    skuCount: skus.size,
    warehousesEncontrados: Array.from(warehouses).sort(),
  };
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
          fecha_archivo: parsed.fechaFin,
          fecha_inicio: parsed.fechaInicio,
          estatus: "procesando",
          creado_por: user?.id ?? null,
          total_skus_procesados: parsed.skuCount,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // Una línea por (sku, almacén) — el reporte ya da existencia final del periodo
      const bySku = new Map<string, { nombre: string; stocks: Record<string, number>; valores: Record<string, number> }>();
      for (const l of parsed.lineas) {
        const e = bySku.get(l.codigo) || { nombre: l.nombre, stocks: {}, valores: {} };
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
          empresa_vendedora: empresa,
          fecha_ultimo_kardex: parsed.fechaFin,
        };
        if (parsed.tipo === "unidades") {
          row.stock_almacen_1001 = e.stocks["1001"] ?? 0;
          row.stock_almacen_1002 = e.stocks["1002"] ?? 0;
          row.stock_almacen_1003 = e.stocks["1003"] ?? 0;
          row.stock_almacen_1004 = e.stocks["1004"] ?? 0;
          row.stock_total = row.stock_almacen_1001 + row.stock_almacen_1002 + row.stock_almacen_1003 + row.stock_almacen_1004;
        } else {
          const valor = Object.values(e.valores).reduce((a, b) => a + b, 0);
          const total = ex?.stock_total ?? 0;
          row.valor_total_inventario = valor;
          row.costo_promedio = total > 0 ? valor / total : null;
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
        estatus: errors > 0 ? "error" : "completado",
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
        <p className="text-sm text-muted-foreground">Sube reportes CONTPAQi "Inventario actual del almacén" en Unidades o Importes (XLS). Se ignoran los almacenes 1 "Almacen Uno" y 999 "Consignación".</p>
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
                  <Info label="Almacenes" value={parsed.warehousesEncontrados.join(", ") || "—"} />
                  <Info label="Desde" value={parsed.fechaInicio || "—"} />
                  <Info label="Hasta" value={parsed.fechaFin || "—"} />
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
                      <TableCell className="text-xs">{c.fecha_inicio || "—"} → {c.fecha_archivo || "—"}</TableCell>
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