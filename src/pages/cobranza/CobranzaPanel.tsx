import { useEffect, useRef, useState } from "react";
import { useModuleAccess } from "@/hooks/useModuleAccess";

const CobranzaPanel = () => {
  const access = useModuleAccess("cobranza");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<string>("calc(100vh - 4rem)");

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; h?: unknown } | null;
      if (!data || data.type !== "cobranza-height" || !Number.isFinite(data.h as number)) return;
      setHeight(`${Math.ceil(data.h as number) + 8}px`);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (access.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!access.canView) {
    return <p className="p-6 text-sm text-muted-foreground">No tienes acceso a este módulo</p>;
  }

  return (
    <div className="w-full">
      <iframe
        ref={iframeRef}
        src="/cobranza.html"
        title="Panel de Cobranza"
        className="w-full border-0 block"
        style={{ height }}
      />
    </div>
  );
};

export default CobranzaPanel;
