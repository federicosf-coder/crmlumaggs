import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useModuleAccess } from "@/hooks/useModuleAccess";

const CobranzaPanel = () => {
  const access = useModuleAccess("cobranza");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [marca, setMarca] = useState<"lumaggs" | "galsa">("lumaggs");
  const [height, setHeight] = useState<string>("calc(100vh - 8rem)");

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

  const cambiarMarca = (nueva: "lumaggs" | "galsa") => {
    setMarca(nueva);
    setHeight("calc(100vh - 8rem)");
  };

  if (access.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!access.canView) {
    return <p className="p-6 text-sm text-muted-foreground">No tienes acceso a este módulo</p>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 p-4">
        <Button
          variant={marca === "lumaggs" ? "default" : "outline"}
          className={marca === "lumaggs" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-600 text-blue-600"}
          onClick={() => cambiarMarca("lumaggs")}
        >
          Lumaggs
        </Button>
        <Button
          variant={marca === "galsa" ? "default" : "outline"}
          className={marca === "galsa" ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-600 text-red-600"}
          onClick={() => cambiarMarca("galsa")}
        >
          Galsa
        </Button>
      </div>
      <iframe
        key={marca}
        ref={iframeRef}
        src={`/cobranza.html?marca=${marca}`}
        title="Panel de Cobranza"
        className="w-full border-0 block"
        style={{ height }}
      />
    </div>
  );
};

export default CobranzaPanel;
