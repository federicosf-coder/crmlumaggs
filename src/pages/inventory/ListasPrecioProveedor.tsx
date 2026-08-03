import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProveedorPriceAccess } from "@/hooks/useProveedorPriceAccess";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, ShieldAlert, FileSpreadsheet } from "lucide-react";

const TIPOS_LISTA = [
  { value: "general", label: "General" },
  { value: "especial", label: "Especial" },
  { value: "contable", label: "Contable" },
];

const COSTO_COL: Record<string, string> = {
  general: "costo_lista_general",
  especial: "costo_lista_especial",
  contable: "costo_contable",
};

interface ParsedRow {
  codigo: string;
  nombre: string;
  clasificacion: string;
  empaque: string;
  costo: number;
  costoActual: number | null;
}

const norm = (v: any) => String(v ?? "").trim().toLowerCase();

function excelDateToISO(value: any): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    let [, a, b, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export default function ListasPrecioProveedor() {
  const { user } = useAuth();
  const { data: hasAccess, isLoading: loadingAccess } = useProveedorPriceAccess();
  const fileRef = useRef<HTMLInputElement>(null);

  const [marca, setMarca] = useState<string>("");
  const [tipoLista, setTipoLista] = useState<string>("general");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fechaVigencia, setFechaVigencia] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumen, setResumen] = useState<{ nuevas: number; actualizadas: number } | null>(null);

  const { data: marcas = [] } = useQuery({
    queryKey: ["proveedor_marcas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedor_marcas")
        .select("code, nombre")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const nuevas = rows.filter((r) => r.costoActual == null).length;
    const actualizadas = rows.filter(
      (r) => r.costoActual != null && Math.abs(r.costoActual - r.costo) > 0.0001
    ).length;
    return { nuevas, actualizadas, sinCambio: rows.length - nuevas - actualizadas };
  }, [rows]);

  const resetForm = () => {
    setFile(null);
    setRows([]);
    setFechaVigencia(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (f: File | null) => {
    setResumen(null);
    setFile(f);
    setRows([]);
    setFechaVigencia(null);
    if (!f) return;
    if (!marca) {
      toast.error("Selecciona primero la marca");
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
      return;
    }
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      let parsed: ParsedRow[] = [];
      let fecha: string | null = null;

      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const headerIdx = matrix.findIndex((row) =>
          row.some((c) => norm(c).includes("material id"))
        );
        if (headerIdx === -1) continue;

        const header = matrix[headerIdx].map((c) => norm(c));
        const findCol = (...needles: string[]) =>
          header.findIndex((h) => needles.some((n) => h.includes(n)));

        const cCodigo = findCol("material id", "materialid");
        const cNombre = findCol("material name", "material description");
        const cClas = findCol("prod hier 3", "prod hier3", "prod hier");
        const cEmpaque = findCol("pricing uom", "uom");
        const cCosto = findCol("proposed price", "price");
        const cFecha = findCol("valid from");

        for (let i = headerIdx + 1; i < matrix.length; i++) {
          const row = matrix[i];
          const codigo = String(row[cCodigo] ?? "").trim();
          const costo = Number(String(row[cCosto] ?? "").replace(/[$,\s]/g, ""));
          if (!codigo || !isFinite(costo) || costo <= 0) continue;
          if (!fecha && cFecha >= 0) fecha = excelDateToISO(row[cFecha]);
          parsed.push({
            codigo,
            nombre: String(row[cNombre] ?? "").trim(),
            clasificacion: cClas >= 0 ? String(row[cClas] ?? "").trim() : "",
            empaque: cEmpaque >= 0 ? String(row[cEmpaque] ?? "").trim() : "",
            costo,
            costoActual: null,
          });
        }
        if (parsed.length) break;
      }

      if (!parsed.length) {
        toast.error('No se encontraron filas. Verifica que el archivo tenga la columna "Material ID".');
        return;
      }

      // Deduplicar por código (última ocurrencia gana)
      const map = new Map<string, ParsedRow>();
      parsed.forEach((r) => map.set(r.codigo, r));
      parsed = Array.from(map.values());

      const costoCol = COSTO_COL[tipoLista];
      const { data: existentes, error } = await supabase
        .from("proveedor_price_items")
        .select(`codigo_proveedor, ${costoCol}`)
        .eq("marca", marca)
        .in("codigo_proveedor", parsed.map((r) => r.codigo));
      if (error) throw error;
      const actuales = new Map<string, number | null>();
      (existentes as any[] ?? []).forEach((e) => actuales.set(e.codigo_proveedor, e[costoCol]));

      parsed = parsed.map((r) => ({
        ...r,
        costoActual: actuales.has(r.codigo) ? (actuales.get(r.codigo) ?? null) : null,
      }));

      setRows(parsed);
      setFechaVigencia(fecha);
      toast.success(`${parsed.length} filas leídas`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al leer el archivo: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleGuardar = async () => {
    if (!file || !rows.length || !marca) return;
    setSaving(true);
    setProgress(0);
    setResumen(null);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `${marca}/${tipoLista}/${timestamp}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("proveedor-price-lists")
        .upload(storagePath, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: upload, error: insErr } = await supabase
        .from("proveedor_price_uploads")
        .insert({
          marca,
          tipo_lista: tipoLista,
          fecha_vigencia: fechaVigencia,
          nombre_archivo: file.name,
          storage_path: storagePath,
          subido_por: user?.id ?? null,
          total_filas_procesadas: rows.length,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const nuevas = stats.nuevas;
      const actualizadas = stats.actualizadas;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const { error } = await supabase.rpc("upsert_proveedor_price_row", {
          _marca: marca,
          _codigo_proveedor: r.codigo,
          _producto_nombre: r.nombre,
          _empaque: r.empaque,
          _clasificacion_proveedor: r.clasificacion,
          _tipo_lista: tipoLista,
          _costo: r.costo,
          _fecha_vigencia: fechaVigencia ?? new Date().toISOString().slice(0, 10),
          _upload_id: upload.id,
        });
        if (error) throw error;
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      setResumen({ nuevas, actualizadas });
      toast.success(`${nuevas} filas nuevas, ${actualizadas} actualizadas`);
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingAccess) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando acceso…</div>;
  }

  if (!hasAccess) {
    return (
      <div className="p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Sin acceso</p>
            <p className="text-sm text-muted-foreground">
              No tienes permiso para consultar las listas de precios de proveedor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Listas de Precios de Proveedor</h1>
        <p className="text-sm text-muted-foreground">
          Carga de listas de costos por marca y tipo de lista.
        </p>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-lg">
          <CardTitle className="text-sm uppercase tracking-wide font-medium">Nueva carga</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="uppercase text-xs tracking-wide">Marca</Label>
            <Select value={marca} onValueChange={(v) => { setMarca(v); resetForm(); }} disabled={saving}>
              <SelectTrigger><SelectValue placeholder="Selecciona marca" /></SelectTrigger>
              <SelectContent>
                {marcas.map((m: any) => (
                  <SelectItem key={m.code} value={m.code}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="uppercase text-xs tracking-wide">Tipo de lista</Label>
            <Select value={tipoLista} onValueChange={(v) => { setTipoLista(v); resetForm(); }} disabled={saving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_LISTA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="uppercase text-xs tracking-wide">Archivo (.xlsx)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={saving || parsing || !marca}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </CardContent>
      </Card>

      {parsing && <p className="text-sm text-muted-foreground">Leyendo archivo…</p>}

      {resumen && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="font-medium">Carga completada:</span>{" "}
            {resumen.nuevas} filas nuevas, {resumen.actualizadas} actualizadas.
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-lg flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-4 w-4" />
              <CardTitle className="text-sm uppercase tracking-wide font-medium">
                Previsualización ({rows.length} filas)
              </CardTitle>
              <Badge variant="outline">Vigencia: {fechaVigencia ?? "s/f"}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{stats.nuevas} nuevas</Badge>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{stats.actualizadas} cambian</Badge>
            </div>
            <Button onClick={handleGuardar} disabled={saving}>
              <Upload className="h-4 w-4 mr-2" />
              {saving ? "Guardando…" : "Confirmar y guardar"}
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {saving && <Progress value={progress} />}
            <div className="max-h-[520px] overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableRow>
                    <TableHead className="uppercase text-xs tracking-wide">Código</TableHead>
                    <TableHead className="uppercase text-xs tracking-wide">Nombre</TableHead>
                    <TableHead className="uppercase text-xs tracking-wide">Clasificación</TableHead>
                    <TableHead className="uppercase text-xs tracking-wide text-right">Costo nuevo</TableHead>
                    <TableHead className="uppercase text-xs tracking-wide text-right">Costo actual</TableHead>
                    <TableHead className="uppercase text-xs tracking-wide text-right">Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const esNueva = r.costoActual == null;
                    const dif = esNueva ? null : r.costo - (r.costoActual ?? 0);
                    const cambia = dif != null && Math.abs(dif) > 0.0001;
                    return (
                      <TableRow
                        key={r.codigo}
                        className={esNueva ? "bg-emerald-50/70" : cambia ? "bg-amber-50/70" : undefined}
                      >
                        <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                        <TableCell className="text-sm font-light">{r.nombre}</TableCell>
                        <TableCell className="text-sm font-light">{r.clasificacion}</TableCell>
                        <TableCell className="text-right tabular-nums">${r.costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.costoActual == null ? "—" : `$${r.costoActual.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dif == null ? "—" : `${dif > 0 ? "+" : ""}${dif.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
