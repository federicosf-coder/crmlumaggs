import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, CheckCircle2, AlertCircle, Package, DollarSign, Activity, Coins, Upload, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useKardexCargas } from "@/hooks/useInventario";
import { useAuth } from "@/contexts/AuthContext";

type TipoArchivo = "inventario_unidades" | "inventario_importe" | "kardex_unidades" | "kardex_importe";

const ALMACENES_VALIDOS = new Set(["1001", "1002", "1003", "1004", "1005", "1006", "1007"]);

// Galsa usa su propio esquema de códigos de almacén en CONTPAQi (distinto a Chevron).
// Mapeamos a los códigos canónicos de plaza. Tijuana 02 se fusiona con Tijuana.
const GALSA_ALMACEN_MAP: Record<string, string> = {
  "1": "1001",  // Mexicali
  "9": "1002",  // Tijuana
  "15": "1002", // Tijuana 02 -> Tijuana
  "4": "1003",  // Morelos
  "13": "1004", // Ensenada
  "2": "1005",  // San Luis
  "5": "1006",  // Puerto Peñasco
  "6": "1007",  // San Quintín
};

const MESES_ES: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
  JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

function normContpaqiDate(s: string): string {
  const m = String(s).trim().toUpperCase().match(/^(\d{1,2})\/([A-Z]{3})\/(\d{4})$/);
  if (!m) return "";
  const mes = MESES_ES[m[2]];
  if (!mes) return "";
  return `${m[3]}-${mes}-${m[1].padStart(2, "0")}`;
}

function normalizeCodigo(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v));
  return String(v).trim();
}

function buscarRangoFechas(rows: any[][]): { fechaInicio: string | null; fechaFin: string | null } {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    for (let j = 0; j < (rows[i]?.length || 0); j++) {
      const cell = String(rows[i][j] ?? "");
      const m = cell.match(/Del[:\s]+([\d\/A-Za-z]+)\s+Al[:\s]+([\d\/A-Za-z]+)/i);
      if (m) {
        return {
          fechaInicio: normContpaqiDate(m[1].trim()) || null,
          fechaFin: normContpaqiDate(m[2].trim()) || null,
        };
      }
    }
  }
  let primera: string | null = null;
  let ultima: string | null = null;
  for (const row of rows) {
    const f = normContpaqiDate(String(row?.[1] ?? ""));
    if (f) {
      if (!primera) primera = f;
      ultima = f;
    }
  }
  return { fechaInicio: primera, fechaFin: ultima };
}

interface ParsedLinea {
  codigo: string;
  nombre: string;
  almacen: string;
  existencia: number;
  entradas: number;
  salidas: number;
  inicial: number;
}

interface ParsedInventario {
  lineas: ParsedLinea[];
  fechaInicio: string | null;
  fechaFin: string | null;
  skuCount: number;
  warehousesEncontrados: string[];
}

function parseInventario(rows: any[][], empresa: string): ParsedInventario {
  const { fechaInicio, fechaFin } = buscarRangoFechas(rows);

  const lineas: ParsedLinea[] = [];
  const skus = new Set<string>();
  const warehouses = new Set<string>();
  let curAlmacen: string | null = null;
  let almacenValido = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = String(row[0] ?? "").trim();

    if (/^Almac[eé]n/i.test(c0)) {
      const mInline = c0.match(/:\s*(\d+)/);
      const codeRaw = mInline ? mInline[1] : row[1];
      const code = typeof codeRaw === "number" ? String(Math.round(codeRaw)) : String(codeRaw ?? "").trim();
      const mappedCode = empresa === "galsa" ? (GALSA_ALMACEN_MAP[code] ?? null) : code;
      curAlmacen = mappedCode;
      almacenValido = !!mappedCode && ALMACENES_VALIDOS.has(mappedCode);
      if (almacenValido && mappedCode) warehouses.add(mappedCode);
      continue;
    }
    if (/^Nombre:/i.test(c0)) continue;
    if (!curAlmacen || !almacenValido) continue;

    const codigo = normalizeCodigo(row[0]);
    const nombre = String(row[1] ?? "").trim();
    if (!codigo || !nombre) continue;
    if (/^c[oó]digo/i.test(codigo) || /^total/i.test(codigo)) continue;

    const inicial = Number(row[3]) || 0;
    const entradas = Number(row[4]) || 0;
    const salidas = Number(row[5]) || 0;
    const existencia = Number(row[6]) || 0;

    lineas.push({ codigo, nombre, almacen: curAlmacen, existencia, entradas, salidas, inicial });
    skus.add(codigo);
  }

  return {
    lineas,
    fechaInicio,
    fechaFin,
    skuCount: skus.size,
    warehousesEncontrados: Array.from(warehouses).sort(),
  };
}

