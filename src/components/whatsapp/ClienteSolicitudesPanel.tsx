import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FileText, Loader2, Plus, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createCotizacionDraft } from "@/lib/createCotizacionDraft";
import { AssignListaPreciosDialog } from "./AssignListaPreciosDialog";
import { NuevaSolicitudDialog } from "./NuevaSolicitudDialog";
import { ProductMultiPicker, type ProductOption } from "./ProductMultiPicker";

interface Props {
  companyId: string;
  contactoId?: string | null;
  conversationId?: string | null;
}

type SolicitudRow = {
  id: string;
  titulo: string | null;
  estatus: "abierta" | "cotizada" | "cerrada";
  documento_id: string | null;
  created_at: string;
  empresa_vendedora: "lumaggs_chevron" | "galsa_phillips66" | null;
  lineas: { id: string; producto_id: string; cantidad: number; productos: { id: string; codigo: string; nombre_producto: string } | null }[];
};

function statusBadgeVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "cotizada") return "default";
  if (s === "cerrada") return "outline";
  return "secondary";
}

export function ClienteSolicitudesPanel({ companyId, contactoId, conversationId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sb: any = supabase;

  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [listaDialog, setListaDialog] = useState<null | { onContinue: () => void }>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // "interest" or solicitud id

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

  // Solicitudes existentes
  const { data: solicitudes = [], refetch: refetchSolicitudes } = useQuery<SolicitudRow[]>({
    queryKey: ["cliente-solicitudes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await sb
        .from("cliente_solicitudes")
        .select("id, titulo, estatus, documento_id, created_at, empresa_vendedora, lineas:cliente_solicitud_lineas(id, producto_id, cantidad, productos(id, codigo, nombre_producto))")
        .eq("empresa_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as SolicitudRow[];
    },
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
      // Si vino de una solicitud, marcarla como cotizada y vincular
      if (source !== "interest") {
        await sb.from("cliente_solicitudes")
          .update({ estatus: "cotizada", documento_id: docId })
          .eq("id", source);
        qc.invalidateQueries({ queryKey: ["cliente-solicitudes", companyId] });
      } else {
        setInterestIds([]);
      }
      toast.success("Cotización creada");
      const back = conversationId ? `&back=whatsapp&conversation_id=${conversationId}` : "";
      navigate(`/documents/${docId}/edit?edit=1${back}`);
    } catch (e: any) {
      toast.error("No se pudo crear la cotización: " + (e?.message || "error"));
    } finally {
      setCreatingFor(null);
    }
  };

  const cerrarSolicitud = async (id: string) => {
    await sb.from("cliente_solicitudes").update({ estatus: "cerrada" }).eq("id", id);
    refetchSolicitudes();
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

      {/* Bloque 2: solicitudes acumuladas */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-muted-foreground">Solicitudes del cliente</div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNuevaOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Nueva
          </Button>
        </div>
        {solicitudes.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Sin solicitudes registradas.</div>
        ) : (
          <div className="space-y-1.5">
            {solicitudes.map((s) => {
              const expanded = expandedId === s.id;
              const fecha = new Date(s.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
              return (
                <div key={s.id} className="rounded-md border bg-card/50">
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 flex items-center gap-2 text-left hover:bg-muted/40"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                  >
                    {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {s.titulo || `Solicitud ${fecha}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fecha} · {s.lineas.length} producto{s.lineas.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(s.estatus)} className="text-[10px] capitalize">{s.estatus}</Badge>
                  </button>
                  {expanded && (
                    <div className="px-2 pb-2 space-y-2 border-t">
                      <ul className="text-xs space-y-0.5 mt-2">
                        {s.lineas.map((l) => (
                          <li key={l.id} className="truncate text-muted-foreground">
                            • {l.productos?.codigo} — {l.productos?.nombre_producto}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-1.5">
                        {s.documento_id ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => navigate(`/documents/${s.documento_id}/edit`)}>
                            Ver cotización
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs flex-1"
                            disabled={creatingFor === s.id || !s.lineas.length}
                            onClick={() => ensureListaThen(() =>
                              handleCreateCotizacion(s.lineas.map((l) => l.producto_id), (s.empresa_vendedora || defaultBrand), s.id)
                            )}
                          >
                            {creatingFor === s.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                            + Cotización
                          </Button>
                        )}
                        {s.estatus !== "cerrada" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cerrarSolicitud(s.id)}>
                            Cerrar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NuevaSolicitudDialog
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        empresaId={companyId}
        contactoId={contactoId}
        conversationId={conversationId}
        empresaVendedora={defaultBrand}
        productos={productos}
        userId={user?.id}
        onCreated={() => refetchSolicitudes()}
      />

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