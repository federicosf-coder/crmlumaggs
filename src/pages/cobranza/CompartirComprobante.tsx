import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/PageBanner";
import { supabase } from "@/integrations/supabase/client";
import { Share2, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const CACHE_NAME = "share-target-cache-v1";

type Estado = "cargando" | "sin-archivo" | "subiendo" | "ok" | "error-token" | "error";

export default function CompartirComprobante() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [detalle, setDetalle] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const iniciado = useRef(false);

  const subir = useCallback(async (file: File) => {
    setEstado("subiendo");
    setDetalle("");
    try {
      const { data: token, error: rpcError } = await supabase.rpc("get_or_create_upload_token", {
        _regenerate: false,
      });
      if (rpcError || !token) {
        setEstado("error-token");
        return;
      }

      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("token", String(token));
      fd.append("canal", "android_share");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intake-comprobante`, {
        method: "POST",
        body: fd,
      });

      if (res.status === 401) {
        setEstado("error-token");
        return;
      }

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          msg = (await res.text()) || msg;
        } catch { /* noop */ }
        setDetalle(msg);
        setEstado("error");
        return;
      }

      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete("shared-file");
        await cache.delete("shared-file-meta");
      } catch { /* noop */ }

      setEstado("ok");
    } catch (e: any) {
      setDetalle(e?.message || "Error desconocido");
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    (async () => {
      try {
        if (!("caches" in window)) {
          setEstado("sin-archivo");
          return;
        }
        const cache = await caches.open(CACHE_NAME);
        const fileRes = await cache.match("shared-file");
        const metaRes = await cache.match("shared-file-meta");
        if (!fileRes || !metaRes) {
          setEstado("sin-archivo");
          return;
        }
        const meta = await metaRes.json();
        const blob = await fileRes.blob();
        const file = new File([blob], meta?.name || "comprobante", {
          type: meta?.type || blob.type || "application/octet-stream",
        });
        fileRef.current = file;
        setFileName(file.name);
        setFileType(file.type);
        if (file.type.startsWith("image/")) {
          setPreviewUrl(URL.createObjectURL(file));
        }
        await subir(file);
      } catch {
        setEstado("sin-archivo");
      }
    })();
  }, [subir]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="space-y-6">
      <PageBanner
        title="Compartir comprobante"
        description="Recibe comprobantes de pago compartidos desde tu celular"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Share2 className="h-5 w-5" />
          </div>
        }
      />

      <Card className="max-w-xl mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          {(fileName || previewUrl) && estado !== "sin-archivo" && (
            <div className="flex flex-col items-center gap-2">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Vista previa del comprobante ${fileName}`}
                  className="max-h-64 rounded-md border object-contain"
                />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground break-all">
                {fileName} {fileType ? `(${fileType})` : ""}
              </p>
            </div>
          )}

          {estado === "cargando" && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Leyendo archivo compartido...</p>
            </div>
          )}

          {estado === "sin-archivo" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                No se encontró ningún archivo compartido. Vuelve a intentar compartir la imagen o PDF
                desde tu galería o WhatsApp.
              </p>
              <Button onClick={() => navigate("/cobranza")}>Ir a Cobranza</Button>
            </div>
          )}

          {estado === "subiendo" && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Subiendo comprobante...</p>
            </div>
          )}

          {estado === "ok" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="font-medium">
                ¡Comprobante recibido! Ya está en tu bandeja de Cobranza para clasificarlo.
              </p>
              <Button onClick={() => navigate("/cobranza")}>Ir a Cobranza</Button>
            </div>
          )}

          {estado === "error-token" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-muted-foreground">
                No se pudo identificar tu usuario. Inicia sesión y vuelve a intentar compartir.
              </p>
              <Button onClick={() => navigate("/auth")}>Iniciar sesión</Button>
            </div>
          )}

          {estado === "error" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-muted-foreground">No se pudo subir el comprobante.</p>
              {detalle && <p className="text-xs text-muted-foreground break-all">{detalle}</p>}
              <div className="flex gap-2">
                <Button onClick={() => fileRef.current && subir(fileRef.current)}>Reintentar</Button>
                <Button variant="outline" onClick={() => navigate("/cobranza")}>
                  Ir a Cobranza
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
