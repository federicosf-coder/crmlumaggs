import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Download } from "lucide-react";
import { FORMATO_BUCKET, FORMATO_PREFIX, getFormatoBlanco, descargarFormatoBlanco } from "@/lib/creditoFormatoBlanco";

export function FormatoBlancoAdmin() {
  const [actual, setActual] = useState<{ path: string; updated_at?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const load = async () => setActual(await getFormatoBlanco());
  useEffect(() => { load(); }, []);

  const subir = async (file: File) => {
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    if (!["pdf", "xlsx", "xls", "docx", "doc"].includes(ext)) { toast.error("Formato no permitido (PDF, Excel o Word)"); return; }
    setBusy(true);
    const nuevo = `${FORMATO_PREFIX}.${ext}`;
    const { error } = await supabase.storage.from(FORMATO_BUCKET).upload(nuevo, file, { upsert: true, contentType: file.type || undefined });
    if (!error && actual && actual.path !== nuevo) await supabase.storage.from(FORMATO_BUCKET).remove([actual.path]);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Formato actualizado");
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Formato en blanco para llenar a mano</CardTitle></CardHeader>
      <CardContent className="space-y-3 font-light">
        <p className="text-sm text-muted-foreground">
          Este archivo se descarga con el botón «Descargar formato en blanco» en la solicitud y en el portal del cliente.
          Súbelo de nuevo cuando cambien las políticas; reemplaza al anterior.
        </p>
        <div className="text-sm">
          Actual: <span className="font-medium">{actual ? actual.path : "sin archivo"}</span>
          {actual?.updated_at && <span className="text-muted-foreground"> · {new Date(actual.updated_at).toLocaleString("es-MX")}</span>}
        </div>
        <div className="flex gap-2">
          <input ref={ref} type="file" hidden accept=".pdf,.xlsx,.xls,.docx,.doc"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />
          <Button onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Subir nuevo formato
          </Button>
          <Button variant="outline" onClick={() => descargarFormatoBlanco()} disabled={!actual}>
            <Download className="h-4 w-4 mr-2" />Descargar actual
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
