import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImportExportField {
  key: string;
  label: string;
  /** Whether this field is importable (true) or calculated/referenced (false). Default true. */
  importable?: boolean;
}

interface ImportExportMenuProps {
  /** Supabase table name */
  table: string;
  /** Fields to export/import (order matters for CSV columns) */
  fields: ImportExportField[];
  /** Key used for upsert matching (e.g. "email", "name") */
  upsertKey: string;
  /** Label for display */
  entityLabel: string;
  /** Current data to export */
  data: Record<string, any>[];
  /** Called after successful import */
  onImported: () => void;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export function ImportExportMenu({
  table,
  fields,
  upsertKey,
  entityLabel,
  data,
  onImported,
}: ImportExportMenuProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState({ created: 0, updated: 0, errors: 0, errorDetails: [] as string[] });
  const [importing, setImporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"importable" | "all">("importable");

  const importableCount = fields.filter(f => f.importable !== false).length;

  const runExport = () => {
    if (data.length === 0) { toast.info("No hay registros para exportar"); setExportOpen(false); return; }
    const chosen = exportMode === "importable" ? fields.filter(f => f.importable !== false) : fields;
    if (chosen.length === 0) { toast.error("No hay campos disponibles"); return; }
    const headerRow = chosen.map(f => f.label).join(",");
    const rows = data.map(d =>
      chosen.map(f => {
        const val = d[f.key];
        if (val === null || val === undefined) return "";
        const str = Array.isArray(val) ? val.join("; ") : String(val);
        return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const csv = [headerRow, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}_${exportMode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} registros exportados`);
    setExportOpen(false);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      toast.error("El archivo está vacío o no tiene formato válido");
      setImporting(false);
      return;
    }

    // Build label-to-key map
    const labelToKey: Record<string, string> = {};
    fields.forEach(f => { labelToKey[f.label] = f.key; labelToKey[f.key] = f.key; });

    let created = 0, updated = 0, errors = 0;
    const errorDetails: string[] = [];

    // Fetch existing records by upsert key for matching
    const { data: existing } = await (supabase.from as any)(table)
      .select("id, " + upsertKey);
    const existingMap = new Map<string, string>();
    (existing || []).forEach((r: any) => {
      if (r[upsertKey]) existingMap.set(String(r[upsertKey]).toLowerCase().trim(), r.id);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, any> = {};

      // Map CSV columns to DB keys
      Object.entries(row).forEach(([col, val]) => {
        const dbKey = labelToKey[col];
        if (dbKey && val) record[dbKey] = val;
      });

      const matchVal = record[upsertKey];
      if (!matchVal) {
        errors++;
        errorDetails.push(`Fila ${i + 2}: campo "${upsertKey}" vacío`);
        continue;
      }

      const existingId = existingMap.get(String(matchVal).toLowerCase().trim());

      try {
        if (existingId) {
          // Update
          const { error } = await (supabase.from as any)(table)
            .update(record)
            .eq("id", existingId);
          if (error) throw error;
          updated++;
        } else {
          // Insert
          const { error } = await (supabase.from as any)(table)
            .insert(record);
          if (error) throw error;
          created++;
        }
      } catch (err: any) {
        errors++;
        errorDetails.push(`Fila ${i + 2}: ${err.message || "Error desconocido"}`);
      }
    }

    setSummary({ created, updated, errors, errorDetails });
    setSummaryOpen(true);
    setImporting(false);
    onImported();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={importing}>
        <Download className="h-4 w-4 mr-1" /> Exportar
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
      >
        <Upload className="h-4 w-4 mr-1" /> {importing ? "Importando..." : "Importar"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar {entityLabel} a CSV</DialogTitle>
            <DialogDescription>Elige qué campos quieres incluir en el archivo.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={exportMode} onValueChange={(v) => setExportMode(v as any)} className="space-y-2 py-2">
            <label htmlFor="exp-imp" className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted">
              <RadioGroupItem value="importable" id="exp-imp" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="exp-imp" className="font-medium cursor-pointer">Solo campos importables</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Excluye campos calculados o referenciados. Útil para reimportar ({importableCount} campos)
                </p>
              </div>
            </label>
            <label htmlFor="exp-all" className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted">
              <RadioGroupItem value="all" id="exp-all" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="exp-all" className="font-medium cursor-pointer">Todos los campos</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Incluye todos los campos disponibles ({fields.length} campos)
                </p>
              </div>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={runExport}>Exportar CSV</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumen de importación — {entityLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm">✅ <strong>{summary.created}</strong> registros creados</p>
            <p className="text-sm">🔄 <strong>{summary.updated}</strong> registros actualizados</p>
            {summary.errors > 0 && (
              <>
                <p className="text-sm text-destructive">❌ <strong>{summary.errors}</strong> errores</p>
                <div className="max-h-32 overflow-y-auto bg-muted rounded p-2">
                  {summary.errorDetails.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setSummaryOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
