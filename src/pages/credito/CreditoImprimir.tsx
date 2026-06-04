import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTokens, renderTemplate, templateKeyForFirma, PRINT_STYLES, TEMPLATE_LABELS, TemplateKey, LFPIORPI_DEFAULT_HTML } from "@/lib/creditoTemplates";

type RenderedDoc = { html: string; entidad: "lumaggs" | "galsa"; titulo: string };

export default function CreditoImprimir() {
  const { id, firmaKey } = useParams<{ id: string; firmaKey: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<RenderedDoc[]>([]);
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

        // firmaKey puede ser un solo key o varios separados por coma (para "Generar Todos")
        const requestedKeys = (firmaKey || "").split(",").map((k) => k.trim()).filter(Boolean);
        if (requestedKeys.length === 0) throw new Error("No se especificó ningún documento");

        const rendered: RenderedDoc[] = [];
        for (const rawKey of requestedKeys) {
          let baseFirmaKey = rawKey;
          let entidadOverride: "lumaggs" | "galsa" | null = null;
          if (baseFirmaKey.startsWith("solicitud-")) {
            const suf = baseFirmaKey.slice("solicitud-".length);
            if (suf === "lumaggs" || suf === "galsa") entidadOverride = suf;
            baseFirmaKey = "solicitud";
          }

          const tplKey: TemplateKey | null = templateKeyForFirma(baseFirmaKey, form);
          if (!tplKey) continue;

          let entidad: "lumaggs" | "galsa";
          if (entidadOverride) {
            entidad = entidadOverride;
          } else {
            const f: any = form;
            const solL = !!f.solicita_lumaggs;
            const solG = !!f.solicita_galsa;
            const mL = Number(f.monto_solicitado_lumaggs ?? 0);
            const mG = Number(f.monto_solicitado_galsa ?? 0);
            if (solL && solG) entidad = mG > mL ? "galsa" : "lumaggs";
            else if (solG) entidad = "galsa";
            else if (solL) entidad = "lumaggs";
            else {
              const ev = company?.empresa_vendedora as string | undefined;
              entidad = (ev || "").toLowerCase().includes("galsa") ? "galsa" : "lumaggs";
            }
          }

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
          let tpl =
            (tpls || []).find((t: any) => t.entidad === entidad) ||
            (tpls || []).find((t: any) => t.entidad === "ambas") ||
            (tpls || [])[0];
          // Fallback embebido para "Recursos de Procedencia Lícita" cuando no hay
          // plantilla configurada en base de datos.
          if (!tpl && tplKey === "lfpiorpi") {
            tpl = {
              entidad,
              contenido_html: LFPIORPI_DEFAULT_HTML,
              header_html: "",
              footer_html: "",
            };
          }
          if (!tpl) continue;

          const tokens = buildTokens(formForTokens, companyForTokens);
          const body = renderTemplate(tpl.contenido_html || "", tokens);
          const header = renderTemplate(tpl.header_html || "", tokens);
          const footer = renderTemplate(tpl.footer_html || "", tokens);

          rendered.push({
            html: `${header}${body}${footer}`,
            entidad,
            titulo: `${TEMPLATE_LABELS[tplKey]}`,
          });
        }

        if (rendered.length === 0) throw new Error("No hay formatos configurados para los documentos solicitados");

        const razon = buildTokens(form as any, company).razon_social;
        setTitulo(rendered.length === 1 ? `${rendered[0].titulo} · ${razon}` : `Documentos de crédito · ${razon}`);
        setDocs(rendered);
      } catch (e: any) {
        setError(e?.message || "Error al cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, firmaKey]);

  useEffect(() => {
    if (!loading && !error && docs.length > 0) {
      document.title = titulo || "Documento de crédito";
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, error, docs, titulo]);

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
        /* Refuerzo por marca: las plantillas inyectan <style> globales que se pisan entre sí
           cuando se imprimen varios documentos. Forzamos colores por marca con alta especificidad. */
        .doc-page.brand-lumaggs .section-title { background-color: #1d4ed8 !important; color: #fff !important; }
        .doc-page.brand-galsa   .section-title { background-color: #b91c1c !important; color: #fff !important; }
        .doc-page.brand-lumaggs .header { border-bottom-color: #1d4ed8 !important; }
        .doc-page.brand-galsa   .header { border-bottom-color: #b91c1c !important; }
        .doc-page.brand-lumaggs .header-title .empresa { color: #1d4ed8 !important; }
        .doc-page.brand-galsa   .header-title .empresa { color: #b91c1c !important; }
        .doc-page.brand-lumaggs table.kv th, .doc-page.brand-lumaggs table.kv td,
        .doc-page.brand-lumaggs table.grid th, .doc-page.brand-lumaggs table.grid td {
          border-color: #bfdbfe !important;
        }
        .doc-page.brand-galsa table.kv th, .doc-page.brand-galsa table.kv td,
        .doc-page.brand-galsa table.grid th, .doc-page.brand-galsa table.grid td {
          border-color: #fecaca !important;
        }
      `}</style>
      <div className="print-toolbar">
        <Button size="sm" onClick={() => window.print()}>Imprimir</Button>
        <Button size="sm" variant="outline" onClick={() => window.close()}>Cerrar</Button>
      </div>
      {docs.map((d, i) => (
        <div
          key={i}
          className={`doc-page brand-${d.entidad}`}
          style={i < docs.length - 1 ? { pageBreakAfter: "always", breakAfter: "page" } : undefined}
          dangerouslySetInnerHTML={{ __html: d.html }}
        />
      ))}
    </>
  );
}