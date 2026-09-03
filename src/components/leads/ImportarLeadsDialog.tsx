import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const SOURCE_ID = "7d615fa2-be2a-4e13-bcc3-e49452b7865e";

type Destino = "nombre" | "empresa_nombre" | "telefono" | "email" | "mensaje" | "ignorar";

const DESTINOS: { value: Destino; label: string }[] = [
  { value: "nombre", label: "Nombre" },
  { value: "empresa_nombre", label: "Empresa" },
  { value: "telefono", label: "Teléfono" },
  { value: "email", label: "Correo" },
  { value: "mensaje", label: "Mensaje" },
  { value: "ignorar", label: "Ignorar" },
];

const norm = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function autoMap(header: string): Destino {
  const h = norm(header);
  if (!h) return "ignorar";
  const has = (...keys: string[]) => keys.some((k) => h.includes(k));
  if (has("correo", "mail", "email")) return "email";
  if (has("telefono", "tel", "celular", "movil", "whatsapp", "phone")) return "telefono";
  if (has("empresa", "compania", "negocio", "company", "razonsocial", "cliente")) return "empresa_nombre";
  if (has("mensaje", "comentario", "nota", "message", "observ")) return "mensaje";
  if (has("nombre", "contacto", "name")) return "nombre";
  return "ignorar";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportarLeadsDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Destino[]>([]);
  const [importando, setImportando] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFileName(null); setHeaders([]); setRows([]); setMapeo([]); setDragOver(false);
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
      if (!matrix.length) { toast.error("El archivo está vacío"); return; }
      const hdr = (matrix[0] as any[]).map((c) => String(c ?? "").trim());
      const body = (matrix.slice(1) as any[][]).map((r) => hdr.map((_, i) => String(r?.[i] ?? "").trim()));
      setFileName(file.name);
      setHeaders(hdr);
      setRows(body.filter((r) => r.some((c) => c !== "")));
      setMapeo(hdr.map(autoMap));
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer el archivo");
    }
  };

  const mapRow = (r: string[]) => {
    const out: Record<string, string | null> = {
      nombre: null, empresa_nombre: null, telefono: null, email: null, mensaje: null,
    };
    mapeo.forEach((d, i) => {
      if (d === "ignorar") return;
      const v = (r[i] ?? "").trim();
      if (v) out[d] = v;
    });
    return out;
  };

  const mapeadas = useMemo(() => rows.map(mapRow), [rows, mapeo]);
  const validas = useMemo(
    () => mapeadas.filter((m) => m.nombre || m.empresa_nombre || m.telefono),
    [mapeadas]
  );
  const excluidas = mapeadas.length - validas.length;

  const importar = async () => {
    if (!validas.length) return;
    setImportando(true);
    try {
      const payloadRows = rows
        .map((r, i) => ({ m: mapeadas[i], original: Object.fromEntries(headers.map((h, j) => [h || `col_${j + 1}`, r[j] ?? ""])) }))
        .filter(({ m }) => m.nombre || m.empresa_nombre || m.telefono)
        .map(({ m, original }) => ({
          source_id: SOURCE_ID,
          estatus: "nuevo",
          nombre: m.nombre ?? m.empresa_nombre ?? m.telefono ?? "Sin nombre",
          empresa_nombre: m.empresa_nombre,
          telefono: m.telefono,
          email: m.email,
          mensaje: m.mensaje,
          payload: original,
        }));

      const { error } = await (supabase as any).from("leads").insert(payloadRows);
      if (error) throw error;
      toast.success(`${payloadRows.length} prospectos importados`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-pending-count"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al importar");
    } finally {
      setImportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="font-light">Importar lista de prospectos</DialogTitle>
          <DialogDescription className="text-xs">
            Carga un archivo .xlsx o .csv, revisa el mapeo de columnas y confirma la importación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!headers.length ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/40"
              }`}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm">Arrastra el archivo aquí o haz clic para seleccionarlo</p>
              <p className="text-[11px] text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span>{fileName}</span>
                  <span className="text-muted-foreground text-xs">({rows.length} filas)</span>
                </div>
                <Button size="sm" variant="ghost" onClick={reset}><X className="h-4 w-4" /></Button>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Mapeo de columnas</p>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                        <TableHead className="text-[11px] uppercase tracking-wide">Columna del archivo</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide">Ejemplo</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide w-[200px]">Campo destino</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {headers.map((h, i) => (
                        <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                          <TableCell className="text-sm">{h || `Columna ${i + 1}`}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[220px]">{rows[0]?.[i] ?? ""}</TableCell>
                          <TableCell>
                            <Select
                              value={mapeo[i] ?? "ignorar"}
                              onValueChange={(v) => setMapeo((prev) => prev.map((d, j) => (j === i ? (v as Destino) : d)))}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DESTINOS.map((d) => (
                                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Vista previa (primeras 10 filas)</p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                        <TableHead className="text-[11px] uppercase tracking-wide">Nombre</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide">Empresa</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide">Teléfono</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide">Correo</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wide">Mensaje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mapeadas.slice(0, 10).map((m, i) => (
                        <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                          <TableCell className="text-xs">{m.nombre ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.empresa_nombre ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.telefono ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.email ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate">{m.mensaje ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {excluidas > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    {excluidas} fila(s) se excluirán por no tener nombre, empresa ni teléfono.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/40">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={importar} disabled={!validas.length || importando}>
            {importando ? "Importando..." : `Importar ${validas.length} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
