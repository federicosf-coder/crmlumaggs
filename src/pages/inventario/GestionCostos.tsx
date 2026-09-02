import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanViewCostos } from "@/hooks/useCanViewCostos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, DollarSign, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, Lock, RefreshCw, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MARGIN_LEVELS, MARGIN_TO_PRICE, computePricesFromCost } from "@/pages/inventory/PreciosConfigTab";
import { MapeoTabsContent } from "@/pages/inventario/MapeoProductos";
import { useCostosIgnorados } from "@/hooks/useMapeoProductos";

// ─── Tipos de archivo ───────────────────────────────────────────
const TIPOS_ARCHIVO: { value: string; label: string; empresa: "lumaggs" | "galsa" | null; categoria: "galper" | "especial" | "lista" }[] = [
  { value: "costos_galper_lumaggs", label: "Lista Precios Lumaggs Galper", empresa: "lumaggs", categoria: "galper" },
  { value: "precios_especiales_lumaggs", label: "Precios Especiales Lumaggs", empresa: "lumaggs", categoria: "especial" },
  { value: "lista_general_lumaggs", label: "Lista General Lumaggs", empresa: "lumaggs", categoria: "lista" },
  { value: "costos_galper_galsa", label: "Lista Precios Galsa Galper", empresa: "galsa", categoria: "galper" },
  { value: "lista_general_galsa", label: "Lista General Galsa", empresa: "galsa", categoria: "lista" },
  { value: "costos_galper_gonher", label: "Costo Galper Gonher", empresa: "galsa", categoria: "galper" },
  { value: "lista_general_gonher", label: "Lista Precios Gonher / GW Galper", empresa: "galsa", categoria: "lista" },
];

const ceilTo5 = (n: number) => (!isFinite(n) || n <= 0 ? 0 : Math.round(n * 100) / 100);

type MarcaFiltro = "lumaggs" | "galsa" | "gonher";

const MARCA_TIPOS: Record<MarcaFiltro, string[]> = {
  lumaggs: ["costos_galper_lumaggs", "precios_especiales_lumaggs", "lista_general_lumaggs"],
  galsa: ["costos_galper_galsa", "lista_general_galsa"],
  gonher: ["costos_galper_gonher", "lista_general_gonher"],
};

function detectarEmpresa(producto: any): "lumaggs" | "galsa" {
  const marca = String(producto?.marca?.value || "").toLowerCase();
  if (marca.includes("phillips") || marca.includes("gonher")) return "galsa";
  return "lumaggs";
}

function nivelColor(n: string) {
  return n === "bloqueo" ? "🔴" : n === "alerta" ? "🟠" : n === "aviso" ? "🟡" : "✅";
}

function nivelClass(n: string) {
  return n === "bloqueo" ? "bg-red-100 text-red-800 border-red-300"
    : n === "alerta" ? "bg-orange-100 text-orange-800 border-orange-300"
    : n === "aviso" ? "bg-yellow-100 text-yellow-800 border-yellow-300"
    : "bg-green-100 text-green-800 border-green-300";
}

async function parsePdfToMap(file: File): Promise<Map<string, { codigo: string; costo: number; nombre?: string }>> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const map = new Map<string, { codigo: string; costo: number; nombre?: string }>();
  const rowRe = /^(\S+)\s+(.+)\s+([A-Z]{2,4})\s+([^\d]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([A-Z]+)$/;

  const pushLine = (raw: string) => {
    const line = raw.replace(/\s+/g, " ").trim();
    const m = line.match(rowRe);
    if (!m) return;
    const codigo = m[1].trim();
    const nombre = m[2].trim();
    const costo = Number(m[6].replace(/,/g, ""));
    if (codigo && Number.isFinite(costo) && costo > 0) map.set(codigo, { codigo, costo, nombre });
  };

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter(it => typeof it.str === "string")
      .map(it => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number }))
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    let currentY: number | null = null;
    let parts: string[] = [];
    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= 3) {
        if (currentY === null) currentY = it.y;
        parts.push(it.str);
      } else {
        pushLine(parts.join(" "));
        parts = [it.str];
        currentY = it.y;
      }
    }
    if (parts.length) pushLine(parts.join(" "));
  }
  return map;
}

async function parseGonherPdfToMap(file: File): Promise<Map<string, { codigo: string; costo: number; nombre?: string }>> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const map = new Map<string, { codigo: string; costo: number; nombre?: string }>();
  // [fecha opcional] codigo empaque nombre... precioContado precioCredito
  const rowRe = /^(?:\d{2}\/\d{2}\/\d{4}\s+)?([A-Za-z0-9][A-Za-z0-9\-_.]*)\s+(\S+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?:\s+[\d,]+\.\d{2})?$/;

  const pushLine = (raw: string) => {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || /^[-\s]+$/.test(line)) return;
    const m = line.match(rowRe);
    if (!m) return;
    const codigo = m[1].trim();
    const empaque = m[2].trim();
    const producto = m[3].trim();
    const contado = Number(m[4].replace(/,/g, ""));
    if (!codigo || !Number.isFinite(contado) || contado <= 0) return;
    map.set(codigo, { codigo, costo: contado * 0.7, nombre: `${empaque} ${producto}`.trim() });
  };

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter(it => typeof it.str === "string")
      .map(it => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number }))
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    let currentY: number | null = null;
    let parts: string[] = [];
    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= 3) {
        if (currentY === null) currentY = it.y;
        parts.push(it.str);
      } else {
        pushLine(parts.join(" "));
        parts = [it.str];
        currentY = it.y;
      }
    }
    if (parts.length) pushLine(parts.join(" "));
  }
  return map;
}

function parseExcelToMap(file: File): Promise<Map<string, { codigo: string; costo: number; nombre?: string; fecha?: string }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        let mejorMapa = new Map<string, any>();
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
          const mapaHoja = intentarParsearHoja(raw);
          if (mapaHoja.size > mejorMapa.size) mejorMapa = mapaHoja;
        }
        resolve(mejorMapa);
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function intentarParsearHoja(raw: any[][]): Map<string, { codigo: string; costo: number; nombre?: string; fecha?: string }> {
  const map = new Map<string, any>();
  let headerRow = -1;
  let iCodigo = -1, iCosto = -1, iNombre = -1;

  for (let r = 0; r < Math.min(15, raw.length); r++) {
    const row = raw[r] || [];
    let _iCodigo = -1, _iCosto = -1, _iNombre = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").toLowerCase().trim();
      if (cell === "codigo" || cell === "código" || cell === "sku" || cell === "clave" || cell === "code" || cell === "item" || cell === "material" || cell.includes("material id") || cell.includes("materialid")) _iCodigo = c;
      if (
        cell.includes("precio por empaque") ||
        cell.includes("precio por uom") ||
        cell.includes("proposed price") ||
        cell.includes("net price") ||
        cell.includes("unit price") ||
        cell.includes("costo") ||
        cell === "precio" ||
        cell === "importe" ||
        cell === "price"
      ) _iCosto = c;
      if (cell.includes("nombre") || cell.includes("descripcion") || cell.includes("descripción") || cell.includes("producto") || cell === "name" || cell.includes("product") || cell.includes("material name")) _iNombre = c;
    }
    if (_iCodigo >= 0 && _iCosto >= 0) {
      headerRow = r; iCodigo = _iCodigo; iCosto = _iCosto; iNombre = _iNombre;
      break;
    }
  }

  if (headerRow >= 0) {
    for (let r = headerRow + 1; r < raw.length; r++) {
      const row = raw[r] || [];
      const codigoRaw = row[iCodigo];
      const costoRaw = row[iCosto];
      if (codigoRaw == null || costoRaw == null) continue;
      const codigo = typeof codigoRaw === "number" ? String(Math.round(codigoRaw)) : String(codigoRaw).trim();
      const costo = Number(String(costoRaw).replace(/[^0-9.\-]/g, ""));
      if (!codigo || !isFinite(costo) || costo <= 0) continue;
      const nombre = iNombre >= 0 ? String(row[iNombre] ?? "").trim() : undefined;
      map.set(codigo, { codigo, costo, nombre });
    }
  } else {
    for (const row of raw) {
      if (!row || row.length < 2) continue;
      const codigoRaw = row[0];
      if (codigoRaw == null) continue;
      const codigoStr = typeof codigoRaw === "number" ? String(Math.round(codigoRaw)) : String(codigoRaw).trim();
      if (!/^[A-Za-z0-9]{5,15}$/.test(codigoStr)) continue;
      const nombre = String(row[1] ?? "").trim();
      let costo = 0;
      for (let c = 2; c <= Math.min(8, row.length - 1); c++) {
        const v = Number(String(row[c] ?? "").replace(/[^0-9.\-]/g, ""));
        if (isFinite(v) && v > 0) { costo = v; break; }
      }
      if (!costo) continue;
      map.set(codigoStr, { codigo: codigoStr, costo, nombre: nombre || undefined });
    }
  }
  return map;
}

