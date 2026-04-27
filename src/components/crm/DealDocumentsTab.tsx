import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ShoppingCart, Receipt, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

type TipoDoc = "cotizacion" | "pedido" | "factura";

interface DocRow {
  id: string;
  tipo_documento: TipoDoc;
  numero_cotizacion: string | null;
  numero_pedido: string | null;
  numero_factura: string | null;
  fecha_documento: string;
  total: number;
  saldo_pendiente_cobranza: number | null;
  estatus_cotizacion: string | null;
  estatus_pedido: string | null;
  estatus_factura: string | null;
  estado_cobranza: string | null;
  empresa_id: string | null;
  ejecutivo_venta_id: string | null;
  companies?: { id: string; name: string } | null;
  ejecutivo?: { user_id: string; full_name: string | null } | null;
}

const TYPE_META: Record<TipoDoc, { label: string; icon: typeof FileText; color: string }> = {
  cotizacion: { label: "Cotizaciones", icon: FileText, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  pedido: { label: "Pedidos", icon: ShoppingCart, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  factura: { label: "Facturas", icon: Receipt, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
};

function getNumero(d: DocRow): string {
  return (
    d.numero_factura ||
    d.numero_pedido ||
    d.numero_cotizacion ||
    d.id.slice(0, 8)
  );
}

function getEstatus(d: DocRow): string {
  if (d.tipo_documento === "factura") return d.estatus_factura || d.estado_cobranza || "—";
  if (d.tipo_documento === "pedido") return d.estatus_pedido || "—";
  return d.estatus_cotizacion || "—";
}

export function DealDocumentsTab({ dealId }: { dealId: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TipoDoc | "all">("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["crm_deal_documents", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, tipo_documento, numero_cotizacion, numero_pedido, numero_factura, fecha_documento, total, saldo_pendiente_cobranza, estatus_cotizacion, estatus_pedido, estatus_factura, estado_cobranza, empresa_id, ejecutivo_venta_id, companies:empresa_id (id, name)"
        )
        .eq("negocio_id", dealId)
        .order("fecha_documento", { ascending: false });
      if (error) throw error;

      // Resolve ejecutivo names in a second batch
      const ejecutivoIds = Array.from(
        new Set(((data ?? []) as any[]).map((r) => r.ejecutivo_venta_id).filter(Boolean)),
      );
      let ejecutivos: Record<string, string | null> = {};
      if (ejecutivoIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ejecutivoIds);
        ejecutivos = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.user_id, p.full_name]),
        );
      }
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        ejecutivo: r.ejecutivo_venta_id
          ? { user_id: r.ejecutivo_venta_id, full_name: ejecutivos[r.ejecutivo_venta_id] ?? null }
          : null,
      })) as DocRow[];
    },
  });

  const counts = useMemo(() => {
    const c = { cotizacion: 0, pedido: 0, factura: 0 };
    (documents ?? []).forEach((d) => {
      c[d.tipo_documento] = (c[d.tipo_documento] ?? 0) + 1;
    });
    return c;
  }, [documents]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    if (filter === "all") return documents;
    return documents.filter((d) => d.tipo_documento === filter);
  }, [documents, filter]);

  return (
    <div className="space-y-4">
      {/* Filtros tipo Documentos */}
      <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1 w-fit">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "ghost"}
          className="rounded-full h-7 text-xs"
          onClick={() => setFilter("all")}
        >
          Todos ({documents?.length ?? 0})
        </Button>
        {(["cotizacion", "pedido", "factura"] as TipoDoc[]).map((t) => {
          const Icon = TYPE_META[t].icon;
          return (
            <Button
              key={t}
              size="sm"
              variant={filter === t ? "default" : "ghost"}
              className="rounded-full h-7 text-xs gap-1"
              onClick={() => setFilter(t)}
            >
              <Icon className="h-3 w-3" />
              {TYPE_META[t].label} ({counts[t]})
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sin documentos relacionados con este negocio.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const meta = TYPE_META[d.tipo_documento];
            const Icon = meta.icon;
            return (
              <div
                key={d.id}
                className="rounded-lg border bg-card p-3 hover:bg-accent/50 transition cursor-pointer"
                onClick={() => navigate(`/documents/${d.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${meta.color} flex-shrink-0`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{getNumero(d)}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {getEstatus(d)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {d.companies?.name || "—"} · {formatDate(d.fecha_documento)}
                      </div>
                      {d.ejecutivo?.full_name && (
                        <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                          Ejec.: {d.ejecutivo.full_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold">{formatCurrency(Number(d.total) || 0)}</div>
                    {d.tipo_documento === "factura" && (
                      <div className="text-[11px] text-muted-foreground">
                        Saldo: {formatCurrency(Number(d.saldo_pendiente_cobranza) || 0)}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 mt-1 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/documents/${d.id}`);
                      }}
                    >
                      Abrir <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
