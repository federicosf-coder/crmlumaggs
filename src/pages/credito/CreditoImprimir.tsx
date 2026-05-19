import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTokens, renderTemplate, templateKeyForFirma, PRINT_STYLES, TEMPLATE_LABELS, TemplateKey } from "@/lib/creditoTemplates";

export default function CreditoImprimir() {
  const { id, firmaKey } = useParams<{ id: string; firmaKey: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");
  const [titulo, setTitulo] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { data: form, error: e1 } = await supabase
          .from("credit_requests")
          .select("*, companies(*)")
          .eq("id", id!)
          .maybeSingle();
        if (e1 || !form) throw new Error(e1?.message || "Crédito no encontrado");

        const company = (form as any).companies || {};
        const tplKey: TemplateKey | null = templateKeyForFirma(firmaKey || "", form);
        if (!tplKey) throw new Error("Formato no disponible para esta firma");

        const empresaVendedora = company?.empresa_vendedora as string | undefined;
        const entidad = (empresaVendedora || "").toLowerCase().includes("galsa") ? "galsa" : "lumaggs";

        const { data: tpls, error: e2 } = await (supabase as any)
          .from("credit_doc_templates")
          .select("*")
          .eq("key", tplKey)
          .eq("activo", true);
        if (e2) throw new Error(e2.message);
        const tpl =
          (tpls || []).find((t: any) => t.entidad === entidad) ||
          (tpls || []).find((t: any) => t.entidad === "ambas") ||
          (tpls || [])[0];
        if (!tpl) throw new Error("No hay formato configurado");

        const tokens = buildTokens(form, company);
        const body = renderTemplate(tpl.contenido_html || "", tokens);
        const header = renderTemplate(tpl.header_html || "", tokens);
        const footer = renderTemplate(tpl.footer_html || "", tokens);

        setTitulo(`${TEMPLATE_LABELS[tplKey]} · ${tokens.razon_social}`);
        setHtml(`${header}${body}${footer}`);
      } catch (e: any) {
        setError(e?.message || "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, firmaKey]);

  useEffect(() => {
    if (!loading && !error && html) {
      document.title = titulo || "Documento de crédito";
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, error, html, titulo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-lg font-medium">No se pudo generar el documento</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" onClick={() => window.close()}>Cerrar</Button>
      </div>
    );
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <style>{`
        .print-toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10; }
        @media print { .print-toolbar { display: none !important; } body { background: white; } }
        body { background: #f4f4f5; }
        .doc-page { background: white; max-width: 8.5in; margin: 24px auto; padding: 0.75in 0.75in; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        @media print { .doc-page { box-shadow: none; margin: 0; padding: 0; max-width: none; } }
      `}</style>
      <div className="print-toolbar">
        <Button size="sm" onClick={() => window.print()}>Imprimir</Button>
        <Button size="sm" variant="outline" onClick={() => window.close()}>Cerrar</Button>
      </div>
      <div className="doc-page" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}