// ─── Componente principal ───────────────────────────────────────
export default function GestionCostos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canViewCostos = useCanViewCostos();
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return t || "biblioteca";
  });

  // Archivos de referencia
  const { data: archivos = [], refetch: refetchArchivos } = useQuery({
    queryKey: ["inv_archivos_referencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_archivos_referencia")
        .select("*")
        .order("fecha_vigencia_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Lote activo (más reciente con estado pendiente o autorizado)
  const { data: loteActivo, refetch: refetchLote } = useQuery({
    queryKey: ["inv_costos_lote_activo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_costos_producto")
        .select("lote_id, created_at")
        .in("estado", ["pendiente", "autorizado"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.lote_id || null;
    },
  });

  const { data: propuesta = [], refetch: refetchPropuesta } = useQuery({
    queryKey: ["inv_costos_propuesta", loteActivo],
    enabled: !!loteActivo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_costos_producto")
        .select("*")
        .eq("lote_id", loteActivo)
        .neq("estado", "aplicado")
        .order("nivel_alerta")
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: historial = [] } = useQuery({
    queryKey: ["inv_costos_historial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_costos_historial")
        .select("*")
        .order("aplicado_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: listasMarca } = useQuery({
    queryKey: ["inv_costos_listas_marca"],
    queryFn: async () => {
      const [costosRes, archivosRes, prodsRes, nivelesRes, margenesRes] = await Promise.all([
        supabase
          .from("inv_costos_producto")
          .select("codigo_producto, empresa, costo_galper, costo_especial, costo_lista, costo_efectivo, costo_efectivo_fuente, archivo_galper_id, archivo_lista_id, nombre_en_archivo, nombre_en_catalogo, created_at")
          .order("created_at", { ascending: false })
          .limit(50000),
        supabase.from("inv_archivos_referencia").select("id, tipo"),
        supabase.from("productos").select("codigo, nombre_producto, presentaciones(nombre), precio_base_uf1, linea_id").eq("is_active", true).limit(20000),
        supabase.from("inv_niveles_inventario").select("codigo_producto, stock_total, clasificacion_abc").limit(50000),
        supabase.from("producto_linea_margenes").select("*").eq("activo", true),
      ]);
      const costos = (costosRes.data as any[]) || [];
      const tipoPorArchivo = new Map<string, string>(((archivosRes.data as any[]) || []).map((a: any) => [a.id, String(a.tipo || "").toLowerCase()]));
      const prodsAll = (prodsRes.data as any[]) || [];
      const nombrePorCodigo = new Map<string, string>(prodsAll.map((p: any) => [p.codigo, p.nombre_producto]));
      const presentacionPorCodigo = new Map<string, string | null>(prodsAll.map((p: any) => [p.codigo, p.presentaciones?.nombre ?? null]));
      const uf1PorCodigo = new Map<string, number | null>(prodsAll.map((p: any) => [p.codigo, p.precio_base_uf1 ?? null]));
      const lineaIdPorCodigo = new Map<string, string | null>(prodsAll.map((p: any) => [p.codigo, p.linea_id ?? null]));
      const margenesPorLinea = new Map<string | null, any>();
      for (const m of ((margenesRes.data as any[]) || [])) margenesPorLinea.set(m.linea_id, m);
      const calcPrecioSiGalper = (codigo: string, costo: number | null): number | null => {
        if (costo == null) return null;
        const margins = margenesPorLinea.get(lineaIdPorCodigo.get(codigo) ?? null) ?? margenesPorLinea.get(null);
        if (!margins) return null;
        const mRec: Record<string, number> = {};
        for (const lvl of MARGIN_LEVELS) mRec[lvl.key] = Number((margins as any)[lvl.key] ?? 0);
        const raw: any = computePricesFromCost(Number(costo), mRec);
        const base = Number(raw?.precio_base_uf1);
        if (!isFinite(base)) return null;
        return ceilTo5(base);
      };
      const nivelesAll = (nivelesRes.data as any[]) || [];
      const stockPorCodigo = new Map<string, number>(nivelesAll.map((n: any) => [n.codigo_producto, n.stock_total]));
      const abcPorCodigo = new Map<string, string | null>(nivelesAll.map((n: any) => [n.codigo_producto, n.clasificacion_abc ?? null]));

      const vistos = new Set<string>();
      const lumaggs: any[] = [], galsa: any[] = [], gonher: any[] = [];
      for (const c of costos) {
        if (!c.codigo_producto || vistos.has(c.codigo_producto)) continue;
        vistos.add(c.codigo_producto);
        const row = {
          codigo: c.codigo_producto,
          nombre: c.nombre_en_archivo || c.nombre_en_catalogo || nombrePorCodigo.get(c.codigo_producto) || c.codigo_producto,
          presentacion: presentacionPorCodigo.get(c.codigo_producto) ?? null,
          clasificacion_abc: abcPorCodigo.get(c.codigo_producto) ?? null,
          precio_uf1: uf1PorCodigo.get(c.codigo_producto) ?? null,
          costo_galper: c.costo_galper,
          costo_especial: c.costo_especial,
          costo_lista: c.costo_lista,
          costo_efectivo: c.costo_efectivo,
          fuente: c.costo_efectivo_fuente,
          en_catalogo: nombrePorCodigo.has(c.codigo_producto),
          stock_total: stockPorCodigo.get(c.codigo_producto) ?? null,
          precio_si_galper: null as number | null,
          descuento_disponible: null as number | null,
        };
        if (c.empresa === "lumaggs") {
          const precio_si_galper = calcPrecioSiGalper(c.codigo_producto, c.costo_galper);
          const precio_uf1 = row.precio_uf1;
          lumaggs.push({
            ...row,
            precio_si_galper,
            descuento_disponible:
              precio_si_galper != null && precio_uf1 != null && precio_si_galper > Number(precio_uf1)
                ? precio_si_galper - Number(precio_uf1)
                : null,
          });
          continue;
        }
        if (c.empresa === "galsa") {
          const tipo = tipoPorArchivo.get(c.archivo_galper_id) ?? tipoPorArchivo.get(c.archivo_lista_id) ?? "";
          (tipo.includes("gonher") ? gonher : galsa).push(row);
        }
      }
      return { lumaggs, galsa, gonher };
    },
  });

  const { data: sinConfirmarCount = 0 } = useQuery({
    queryKey: ["inv_costos_sin_confirmar_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("costo_confirmado_en_ultima_lista", false);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: huerfanosInv = [] } = useHuerfanosInventario();
  const { data: ignoradosGlobal = [] } = useCostosIgnorados();
  const huerfanosInvCount = useMemo(() => {
    const ignoradosSet = new Set((ignoradosGlobal as any[]).map((i) => i.codigo_producto));
    return huerfanosInv.filter((r) => !ignoradosSet.has(r.codigo)).length;
  }, [huerfanosInv, ignoradosGlobal]);

  if (!canViewCostos) {
    return (
      <div className="p-6 flex justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-light text-muted-foreground">No tienes permiso para ver esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Gestión de Costos y Precios
          </h1>
          <p className="text-sm text-muted-foreground font-light">Flujo de autorización para actualizar costos desde archivos de referencia.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="biblioteca">Biblioteca de Archivos</TabsTrigger>
          <TabsTrigger value="propuesta">
            Propuesta Activa
            {propuesta.length > 0 && <Badge variant="secondary" className="ml-2">{propuesta.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="listas">Listas por Marca</TabsTrigger>
          <TabsTrigger value="bajas">Bajas de Costo Pendientes</TabsTrigger>
          <TabsTrigger value="sinconfirmar">
            Sin Confirmar en Listas
            {sinConfirmarCount > 0 && <Badge variant="secondary" className="ml-2">{sinConfirmarCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mapeo">Mapeo</TabsTrigger>
          <TabsTrigger value="huerfanos">
            Huérfanos con Inventario
            {huerfanosInvCount > 0 && <Badge variant="secondary" className="ml-2">{huerfanosInvCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="mt-4">
          <BibliotecaSection
            archivos={archivos}
            onRefresh={async () => {
              await refetchLote();
              qc.invalidateQueries({ queryKey: ["inv_costos_propuesta"] });
              refetchArchivos();
              qc.invalidateQueries({ queryKey: ["inv_costos_lote_activo"] });
              qc.invalidateQueries({ queryKey: ["inv_costos_listas_marca"] });
              qc.invalidateQueries({ queryKey: ["inv_costos_sin_confirmar_count"] });
            }}
            userId={user?.id}
          />
        </TabsContent>

        <TabsContent value="propuesta" className="mt-4">
          <PropuestaSection
            propuesta={propuesta}
            loteId={loteActivo}
            onRefresh={async () => {
              await refetchLote();
              qc.invalidateQueries({ queryKey: ["inv_costos_propuesta"] });
              refetchPropuesta();
              qc.invalidateQueries({ queryKey: ["products"] });
              qc.invalidateQueries({ queryKey: ["inv_costos_historial"] });
            }}
            userId={user?.id}
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <HistorialSection historial={historial} />
        </TabsContent>

        <TabsContent value="listas" className="mt-4">
          <ListasMarcaSection data={listasMarca} />
        </TabsContent>

        <TabsContent value="bajas" className="mt-4">
          <BajasPendientesSection userId={user?.id} />
        </TabsContent>
        <TabsContent value="sinconfirmar" className="mt-4">
          <SinConfirmarSection />
        </TabsContent>
        <TabsContent value="mapeo" className="mt-4">
          <MapeoTabsContent />
        </TabsContent>
        <TabsContent value="huerfanos" className="mt-4">
          <HuerfanosInventarioSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── BAJAS DE COSTO PENDIENTES (Chevron) ────────────────────────
function BajasPendientesSection({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const [procesando, setProcesando] = useState(false);
  const [confirmRow, setConfirmRow] = useState<any | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["inv_bajas_costo_pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre_producto, costo_actual, costo_mercado_vigente, costo_mercado_fecha, costo_mercado_pendiente_desde, precio_clasificacion_id, linea_id, precio_base_uf1")
        .eq("costo_mercado_pendiente_baja", true)
        .eq("is_active", true)
        .order("costo_mercado_pendiente_desde", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const visibles = useMemo(() => rows.filter((r: any) => !ocultos.includes(r.id)), [rows, ocultos]);

  async function aceptarBaja(items: any[]) {
    if (!userId || items.length === 0) return;
    setProcesando(true);
    try {
      const { data: lineaMargenes } = await supabase.from("producto_linea_margenes").select("*").eq("activo", true);
      const margenesPorLinea = new Map<string | null, any>();
      for (const m of lineaMargenes || []) margenesPorLinea.set(m.linea_id, m);
      const margenGeneral = margenesPorLinea.get(null);

      let ok = 0, fail = 0;
      for (const item of items) {
        const costoFinal = Number(item.costo_mercado_vigente);
        if (!isFinite(costoFinal) || costoFinal <= 0) { fail++; continue; }

        const updates: any = {
          costo_actual: costoFinal,
          costo_mercado_pendiente_baja: false,
          costo_mercado_pendiente_desde: null,
        };

        const margins = margenesPorLinea.get(item.linea_id) || margenGeneral;
        let nuevoUf1: number | null = null;
        if (margins) {
          const mRec: Record<string, number> = {};
          for (const lvl of MARGIN_LEVELS) mRec[lvl.key] = Number((margins as any)[lvl.key] ?? 0);
          const raw = computePricesFromCost(costoFinal, mRec);
          for (const [k, v] of Object.entries(raw)) {
            const val = ceilTo5(Number(v));
            if (val > 0) updates[k] = val;
          }
          nuevoUf1 = updates.precio_base_uf1 ?? null;
        }

        const { error: upErr } = await supabase.from("productos").update(updates).eq("id", item.id);
        if (upErr) { fail++; continue; }

        await supabase.from("inv_costos_historial").insert({
          codigo_producto: item.codigo,
          empresa: "lumaggs",
          costo_anterior: item.costo_actual,
          costo_nuevo: costoFinal,
          fuente: "baja_mercado_aceptada",
          lote_id: null,
          precio_uf1_anterior: item.precio_base_uf1,
          precio_uf1_nuevo: nuevoUf1 ?? item.precio_base_uf1,
          aplicado_por: userId,
        });
        ok++;
      }

      setOcultos(prev => [...prev, ...items.map(i => i.id)]);
      toast.success(`${ok} baja${ok === 1 ? "" : "s"} de costo aplicada${ok === 1 ? "" : "s"}${fail ? ` · ${fail} con error` : ""}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv_costos_historial"] });
      refetch();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setProcesando(false);
      setConfirmRow(null);
      setConfirmAll(false);
    }
  }

  const money = (n: any) => (n == null || !isFinite(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`);
  const fecha = (d: any) => (d ? new Date(d).toLocaleDateString("es-MX") : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Bajas de Costo Pendientes (Chevron)
              {visibles.length > 0 && <Badge variant="secondary">{visibles.length}</Badge>}
            </span>
            <Button
              size="sm"
              onClick={() => setConfirmAll(true)}
              disabled={procesando || visibles.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Aceptar todas
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando…</div>
          ) : visibles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No hay bajas de costo pendientes.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Costo actual</TableHead>
                  <TableHead className="text-right">Costo de mercado</TableHead>
                  <TableHead className="text-right">% diferencia</TableHead>
                  <TableHead>Pendiente desde</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r: any) => {
                  const actual = Number(r.costo_actual) || 0;
                  const mercado = Number(r.costo_mercado_vigente) || 0;
                  const diff = actual > 0 ? ((mercado - actual) / actual) * 100 : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell className="font-light">{r.nombre_producto}</TableCell>
                      <TableCell className="text-right">{money(r.costo_actual)}</TableCell>
                      <TableCell className="text-right text-green-700">{money(r.costo_mercado_vigente)}</TableCell>
                      <TableCell className="text-right text-green-700">{diff == null ? "—" : `${diff.toFixed(1)}%`}</TableCell>
                      <TableCell className="text-sm">{fecha(r.costo_mercado_pendiente_desde || r.costo_mercado_fecha)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={procesando} onClick={() => setConfirmRow(r)}>
                          Aceptar baja de costo
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceptar baja de costo</DialogTitle>
            <DialogDescription>
              Se actualizará el costo de <strong>{confirmRow?.codigo}</strong> de {money(confirmRow?.costo_actual)} a{" "}
              {money(confirmRow?.costo_mercado_vigente)} y se recalcularán sus 8 precios de venta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRow(null)} disabled={procesando}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={procesando} onClick={() => aceptarBaja([confirmRow])}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAll} onOpenChange={(o) => !o && setConfirmAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceptar todas las bajas de costo</DialogTitle>
            <DialogDescription>
              Se actualizarán los costos y se recalcularán los precios de <strong>{visibles.length}</strong> producto(s). Esta acción afecta precios reales de venta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAll(false)} disabled={procesando}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={procesando} onClick={() => aceptarBaja(visibles)}>
              Confirmar {visibles.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── SIN CONFIRMAR EN LISTAS ────────────────────────────────────
function SinConfirmarSection() {
  const [filtroMarca, setFiltroMarca] = useState<"todas" | "lumaggs" | "galsa" | "gonher">("todas");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["inv_costos_sin_confirmar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, codigo, nombre_producto, costo_actual, costo_confirmado_fecha, marca:product_option_values!productos_marca_id_fkey(value)")
        .eq("is_active", true)
        .eq("costo_confirmado_en_ultima_lista", false)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const esGonher = (p: any) => String(p?.marca?.value || "").toLowerCase().includes("gonher");
  const marcaLabel = (p: any) => {
    const emp = detectarEmpresa(p);
    if (emp === "lumaggs") return "Chevron";
    return esGonher(p) ? "Galsa/Gonher" : "Phillips 66";
  };
  const marcaKey = (p: any): "lumaggs" | "galsa" | "gonher" => {
    const emp = detectarEmpresa(p);
    if (emp === "lumaggs") return "lumaggs";
    return esGonher(p) ? "gonher" : "galsa";
  };

  const hoy = new Date();
  const diasSinConfirmar = (d: any) => {
    if (!d) return null;
    const fecha = new Date(d);
    if (isNaN(fecha.getTime())) return null;
    return Math.floor((hoy.getTime() - fecha.getTime()) / 86400000);
  };

  const filtradas = useMemo(() => {
    const base = filtroMarca === "todas" ? rows : rows.filter((r: any) => marcaKey(r) === filtroMarca);
    return [...base].sort((a: any, b: any) => {
      const da = diasSinConfirmar(a.costo_confirmado_fecha) ?? -1;
      const db = diasSinConfirmar(b.costo_confirmado_fecha) ?? -1;
      return db - da;
    });
  }, [rows, filtroMarca]);

  const money = (n: any) => (n == null || !isFinite(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`);
  const fecha = (d: any) => (d ? new Date(d).toLocaleDateString("es-MX") : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            Sin Confirmar en Listas
            {filtradas.length > 0 && <Badge variant="secondary">{filtradas.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Marca:</Label>
            <Select value={filtroMarca} onValueChange={(v) => setFiltroMarca(v as any)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="lumaggs">Chevron</SelectItem>
                <SelectItem value="galsa">Phillips 66</SelectItem>
                <SelectItem value="gonher">Galsa/Gonher</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No hay productos sin confirmar en listas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Costo actual</TableHead>
                  <TableHead>Confirmado por última vez</TableHead>
                  <TableHead className="text-right">Días sin confirmar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r: any) => {
                  const dias = diasSinConfirmar(r.costo_confirmado_fecha);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell className="font-light">{r.nombre_producto}</TableCell>
                      <TableCell className="text-sm">{marcaLabel(r)}</TableCell>
                      <TableCell className="text-right">{money(r.costo_actual)}</TableCell>
                      <TableCell className="text-sm">{fecha(r.costo_confirmado_fecha)}</TableCell>
                      <TableCell className="text-right text-sm">{dias == null ? "—" : dias}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground font-light">
            Listado informativo para revisión manual. Estos productos no aparecieron en la última lista de precios procesada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── BIBLIOTECA ─────────────────────────────────────────────────
function BibliotecaSection({ archivos, onRefresh, userId }: { archivos: any[]; onRefresh: () => Promise<void>; userId?: string }) {
  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [progresoTexto, setProgresoTexto] = useState("");
  const [archivosEnMemoria, setArchivosEnMemoria] = useState<Record<string, Map<string, any>>>({});
  const [procesandoTipo, setProcesandoTipo] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const archivosPorTipo = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of archivos) {
      if (!a.es_activo) continue;
      const prev = m.get(a.tipo);
      if (!prev || new Date(a.fecha_vigencia_inicio) > new Date(prev.fecha_vigencia_inicio)) m.set(a.tipo, a);
    }
    return m;
  }, [archivos]);

  const puedeGenerar = useMemo(() => {
    return Object.keys(archivosEnMemoria).length > 0;
  }, [archivosEnMemoria]);

  const puedeGenerarMarca = useMemo(() => {
    const calc = (m: MarcaFiltro) => MARCA_TIPOS[m].some(t => !!archivosEnMemoria[t]);
    return { lumaggs: calc("lumaggs"), galsa: calc("galsa"), gonher: calc("gonher") } as Record<MarcaFiltro, boolean>;
  }, [archivosEnMemoria]);

  function formatFecha(iso?: string | null) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  async function handleFileSelected(tipo: string, file: File) {
    if (!userId) return;
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    if (lowerName.endsWith(".csv")) {
      toast.warning("Los archivos CSV se procesarán como tabla.");
    }
    setProcesandoTipo(tipo);
    try {
      const tipoDef = TIPOS_ARCHIVO.find(t => t.value === tipo);
      const esGonherPdf = isPdf && (tipo === "costos_galper_gonher" || tipo === "lista_general_gonher" || tipo === "costos_galper_galsa" || tipo === "costos_galper_lumaggs");
      const map = isPdf
        ? (esGonherPdf ? await parseGonherPdfToMap(file) : await parsePdfToMap(file))
        : await parseExcelToMap(file);
      if (map.size === 0) { toast.error("No se detectaron registros válidos en el archivo"); return; }

      // Subir archivo original a Storage (no bloquea el flujo si falla)
      let storagePath: string | null = null;
      try {
        const path = `${tipo}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("inventario-archivos").upload(path, file);
        if (upErr) throw upErr;
        storagePath = path;
      } catch (upe: any) {
        console.warn("Storage upload falló", upe);
        toast.warning("No se pudo guardar el archivo original en Storage, pero los datos sí se procesaron.");
      }

      await supabase.from("inv_archivos_referencia").update({ es_activo: false }).eq("tipo", tipo).eq("es_activo", true);

      const hoy = new Date().toISOString().slice(0, 10);
      const { error: insErr } = await supabase.from("inv_archivos_referencia").insert({
        tipo, empresa: tipoDef?.empresa || null,
        nombre_archivo: file.name,
        fecha_vigencia_inicio: hoy,
        fecha_vigencia_fin: null,
        es_activo: true,
        total_registros: map.size,
        registros_procesados: map.size,
        registros_con_error: 0,
        estatus: "completado",
        storage_path: storagePath,
        subido_por: userId,
      });
      if (insErr) throw insErr;

      setArchivosEnMemoria(prev => ({ ...prev, [tipo]: map }));
      toast.success(`${tipoDef?.label}: ${map.size} registros cargados`);
      onRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error("Error procesando archivo: " + (e?.message || e));
    } finally {
      setProcesandoTipo(null);
      const inp = inputsRef.current[tipo];
      if (inp) inp.value = "";
    }
  }

  async function generarPropuesta(marcaFiltro: MarcaFiltro) {
    if (!userId) return;
    const tiposMarca = MARCA_TIPOS[marcaFiltro];
    if (!tiposMarca.some(t => !!archivosEnMemoria[t])) {
      toast.error("Los archivos de esta marca no están cargados en esta sesión. Vuelve a seleccionarlos antes de generar.");
      return;
    }
    setGenerando(true); setProgreso(5); setProgresoTexto("Preparando archivos…");
    try {
      // 1) Usar los archivos cargados en memoria
      const fuentes: Record<string, Map<string, any>> = { ...archivosEnMemoria };
      setProgreso(20);
      setProgresoTexto("Cargando catálogo de productos…");
      // 2) Cargar todos los productos con sus relaciones (marca, linea)
      const { data: productosAll, error: pe } = await supabase
        .from("productos")
        .select("id, codigo, nombre_producto, costo_actual, precio_base_uf1, linea_id, costo_mercado_pendiente_desde, marca:product_option_values!productos_marca_id_fkey(value)")
        .eq("is_active", true);
      if (pe) throw pe;
      const esGonher = (p: any) => String(p?.marca?.value || "").toLowerCase().includes("gonher");
      const productos = (productosAll || []).filter(p => {
        const emp = detectarEmpresa(p);
        if (marcaFiltro === "lumaggs") return emp === "lumaggs";
        if (marcaFiltro === "galsa") return emp === "galsa" && !esGonher(p);
        return emp === "galsa" && esGonher(p);
      });
      setProgreso(25); setProgresoTexto("Cargando márgenes…");

      // 3) Cargar márgenes (por línea + general)
      const { data: lineaMargenes } = await supabase.from("producto_linea_margenes").select("*").eq("activo", true);
      const margenesPorLinea = new Map<string | null, any>();
      for (const m of lineaMargenes || []) margenesPorLinea.set(m.linea_id, m);
      const margenGeneral = margenesPorLinea.get(null);

      // 4) Resolver IDs de archivos (para FKs)
      const idArchivo = (tipo: string) => archivosPorTipo.get(tipo)?.id || null;

      // 5) Procesar cada producto
      const loteId = crypto.randomUUID();
      const propuestas: any[] = [];
      const total = (productos || []).length;
      let n = 0;
      const codigosVistos = new Set<string>();
      const duplicados = new Set<string>();
      const hoyISO = new Date().toISOString().slice(0, 10);
      const idsConfirmados: string[] = [];
      const idsNoConfirmados: string[] = [];
      const mercadoBajaConDesde: string[] = [];
      const mercadoBajaSinDesde: string[] = [];
      const mercadoCostoPorProducto = new Map<string, number>();
      const mercadoInformativo: string[] = [];
      for (const p of productosAll || []) {
        if (codigosVistos.has(p.codigo)) duplicados.add(p.codigo);
        codigosVistos.add(p.codigo);
      }

      for (const producto of productos || []) {
        n++;
        if (n % 50 === 0) { setProgreso(25 + Math.round((n / total) * 50)); setProgresoTexto(`Procesando ${n}/${total}…`); }
        const codigo = producto.codigo;
        const empresa = detectarEmpresa(producto);

        // Buscar fuentes según empresa
        let galper: any = null, especial: any = null, lista: any = null;
        let archivoGalperId: string | null = null, archivoEspId: string | null = null, archivoListaId: string | null = null;

        if (marcaFiltro === "lumaggs") {
          galper = fuentes["costos_galper_lumaggs"]?.get(codigo) || null;
          archivoGalperId = galper ? idArchivo("costos_galper_lumaggs") : null;
          especial = fuentes["precios_especiales_lumaggs"]?.get(codigo) || null;
          archivoEspId = especial ? idArchivo("precios_especiales_lumaggs") : null;
          lista = fuentes["lista_general_lumaggs"]?.get(codigo) || null;
          archivoListaId = lista ? idArchivo("lista_general_lumaggs") : null;
        } else {
          const tGalper = `costos_galper_${marcaFiltro}`;
          const tLista = `lista_general_${marcaFiltro}`;
          galper = fuentes[tGalper]?.get(codigo) || null;
          archivoGalperId = galper ? idArchivo(tGalper) : null;
          lista = fuentes[tLista]?.get(codigo) || null;
          archivoListaId = lista ? idArchivo(tLista) : null;
        }

        // Calcular costo efectivo
        let costoEfectivo: number | null = null;
        let fuente = "";
        if (marcaFiltro === "lumaggs") {
          const costoActualRef = Number(producto.costo_actual || 0);
          if (especial) {
            costoEfectivo = especial.costo; fuente = "especial";
            if (costoActualRef > 0 && especial.costo < costoActualRef && galper) {
              costoEfectivo = galper.costo; fuente = "galper";
            }
          } else if (galper) {
            costoEfectivo = galper.costo; fuente = "galper";
          } else if (lista) {
            costoEfectivo = lista.costo; fuente = "lista";
          }
        } else {

          if (galper) { costoEfectivo = galper.costo; fuente = "galper"; }
          else if (lista) { costoEfectivo = lista.costo; fuente = "lista"; }
        }
        // Confirmación de aparición en la última lista procesada (independiente de la propuesta)
        if (galper || especial || lista) idsConfirmados.push(producto.id);
        else idsNoConfirmados.push(producto.id);
        if (!costoEfectivo) continue;

        const costoAnterior = Number(producto.costo_actual || 0);

        // Costo de mercado / regla de piso
        if (empresa === "lumaggs") {
          if (costoAnterior > 0 && costoEfectivo < costoAnterior) {
            mercadoCostoPorProducto.set(producto.id, costoEfectivo);
            if ((producto as any).costo_mercado_pendiente_desde) mercadoBajaConDesde.push(producto.id);
            else mercadoBajaSinDesde.push(producto.id);
            continue; // no se propone bajar el costo/precio
          }
          if (costoAnterior > 0 && costoEfectivo === costoAnterior) {
            mercadoCostoPorProducto.set(producto.id, costoAnterior);
            mercadoInformativo.push(producto.id);
          }
        } else {
          mercadoCostoPorProducto.set(producto.id, costoEfectivo);
          mercadoInformativo.push(producto.id);
        }

        const variacion = costoAnterior > 0 ? (costoEfectivo - costoAnterior) / costoAnterior : null;
        const razones: string[] = [];
        let nivel = "normal";

        if (variacion !== null) {
          const abs = Math.abs(variacion);
          if (abs > 0.4) { razones.push("variacion_extrema"); nivel = "bloqueo"; }
          else if (variacion < -0.15) { razones.push("baja_pronunciada"); if (nivel !== "bloqueo") nivel = "alerta"; }
          else if (abs > 0.2) { razones.push("variacion_alta"); if (nivel !== "bloqueo") nivel = "alerta"; }
          else if (abs > 0.1) { razones.push("variacion_media"); if (nivel === "normal") nivel = "aviso"; }
        } else {
          razones.push("producto_nuevo"); nivel = "aviso";
        }
        if (producto.precio_base_uf1 && costoEfectivo > Number(producto.precio_base_uf1)) { razones.push("costo_mayor_precio_uf1"); nivel = "bloqueo"; }
        if (duplicados.has(codigo)) { razones.push("codigo_duplicado"); nivel = "bloqueo"; }

        // Calcular precios propuestos
        const margins = margenesPorLinea.get(producto.linea_id) || margenGeneral;
        const precios: Record<string, number> = {};
        if (margins) {
          const mRec: Record<string, number> = {};
          for (const lvl of MARGIN_LEVELS) mRec[lvl.key] = Number((margins as any)[lvl.key] ?? 0);
          const raw = computePricesFromCost(costoEfectivo, mRec);
          for (const [k, v] of Object.entries(raw)) precios[k] = ceilTo5(Number(v));
        }

        // Detectar nombre diferente
        const nombreArchivo = galper?.nombre || especial?.nombre || lista?.nombre || null;
        if (nombreArchivo && producto.nombre_producto) {
          const a = nombreArchivo.toLowerCase().replace(/\s+/g, "");
          const b = String(producto.nombre_producto).toLowerCase().replace(/\s+/g, "");
          const minLen = Math.min(a.length, b.length);
          let matches = 0;
          for (let k = 0; k < minLen; k++) if (a[k] === b[k]) matches++;
          const sim = matches / Math.max(a.length, b.length);
          if (sim < 0.6) { razones.push("nombre_diferente"); if (nivel === "normal") nivel = "alerta"; }
        }

        propuestas.push({
          codigo_producto: codigo,
          empresa,
          costo_galper: galper?.costo ?? null,
          costo_galper_fecha: null,
          costo_especial: especial?.costo ?? null,
          costo_especial_fecha: null,
          costo_lista: lista?.costo ?? null,
          costo_lista_fecha: null,
          costo_efectivo: costoEfectivo,
          costo_efectivo_fuente: fuente,
          costo_anterior: costoAnterior,
          variacion_absoluta: costoEfectivo - costoAnterior,
          variacion_porcentual: variacion,
          precio_propuesto_uf1: precios.precio_base_uf1 ?? null,
          precio_propuesto_uf2: precios.precio_uf2 ?? null,
          precio_propuesto_uf3: precios.precio_uf3 ?? null,
          precio_propuesto_uf4: precios.precio_uf4 ?? null,
          precio_propuesto_r1: precios.precio_r1 ?? null,
          precio_propuesto_r2: precios.precio_r2 ?? null,
          precio_propuesto_r3: precios.precio_r3 ?? null,
          precio_propuesto_r4: precios.precio_r4 ?? null,
          nivel_alerta: nivel,
          razones_alerta: razones,
          estado: "pendiente",
          lote_id: loteId,
          archivo_galper_id: archivoGalperId,
          archivo_especial_id: archivoEspId,
          archivo_lista_id: archivoListaId,
          nombre_en_archivo: nombreArchivo,
          nombre_en_catalogo: producto.nombre_producto,
        });
      }

      // Actualizaciones directas a productos (confirmación en lista y costo de mercado)
      setProgresoTexto("Actualizando catálogo…");
      for (let i = 0; i < idsConfirmados.length; i += 200) {
        await supabase.from("productos")
          .update({ costo_confirmado_en_ultima_lista: true, costo_confirmado_fecha: hoyISO })
          .in("id", idsConfirmados.slice(i, i + 200));
      }
      for (let i = 0; i < idsNoConfirmados.length; i += 200) {
        await supabase.from("productos")
          .update({ costo_confirmado_en_ultima_lista: false })
          .in("id", idsNoConfirmados.slice(i, i + 200));
      }
      for (const id of mercadoBajaSinDesde) {
        await supabase.from("productos").update({
          costo_mercado_vigente: mercadoCostoPorProducto.get(id) ?? null,
          costo_mercado_fecha: hoyISO,
          costo_mercado_pendiente_baja: true,
          costo_mercado_pendiente_desde: hoyISO,
        }).eq("id", id);
      }
      for (const id of mercadoBajaConDesde) {
        await supabase.from("productos").update({
          costo_mercado_vigente: mercadoCostoPorProducto.get(id) ?? null,
          costo_mercado_fecha: hoyISO,
          costo_mercado_pendiente_baja: true,
        }).eq("id", id);
      }
      for (const id of mercadoInformativo) {
        const payload: any = {
          costo_mercado_vigente: mercadoCostoPorProducto.get(id) ?? null,
          costo_mercado_fecha: hoyISO,
        };
        if (marcaFiltro !== "lumaggs") payload.costo_mercado_pendiente_baja = false;
        await supabase.from("productos").update(payload).eq("id", id);
      }

      setProgresoTexto(`Guardando ${propuestas.length} propuestas…`);
      setProgreso(80);
      for (let i = 0; i < propuestas.length; i += 100) {
        const chunk = propuestas.slice(i, i + 100);
        const { error } = await supabase.from("inv_costos_producto").insert(chunk);
        if (error) throw error;
        setProgreso(80 + Math.round(((i + 100) / propuestas.length) * 18));
      }

      // 6) Códigos presentes en archivos pero NO en el catálogo
      const huerfanos: any[] = [];
      const vistosHuerfanos = new Set<string>();
      const empresaHuerfano: "lumaggs" | "galsa" = marcaFiltro === "lumaggs" ? "lumaggs" : "galsa";
      const gruposHuerfanos: { empresa: "lumaggs" | "galsa"; tipos: string[] }[] = [
        { empresa: empresaHuerfano, tipos: tiposMarca },
      ];
      for (const grupo of gruposHuerfanos) {
        for (const tipo of grupo.tipos) {
          const mapa = fuentes[tipo];
          if (!mapa) continue;
          for (const codigo of mapa.keys()) {
            if (codigosVistos.has(codigo) || vistosHuerfanos.has(codigo)) continue;
            vistosHuerfanos.add(codigo);
            const empresa = grupo.empresa;

            let galper: any = null, especial: any = null, lista: any = null;
            let archivoGalperId: string | null = null, archivoEspId: string | null = null, archivoListaId: string | null = null;

            if (marcaFiltro === "lumaggs") {
              galper = fuentes["costos_galper_lumaggs"]?.get(codigo) || null;
              archivoGalperId = galper ? idArchivo("costos_galper_lumaggs") : null;
              especial = fuentes["precios_especiales_lumaggs"]?.get(codigo) || null;
              archivoEspId = especial ? idArchivo("precios_especiales_lumaggs") : null;
              lista = fuentes["lista_general_lumaggs"]?.get(codigo) || null;
              archivoListaId = lista ? idArchivo("lista_general_lumaggs") : null;
            } else {
              const tGalper = `costos_galper_${marcaFiltro}`;
              const tLista = `lista_general_${marcaFiltro}`;
              galper = fuentes[tGalper]?.get(codigo) || null;
              archivoGalperId = galper ? idArchivo(tGalper) : null;
              lista = fuentes[tLista]?.get(codigo) || null;
              archivoListaId = lista ? idArchivo(tLista) : null;
            }

            let costoEfectivo: number | null = null;
            let fuente = "";
            if (marcaFiltro === "lumaggs") {
              if (galper && especial) { costoEfectivo = Math.max(galper.costo, especial.costo); fuente = "max_galper_especial"; }
              else if (galper) { costoEfectivo = galper.costo; fuente = "galper"; }
              else if (especial) { costoEfectivo = especial.costo; fuente = "especial"; }
              else if (lista) { costoEfectivo = lista.costo; fuente = "lista"; }
            } else {
              if (galper) { costoEfectivo = galper.costo; fuente = "galper"; }
              else if (lista) { costoEfectivo = lista.costo; fuente = "lista"; }
            }
            if (!costoEfectivo) continue;

            huerfanos.push({
              codigo_producto: codigo,
              empresa,
              costo_galper: galper?.costo ?? null,
              costo_especial: especial?.costo ?? null,
              costo_lista: lista?.costo ?? null,
              costo_efectivo: costoEfectivo,
              costo_efectivo_fuente: fuente,
              costo_anterior: 0,
              variacion_absoluta: null,
              variacion_porcentual: null,
              precio_propuesto_uf1: null,
              precio_propuesto_uf2: null,
              precio_propuesto_uf3: null,
              precio_propuesto_uf4: null,
              precio_propuesto_r1: null,
              precio_propuesto_r2: null,
              precio_propuesto_r3: null,
              precio_propuesto_r4: null,
              nivel_alerta: null,
              razones_alerta: ["sin_producto"],
              estado: "sin_producto",
              lote_id: null,
              archivo_galper_id: archivoGalperId,
              archivo_especial_id: archivoEspId,
              archivo_lista_id: archivoListaId,
              nombre_en_archivo: galper?.nombre || especial?.nombre || lista?.nombre || null,
              nombre_en_catalogo: null,
            });
          }
        }
      }
      if (huerfanos.length) {
        setProgresoTexto(`Guardando ${huerfanos.length} referencias sin producto…`);
        // Limpiar solo las referencias sin_producto de los códigos que se recalculan en este run
        const codigosRun = Array.from(new Set(tiposMarca.flatMap(t => Array.from(fuentes[t]?.keys() || []))));
        for (let i = 0; i < codigosRun.length; i += 200) {
          const lote = codigosRun.slice(i, i + 200);
          const { error } = await supabase.from("inv_costos_producto").delete().eq("estado", "sin_producto").in("codigo_producto", lote);
          if (error) throw error;
        }
        for (let i = 0; i < huerfanos.length; i += 100) {
          const chunk = huerfanos.slice(i, i + 100);
          const { error } = await supabase.from("inv_costos_producto").insert(chunk);
          if (error) throw error;
        }
      }

      setProgreso(100); setProgresoTexto("Listo");
      toast.success(`Propuesta ${marcaFiltro} generada: ${propuestas.length} SKUs · ${huerfanos.length} referencias de códigos no catalogados`);
      onRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error("Error generando propuesta: " + (e?.message || e));
    } finally {
      setTimeout(() => { setGenerando(false); setProgreso(0); setProgresoTexto(""); }, 600);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium">Generar propuesta de costos</p>
            <p className="text-xs text-muted-foreground">Procesa los archivos activos de cada marca contra el catálogo y crea un lote pendiente de autorización.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { marca: "lumaggs" as MarcaFiltro, label: "Generar Chevron/Lumaggs" },
              { marca: "galsa" as MarcaFiltro, label: "Generar Phillips 66/Galsa" },
              { marca: "gonher" as MarcaFiltro, label: "Generar Gonher" },
            ]).map(({ marca, label }) => (
              <Button
                key={marca}
                onClick={() => generarPropuesta(marca)}
                disabled={!puedeGenerarMarca[marca] || generando}
                size="lg"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${generando ? "animate-spin" : ""}`} />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
        {generando && (
          <CardContent className="pt-0">
            <Progress value={progreso} />
            <p className="text-xs text-muted-foreground mt-1">{progresoTexto}</p>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TIPOS_ARCHIVO.map(t => {
          const a = archivosPorTipo.get(t.value);
          const enMemoria = !!archivosEnMemoria[t.value];
          const procesando = procesandoTipo === t.value;
          return (
            <Card key={t.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" /> {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {a ? (
                  <>
                    <p className="text-xs truncate" title={a.nombre_archivo}>{a.nombre_archivo}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.registros_procesados ?? 0} reg.</Badge>
                      {enMemoria
                        ? <Badge variant="default" className="text-[10px] bg-green-600">En memoria</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Re-cargar</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Subido: {formatFecha(a.created_at)}</p>
                    {a.storage_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          const { data, error } = await supabase.storage
                            .from("inventario-archivos")
                            .createSignedUrl(a.storage_path!, 300);
                          if (error || !data?.signedUrl) {
                            toast.error("No se pudo generar el enlace del archivo");
                            return;
                          }
                          window.open(data.signedUrl, "_blank");
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> Ver / Descargar
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin archivo subido</p>
                )}
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.pdf"
                  className="hidden"
                  ref={el => { inputsRef.current[t.value] = el; }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(t.value, f); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={procesando}
                  onClick={() => inputsRef.current[t.value]?.click()}
                >
                  {procesando ? (
                    <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Procesando…</>
                  ) : (
                    <><Upload className="h-3 w-3 mr-1" /> {a ? "Subir nuevo" : "Subir archivo"}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── PROPUESTA ──────────────────────────────────────────────────
function PropuestaSection({ propuesta, loteId, onRefresh, userId }: { propuesta: any[]; loteId: string | null; onRefresh: () => Promise<void>; userId?: string }) {
  const [filtroNivel, setFiltroNivel] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todos");
  const [filtroFuente, setFiltroFuente] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [revisando, setRevisando] = useState<any>(null);
  const [aplicando, setAplicando] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  const conteos = useMemo(() => {
    const c = { bloqueo: 0, alerta: 0, aviso: 0, normal: 0, autorizado: 0 };
    for (const p of propuesta) {
      if (p.nivel_alerta in c) (c as any)[p.nivel_alerta]++;
      if (p.estado === "autorizado") c.autorizado++;
    }
    return c;
  }, [propuesta]);

  const fuentesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of propuesta) {
      if (p.costo_efectivo_fuente) set.add(String(p.costo_efectivo_fuente));
    }
    return ["todas", ...Array.from(set).sort()];
  }, [propuesta]);

  const filtrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return propuesta.filter(p =>
      (filtroNivel === "todos" || p.nivel_alerta === filtroNivel) &&
      (filtroEstado === "todos" || p.estado === filtroEstado) &&
      (filtroEmpresa === "todos" || p.empresa === filtroEmpresa) &&
      (filtroFuente === "todas" || p.costo_efectivo_fuente === filtroFuente) &&
      (!q ||
        String(p.codigo_producto || "").toLowerCase().includes(q) ||
        String(p.nombre_en_catalogo || "").toLowerCase().includes(q))
    );
  }, [propuesta, filtroNivel, filtroEstado, filtroEmpresa, filtroFuente, busqueda]);

  const pendientesVisibles = useMemo(() => filtrada.filter((p: any) => p.estado === "pendiente"), [filtrada]);
  const todosSeleccionados = pendientesVisibles.length > 0 && pendientesVisibles.every((p: any) => seleccion.has(p.id));

  function toggleTodos(checked: boolean) {
    setSeleccion(prev => {
      const next = new Set(prev);
      for (const p of pendientesVisibles) checked ? next.add(p.id) : next.delete(p.id);
      return next;
    });
  }

  function toggleUno(id: string, checked: boolean) {
    setSeleccion(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function actualizarSeleccionados(estado: "autorizado" | "rechazado") {
    if (!userId || seleccion.size === 0) return;
    const ids = propuesta.filter((p: any) => seleccion.has(p.id) && p.estado === "pendiente").map((p: any) => p.id);
    if (ids.length === 0) { toast.error("No hay filas pendientes en la selección"); return; }
    const { error } = await supabase
      .from("inv_costos_producto")
      .update({ estado, autorizado_por: userId, autorizado_at: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    setSeleccion(new Set());
    toast.success(`${ids.length} ${estado === "autorizado" ? "autorizados" : "rechazados"}`);
    await onRefresh();
  }

  async function autorizarPorNivel(nivel: string) {
    if (!loteId || !userId) return;
    const { error } = await supabase
      .from("inv_costos_producto")
      .update({ estado: "autorizado", autorizado_por: userId, autorizado_at: new Date().toISOString() })
      .eq("lote_id", loteId).eq("nivel_alerta", nivel).eq("estado", "pendiente");
    if (error) { toast.error(error.message); return; }
    toast.success(`Autorizados nivel ${nivel}`);
    onRefresh();
  }

  async function autorizarItem(id: string, costoManual?: number | null, notas?: string) {
    if (!userId) return;
    const updates: any = { estado: "autorizado", autorizado_por: userId, autorizado_at: new Date().toISOString() };
    if (typeof costoManual === "number" && costoManual > 0) updates.costo_manual = costoManual;
    if (notas) updates.notas_autorizacion = notas;
    const { error } = await supabase.from("inv_costos_producto").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Autorizado");
    onRefresh();
  }

  async function rechazarItem(id: string, notas?: string) {
    if (!userId) return;
    const { error } = await supabase.from("inv_costos_producto").update({
      estado: "rechazado", autorizado_por: userId, autorizado_at: new Date().toISOString(), notas_autorizacion: notas || null
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rechazado");
    onRefresh();
  }

  async function aplicarCambios() {
    if (!loteId || !userId) return;
    setAplicando(true);
    try {
      const { data: freshRows } = await supabase
        .from("inv_costos_producto")
        .select("*")
        .eq("lote_id", loteId)
        .eq("estado", "autorizado");
      const autorizados = freshRows || [];
      if (autorizados.length === 0) {
        toast.warning("No hay productos autorizados para aplicar — actualiza la página e inténtalo de nuevo");
        setConfirmApply(false);
        return;
      }
      let ok = 0, fail = 0;
      for (const item of autorizados) {
        const costoFinal = Number(item.costo_manual ?? item.costo_efectivo);
        if (!isFinite(costoFinal) || costoFinal <= 0) { fail++; continue; }
        // Buscar producto
        const { data: prod } = await supabase.from("productos").select("id, precio_base_uf1").eq("codigo", item.codigo_producto).maybeSingle();
        if (!prod) { fail++; continue; }
        const updates: any = { costo_actual: costoFinal };
        if (item.precio_propuesto_uf1) updates.precio_base_uf1 = item.precio_propuesto_uf1;
        if (item.precio_propuesto_uf2) updates.precio_uf2 = item.precio_propuesto_uf2;
        if (item.precio_propuesto_uf3) updates.precio_uf3 = item.precio_propuesto_uf3;
        if (item.precio_propuesto_uf4) updates.precio_uf4 = item.precio_propuesto_uf4;
        if (item.precio_propuesto_r1) updates.precio_r1 = item.precio_propuesto_r1;
        if (item.precio_propuesto_r2) updates.precio_r2 = item.precio_propuesto_r2;
        if (item.precio_propuesto_r3) updates.precio_r3 = item.precio_propuesto_r3;
        if (item.precio_propuesto_r4) updates.precio_r4 = item.precio_propuesto_r4;
        const { error: upErr } = await supabase.from("productos").update(updates).eq("id", prod.id);
        if (upErr) { fail++; continue; }
        await supabase.from("inv_costos_historial").insert({
          codigo_producto: item.codigo_producto,
          empresa: item.empresa,
          costo_anterior: item.costo_anterior,
          costo_nuevo: costoFinal,
          fuente: item.costo_manual ? "manual" : item.costo_efectivo_fuente,
          lote_id: item.lote_id,
          precio_uf1_anterior: prod.precio_base_uf1,
          precio_uf1_nuevo: item.precio_propuesto_uf1 ?? prod.precio_base_uf1,
          aplicado_por: userId,
        });
        await supabase.from("inv_costos_producto").update({ estado: "aplicado" }).eq("id", item.id);
        ok++;
      }
      toast.success(`${ok} productos actualizados${fail ? ` · ${fail} con error` : ""}`);
      await onRefresh();
      setConfirmApply(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally { setAplicando(false); }
  }

  if (!loteId) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">No hay propuesta activa. Genera una desde la biblioteca de archivos.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Badge className="bg-red-100 text-red-800 border-red-300">🔴 {conteos.bloqueo} Bloqueos</Badge>
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">🟠 {conteos.alerta} Alertas</Badge>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">🟡 {conteos.aviso} Avisos</Badge>
          <Badge className="bg-green-100 text-green-800 border-green-300">✅ {conteos.normal} Normales</Badge>
          <span className="text-xs text-muted-foreground ml-2">Total: {propuesta.length} SKUs</span>
          <span className="text-xs text-muted-foreground">· Autorizados: {conteos.autorizado}</span>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => autorizarPorNivel("normal")}>Autorizar NORMALES</Button>
            <Button size="sm" variant="outline" onClick={() => autorizarPorNivel("aviso")}>Autorizar AVISOS</Button>
            <Button size="sm" disabled={conteos.autorizado === 0} onClick={() => setConfirmApply(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1" /> APLICAR CAMBIOS ({conteos.autorizado})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar por código o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-[220px] h-8"
          />
          <Select value={filtroNivel} onValueChange={setFiltroNivel}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los niveles</SelectItem>
              <SelectItem value="bloqueo">🔴 Bloqueos</SelectItem>
              <SelectItem value="alerta">🟠 Alertas</SelectItem>
              <SelectItem value="aviso">🟡 Avisos</SelectItem>
              <SelectItem value="normal">✅ Normales</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="autorizado">Autorizados</SelectItem>
              <SelectItem value="rechazado">Rechazados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Ambas empresas</SelectItem>
              <SelectItem value="lumaggs">Lumaggs</SelectItem>
              <SelectItem value="galsa">Galsa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroFuente} onValueChange={setFiltroFuente}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {fuentesOptions.map(f => (
                <SelectItem key={f} value={f}>{f === "todas" ? "Todas las fuentes" : f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-2">{filtrada.length} resultados</span>
        </CardContent>
      </Card>

      {seleccion.size > 0 && (
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium">{seleccion.size} seleccionados</span>
            <div className="ml-auto flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => actualizarSeleccionados("autorizado")}>Autorizar seleccionados</Button>
              <Button size="sm" variant="outline" onClick={() => actualizarSeleccionados("rechazado")}>Rechazar seleccionados</Button>
              <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>Limpiar selección</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={todosSeleccionados}
                    disabled={pendientesVisibles.length === 0}
                    onCheckedChange={(v) => toggleTodos(!!v)}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide">●</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Código</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Nombre</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Emp.</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Costo ant.</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Galper</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Especial</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Lista</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Efectivo</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Var %</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">UF1</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Fuente</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Razones</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Estado</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrada.map((p, i) => (
                <TableRow key={p.id} className={i % 2 ? "bg-muted/20 hover:bg-blue-50/40" : "hover:bg-blue-50/40"}>
                  <TableCell>
                    {p.estado === "pendiente" && (
                      <Checkbox
                        checked={seleccion.has(p.id)}
                        onCheckedChange={(v) => toggleUno(p.id, !!v)}
                        aria-label="Seleccionar fila"
                      />
                    )}
                  </TableCell>
                  <TableCell>{nivelColor(p.nivel_alerta)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.codigo_producto}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={p.nombre_en_catalogo}>{p.nombre_en_catalogo}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.empresa}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">${Number(p.costo_anterior || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.costo_galper ? `$${Number(p.costo_galper).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.costo_especial ? `$${Number(p.costo_especial).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{p.costo_lista ? `$${Number(p.costo_lista).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">${Number(p.costo_efectivo || 0).toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${Number(p.variacion_porcentual) > 0 ? "text-green-700" : Number(p.variacion_porcentual) < 0 ? "text-red-700" : ""}`}>
                    {p.variacion_porcentual !== null ? `${(Number(p.variacion_porcentual) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <span className="text-muted-foreground">${Number(p.costo_anterior > 0 ? 0 : 0).toFixed(0)}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1" />
                    <span className="font-semibold">${Number(p.precio_propuesto_uf1 || 0).toFixed(0)}</span>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] uppercase">{p.costo_efectivo_fuente}</Badge></TableCell>
                  <TableCell className="max-w-[160px]">
                    <div className="flex flex-wrap gap-1">
                      {(p.razones_alerta || []).map((r: string) => (
                        <Badge key={r} variant="outline" className="text-[9px]">{r}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.estado === "autorizado" ? "default" : p.estado === "rechazado" ? "destructive" : "secondary"} className="text-[10px]">{p.estado}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.estado === "pendiente" && (
                      p.nivel_alerta === "normal" || p.nivel_alerta === "aviso" ? (
                        <Button size="sm" variant="outline" onClick={() => autorizarItem(p.id)} className="h-7 text-xs">Autorizar</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setRevisando(p)} className="h-7 text-xs">
                          {p.nivel_alerta === "bloqueo" ? <Lock className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                          Revisar
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtrada.length === 0 && (
                <TableRow><TableCell colSpan={16} className="text-center py-6 text-muted-foreground text-sm">Sin resultados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <RevisionDialog item={revisando} onClose={() => setRevisando(null)} onAuthorize={(c, n) => { autorizarItem(revisando.id, c, n); setRevisando(null); }} onReject={(n) => { rechazarItem(revisando.id, n); setRevisando(null); }} />

      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar aplicación de cambios</DialogTitle>
            <DialogDescription>Se actualizará el costo y los precios de <strong>{conteos.autorizado}</strong> productos. Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApply(false)} disabled={aplicando}>Cancelar</Button>
            <Button onClick={aplicarCambios} disabled={aplicando} className="bg-green-600 hover:bg-green-700">
              {aplicando ? "Aplicando…" : "Sí, aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DIALOG REVISIÓN ─────────────────────────────────────────────
function RevisionDialog({ item, onClose, onAuthorize, onReject }: { item: any | null; onClose: () => void; onAuthorize: (costoManual: number | null, notas: string) => void; onReject: (notas: string) => void }) {
  const [costoManual, setCostoManual] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  useEffect(() => { if (item) { setCostoManual(""); setNotas(""); } }, [item?.id]);
  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
          <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span>{nivelColor(item.nivel_alerta)}</span> Revisar {item.codigo_producto}
          </DialogTitle>
          <DialogDescription className="text-xs font-light">{item.nombre_en_catalogo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Anterior</p>
              <p className="text-xs">Costo: <strong className="font-mono">${Number(item.costo_anterior || 0).toFixed(2)}</strong></p>
            </div>
            <div className="border rounded-md p-3 bg-blue-50/40">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Propuesto</p>
              <p className="text-xs">Galper: <span className="font-mono">{item.costo_galper ? `$${Number(item.costo_galper).toFixed(2)}` : "—"}</span></p>
              <p className="text-xs">Especial: <span className="font-mono">{item.costo_especial ? `$${Number(item.costo_especial).toFixed(2)}` : "—"}</span></p>
              <p className="text-xs">Lista: <span className="font-mono">{item.costo_lista ? `$${Number(item.costo_lista).toFixed(2)}` : "—"}</span></p>
              <p className="text-sm mt-2">Efectivo: <strong className="font-mono">${Number(item.costo_efectivo).toFixed(2)}</strong> <Badge variant="secondary" className="text-[10px]">{item.costo_efectivo_fuente}</Badge></p>
              <p className="text-xs mt-1">Variación: <strong className={Number(item.variacion_porcentual) < 0 ? "text-red-700" : "text-green-700"}>{item.variacion_porcentual !== null ? `${(Number(item.variacion_porcentual) * 100).toFixed(1)}%` : "—"}</strong></p>
            </div>
          </div>

          {item.nombre_en_archivo && (
            <div className="border rounded-md p-3 text-xs space-y-1">
              <p><span className="text-muted-foreground">En catálogo:</span> {item.nombre_en_catalogo}</p>
              <p><span className="text-muted-foreground">En archivo:</span> {item.nombre_en_archivo}</p>
            </div>
          )}

          <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-md p-3">
            <p className="text-xs uppercase tracking-wide mb-1">Razones</p>
            <div className="flex flex-wrap gap-1">
              {(item.razones_alerta || []).map((r: string) => <Badge key={r} variant="outline" className="text-[10px] bg-white/60">{r}</Badge>)}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Costo manual (opcional, sobrescribe el efectivo)</Label>
            <Input type="number" step="0.01" value={costoManual} onChange={e => setCostoManual(e.target.value)} className="h-9 font-light" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas de autorización</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} className="font-light" rows={3} />
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => onReject(notas)}>Rechazar</Button>
          <Button onClick={() => onAuthorize(costoManual ? Number(costoManual) : null, notas)}>
            {costoManual ? "Autorizar con costo manual" : "Autorizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── HISTORIAL ──────────────────────────────────────────────────
function HistorialSection({ historial }: { historial: any[] }) {
  return (
    <Card>
      <div className="overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Fecha</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Código</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Empresa</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-right">Costo anterior</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-right">Costo nuevo</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-right">Variación %</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Fuente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historial.map((h, i) => {
              const v = h.costo_anterior > 0 ? ((h.costo_nuevo - h.costo_anterior) / h.costo_anterior) * 100 : null;
              return (
                <TableRow key={h.id} className={i % 2 ? "bg-muted/20" : ""}>
                  <TableCell className="text-xs">{new Date(h.aplicado_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{h.codigo_producto}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{h.empresa}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">${Number(h.costo_anterior || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">${Number(h.costo_nuevo || 0).toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${v !== null && v < 0 ? "text-red-700" : "text-green-700"}`}>{v !== null ? `${v.toFixed(1)}%` : "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] uppercase">{h.fuente}</Badge></TableCell>
                </TableRow>
              );
            })}
            {historial.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Sin historial aún</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
// ─── LISTAS POR MARCA (solo lectura) ────────────────────────────
type ListaMarcaRow = {
  codigo: string;
  nombre: string;
  presentacion: string | null;
  clasificacion_abc: string | null;
  precio_uf1: number | null;
  costo_galper: number | null;
  costo_especial: number | null;
  costo_lista: number | null;
  costo_efectivo: number | null;
  fuente: string | null;
  en_catalogo: boolean;
  stock_total: number | null;
  precio_si_galper: number | null;
  descuento_disponible: number | null;
};

function fuenteBadgeLista(f: string | null | undefined) {
  if (!f) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    GALPER: "bg-blue-100 text-blue-700 border-blue-200",
    ESPECIAL: "bg-purple-100 text-purple-700 border-purple-200",
    MAX: "bg-indigo-100 text-indigo-700 border-indigo-200",
    LISTA: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-medium ${map[f] || "bg-muted"}`}>{f}</Badge>;
}

function abcBadgeLista(abc: string | null | undefined) {
  if (!abc) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700 border-emerald-200",
    B: "bg-amber-100 text-amber-700 border-amber-200",
    C: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return <Badge variant="outline" className={`text-[10px] font-medium ${map[abc] || "bg-muted"}`}>{abc}</Badge>;
}

function ListasMarcaSection({ data }: { data?: { lumaggs: ListaMarcaRow[]; galsa: ListaMarcaRow[]; gonher: ListaMarcaRow[] } }) {
  const [sub, setSub] = useState("lumaggs");
  const lumaggs = data?.lumaggs || [];
  const galsa = data?.galsa || [];
  const gonher = data?.gonher || [];
  return (
    <Tabs value={sub} onValueChange={setSub}>
      <TabsList>
        <TabsTrigger value="lumaggs">
          Costos Lumaggs <Badge variant="secondary" className="ml-2">{lumaggs.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="galsa">
          Costos Galsa <Badge variant="secondary" className="ml-2">{galsa.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="gonher">
          Costos Gonher <Badge variant="secondary" className="ml-2">{gonher.length}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="lumaggs" className="mt-4">
        <ListaMarcaTable rows={lumaggs} showEspecial exportName="costos_lumaggs" empresa="lumaggs" />
      </TabsContent>
      <TabsContent value="galsa" className="mt-4">
        <ListaMarcaTable rows={galsa} exportName="costos_galsa" empresa="galsa" />
      </TabsContent>
      <TabsContent value="gonher" className="mt-4">
        <ListaMarcaTable rows={gonher} exportName="costos_gonher" empresa="galsa" />
      </TabsContent>
    </Tabs>
  );
}

type TriFiltro = "todos" | "si" | "no";

function ListaMarcaTable({ rows, showEspecial = false, exportName, empresa }: { rows: ListaMarcaRow[]; showEspecial?: boolean; exportName: string; empresa: string }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: ignorados = [] } = useCostosIgnorados();
  const [sortKey, setSortKey] = useState<keyof ListaMarcaRow>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fFuente, setFFuente] = useState("todas");
  const [fCatalogo, setFCatalogo] = useState<TriFiltro>("todos");
  const [fExistencia, setFExistencia] = useState<TriFiltro>("todos");
  const [fGalper, setFGalper] = useState<TriFiltro>("todos");
  const [fEspecial, setFEspecial] = useState<TriFiltro>("todos");
  const [fLista, setFLista] = useState<TriFiltro>("todos");
  const [fEfectivo, setFEfectivo] = useState<TriFiltro>("todos");
  const [fDescuento, setFDescuento] = useState<TriFiltro>("todos");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);

  const ignoradosSet = useMemo(
    () => new Set((ignorados as any[]).map((i) => i.codigo_producto)),
    [ignorados],
  );

  const visibles = useMemo(() => rows.filter(r => !ignoradosSet.has(r.codigo)), [rows, ignoradosSet]);

  const fuentes = useMemo(
    () => Array.from(new Set(visibles.map(r => r.fuente).filter(Boolean) as string[])).sort(),
    [visibles],
  );

  const matchValor = (f: TriFiltro, v: number | null) =>
    f === "todos" ? true : f === "si" ? v != null : v == null;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = visibles;
    if (term) out = out.filter(r => r.codigo.toLowerCase().includes(term) || (r.nombre || "").toLowerCase().includes(term));
    out = out.filter(r => {
      if (fFuente !== "todas" && (r.fuente || "") !== fFuente) return false;
      if (fCatalogo !== "todos" && r.en_catalogo !== (fCatalogo === "si")) return false;
      if (fExistencia !== "todos") {
        const con = (r.stock_total ?? 0) > 0;
        if (con !== (fExistencia === "si")) return false;
      }
      if (!matchValor(fGalper, r.costo_galper)) return false;
      if (showEspecial && !matchValor(fEspecial, r.costo_especial)) return false;
      if (!matchValor(fLista, r.costo_lista)) return false;
      if (!matchValor(fEfectivo, r.costo_efectivo)) return false;
      if (showEspecial && !matchValor(fDescuento, r.descuento_disponible)) return false;
      return true;
    });
    return [...out].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [visibles, q, sortKey, sortDir, fFuente, fCatalogo, fExistencia, fGalper, fEspecial, fLista, fEfectivo, fDescuento, showEspecial]);

  const todosSeleccionados = filtered.length > 0 && filtered.every(r => seleccion.has(r.codigo));
  const toggleTodos = (on: boolean) => {
    setSeleccion(prev => {
      const s = new Set(prev);
      filtered.forEach(r => (on ? s.add(r.codigo) : s.delete(r.codigo)));
      return s;
    });
  };
  const toggleUno = (codigo: string, on: boolean) => {
    setSeleccion(prev => {
      const s = new Set(prev);
      if (on) s.add(codigo); else s.delete(codigo);
      return s;
    });
  };

  const ignorarMut = useMutation({
    mutationFn: async (codigos: string[]) => {
      const nuevos = codigos.filter(c => !ignoradosSet.has(c));
      if (nuevos.length === 0) return 0;
      const { error } = await (supabase as any)
        .from("inv_costos_producto_ignorados")
        .insert(nuevos.map(c => ({ codigo_producto: c, empresa, ignorado_por: user?.id ?? null })));
      if (error) throw error;
      return nuevos.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} código(s) ignorado(s)`);
      setSeleccion(new Set());
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

  const toggleSort = (k: keyof ListaMarcaRow) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  const exportarRows = (data: ListaMarcaRow[], sufijo = "") => {
    const out = data.map(d => ({
      "Código": d.codigo,
      "Nombre": d.nombre,
      "Presentación": d.presentacion ?? "",
      "ABC": d.clasificacion_abc ?? "",
      "Precio UF1": d.precio_uf1 ?? "",
      "Costo Galper": d.costo_galper ?? "",
      ...(showEspecial ? { "Precio Especial": d.costo_especial ?? "" } : {}),
      "Lista General": d.costo_lista ?? "",
      "Costo Efectivo": d.costo_efectivo ?? "",
      "Fuente": d.fuente || "",
      "En Catálogo": d.en_catalogo ? "Sí" : "No",
      "Piezas en Inventario": d.stock_total ?? "",
      ...(showEspecial
        ? { "Precio si Galper": d.precio_si_galper ?? "", "Margen Descuento Disp.": d.descuento_disponible ?? "" }
        : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(out);
    ws["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costos");
    XLSX.writeFile(wb, `${exportName}${sufijo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportar = () => exportarRows(filtered);

  const ignoradosMarca = useMemo(() => {
    const codigosMarca = new Set(rows.map(r => r.codigo));
    return (ignorados as any[]).filter(i => codigosMarca.has(i.codigo_producto));
  }, [ignorados, rows]);

  const Th = ({ k, children, className }: { k: keyof ListaMarcaRow; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none ${className || ""}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </span>
    </TableHead>
  );

  const TriSelect = ({ label, value, onChange, si = "Con valor", no = "Vacío" }: { label: string; value: TriFiltro; onChange: (v: TriFiltro) => void; si?: string; no?: string }) => (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as TriFiltro)}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="si">{si}</SelectItem>
          <SelectItem value="no">{no}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <Input placeholder="Buscar por código o nombre…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs h-9" />
        <Button variant="outline" size="sm" onClick={exportar} disabled={filtered.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-1.5" />Exportar Excel
        </Button>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fuente</Label>
            <Select value={fFuente} onValueChange={setFFuente}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {fuentes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TriSelect label="En Catálogo" value={fCatalogo} onChange={setFCatalogo} si="Sí" no="No" />
          <TriSelect label="Existencia" value={fExistencia} onChange={setFExistencia} si="Con existencia" no="Sin existencia" />
          <TriSelect label="Costo Galper" value={fGalper} onChange={setFGalper} />
          {showEspecial && <TriSelect label="Precio Especial" value={fEspecial} onChange={setFEspecial} />}
          <TriSelect label="Lista General" value={fLista} onChange={setFLista} />
          <TriSelect label="Costo Efectivo" value={fEfectivo} onChange={setFEfectivo} />
          {showEspecial && <TriSelect label="Con Margen Descuento" value={fDescuento} onChange={setFDescuento} si="Con margen" no="Sin margen" />}
        </div>
        {seleccion.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
            <span className="text-sm font-medium">{seleccion.size} seleccionados</span>
            <Button size="sm" variant="outline" onClick={() => ignorarMut.mutate([...seleccion])} disabled={ignorarMut.isPending}>
              Ignorar seleccionados
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportarRows(filtered.filter(r => seleccion.has(r.codigo)), "_seleccion")}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />Exportar seleccionados a Excel
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>Limpiar selección</Button>
          </div>
        )}
      </CardContent>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 sticky left-0 z-20 bg-background">
                <Checkbox checked={todosSeleccionados} onCheckedChange={(v) => toggleTodos(!!v)} />
              </TableHead>
              <Th k="codigo" className="sticky left-10 z-20 bg-background min-w-[90px]">Código</Th>
              <Th k="nombre" className="sticky left-[130px] z-20 bg-background min-w-[180px] border-r">Nombre</Th>
              <Th k="presentacion">Presentación</Th>
              <Th k="clasificacion_abc">ABC</Th>
              <Th k="precio_uf1" className="text-right">Precio UF1</Th>
              {showEspecial && <Th k="precio_si_galper" className="text-right">Precio si Galper</Th>}
              {showEspecial && <Th k="descuento_disponible" className="text-right">Margen Descuento Disp.</Th>}
              <Th k="costo_galper" className="text-right">Costo Galper</Th>
              {showEspecial && <Th k="costo_especial" className="text-right">Precio Especial</Th>}
              <Th k="costo_lista" className="text-right">Lista General</Th>
              <Th k="costo_efectivo" className="text-right">Costo Efectivo</Th>
              <Th k="fuente">Fuente</Th>
              <Th k="en_catalogo">En Catálogo</Th>
              <Th k="stock_total" className="text-right">Piezas en Inventario</Th>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showEspecial ? 16 : 13} className="text-center text-muted-foreground py-8">Sin registros…</TableCell>
              </TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.codigo}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <Checkbox checked={seleccion.has(r.codigo)} onCheckedChange={(v) => toggleUno(r.codigo, !!v)} />
                </TableCell>
                <TableCell className="font-mono text-xs sticky left-10 z-10 bg-background min-w-[90px]">{r.codigo}</TableCell>
                <TableCell className="sticky left-[130px] z-10 bg-background min-w-[180px] border-r">{r.nombre}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.presentacion ?? "—"}</TableCell>
                <TableCell>{abcBadgeLista(r.clasificacion_abc)}</TableCell>
                <TableCell className="text-right">{money(r.precio_uf1)}</TableCell>
                {showEspecial && <TableCell className="text-right">{money(r.precio_si_galper)}</TableCell>}
                {showEspecial && (
                  <TableCell className={`text-right ${r.descuento_disponible != null ? "text-emerald-600 font-medium" : ""}`}>
                    {r.descuento_disponible == null ? "—" : money(r.descuento_disponible)}
                  </TableCell>
                )}
                <TableCell className="text-right">{money(r.costo_galper)}</TableCell>
                {showEspecial && <TableCell className="text-right">{money(r.costo_especial)}</TableCell>}
                <TableCell className="text-right">{money(r.costo_lista)}</TableCell>
                <TableCell className="text-right font-semibold">{money(r.costo_efectivo)}</TableCell>
                <TableCell>{fuenteBadgeLista(r.fuente)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={r.en_catalogo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}>
                    {r.en_catalogo ? "Sí" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{r.stock_total == null ? "—" : Number(r.stock_total).toLocaleString("es-MX")}</TableCell>
                <TableCell className="text-right">
                  {r.en_catalogo ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/inventory", {
                        state: {
                          prefillHuerfano: {
                            codigo: r.codigo,
                            nombre_producto: r.nombre,
                            unidad: null,
                            proveedor: null,
                          },
                        },
                      })}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Agregar al catálogo
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>

    <div>
      <Button variant="outline" size="sm" onClick={() => setMostrarIgnorados(v => !v)}>
        {mostrarIgnorados ? "Ocultar" : "Mostrar"} ignorados ({ignoradosMarca.length})
      </Button>
    </div>
    {mostrarIgnorados && (
      <Card>
        <CardHeader><CardTitle className="text-sm">Códigos ignorados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ignoradosMarca.map((ig: any, i: number) => (
                <TableRow key={ig.id || i}>
                  <TableCell className="font-mono text-xs">{ig.codigo_producto}</TableCell>
                  <TableCell className="text-xs">{ig.empresa || "—"}</TableCell>
                  <TableCell className="text-xs">{ig.ignorado_at ? new Date(ig.ignorado_at).toLocaleDateString("es-MX") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => quitarMut.mutate(ig.codigo_producto)} disabled={quitarMut.isPending}>
                      Quitar de ignorados
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ignoradosMarca.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin códigos ignorados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )}
    </div>
  );
}

// ─── HUÉRFANOS CON INVENTARIO ───────────────────────────────────
type HuerfanoInvRow = {
  codigo: string;
  nombre: string;
  empresa: string;
  stock_total: number;
  costo: number | null;
  fuenteCosto: "lista_precios" | "kardex" | "sin_costo";
  marcaSugerida: string | null;
  marcaId: string | null;
  sugerirIgnorar: boolean;
};

function useHuerfanosInventario() {
  return useQuery({
    queryKey: ["inv_huerfanos_inventario"],
    queryFn: async (): Promise<HuerfanoInvRow[]> => {
      const [nivelesRes, prodsRes, costosRes, marcasRes] = await Promise.all([
        (supabase as any).from("inv_niveles_inventario").select("codigo_producto, nombre_producto, empresa_vendedora, stock_total, costo_promedio").gt("stock_total", 0),
        supabase.from("productos").select("codigo"),
        (supabase as any).from("inv_costos_producto").select("codigo_producto, costo_efectivo").eq("estado", "sin_producto").order("created_at", { ascending: false }),
        supabase.from("product_option_values").select("id, value").eq("option_type", "marca"),
      ]);
      const codigosCatalogo = new Set((prodsRes.data || []).map((p: any) => p.codigo));
      const costoListaPorCodigo = new Map<string, any>();
      for (const c of (costosRes.data || []) as any[]) {
        if (!costoListaPorCodigo.has(c.codigo_producto)) costoListaPorCodigo.set(c.codigo_producto, c.costo_efectivo);
      }
      const marcaIdByValue = new Map<string, string>(((marcasRes.data || []) as any[]).map((m: any) => [m.value, m.id]));

      const inferirMarca = (empresa: string, nombre: string | null): string | null => {
        const n = (nombre || "").toLowerCase();
        if (empresa === "lumaggs") return "Chevron";
        if (/p\.?\s?66/.test(n)) return "Phillips 66";
        if (/\bgo\b/.test(n) || n.includes("gonher")) return "Gonher";
        if (/\bgw\b/.test(n)) return "Green World";
        if (n.includes("compass blue")) return "Compass Blue";
        return null;
      };
      const esProbableNoLubricante = (codigo: string, nombre: string | null): boolean => {
        const n = (nombre || "").toUpperCase();
        if (n.startsWith("PIEZA")) return true;
        if (/^NR/i.test(codigo)) return true;
        if (/^[0-9]+$/.test(codigo)) return true;
        return false;
      };

      return ((nivelesRes.data || []) as any[])
        .filter((n) => !codigosCatalogo.has(n.codigo_producto))
        .map((n) => {
          const costoLista = costoListaPorCodigo.get(n.codigo_producto);
          const costo = costoLista ?? n.costo_promedio ?? null;
          const fuenteCosto: HuerfanoInvRow["fuenteCosto"] = costoLista != null ? "lista_precios" : n.costo_promedio != null ? "kardex" : "sin_costo";
          const marcaSugerida = inferirMarca(n.empresa_vendedora, n.nombre_producto);
          return {
            codigo: n.codigo_producto,
            nombre: n.nombre_producto,
            empresa: n.empresa_vendedora,
            stock_total: Number(n.stock_total || 0),
            costo,
            fuenteCosto,
            marcaSugerida,
            marcaId: marcaSugerida ? marcaIdByValue.get(marcaSugerida) || null : null,
            sugerirIgnorar: esProbableNoLubricante(n.codigo_producto, n.nombre_producto),
          };
        });
    },
  });
}

function HuerfanosInventarioSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useHuerfanosInventario();
  const { data: ignorados = [] } = useCostosIgnorados();
  const [q, setQ] = useState("");
  const [fEmpresa, setFEmpresa] = useState("todas");
  const [fMarca, setFMarca] = useState("todas");
  const [fCosto, setFCosto] = useState<TriFiltro>("todos");
  const [fSugerido, setFSugerido] = useState<TriFiltro>("todos");
  const [sortKey, setSortKey] = useState<keyof HuerfanoInvRow>("codigo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);
  const [confirmAgregar, setConfirmAgregar] = useState<HuerfanoInvRow[] | null>(null);
  const [confirmIgnorar, setConfirmIgnorar] = useState<HuerfanoInvRow[] | null>(null);

  const ignoradosSet = useMemo(
    () => new Set((ignorados as any[]).map((i) => i.codigo_producto)),
    [ignorados],
  );

  const visibles = useMemo(() => rows.filter(r => !ignoradosSet.has(r.codigo)), [rows, ignoradosSet]);

  const marcasDisponibles = useMemo(
    () => Array.from(new Set(visibles.map(r => r.marcaSugerida).filter(Boolean) as string[])).sort(),
    [visibles],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = visibles;
    if (term) out = out.filter(r => r.codigo.toLowerCase().includes(term) || (r.nombre || "").toLowerCase().includes(term));
    out = out.filter(r => {
      if (fEmpresa !== "todas" && r.empresa !== fEmpresa) return false;
      if (fMarca === "sin_marca" && r.marcaSugerida !== null) return false;
      if (fMarca !== "todas" && fMarca !== "sin_marca" && r.marcaSugerida !== fMarca) return false;
      if (fCosto !== "todos" && (r.costo != null) !== (fCosto === "si")) return false;
      if (fSugerido !== "todos" && r.sugerirIgnorar !== (fSugerido === "si")) return false;
      return true;
    });
    return [...out].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [visibles, q, fEmpresa, fMarca, fCosto, fSugerido, sortKey, sortDir]);

  const toggleSort = (k: keyof HuerfanoInvRow) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const Th = ({ k, children, className }: { k: keyof HuerfanoInvRow; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none ${className || ""}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </span>
    </TableHead>
  );

  const todosSeleccionados = filtered.length > 0 && filtered.every(r => seleccion.has(r.codigo));
  const toggleTodos = (on: boolean) => {
    setSeleccion(prev => {
      const s = new Set(prev);
      filtered.forEach(r => (on ? s.add(r.codigo) : s.delete(r.codigo)));
      return s;
    });
  };
  const toggleUno = (codigo: string, on: boolean) => {
    setSeleccion(prev => {
      const s = new Set(prev);
      if (on) s.add(codigo); else s.delete(codigo);
      return s;
    });
  };

  const agregarMut = useMutation({
    mutationFn: async (seleccionados: HuerfanoInvRow[]) => {
      const { data: margins } = await (supabase as any)
        .from("producto_linea_margenes")
        .select("*")
        .is("linea_id", null)
        .maybeSingle();
      const mRec: Record<string, number> = {};
      for (const lvl of MARGIN_LEVELS) mRec[lvl.key] = Number(margins?.[lvl.key] ?? 0);
      const inserts = seleccionados.map((r) => {
        const costo = Number(r.costo || 0);
        const precios = costo > 0 ? computePricesFromCost(costo, mRec) : {};
        const preciosRedondeados: Record<string, number> = {};
        for (const [k, v] of Object.entries(precios)) preciosRedondeados[k] = ceilTo5(Number(v));
        return {
          codigo: r.codigo,
          nombre_producto: r.nombre,
          is_active: true,
          creado_automaticamente: true,
          marca_id: r.marcaId,
          costo_actual: costo,
          ...preciosRedondeados,
        };
      });
      const { error } = await (supabase as any).from("productos").insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} producto(s) agregado(s) al catálogo`);
      setSeleccion(new Set());
      setConfirmAgregar(null);
      qc.invalidateQueries({ queryKey: ["productos"] });
      qc.invalidateQueries({ queryKey: ["inv_huerfanos_inventario"] });
    },
    onError: (e: any) => { toast.error(e.message || "No se pudo agregar al catálogo"); setConfirmAgregar(null); },
  });

  const ignorarMut = useMutation({
    mutationFn: async (items: HuerfanoInvRow[]) => {
      const nuevos = items.filter(r => !ignoradosSet.has(r.codigo));
      if (nuevos.length === 0) return 0;
      const { error } = await (supabase as any)
        .from("inv_costos_producto_ignorados")
        .insert(nuevos.map(r => ({
          codigo_producto: r.codigo,
          empresa: r.empresa,
          motivo: "Ignorado desde Huérfanos con Inventario",
          ignorado_por: user?.id ?? null,
        })));
      if (error) throw error;
      return nuevos.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} código(s) ignorado(s)`);
      setSeleccion(new Set());
      setConfirmIgnorar(null);
      qc.invalidateQueries({ queryKey: ["inv_costos_producto_ignorados"] });
    },
    onError: (e: any) => { toast.error(e.message || "No se pudo ignorar"); setConfirmIgnorar(null); },
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
      qc.invalidateQueries({ queryKey: ["inv_costos_producto_ignorados"] });
    },
    onError: (e: any) => toast.error(e.message || "No se pudo quitar"),
  });

  const money = (n: number | null) => (n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  const ignoradosAqui = useMemo(() => {
    const codigosAqui = new Set(rows.map(r => r.codigo));
    return (ignorados as any[]).filter(i => codigosAqui.has(i.codigo_producto));
  }, [ignorados, rows]);

  const TriSelect = ({ label, value, onChange, si, no }: { label: string; value: TriFiltro; onChange: (v: TriFiltro) => void; si: string; no: string }) => (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as TriFiltro)}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="si">{si}</SelectItem>
          <SelectItem value="no">{no}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Huérfanos con Inventario</CardTitle>
            <p className="text-xs text-muted-foreground font-light mt-1">
              Códigos con existencia en el Kárdex que no tienen producto en el catálogo.
            </p>
          </div>
          <Input placeholder="Buscar por código o nombre…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs h-9" />
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Empresa</Label>
              <Select value={fEmpresa} onValueChange={setFEmpresa}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="lumaggs">Lumaggs</SelectItem>
                  <SelectItem value="galsa">Galsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Marca sugerida</Label>
              <Select value={fMarca} onValueChange={setFMarca}>
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {marcasDisponibles.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value="sin_marca">Sin marca detectada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TriSelect label="Costo" value={fCosto} onChange={setFCosto} si="Con costo" no="Sin costo" />
            <TriSelect label="Sugerido ignorar" value={fSugerido} onChange={setFSugerido} si="Sí" no="No" />
          </div>
          {seleccion.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
              <span className="text-sm font-medium">{seleccion.size} seleccionados</span>
              <Button size="sm" onClick={() => setConfirmAgregar(rows.filter(r => seleccion.has(r.codigo)))}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar al catálogo ({seleccion.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmIgnorar(rows.filter(r => seleccion.has(r.codigo)))}>
                Ignorar ({seleccion.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>Limpiar selección</Button>
            </div>
          )}
        </CardContent>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={todosSeleccionados} onCheckedChange={(v) => toggleTodos(!!v)} />
                  </TableHead>
                  <Th k="codigo">Código</Th>
                  <Th k="nombre">Nombre</Th>
                  <Th k="empresa">Empresa</Th>
                  <Th k="stock_total" className="text-right">Existencia</Th>
                  <Th k="costo" className="text-right">Costo</Th>
                  <TableHead>Marca sugerida</TableHead>
                  <TableHead>Ignorar sugerido</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin registros…</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.codigo}>
                    <TableCell>
                      <Checkbox checked={seleccion.has(r.codigo)} onCheckedChange={(v) => toggleUno(r.codigo, !!v)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                    <TableCell>{r.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.empresa === "lumaggs" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                        {r.empresa === "lumaggs" ? "Lumaggs" : "Galsa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(r.stock_total).toLocaleString("es-MX")}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        {money(r.costo)}
                        {r.fuenteCosto === "lista_precios" && <Badge variant="outline" className="text-[10px]">Lista</Badge>}
                        {r.fuenteCosto === "kardex" && <Badge variant="outline" className="text-[10px]">Kárdex</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.marcaSugerida ?? "—"}</TableCell>
                    <TableCell>
                      {r.sugerirIgnorar && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Sugerido</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setConfirmAgregar([r])} disabled={agregarMut.isPending}>
                          <Plus className="h-3 w-3 mr-1" /> Agregar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmIgnorar([r])} disabled={ignorarMut.isPending}>
                          Ignorar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button variant="outline" size="sm" onClick={() => setMostrarIgnorados(v => !v)}>
          {mostrarIgnorados ? "Ocultar" : "Mostrar"} ignorados ({ignoradosAqui.length})
        </Button>
      </div>
      {mostrarIgnorados && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Códigos ignorados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ignoradosAqui.map((ig: any, i: number) => (
                  <TableRow key={ig.id || i}>
                    <TableCell className="font-mono text-xs">{ig.codigo_producto}</TableCell>
                    <TableCell className="text-xs">{ig.empresa || "—"}</TableCell>
                    <TableCell className="text-xs">{ig.ignorado_at ? new Date(ig.ignorado_at).toLocaleDateString("es-MX") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => quitarMut.mutate(ig.codigo_producto)} disabled={quitarMut.isPending}>
                        Quitar de ignorados
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {ignoradosAqui.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin códigos ignorados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmAgregar} onOpenChange={(v) => !v && setConfirmAgregar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Agregar al catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán {confirmAgregar?.length ?? 0} producto(s) nuevos con su costo y precios calculados con los márgenes recomendados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAgregar && agregarMut.mutate(confirmAgregar)} disabled={agregarMut.isPending}>
              {agregarMut.isPending ? "Agregando…" : "Agregar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmIgnorar} onOpenChange={(v) => !v && setConfirmIgnorar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Ignorar códigos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se ignorarán {confirmIgnorar?.length ?? 0} código(s). Podrás revertirlo desde "Mostrar ignorados".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmIgnorar && ignorarMut.mutate(confirmIgnorar)} disabled={ignorarMut.isPending}>
              {ignorarMut.isPending ? "Ignorando…" : "Ignorar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