// ============================================================
// Parser específico para Kardex en Unidades (movimientos detallados)
// ============================================================
interface MovimientoKardex {
  codigo: string;
  nombre: string;
  almacen: string;
  plaza: string | null; // 1001..1004 si es facturación a esa plaza
  fecha: string;
  concepto: string;
  salidas: number;
  entradas: number;
}

interface ParsedKardex {
  movimientos: MovimientoKardex[];
  fechaInicio: string | null;
  fechaFin: string | null;
  skuCount: number;
}

function parseKardexMovimientos(rows: any[][]): ParsedKardex {
  const { fechaInicio, fechaFin } = buscarRangoFechas(rows);

  const movimientos: MovimientoKardex[] = [];
  const skus = new Set<string>();
  let curCodigo: string | null = null;
  let curNombre = "";
  let debugCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const c4 = String(row[4] ?? "").trim();
    const c5 = String(row[5] ?? "").trim();
    const c6 = String(row[6] ?? "").trim();
    const c7 = String(row[7] ?? "").trim();

    // Detectar inicio de producto
    if (/^Producto:/i.test(c0)) {
      const codeRaw = row[1];
      curCodigo = typeof codeRaw === "number"
        ? String(Math.round(codeRaw))
        : String(codeRaw ?? "").trim();
      if (curCodigo) skus.add(curCodigo);
      continue;
    }

    // Detectar nombre (solo para info)
    if (/^Nombre:/i.test(c0)) {
      curNombre = c1;
      continue;
    }

    // Saltar filas que no son movimientos
    if (!curCodigo) continue;
    if (!/^\d{1,2}\/[A-Za-z]{3}\/\d{4}$/.test(c1)) continue;

    const fechaIso = normContpaqiDate(c1);
    if (!fechaIso) continue;

    // Determinar si es venta por facturación
    // REGLA: col[4] debe empezar con "Facturacion" (puede tener o sin acento)
    const esFacturacion = /^Facturaci[oó]n\s+\S/i.test(c4) || /^Factura\s+4\.0\b/i.test(c4);

    // Determinar almacén/plaza desde col[5]
    const almacenTexto = c5.toLowerCase();
    let almacenCodigo: string | null = null;
    if (almacenTexto.includes("tijuana")) almacenCodigo = "1002";
    else if (almacenTexto.includes("mexicali")) almacenCodigo = "1001";
    else if (almacenTexto.includes("morelos")) almacenCodigo = "1003";
    else if (almacenTexto.includes("ensenada")) almacenCodigo = "1004";

    // Entradas: col[6], Salidas: col[7]
    const entradas = Number(c6.replace(/[^0-9.-]/g, "")) || 0;
    const salidas = Number(c7.replace(/[^0-9.-]/g, "")) || 0;

    // Plaza = almacén solo si es facturación
    const plaza = esFacturacion ? almacenCodigo : null;

    // Debug primeras 5 facturaciones
    if (esFacturacion && debugCount < 5) {
      console.log(`[KARDEX DEBUG row${i}] codigo=${curCodigo} c4=${JSON.stringify(c4)} c5=${JSON.stringify(c5)} salidas=${salidas} plaza=${plaza} esFacturacion=${esFacturacion}`);
      debugCount++;
    }

    movimientos.push({
      codigo: curCodigo,
      nombre: curNombre,
      almacen: almacenCodigo || "desconocido",
      plaza,
      fecha: fechaIso,
      concepto: c4,
      salidas,
      entradas,
    });
  }

  console.log(`[KARDEX] Total movimientos: ${movimientos.length}, SKUs: ${skus.size}`);
  console.log(`[KARDEX] Facturaciones con salidas>0: ${movimientos.filter(m => m.plaza && m.salidas > 0).length}`);

  return { movimientos, fechaInicio, fechaFin, skuCount: skus.size };
}

// ============================================================
// Configuración de los 4 tipos de archivo
// ============================================================
const TIPOS: { key: TipoArchivo; titulo: string; descripcion: string; icon: any; color: string }[] = [
  {
    key: "inventario_unidades",
    titulo: "Inventario en Unidades",
    descripcion: "Stock final por almacén. Actualiza existencias en niveles de inventario.",
    icon: Package,
    color: "text-blue-600",
  },
  {
    key: "inventario_importe",
    titulo: "Inventario en Importe",
    descripcion: "Valor monetario del inventario. Actualiza costo promedio y valor total.",
    icon: DollarSign,
    color: "text-emerald-600",
  },
  {
    key: "kardex_unidades",
    titulo: "Kárdex en Unidades",
    descripcion: "Movimientos detallados. Calcula demanda por plaza y recalcula mín/máx.",
    icon: Activity,
    color: "text-violet-600",
  },
  {
    key: "kardex_importe",
    titulo: "Kárdex en Importe",
    descripcion: "Referencia histórica de movimientos en pesos.",
    icon: Coins,
    color: "text-amber-600",
  },
];

