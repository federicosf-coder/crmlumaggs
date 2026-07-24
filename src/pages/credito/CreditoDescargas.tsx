import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface DocItem { nombre_archivo: string; signed_url: string }

export default function CreditoDescargas() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [folio, setFolio] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("credito-portal", {
        body: { action: "cescemex_docs", token },
      });
      if (cancel) return;
      if (error || (data as any)?.error) {
        setError("Este enlace ya no está disponible");
      } else {
        setCompanyName((data as any).company_name || "");
        setFolio((data as any).folio || "");
        setDocs(((data as any).docs || []) as DocItem[]);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [token]);

  const downloadOne = async (d: DocItem) => {
    try {
      const res = await fetch(d.signed_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.nombre_archivo || "archivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      toast.error(`No se pudo descargar ${d.nombre_archivo}`);
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    for (const d of docs) {
      await downloadOne(d);
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando documentos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="bg-gradient-to-br from-violet-50 to-blue-50 border-b">
            <CardTitle className="text-base font-semibold tracking-tight">Enlace no disponible</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-sm text-muted-foreground font-light">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="bg-gradient-to-br from-violet-50 to-blue-50 border-b">
            <CardTitle className="text-base font-semibold tracking-tight">{companyName || "Documentos"}</CardTitle>
            {folio && (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono mt-1">
                Folio {folio}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-5 space-y-3 font-light">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {docs.length} {docs.length === 1 ? "documento disponible" : "documentos disponibles"}
              </p>
              <Button size="sm" onClick={downloadAll} disabled={downloadingAll || docs.length === 0}>
                {downloadingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Descargar todos
              </Button>
            </div>
            <div className="divide-y border rounded-md bg-white">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{d.nombre_archivo}</span>
                  </div>
                  <a href={d.signed_url} download={d.nombre_archivo}>
                    <Button size="sm" variant="outline">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar
                    </Button>
                  </a>
                </div>
              ))}
              {docs.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay documentos para mostrar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}