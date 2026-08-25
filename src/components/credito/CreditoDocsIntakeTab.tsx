import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FileText, Trash2, ExternalLink, Loader2, Check } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface IntakeRow {
  id: string;
  credit_request_id: string | null;
  folio_detectado: string | null;
  doc_type_sugerido_id: string | null;
  confianza_ia: string | null;
  storage_path: string;
  nombre_archivo: string | null;
  mime_type: string | null;
  estatus: string;
  remitente_email: string | null;
  asunto_email: string | null;
  resend_email_id: string | null;
  extraccion_raw: any;
  extraccion_error: string | null;
  created_at: string;
}

const CONFIANZA_COLOR: Record<string, string> = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  baja: "bg-red-50 text-red-700 border-red-200",
};

export function CreditoDocsIntakeTab() {
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["credito-docs-intake-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credito_docs_intake")
        .select(
          "id,credit_request_id,folio_detectado,doc_type_sugerido_id,confianza_ia,storage_path,nombre_archivo,mime_type,estatus,remitente_email,asunto_email,resend_email_id,extraccion_raw,extraccion_error,created_at"
        )
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as IntakeRow[];
    },
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["credit-doc-types-activos-intake"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_doc_types")
        .select("id,nombre")
        .eq("is_active", true)
        .order("nombre");
      if (error) throw error;
      return (data || []) as { id: string; nombre: string }[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["credit-requests-intake-select"],
    queryFn: async () => {
      return await fetchAllRows<any>((from, to) =>
        supabase
          .from("credit_requests")
          .select("id, folio, companies(name)")
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando documentos...</p>;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay documentos pendientes de clasificar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <DocIntakeCard
          key={r.id}
          row={r}
          docTypes={docTypes}
          requests={requests as any[]}
          onDone={() => refetch()}
        />
      ))}
    </div>
  );
}

function DocIntakeCard({
  row,
  docTypes,
  requests,
  onDone,
}: {
  row: IntakeRow;
  docTypes: { id: string; nombre: string }[];
  requests: any[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [requestId, setRequestId] = useState(row.credit_request_id || "");
  const [docTypeId, setDocTypeId] = useState(row.doc_type_sugerido_id || "");
  const [saving, setSaving] = useState(false);

  const isImage = (row.mime_type || "").startsWith("image/");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.storage
        .from("credit-docs")
        .createSignedUrl(row.storage_path, 3600);
      if (active) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [row.storage_path]);

  const razon = row.extraccion_raw?.razon as string | undefined;

  const handleAplicar = async () => {
    if (!requestId) {
      toast.error("Selecciona la solicitud de crédito");
      return;
    }
    if (!docTypeId) {
      toast.error("Selecciona el tipo de documento");
      return;
    }
    setSaving(true);
    const { error: insErr } = await supabase.from("credit_request_docs").insert({
      credit_request_id: requestId,
      doc_type_id: docTypeId,
      party_id: null,
      url_archivo: row.storage_path,
      nombre_archivo: row.nombre_archivo,
      tipo_archivo: row.mime_type,
      estado: "recibido" as any,
      visibilidad: "publica" as any,
      subido_por_cliente: true,
      metadata: {
        fuente: "email",
        resend_email_id: row.resend_email_id,
        remitente_email: row.remitente_email,
      },
    } as any);
    if (insErr) {
      setSaving(false);
      toast.error("No se pudo aplicar: " + insErr.message);
      return;
    }
    const { error: updErr } = await supabase
      .from("credito_docs_intake")
      .update({
        estatus: "aplicado" as any,
        credit_request_id: requestId,
        doc_type_sugerido_id: docTypeId,
        clasificado_por: user?.id ?? null,
        clasificado_at: new Date().toISOString(),
      } as any)
      .eq("id", row.id);
    setSaving(false);
    if (updErr) {
      toast.error("Documento aplicado, pero no se pudo actualizar el registro: " + updErr.message);
      return;
    }
    toast.success("Documento aplicado al expediente");
    onDone();
  };

  const handleDescartar = async () => {
    if (!confirm("¿Descartar este documento?")) return;
    const { error } = await supabase
      .from("credito_docs_intake")
      .update({ estatus: "descartado" as any })
      .eq("id", row.id);
    if (error) {
      toast.error("No se pudo descartar: " + error.message);
      return;
    }
    toast.success("Documento descartado");
    onDone();
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-5">
          {/* Preview */}
          <div className="md:w-48 shrink-0 space-y-2">
            {isImage && signedUrl ? (
              <img
                src={signedUrl}
                alt={row.nombre_archivo || "Documento"}
                className="w-full h-40 object-cover rounded-md border cursor-zoom-in"
                onClick={() => setZoomOpen(true)}
              />
            ) : (
              <div className="w-full h-40 rounded-md border bg-muted/30 flex flex-col items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-muted-foreground/60" />
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1"
                  >
                    Ver archivo <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground truncate" title={row.nombre_archivo || ""}>
              {row.nombre_archivo || "Sin nombre"}
            </p>
            <p className="text-[10px] text-muted-foreground">{formatDate(row.created_at)}</p>
          </div>

          {/* Datos */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                {row.folio_detectado || "Sin folio detectado"}
              </Badge>
              {row.extraccion_error ? (
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                  IA no pudo clasificar
                </Badge>
              ) : row.confianza_ia ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-widest ${CONFIANZA_COLOR[row.confianza_ia] || ""}`}
                >
                  Confianza {row.confianza_ia}
                </Badge>
              ) : null}
              {row.remitente_email && (
                <span className="text-[11px] text-muted-foreground">{row.remitente_email}</span>
              )}
            </div>

            {row.asunto_email && (
              <p className="text-xs text-muted-foreground font-light">{row.asunto_email}</p>
            )}
            {razon && <p className="text-[11px] text-muted-foreground font-light">{razon}</p>}

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide font-medium">
                  Solicitud de crédito *
                </Label>
                <SearchableSelect
                  value={requestId}
                  onValueChange={setRequestId}
                  options={requests.map((r) => ({
                    value: r.id,
                    label: `${r.folio || "Sin folio"} — ${(r.companies as any)?.name || "Sin empresa"}`,
                  }))}
                  placeholder="Buscar solicitud..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide font-medium">
                  Tipo de documento *
                </Label>
                <SearchableSelect
                  value={docTypeId}
                  onValueChange={setDocTypeId}
                  options={docTypes.map((d) => ({ value: d.id, label: d.nombre }))}
                  placeholder="Buscar tipo..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleDescartar} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1.5" />Descartar
              </Button>
              <Button size="sm" onClick={handleAplicar} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                Aplicar al expediente
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-2">
          <img src={signedUrl || undefined} alt={row.nombre_archivo || "Documento"} className="w-full h-auto rounded" />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
