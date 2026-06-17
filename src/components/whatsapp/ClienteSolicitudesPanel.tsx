import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ListChecks, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createCotizacionDraft } from "@/lib/createCotizacionDraft";
import { AssignListaPreciosDialog } from "./AssignListaPreciosDialog";
import { ProductMultiPicker, type ProductOption } from "./ProductMultiPicker";

interface Props {
  companyId: string;
  contactoId?: string | null;
  conversationId?: string | null;
  onSendDocPdf?: (docId: string, pdfUrl: string, label: string) => Promise<void> | void;
}

export function ClienteSolicitudesPanel({ companyId, contactoId, conversationId, onSendDocPdf }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sb: any = supabase;

  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [listaDialog, setListaDialog] = useState<null | { onContinue: () => void }>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // "interest"
  const [sendingPdfId, setSendingPdfId] = useState<string | null>(null);

  // Company info (lista_precios + brand)
  const { data: company } = useQuery({
    queryKey: ["wa-cliente-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await sb
        .from("companies")
        .select("id, name, lista_precios, empresa_marcas(empresa_vendedora)")
        .eq("id", companyId)
        .single();
      return data;
    },
  });

  // Ejecutivo asignado (primero)
  const { data: ejecutivoId } = useQuery({
    queryKey: ["wa-cliente-ejec", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await sb
        .from("company_ejecutivos")
        .select("user_id")
        .eq("company_id", companyId)
        .limit(1);
      return data?.[0]?.user_id ?? null;
    },
  });

  // Plaza por defecto: la del ejecutivo asignado, o del usuario actual
  const { data: defaultPlazaId } = useQuery<string | null>({
    queryKey: ["wa-cliente-plaza", ejecutivoId || user?.id || null],
    enabled: !!(ejecutivoId || user?.id),
    queryFn: async () => {
      const uid = ejecutivoId || user?.id;
      if (!uid) return null;
      const { data } = await sb.from("profiles").select("plaza_id").eq("id", uid).maybeSingle();
      if (data?.plaza_id) return data.plaza_id;
      const { data: pd } = await sb.from("plazas").select("id").eq("nombre", "Plaza Predeterminada").maybeSingle();
      return pd?.id ?? null;
    },
  });

  // Cotizaciones con PDF (para reenviar por WhatsApp)
  const { data: cotizacionesPdf = [] } = useQuery<Array<{ id: string; numero_cotizacion: string | null; pdf_url: string; created_at: string; total: number | null }>>({
    queryKey: ["wa-cliente-cot-pdf", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await sb
        .from("documentos")
        .select("id, numero_cotizacion, pdf_url, created_at, total")
        .eq("empresa_id", companyId)
        .eq("tipo_documento", "cotizacion")
        .not("pdf_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any;
    },
  });

  // Catálogo de productos
  const { data: productos = [] } = useQuery<ProductOption[]>({
    queryKey: ["wa-cliente-productos"],
    queryFn: async () => {
      const { data } = await sb
        .from("productos")
        .select("id, codigo, nombre_producto, presentaciones(nombre)")
        .eq("is_active", true)
        .order("codigo");
      return (data || []).map((p: any) => ({
        id: p.id,
        codigo: p.codigo,
        nombre_producto: p.nombre_producto,
        presentacion: p.presentaciones?.nombre,
      })) as ProductOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const defaultBrand = useMemo<"lumaggs_chevron" | "galsa_phillips66">(() => {
    const m = company?.empresa_marcas?.[0]?.empresa_vendedora;
    return (m === "galsa_phillips66" ? "galsa_phillips66" : "lumaggs_chevron");
  }, [company]);

  const ensureListaThen = (cb: () => void) => {
    if (company?.lista_precios) { cb(); return; }
    setListaDialog({ onContinue: cb });
  };

  const handleCreateCotizacion = async (productoIds: string[], brand: "lumaggs_chevron" | "galsa_phillips66", source: string) => {
    if (!productoIds.length) { toast.error("No hay productos"); return; }
    setCreatingFor(source);
    try {
      const docId = await createCotizacionDraft({
        empresaId: companyId,
        contactoId: contactoId || null,
        productoIds,
        empresaVendedora: brand,
        ejecutivoId: ejecutivoId || null,
        plazaId: defaultPlazaId || null,
        userId: user?.id,
      });
      toast.success("Cotización creada");
      const back = conversationId ? `&back=whatsapp&conversation_id=${conversationId}` : "";
      navigate(`/documents/${docId}/edit?edit=1${back}`);
    } catch (e: any) {
      toast.error("No se pudo crear la cotización: " + (e?.message || "error"));
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bloque 1: productos de interés */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <ListChecks className="h-3 w-3" /> Productos de interés (a cotizar)
        </div>
        <ProductMultiPicker productos={productos} value={interestIds} onChange={setInterestIds} placeholder="Agregar producto..." />
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!interestIds.length || creatingFor === "interest"}
          onClick={() => ensureListaThen(() => handleCreateCotizacion(interestIds, defaultBrand, "interest"))}
        >
          {creatingFor === "interest" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
          + Cotización
        </Button>
      </div>

      {/* Bloque 2: cotizaciones PDF para reenviar por WhatsApp */}
      {onSendDocPdf && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Enviar cotización PDF
          </div>
          {cotizacionesPdf.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">Sin cotizaciones con PDF.</div>
          ) : (
            <div className="space-y-1">
              {cotizacionesPdf.map((d) => {
                const fecha = new Date(d.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
                const label = d.numero_cotizacion ? `Cotización ${d.numero_cotizacion}` : `Cotización ${fecha}`;
                const isSending = sendingPdfId === d.id;
                return (
                  <div key={d.id} className="flex items-center gap-1.5 rounded-md border bg-card/50 px-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{label}</div>
                      <div className="text-[10px] text-muted-foreground">{fecha}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isSending}
                      onClick={async () => {
                        setSendingPdfId(d.id);
                        try { await onSendDocPdf(d.id, d.pdf_url, label); }
                        finally { setSendingPdfId(null); }
                      }}
                    >
                      {isSending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                      Enviar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AssignListaPreciosDialog
        open={!!listaDialog}
        onOpenChange={(v) => { if (!v) setListaDialog(null); }}
        companyId={companyId}
        companyName={company?.name}
        onAssigned={() => {
          qc.invalidateQueries({ queryKey: ["wa-cliente-company", companyId] });
          const cb = listaDialog?.onContinue;
          setListaDialog(null);
          // dar tiempo a que la query refresque lista_precios
          setTimeout(() => cb?.(), 100);
        }}
      />
    </div>
  );
}