const TIPO_LABEL: Record<string, string> = {
  inventario_unidades: "Inventario Unidades",
  inventario_importe: "Inventario Importe",
  kardex_unidades: "Kárdex Unidades",
  kardex_importe: "Kárdex Importe",
  unidades: "Inventario Unidades",
  valorizado: "Inventario Importe",
};

export default function KardexCarga() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Carga de Kárdex</h1>
        <p className="text-sm text-muted-foreground">
          Sube los 4 reportes de CONTPAQi (XLS). Cada tipo actualiza información diferente.
          Se ignoran los almacenes 1 "Almacén Uno" y 999 "Consignación".
        </p>
      </div>
      <KardexCargaTabContent />
    </div>
  );
}

export function KardexCargaTabContent() {
  const { data: cargas = [] } = useKardexCargas();
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const [empresa, setEmpresa] = useState<string>("lumaggs");
  const [limpiando, setLimpiando] = useState(false);
  const puedeLimpiarDemanda = hasAnyRole(["admin", "manager"]);

  // [DIAG TEMPORAL] Mostrar estado de tablas al cargar la pantalla
  useEffect(() => {
    (async () => {
      try {
        const { count: demandaCount } = await (supabase as any)
          .from("inv_demanda_plaza")
          .select("*", { count: "exact", head: true });
        const { data: ultima } = await (supabase as any)
          .from("inv_kardex_cargas")
          .select("created_at")
          .eq("tipo", "kardex_unidades")
          .order("created_at", { ascending: false })
          .limit(1);
        const { count: cargasCount } = await (supabase as any)
          .from("inv_kardex_cargas")
          .select("*", { count: "exact", head: true })
          .eq("tipo", "kardex_unidades");
        toast.info(
          `inv_demanda_plaza: ${demandaCount ?? 0} filas · kardex_unidades cargas: ${cargasCount ?? 0}` +
            (ultima?.[0]?.created_at ? ` (última: ${new Date(ultima[0].created_at).toLocaleString("es-MX")})` : ""),
          { duration: 8000 },
        );
      } catch (e: any) {
        toast.error(`Diag error: ${e?.message || e}`);
      }
    })();
  }, []);

  const limpiarDemanda = async () => {
    setLimpiando(true);
    try {
      const { error } = await (supabase as any)
        .from("inv_demanda_plaza")
        .delete()
        .neq("codigo_producto", "");
      if (error) throw error;
      toast.success("Datos de demanda por plaza eliminados");
      qc.invalidateQueries({ queryKey: ["inv_demanda_plaza"] });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo limpiar la demanda");
    } finally {
      setLimpiando(false);
    }
  };

  const { data: ultimasCargas } = useQuery({
    queryKey: ["inv_kardex_cargas_ultimas", empresa],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inv_kardex_cargas")
        .select("tipo, created_at, total_skus_procesados, estatus, empresa_vendedora")
        .eq("estatus", "completado")
        .eq("empresa_vendedora", empresa)
        .order("created_at", { ascending: false });
      const byTipo = new Map<string, any>();
      for (const c of (data || [])) {
        const key = c.tipo === "unidades" ? "inventario_unidades" : c.tipo === "valorizado" ? "inventario_importe" : c.tipo;
        if (!byTipo.has(key)) byTipo.set(key, c);
      }
      return byTipo;
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="subir">
        <TabsList>
          <TabsTrigger value="subir">Subir archivos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="subir" className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lumaggs">Lumaggs — Chevron</SelectItem>
                <SelectItem value="galsa">Galsa — Phillips 66</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TIPOS.map((t) => (
              <FileTypeCard
                key={t.key}
                tipo={t.key}
                titulo={t.titulo}
                descripcion={t.descripcion}
                Icon={t.icon}
                color={t.color}
                empresa={empresa}
                userId={user?.id ?? null}
                ultimaCarga={ultimasCargas?.get(t.key) ?? null}
                onDone={() => {
                  qc.invalidateQueries({ queryKey: ["inv_kardex_cargas"] });
                  qc.invalidateQueries({ queryKey: ["inv_kardex_cargas_ultimas"] });
                  qc.invalidateQueries({ queryKey: ["inv_niveles_inventario"] });
                  qc.invalidateQueries({ queryKey: ["inv_demanda_plaza"] });
                  qc.invalidateQueries({ queryKey: ["inv_minmax"] });
                }}
              />
            ))}
          </div>

          {puedeLimpiarDemanda && (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={limpiando}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {limpiando ? "Limpiando…" : "Limpiar datos de demanda"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Limpiar datos de demanda por plaza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto borrará todos los registros de inv_demanda_plaza. Requiere volver a subir el Kárdex en Unidades para regenerar la demanda.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={limpiarDemanda}>Limpiar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
                      <TableCell><Badge variant="outline" className="uppercase">{TIPO_LABEL[c.tipo] || c.tipo}</Badge></TableCell>
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

// ============================================================
// Card individual por tipo de archivo
// ============================================================
function FileTypeCard({
  tipo, titulo, descripcion, Icon, color, empresa, userId, ultimaCarga, onDone,
}: {
  tipo: TipoArchivo;
  titulo: string;
  descripcion: string;
  Icon: any;
  color: string;
  empresa: string;
  userId: string | null;
  ultimaCarga: any;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const procesar = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(5);
    setResultado(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

      if (tipo === "inventario_unidades" || tipo === "inventario_importe") {
        await procesarInventario(tipo, rows, file.name, empresa, userId, setProgress);
      } else if (tipo === "kardex_unidades") {
        await procesarKardexUnidades(rows, file.name, empresa, userId, setProgress);
      } else {
        await procesarKardexImporte(rows, file.name, empresa, userId, setProgress);
      }

      setProgress(100);
      setResultado({ ok: true, mensaje: "Archivo procesado correctamente" });
      toast.success(`${titulo}: procesado`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onDone();
    } catch (e: any) {
      console.error(e);
      setResultado({ ok: false, mensaje: e?.message || "Error desconocido" });
      toast.error("Error: " + (e?.message || ""));
    } finally {
      setProcessing(false);
    }
  };

  const estado = ultimaCarga ? "aldia" : "sin";

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md bg-muted/50 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">{titulo}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{descripcion}</div>
            </div>
          </div>
          {estado === "aldia" ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Al día</Badge>
          ) : (
            <Badge variant="secondary">Sin importar</Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          {ultimaCarga ? (
            <>
              Última: {new Date(ultimaCarga.created_at).toLocaleString("es-MX")} — {ultimaCarga.total_skus_procesados ?? 0} SKUs
            </>
          ) : (
            <>Nunca importado</>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setResultado(null); }
          }}
        />

        {!file ? (
          <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={processing}>
            <Upload className="h-4 w-4 mr-2" />
            Subir archivo
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={procesar} disabled={processing} className="flex-1">
                {processing ? "Procesando…" : "Procesar"}
              </Button>
              <Button variant="ghost" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} disabled={processing}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {processing && <Progress value={progress} />}

        {resultado && (
          <div className={`flex items-center gap-2 text-sm pt-2 border-t ${resultado.ok ? "text-emerald-700" : "text-red-600"}`}>
            {resultado.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{resultado.mensaje}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Procesadores por tipo
// ============================================================
async function procesarInventario(
  tipo: "inventario_unidades" | "inventario_importe",
  rows: any[][],
  fileName: string,
  empresa: string,
  userId: string | null,
  setProgress: (n: number) => void,
) {
  const parsed = parseInventario(rows, empresa);

  const { data: carga, error: cErr } = await (supabase as any)
    .from("inv_kardex_cargas")
    .insert({
      empresa_vendedora: empresa,
      tipo,
      nombre_archivo: fileName,
      fecha_archivo: parsed.fechaFin,
      fecha_inicio: parsed.fechaInicio,
      estatus: "procesando",
      creado_por: userId,
      total_skus_procesados: parsed.skuCount,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  setProgress(15);

  const bySku = new Map<string, { nombre: string; stocks: Record<string, number>; valores: Record<string, number> }>();
  for (const l of parsed.lineas) {
    const e = bySku.get(l.codigo) || { nombre: l.nombre, stocks: {}, valores: {} };
    if (tipo === "inventario_unidades") e.stocks[l.almacen] = l.existencia;
    else e.valores[l.almacen] = l.existencia;
    bySku.set(l.codigo, e);
  }

  const skuList = Array.from(bySku.keys());
  const { data: existentes } = await (supabase as any)
    .from("inv_niveles_inventario")
    .select("codigo_producto, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004, stock_total")
    .eq("empresa_vendedora", empresa)
    .in("codigo_producto", skuList);
  const existMap = new Map<string, any>((existentes || []).map((r: any) => [r.codigo_producto, r]));

  const upserts: any[] = [];
  let updated = 0, created = 0;
  for (const [codigo, e] of bySku) {
    const ex = existMap.get(codigo);
    const row: any = {
      codigo_producto: codigo,
      nombre_producto: e.nombre || null,
      empresa_vendedora: empresa,
      fecha_ultimo_kardex: parsed.fechaFin,
    };
    if (tipo === "inventario_unidades") {
      row.stock_almacen_1001 = e.stocks["1001"] ?? 0;
      row.stock_almacen_1002 = e.stocks["1002"] ?? 0;
      row.stock_almacen_1003 = e.stocks["1003"] ?? 0;
      row.stock_almacen_1004 = e.stocks["1004"] ?? 0;
      row.stock_almacen_1005 = e.stocks["1005"] ?? 0;
      row.stock_almacen_1006 = e.stocks["1006"] ?? 0;
      row.stock_almacen_1007 = e.stocks["1007"] ?? 0;
      row.stock_total = row.stock_almacen_1001 + row.stock_almacen_1002 + row.stock_almacen_1003 + row.stock_almacen_1004 + row.stock_almacen_1005 + row.stock_almacen_1006 + row.stock_almacen_1007;
    } else {
      const valor = Object.values(e.valores).reduce((a, b) => a + b, 0);
      const total = ex?.stock_total ?? 0;
      row.valor_total_inventario = valor;
      row.costo_promedio = total > 0 ? valor / total : null;
    }
    if (!ex) created++; else updated++;
    upserts.push(row);
  }

  const batchSize = 200;
  let errors = 0;
  let firstErrShown = false;
  for (let i = 0; i < upserts.length; i += batchSize) {
    const chunk = upserts.slice(i, i + batchSize);
    const { error: upErr } = await (supabase as any)
      .from("inv_niveles_inventario")
      .upsert(chunk, { onConflict: "codigo_producto,empresa_vendedora" });
    if (upErr) {
      errors += chunk.length;
      console.error("Upsert inv_niveles_inventario error:", upErr);
      if (!firstErrShown) {
        firstErrShown = true;
        toast.error(`Error en upsert: ${upErr.message || upErr.code || "desconocido"}`);
      }
    }
    setProgress(15 + Math.round(((i + chunk.length) / upserts.length) * 75));
  }

  await (supabase as any).from("inv_kardex_cargas").update({
    estatus: errors > 0 ? "con_errores" : "completado",
    total_skus_actualizados: Math.max(0, (updated + created) - errors),
    total_skus_error: errors,
  }).eq("id", carga.id);
}

async function procesarKardexUnidades(
  rows: any[][],
  fileName: string,
  empresa: string,
  userId: string | null,
  setProgress: (n: number) => void,
) {
  const parsed = parseKardexMovimientos(rows);

  // Filtrar solo los últimos 12 meses para demanda, minmax y pronósticos
  const hoy = new Date();
  const hace12Meses = new Date(hoy);
  hace12Meses.setFullYear(hoy.getFullYear() - 1);
  const hace12MesesIso = hace12Meses.toISOString().slice(0, 10);

  const movimientos12m = parsed.movimientos.filter(m => m.fecha >= hace12MesesIso);

  const { data: carga, error: cErr } = await (supabase as any)
    .from("inv_kardex_cargas")
    .insert({
      empresa_vendedora: empresa,
      tipo: "kardex_unidades",
      nombre_archivo: fileName,
      fecha_archivo: parsed.fechaFin,
      fecha_inicio: parsed.fechaInicio,
      estatus: "procesando",
      creado_por: userId,
      total_skus_procesados: parsed.skuCount,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  setProgress(15);

  let { fechaInicio, fechaFin } = parsed;
  let advertenciaFechas = false;
  if (!fechaInicio || !fechaFin) {
    advertenciaFechas = true;
    const hace365 = new Date(hoy.getTime() - 365 * 86400000);
    fechaFin = fechaFin || hoy.toISOString().slice(0, 10);
    fechaInicio = fechaInicio || hace365.toISOString().slice(0, 10);
  }
  if (advertenciaFechas) toast.warning("No se detectó periodo en el archivo; se usó rango por defecto (último año).");

  const d0 = new Date(fechaInicio);
  const d1 = new Date(fechaFin);
  // El período para demanda diaria es máximo 365 días (12 meses)
  const diasPeriodo = Math.min(365, Math.max(1, Math.round((d1.getTime() - Math.max(d0.getTime(), hace12Meses.getTime())) / 86400000) + 1));

  // Acumular ventas por (codigo, plaza) usando movimientos con plaza detectada
  const ventas = new Map<string, { codigo: string; almacen: string; uds: number }>();
  for (const m of movimientos12m) {
    if (!m.plaza) continue; // ignorar traspasos y otros
    if (!(m.salidas > 0)) continue;
    const k = `${m.codigo}|${m.plaza}`;
    const cur = ventas.get(k) || { codigo: m.codigo, almacen: m.plaza, uds: 0 };
    cur.uds += m.salidas;
    ventas.set(k, cur);
  }

  setProgress(35);

  // [DIAG TEMPORAL]
  const totalMovimientos = parsed.movimientos.length;
  const movimientos12mCount = movimientos12m.length;
  const conPlaza = movimientos12m.filter(m => m.plaza && m.salidas > 0).length;
  toast.info(
    `Movimientos totales: ${totalMovimientos} · últimos 12m: ${movimientos12mCount} · ventas con plaza: ${conPlaza}`,
    { duration: 8000 },
  );
  console.log("[DIAG kardex_unidades] movimientos:", totalMovimientos,
    "ventas:", ventas.size, "conPlaza:", conPlaza, "muestra:", parsed.movimientos.slice(0, 3));

  // 0) Detalle de fechas de venta (histórico por movimiento)
  try {
    const fechasMap = new Map<string, { codigo_producto: string; almacen: string; fecha: string; cantidad: number; carga_id: string }>();
    for (const m of movimientos12m) {
      if (!m.plaza) continue;
      if (!(m.salidas > 0)) continue;
      const k = `${m.codigo}|${m.plaza}|${m.fecha}`;
      const cur = fechasMap.get(k) || { codigo_producto: m.codigo, almacen: m.plaza, fecha: m.fecha, cantidad: 0, carga_id: carga.id };
      cur.cantidad += m.salidas;
      fechasMap.set(k, cur);
    }
    const fechasRows = Array.from(fechasMap.values());
    for (let i = 0; i < fechasRows.length; i += 200) {
      const { error: fvErr } = await (supabase as any)
        .from("inv_kardex_fechas_venta")
        .upsert(fechasRows.slice(i, i + 200), { onConflict: "codigo_producto,almacen,fecha", ignoreDuplicates: false });
      if (fvErr) throw fvErr;
      setProgress(20 + Math.round(((i + 200) / Math.max(1, fechasRows.length)) * 10));
    }
  } catch (e: any) {
    console.error("Error guardando inv_kardex_fechas_venta:", e);
    toast.warning("No se pudo guardar el detalle de fechas de venta: " + (e?.message || ""));
  }

  // 1) UPSERT inv_demanda_plaza

  const batchSize = 200;
  const demandaRows = Array.from(ventas.values()).map((v) => {
    const ddia = v.uds / diasPeriodo;
    return {
      codigo_producto: v.codigo,
      almacen: v.almacen,
      periodo_inicio: fechaInicio,
      periodo_fin: fechaFin,
      dias_periodo: diasPeriodo,
      unidades_vendidas: v.uds,
      unidades_traspaso_salida: 0,
      demanda_diaria_promedio: ddia,
      demanda_mensual_promedio: ddia * 30,
      ultima_venta: fechaFin,
    };
  });

  // [DIAG TEMPORAL]
  toast.info(`demandaRows a insertar: ${demandaRows.length} (${totalMovimientos} movimientos, ${conPlaza} con plaza)`, { duration: 8000 });
  if (demandaRows.length === 0) {
    toast.warning(
      "No se detectaron ventas con plaza asignada. Revisar parser (columnas salidas/almacén).",
      { duration: 10000 },
    );
  }

  let demandaErrors = 0;
  for (let i = 0; i < demandaRows.length; i += batchSize) {
    const chunk = demandaRows.slice(i, i + batchSize);
    const { error: demErr } = await (supabase as any)
      .from("inv_demanda_plaza")
      .upsert(chunk, { onConflict: "codigo_producto,almacen,periodo_inicio" });
    if (demErr) {
      demandaErrors += chunk.length;
      console.error("Error upsert inv_demanda_plaza:", demErr);
      if (i === 0) toast.error(`Error guardando demanda: ${demErr.message || demErr.code || JSON.stringify(demErr)}`);
    }
    setProgress(35 + Math.round(((i + batchSize) / Math.max(1, demandaRows.length)) * 25));
  }
  if (demandaErrors > 0) {
    console.warn(`inv_demanda_plaza: ${demandaErrors} registros con error de ${demandaRows.length}`);
  }

  // 2) Recalcular inv_minmax
  const skuListMM = Array.from(new Set(Array.from(ventas.values()).map((v) => v.codigo)));
  const { data: niveles } = await (supabase as any)
    .from("inv_niveles_inventario")
    .select("codigo_producto, clasificacion_abc, lead_time_dias, piezas_por_tarima, stock_almacen_1001, stock_almacen_1002, stock_almacen_1003, stock_almacen_1004")
    .in("codigo_producto", skuListMM);
  const nivMap = new Map<string, any>((niveles || []).map((n: any) => [n.codigo_producto, n]));

  const { data: existMM } = await (supabase as any)
    .from("inv_minmax")
    .select("codigo_producto, almacen, minimo_manual, maximo_manual, cantidad_reorden_manual")
    .in("codigo_producto", skuListMM);
  const mmMap = new Map<string, any>((existMM || []).map((m: any) => [`${m.codigo_producto}|${m.almacen}`, m]));

  const coberturaPorAbc = (abc: string | null | undefined) => abc === "A" ? 60 : abc === "C" ? 30 : abc === "B" ? 45 : 45;
  const seguridadPorAbc = (abc: string | null | undefined) => abc === "A" ? 15 : abc === "C" ? 7 : abc === "B" ? 10 : 10;
  const stockAlmacen = (n: any, alm: string) => Number(n?.[`stock_almacen_${alm}`] ?? 0);

  const minmaxRows: any[] = [];
  const hoyIso = new Date().toISOString().slice(0, 10);
  for (const v of ventas.values()) {
    const n = nivMap.get(v.codigo);
    const abc = n?.clasificacion_abc ?? null;
    const lead = Number(n?.lead_time_dias ?? 10) || 10;
    const ppt = Math.max(1, Number(n?.piezas_por_tarima ?? 1) || 1);
    const cobertura = coberturaPorAbc(abc);
    const seguridad = seguridadPorAbc(abc);
    const ddia = v.uds / diasPeriodo;
    const minRaw = ddia * (lead + seguridad);
    const maxRaw = ddia * (lead + cobertura);
    const minCalc = Math.ceil(minRaw / ppt) * ppt;
    const maxCalc = Math.ceil(maxRaw / ppt) * ppt;
    const stock = stockAlmacen(n, v.almacen);
    const reordenCalc = Math.max(0, minCalc - stock);

    const prev = mmMap.get(`${v.codigo}|${v.almacen}`);
    minmaxRows.push({
      codigo_producto: v.codigo,
      almacen: v.almacen,
      clasificacion_abc: abc,
      demanda_diaria_hub: ddia,
      dias_cobertura_objetivo: cobertura,
      dias_stock_seguridad: seguridad,
      lead_time_dias: lead,
      minimo_calc: minCalc,
      maximo_calc: maxCalc,
      cantidad_reorden_calc: reordenCalc,
      minimo_manual: prev?.minimo_manual ?? null,
      maximo_manual: prev?.maximo_manual ?? null,
      cantidad_reorden_manual: prev?.cantidad_reorden_manual ?? null,
      ultima_actualizacion_calc: hoyIso,
    });
  }
  for (let i = 0; i < minmaxRows.length; i += batchSize) {
    await (supabase as any)
      .from("inv_minmax")
      .upsert(minmaxRows.slice(i, i + batchSize), { onConflict: "codigo_producto,almacen" });
    setProgress(60 + Math.round(((i + batchSize) / Math.max(1, minmaxRows.length)) * 30));
  }

  await (supabase as any).from("inv_kardex_cargas").update({
    estatus: "completado",
    total_skus_actualizados: skuListMM.length,
    total_skus_error: 0,
  }).eq("id", carga.id);
}

async function procesarKardexImporte(
  rows: any[][],
  fileName: string,
  empresa: string,
  userId: string | null,
  setProgress: (n: number) => void,
) {
  setProgress(10);
  const { fechaInicio, fechaFin } = buscarRangoFechas(rows);

  // Extraer datos de costo por producto
  const costoMap = new Map<string, {
    nombre: string;
    costoTotalFinal: number;       // col[8] del último movimiento
    ultimaCompraImporte: number;   // col[6] de la última entrada tipo COMPRA
    ultimaCompraFecha: string;
  }>();

  let curCodigo: string | null = null;
  let curNombre = "";
  let curCostoTotal = 0;
  let curUltimaCompraImporte = 0;
  let curUltimaCompraFecha = "";

  const guardarProducto = () => {
    if (!curCodigo) return;
    costoMap.set(curCodigo, {
      nombre: curNombre,
      costoTotalFinal: curCostoTotal,
      ultimaCompraImporte: curUltimaCompraImporte,
      ultimaCompraFecha: curUltimaCompraFecha,
    });
  };

  for (const row of rows) {
    const c0 = String(row[0] ?? "").trim();

    if (/^Producto:/i.test(c0)) {
      guardarProducto(); // Guardar el anterior antes de cambiar
      curCodigo = normalizeCodigo(row[1]);
      curNombre = "";
      curCostoTotal = 0;
      curUltimaCompraImporte = 0;
      curUltimaCompraFecha = "";
      continue;
    }
    if (/^Nombre:/i.test(c0)) {
      curNombre = String(row[1] ?? "").trim();
      continue;
    }
    if (!curCodigo) continue;

    // Filas de movimiento: col[1] debe ser una fecha CONTPAQi
    const c1 = String(row[1] ?? "").trim();
    if (!/^\d{1,2}\/[A-Za-z]{3}\/\d{4}$/.test(c1)) continue;

    const concepto = String(row[4] ?? "").trim();
    const almacenTexto = String(row[5] ?? "").trim().toLowerCase();
    const entradas = Number(String(row[6] ?? "").replace(/[^0-9.-]/g, "")) || 0;
    const costoTotal = Number(String(row[8] ?? "").replace(/[^0-9.-]/g, "")) || 0;

    // Actualizar costo total acumulado (último valor válido)
    if (costoTotal > 0) curCostoTotal = costoTotal;

    // Detectar compras (entradas reales de proveedor, no traspasos)
    if (
      entradas > 0 &&
      /compra/i.test(concepto) &&
      !/(traspaso|trasp)/i.test(concepto)
    ) {
      curUltimaCompraImporte = entradas;
      curUltimaCompraFecha = normContpaqiDate(c1) || "";
    }
  }
  guardarProducto(); // Guardar el último producto

  setProgress(40);

  const skuList = Array.from(costoMap.keys());
  if (skuList.length === 0) {
    await (supabase as any).from("inv_kardex_cargas").insert({
      empresa_vendedora: empresa,
      tipo: "kardex_importe",
      nombre_archivo: fileName,
      fecha_archivo: fechaFin,
      fecha_inicio: fechaInicio,
      estatus: "completado",
      creado_por: userId,
      total_skus_procesados: 0,
      total_skus_actualizados: 0,
      total_skus_error: 0,
    });
    setProgress(100);
    return;
  }

  // Cruzar con inv_niveles_inventario para calcular costo_promedio
  const { data: niveles } = await (supabase as any)
    .from("inv_niveles_inventario")
    .select("codigo_producto, stock_total, empresa_vendedora")
    .eq("empresa_vendedora", empresa)
    .in("codigo_producto", skuList);
  const nivelesMap = new Map<string, number>(
    (niveles || []).map((n: any) => [n.codigo_producto, Number(n.stock_total || 0)])
  );

  setProgress(60);

  // Preparar upserts en inv_niveles_inventario
  const upserts: any[] = [];
  for (const [codigo, datos] of costoMap) {
    const stock = nivelesMap.get(codigo) ?? 0;
    const costoPromedio = stock > 0 ? datos.costoTotalFinal / stock : null;

    upserts.push({
      codigo_producto: codigo,
      empresa_vendedora: empresa,
      nombre_producto: datos.nombre || null,
      valor_total_inventario: datos.costoTotalFinal,
      costo_promedio: costoPromedio,
      fecha_ultimo_kardex: fechaFin,
    });
  }

  const batchSize = 200;
  let errors = 0;
  for (let i = 0; i < upserts.length; i += batchSize) {
    const chunk = upserts.slice(i, i + batchSize);
    const { error } = await (supabase as any)
      .from("inv_niveles_inventario")
      .upsert(chunk, { onConflict: "codigo_producto,empresa_vendedora" });
    if (error) {
      errors += chunk.length;
      console.error("Upsert kardex_importe error:", error);
      if (i === 0) toast.error(`Error al guardar: ${error.message || error.code}`);
    }
    setProgress(60 + Math.round(((i + chunk.length) / upserts.length) * 35));
  }

  await (supabase as any).from("inv_kardex_cargas").insert({
    empresa_vendedora: empresa,
    tipo: "kardex_importe",
    nombre_archivo: fileName,
    fecha_archivo: fechaFin,
    fecha_inicio: fechaInicio,
    estatus: errors > 0 ? "con_errores" : "completado",
    creado_por: userId,
    total_skus_procesados: skuList.length,
    total_skus_actualizados: Math.max(0, skuList.length - errors),
    total_skus_error: errors,
  });
}