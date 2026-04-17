import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileUp, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/importNoloco/parseCsv";
import { resolvePlazas, PlazaCsvRow } from "@/lib/importNoloco/resolvePlazas";
import { resolveEjecutivos, EjecutivoCsvRow } from "@/lib/importNoloco/resolveEjecutivos";
import { importDocumentos, ImportDocsLog } from "@/lib/importNoloco/importDocumentos";

interface FullLog {
  plazas: Awaited<ReturnType<typeof resolvePlazas>>["log"];
  ejecutivos: Awaited<ReturnType<typeof resolveEjecutivos>>["log"];
  documentos: ImportDocsLog;
  duracion_ms: number;
}

export default function ImportNoloco() {
  const { roles, loading } = useAuth();
  const [plazasFile, setPlazasFile] = useState<File | null>(null);
  const [ejecutivosFile, setEjecutivosFile] = useState<File | null>(null);
  const [docsFile, setDocsFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [fullLog, setFullLog] = useState<FullLog | null>(null);

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>;
  if (!roles.includes("admin")) return <Navigate to="/" replace />;

  const run = async () => {
    if (!plazasFile || !ejecutivosFile || !docsFile) {
      toast.error("Carga los 3 archivos CSV");
      return;
    }
    setRunning(true);
    setFullLog(null);
    const start = Date.now();

    try {
      // Leer
      setPhase("Leyendo archivos...");
      const [plazasText, ejecutivosText, docsText] = await Promise.all([
        plazasFile.text(), ejecutivosFile.text(), docsFile.text(),
      ]);
      const plazasRows = parseCsv(plazasText) as unknown as PlazaCsvRow[];
      const ejecutivosRows = parseCsv(ejecutivosText) as unknown as EjecutivoCsvRow[];
      const docsRows = parseCsv(docsText);

      // Plazas
      setPhase(`Resolviendo plazas (${plazasRows.length})...`);
      const plazasResult = await resolvePlazas(plazasRows);
      toast.success(`Plazas: ${plazasResult.log.encontradas.length} OK, ${plazasResult.log.creadas.length} creadas, ${plazasResult.log.ajustadas.length} ajustadas`);

      // Ejecutivos
      setPhase(`Resolviendo ejecutivos (${ejecutivosRows.length})...`);
      const ejecResult = await resolveEjecutivos(ejecutivosRows);
      toast.success(`Ejecutivos: ${ejecResult.log.encontradas.length} OK, ${ejecResult.log.creadas.length} creados, ${ejecResult.log.ajustadas.length} ajustados`);

      // Documentos
      setPhase(`Importando documentos (${docsRows.length})...`);
      setProgress({ done: 0, total: docsRows.length });
      const docsLog = await importDocumentos({
        rows: docsRows,
        plazaMap: plazasResult.mapping,
        ejecutivoMap: ejecResult.mapping,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      const log: FullLog = {
        plazas: plazasResult.log,
        ejecutivos: ejecResult.log,
        documentos: docsLog,
        duracion_ms: Date.now() - start,
      };
      setFullLog(log);
      setPhase("Completado");
      toast.success(`Importación completa: ${docsLog.insertados} insertados, ${docsLog.actualizados} actualizados`);
    } catch (err: any) {
      toast.error(`Error: ${err?.message || err}`);
      setPhase(`Error: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  const downloadJson = () => {
    if (!fullLog) return;
    const blob = new Blob([JSON.stringify(fullLog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-noloco-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadIncidenciasCsv = () => {
    if (!fullLog) return;
    const lines = ["fila,numero,tipo,detalle"];
    fullLog.documentos.omitidos_empresa_invalida.forEach((e) => {
      lines.push(`${e.row},"${e.numero}",empresa_invalida,"${e.empresa_id}"`);
    });
    fullLog.documentos.errores.forEach((e) => {
      lines.push(`${e.row},"${e.numero}",error,"${e.error.replace(/"/g, '""')}"`);
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-noloco-incidencias.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar histórico Noloco</h1>
        <p className="text-muted-foreground">Sube los 3 archivos CSV. Resuelve plazas, ejecutivos y documentos sin duplicados.</p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Antes de ejecutar</AlertTitle>
        <AlertDescription>
          Esta operación creará y actualizará registros en producción. Asegúrate de que los CSV son los correctos.
          Los ejecutivos creados quedarán como profiles sin auth (no podrán iniciar sesión hasta vincularlos a un usuario real).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Archivos</CardTitle>
          <CardDescription>CSV con encabezados estándar del export de Noloco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileSlot label="plazas_detectadas_para_alta.csv" file={plazasFile} onChange={setPlazasFile} />
          <FileSlot label="ejecutivos_detectados_para_alta.csv" file={ejecutivosFile} onChange={setEjecutivosFile} />
          <FileSlot label="documentos_noloco_transformado_*.csv" file={docsFile} onChange={setDocsFile} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={run} disabled={running || !plazasFile || !ejecutivosFile || !docsFile}>
          <Play className="h-4 w-4 mr-2" /> {running ? "Procesando..." : "Ejecutar importación"}
        </Button>
        {fullLog && (
          <>
            <Button variant="outline" onClick={downloadJson}><Download className="h-4 w-4 mr-2" /> Log JSON</Button>
            <Button variant="outline" onClick={downloadIncidenciasCsv}><Download className="h-4 w-4 mr-2" /> Incidencias CSV</Button>
          </>
        )}
      </div>

      {(running || phase) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Progreso</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{phase}</p>
            {progress.total > 0 && (
              <>
                <Progress value={(progress.done / progress.total) * 100} />
                <p className="text-xs text-muted-foreground">{progress.done} / {progress.total}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {fullLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
            <CardDescription>Duración: {(fullLog.duracion_ms / 1000).toFixed(1)}s</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Section title="Plazas">
              <Stat label="Encontradas" v={fullLog.plazas.encontradas.length} />
              <Stat label="Creadas" v={fullLog.plazas.creadas.length} />
              <Stat label="Ajustadas" v={fullLog.plazas.ajustadas.length} />
            </Section>
            <Section title="Ejecutivos">
              <Stat label="Encontrados" v={fullLog.ejecutivos.encontradas.length} />
              <Stat label="Creados" v={fullLog.ejecutivos.creadas.length} />
              <Stat label="Ajustados" v={fullLog.ejecutivos.ajustadas.length} />
              <Stat label="Roles agregados" v={fullLog.ejecutivos.roles_agregados.length} />
            </Section>
            <Section title="Documentos">
              <Stat label="Insertados" v={fullLog.documentos.insertados} />
              <Stat label="Actualizados" v={fullLog.documentos.actualizados} />
              <Stat label="Empresa inválida" v={fullLog.documentos.omitidos_empresa_invalida.length} />
              <Stat label="Errores" v={fullLog.documentos.errores.length} />
            </Section>
            <Section title="Relaciones">
              <Stat label="company_ejecutivos" v={fullLog.documentos.relaciones.company_ejecutivos_creadas} />
              <Stat label="company_plazas" v={fullLog.documentos.relaciones.company_plazas_creadas} />
            </Section>

            {fullLog.documentos.errores.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Errores (primeros 50)</h4>
                <ScrollArea className="h-48 rounded border bg-muted/40">
                  <div className="p-3 space-y-1">
                    {fullLog.documentos.errores.slice(0, 50).map((e, i) => (
                      <p key={i} className="text-xs"><span className="text-muted-foreground">Fila {e.row} ({e.numero}):</span> <span className="text-destructive">{e.error}</span></p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FileSlot({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-input file:bg-background file:text-sm file:cursor-pointer"
          />
          {file && <span className="text-xs text-muted-foreground"><FileUp className="h-3 w-3 inline mr-1" />{(file.size / 1024).toFixed(1)} KB</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-2">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border p-2 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{v}</p>
    </div>
  );
}
