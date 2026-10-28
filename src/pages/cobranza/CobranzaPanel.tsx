import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FunctionsHttpError } from "@supabase/supabase-js";

const CobranzaPanel = () => {
  const access = useModuleAccess("cobranza");
  const { roles, loading: authLoading } = useAuth();
  const puedeOperar = roles.some((role) => ["admin", "master", "accounting"].includes(role)) || access.accessLevel === "todos";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [marca, setMarca] = useState<"lumaggs" | "galsa">("lumaggs");
  const [height, setHeight] = useState<string>("calc(100vh - 8rem)");

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;
      const source = iframeRef.current?.contentWindow;
      const responder = (payload: unknown) => {
        if (source && source === iframeRef.current?.contentWindow) {
          source.postMessage(payload, window.location.origin);
        }
      };

      const resolverEjecutivos = async () => {
        const { data: resolved, error } = await (supabase as any).rpc("cobranza_resolver_ejecutivos", {
          _nombres: data.nombres,
        });
        if (error) {
          console.error(error);
          return;
        }
        if (Array.isArray(resolved)) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "cobranza-ejecutivos", items: resolved },
            window.location.origin
          );
        }
      };

      if (data.type === "cobranza-height" && Number.isFinite(data.h as number)) {
        setHeight(`${Math.ceil(data.h as number) + 8}px`);
        return;
      }
      if (data.type === "cobranza-agentes" && Array.isArray(data.nombres)) {
        void resolverEjecutivos();
        return;
      }
      const procesar = async () => {
        const responseType = `${data.type}-res`;
        try {
          if (data.marca !== marca || !access.canView) throw new Error("Solicitud sin acceso o marca inválida");
          if (data.type === "cobranza-listo") {
            const [facturas, estado] = await Promise.all([
              (supabase as any).rpc("cobranza_leer_facturas", { _marca: data.marca }),
              (supabase as any).rpc("cobranza_estado_carga", { _marca: data.marca }),
            ]);
            if (facturas.error) throw facturas.error;
            if (estado.error) throw estado.error;
            responder({ type: "cobranza-datos", rows: facturas.data ?? [], estado: estado.data?.[0] ?? null, puedeSubir: puedeOperar, puedeEnviar: puedeOperar });
            return;
          }
          if (typeof data.reqId !== "string") throw new Error("Solicitud inválida");
          if (!puedeOperar) throw new Error("No tienes permiso para esta acción");
          if (data.type === "cobranza-guardar") {
            if (!Array.isArray(data.rows) || typeof data.corte !== "string") throw new Error("Datos de carga inválidos");
            const { error } = await (supabase as any).rpc("cobranza_guardar_facturas", { _marca: data.marca, _corte: data.corte, _rows: data.rows });
            if (error) throw error;
            responder({ type: responseType, reqId: data.reqId, ok: true });
          } else if (data.type === "cobranza-destinatarios") {
            const { data: items, error } = await (supabase as any).rpc("cobranza_destinatarios", { _marca: data.marca });
            if (error) throw error;
            responder({ type: responseType, reqId: data.reqId, ok: true, items: items ?? [] });
          } else if (data.type === "cobranza-enviar") {
            const { data: result, error } = await supabase.functions.invoke("cobranza-enviar", { body: data });
            if (error) {
              if (error instanceof FunctionsHttpError) {
                const details = await error.context.json();
                throw new Error(details.error || error.message);
              }
              throw error;
            }
            responder({ type: responseType, reqId: data.reqId, ok: result?.ok === true, error: result?.error });
          }
        } catch (error) {
          console.error(error);
          if (data.type !== "cobranza-listo") {
            responder({ type: responseType, reqId: data.reqId, ok: false, error: error instanceof Error ? error.message : (error as { message?: string })?.message || "Error al procesar la solicitud" });
          }
        }
      };
      if (["cobranza-listo", "cobranza-guardar", "cobranza-destinatarios", "cobranza-enviar"].includes(data.type)) void procesar();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [marca, access.canView, puedeOperar]);

  const cambiarMarca = (nueva: "lumaggs" | "galsa") => {
    setMarca(nueva);
    setHeight("calc(100vh - 8rem)");
  };

  if (access.isLoading || authLoading) {
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
