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
  const [entidadActual, setEntidadActual] = useState<"lumaggs" | "galsa">("lumaggs");

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

        // firmaKey puede ser "solicitud-lumaggs" o "solicitud-galsa" → extraer entidad
        let baseFirmaKey = firmaKey || "";
        let entidadOverride: "lumaggs" | "galsa" | null = null;
        if (baseFirmaKey.startsWith("solicitud-")) {
          const suf = baseFirmaKey.slice("solicitud-".length);
          if (suf === "lumaggs" || suf === "galsa") entidadOverride = suf;
          baseFirmaKey = "solicitud";
        }

        const tplKey: TemplateKey | null = templateKeyForFirma(baseFirmaKey, form);
        if (!tplKey) throw new Error("Formato no disponible para esta firma");

        let entidad: "lumaggs" | "galsa";
        if (entidadOverride) {
          entidad = entidadOverride;
        } else {
          // Para firmas comunes (buro, confidencialidad, subsistencia) usar la empresa
          // marcada en "Crédito solicitado por empresa". Si están las dos, usar la del
          // monto solicitado mayor. Fallback a empresa_vendedora del cliente.
          const f: any = form;
          const solL = !!f.solicita_lumaggs;
          const solG = !!f.solicita_galsa;
          const mL = Number(f.monto_solicitado_lumaggs ?? 0);
          const mG = Number(f.monto_solicitado_galsa ?? 0);
          if (solL && solG) {
            entidad = mG > mL ? "galsa" : "lumaggs";
          } else if (solG) {
            entidad = "galsa";
          } else if (solL) {
            entidad = "lumaggs";
          } else {
            const empresaVendedora = company?.empresa_vendedora as string | undefined;
            entidad = (empresaVendedora || "").toLowerCase().includes("galsa") ? "galsa" : "lumaggs";
          }
        }

        // Si se imprime una solicitud específica por empresa, usa su monto en los tokens
        const formForTokens: any = { ...form };
        if (entidadOverride) {
          const montoEntidad = entidadOverride === "lumaggs"
            ? (form as any).monto_solicitado_lumaggs
            : (form as any).monto_solicitado_galsa;
          if (montoEntidad != null) formForTokens.monto_solicitado = montoEntidad;
        }
        const companyForTokens: any = { ...company, empresa_vendedora: entidad };

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

        const tokens = buildTokens(formForTokens, companyForTokens);
        const body = renderTemplate(tpl.contenido_html || "", tokens);
        const header = renderTemplate(tpl.header_html || "", tokens);
        const footer = renderTemplate(tpl.footer_html || "", tokens);

        setTitulo(`${TEMPLATE_LABELS[tplKey]} · ${tokens.razon_social}`);
        setEntidadActual(entidad);
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
        .brand-banner { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10pt 0 14pt; margin: 0 0 16pt; border-top: 3pt solid var(--brand); border-bottom: 1pt solid var(--brand); }
        .brand-banner .brand-name { font-size: 22pt; font-weight: 800; letter-spacing: 3px; color: var(--brand); }
        .brand-banner .brand-sub { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2pt; }
        .doc-page.brand-lumaggs { --brand: #1d4ed8; }
        .doc-page.brand-galsa   { --brand: #b91c1c; }
        .doc-page.brand-lumaggs h2 { border-bottom-color: #1d4ed8 !important; color: #1d4ed8; }
        .doc-page.brand-galsa   h2 { border-bottom-color: #b91c1c !important; color: #b91c1c; }
        .doc-page.brand-lumaggs table.kv th, .doc-page.brand-lumaggs table.grid th { background: #eff6ff !important; color: #1d4ed8; }
        .doc-page.brand-galsa   table.kv th, .doc-page.brand-galsa   table.grid th { background: #fef2f2 !important; color: #b91c1c; }
        .doc-page.brand-lumaggs .doc-title { color: #1d4ed8; }
        .doc-page.brand-galsa   .doc-title { color: #b91c1c; }
      `}</style>
      <div className="print-toolbar">
        <Button size="sm" onClick={() => window.print()}>Imprimir</Button>
        <Button size="sm" variant="outline" onClick={() => window.close()}>Cerrar</Button>
      </div>
      <div className={`doc-page brand-${entidadActual}`} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}